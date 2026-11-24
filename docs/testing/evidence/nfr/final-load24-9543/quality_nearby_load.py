"""NFR-T01 baseline on a disposable local database (never the live directory).

Requires the review PostgreSQL server on 5439, pinned k6 Docker image and uvicorn.
The API binds to loopback, records an explicit worker count (default one), and
uses no reload or uncommitted application code. A 60-second warm-up precedes a
separate 300-second measurement. Do not run
other scans/tests concurrently: host/DB resource samples are retained for review.
"""
import argparse
from datetime import datetime, timezone
from contextlib import asynccontextmanager
import ctypes
import json
import multiprocessing
import os
import re
from pathlib import Path
import socket
import subprocess
import sys
from threading import Thread
import time
from urllib.request import urlopen
import uuid

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from psycopg import sql
from src.db import connect
from src.app import create_app
import uvicorn

IMAGE = 'grafana/k6@sha256:3d8e5c7f1d53ec59408c2ffbd9943602a0985ffcbd4a2430ec00f3ffca89796e'


def seed_database(conn):
    for path in sorted((ROOT / 'db/migrations').glob('*.sql')):
        conn.execute(path.read_text(encoding='utf-8'))
    conn.execute("""INSERT INTO toilets
        (id,source,source_id,name,district,latitude,longitude,status,opening_hours,
         has_disabled_access,has_baby_changing,is_free,price_try)
        SELECT md5('smartloo-load82-' || i::text)::uuid, 'load82', i::text,
            'Synthetic load facility ' || i, 'Synthetic district ' || (i % 5),
            40.90 + (i / 100) * 0.004, 28.60 + (i % 100) * 0.008,
            CASE WHEN i % 11=0 THEN NULL WHEN i % 13=0 THEN 'CLOSED'::toilet_status ELSE 'ACTIVE'::toilet_status END,
            CASE WHEN i % 3=0 THEN NULL ELSE '24/7' END,
            CASE WHEN i % 3=0 THEN NULL ELSE i % 3=1 END,
            CASE WHEN i % 4=0 THEN NULL ELSE i % 4=1 END,
            CASE WHEN i % 3=0 THEN NULL ELSE i % 3=1 END,
            CASE WHEN i % 3=1 THEN 0 WHEN i % 3=2 THEN 5 ELSE NULL END
        FROM generate_series(0,9999) AS i""")
    conn.execute('ANALYZE toilets')


def host_sample():
    class Memory(ctypes.Structure):
        _fields_ = [('length', ctypes.c_ulong), ('load', ctypes.c_ulong),
                    *[(key, ctypes.c_ulonglong) for key in
                      ('total_physical','available_physical','total_page','available_page','total_virtual','available_virtual','extended')]]
    memory = Memory()
    memory.length = ctypes.sizeof(memory)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(memory)):
        raise OSError('Cannot sample Windows memory')
    idle, kernel, user = (ctypes.c_ulonglong() for _ in range(3))
    if not ctypes.windll.kernel32.GetSystemTimes(ctypes.byref(idle),ctypes.byref(kernel),ctypes.byref(user)):
        raise OSError('Cannot sample Windows CPU')
    return dict(memory_load_percent=memory.load, total_physical_bytes=memory.total_physical,
                available_physical_bytes=memory.available_physical,
                cpu_100ns=dict(idle=idle.value,kernel=kernel.value,user=user.value),
                driver_process_cpu_seconds=time.process_time())


def serve_worker(listener,ready):
    app=create_app()
    original_lifespan=app.router.lifespan_context
    @asynccontextmanager
    async def lifespan(instance):
        async with original_lifespan(instance):
            ready.set()
            yield
    app.router.lifespan_context=lifespan
    # Match uvicorn's real multi-process Windows loop choice. Proactor sockets
    # cannot be attached to multiple IOCPs; workers>1 selects SelectorEventLoop.
    server=uvicorn.Server(uvicorn.Config(app,workers=2,log_level='warning',access_log=False))
    server.run(sockets=[listener])


def main(run_name='load82',workers=1):
    if workers not in (1,2,3,4):
        raise SystemExit('Use one to four explicitly recorded workers')
    if not re.fullmatch(r'[a-z0-9_-]+',run_name):
        raise SystemExit('Use a simple local run name')
    if os.getenv('SMARTLOO_DB_HOST', '127.0.0.1') not in ('localhost', '127.0.0.1') or os.getenv('SMARTLOO_DB_PORT') != '5439':
        raise SystemExit('Use only the isolated review PostgreSQL server on 5439')
    os.chdir(ROOT)
    out = ROOT / '.venv' / run_name
    out.mkdir(parents=True, exist_ok=True)
    if (out / 'measurement.json').exists():
        raise SystemExit('Keep existing measurements; choose a new evidence directory for a retest')
    subprocess.run(['git','diff','--exit-code','HEAD','--','src','frontend/src','db','tests'],check=True)
    original = os.environ.get('SMARTLOO_DB_NAME')
    name = 'smartloo_load82_' + uuid.uuid4().hex[:12]
    server, thread, listener = None, None, None
    children=[]
    with connect() as conn:
        conn.autocommit = True
        conn.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(name)))
    try:
        os.environ['SMARTLOO_DB_NAME'] = name
        with connect() as conn:
            seed_database(conn)
            count = conn.execute('SELECT count(*) AS n FROM toilets').fetchone()['n']
            assert count == 10000
            indexes = conn.execute("SELECT indexname,indexdef FROM pg_indexes WHERE tablename='toilets'").fetchall()
            versions = conn.execute('SELECT version(), postgis_full_version()').fetchone()
        listener = socket.socket()
        listener.bind(('127.0.0.1', 0))
        port = listener.getsockname()[1]
        origin = f'http://127.0.0.1:{port}'
        if workers==1:
            server = uvicorn.Server(uvicorn.Config(create_app(), log_level='warning', access_log=False))
            thread = Thread(target=server.run, kwargs={'sockets':[listener]}, daemon=True)
            thread.start()
            for _ in range(100):
                if server.started:
                    break
                time.sleep(.1)
            if not server.started:
                raise RuntimeError('Isolated API did not start')
        else:
            listener.listen(2048)
            context=multiprocessing.get_context('spawn')
            readiness=[]
            for _ in range(workers):
                ready=context.Event()
                child=context.Process(target=serve_worker,args=(listener,ready),daemon=True)
                child.start()
                children.append(child)
                readiness.append(ready)
            if not all(ready.wait(timeout=20) for ready in readiness):
                raise RuntimeError('Not all isolated API workers reached startup')
            for attempt in range(30):
                try:
                    with urlopen(origin+'/api/v1/toilets/nearby?lat=41.1&lon=29&radius=1000',timeout=1) as response:
                        if response.status==200:
                            break
                except (OSError,TimeoutError):
                    if any(not child.is_alive() for child in children):
                        raise RuntimeError('An isolated API worker exited during startup') from None
                    time.sleep(.2)
            else:
                raise RuntimeError('Isolated API workers did not start')
        preflight = []
        for query in ('lat=41.1&lon=29&radius=1000', 'lat=41.1&lon=29&radius=1000&is_free=true&open_now=true'):
            with urlopen(origin + '/api/v1/toilets/nearby?' + query, timeout=10) as response:
                body = json.load(response)
                preflight.append(dict(status=response.status,count=body['count']))
        metadata = dict(application_sha=subprocess.check_output(['git','rev-parse','HEAD'], text=True).strip(),
                        start_utc=datetime.now(timezone.utc).isoformat(), records=count,
                        workers=workers, worker_pids=[child.pid for child in children],
                        database_versions=versions, indexes=indexes, preflight=preflight,
                        k6_image=IMAGE, target='isolated loopback API; Windows to Docker PostGIS',
                        logical_cpus=os.cpu_count(), initial_host=host_sample(),
                        sampling='docker stats every 10 seconds', live_directory_modified=False)
        (out / 'environment.json').write_text(json.dumps(metadata, default=str, indent=2), encoding='utf-8')
        probe = out / 'preflight.js'
        probe.write_text("import http from 'k6/http'; import { check } from 'k6'; "
                         "export const options={thresholds:{checks:['rate==1']}}; "
                         "export default function(){ const r=http.get(__ENV.SMARTLOO_LOAD_ORIGIN + "
                         "'/api/v1/toilets/nearby?lat=41.1&lon=29&radius=1000'); "
                         "check(r, {'local API reachable':r=>r.status===200}); }",encoding='utf-8')
        with (out / 'docker-preflight.log').open('w',encoding='utf-8') as log:
            subprocess.run(['docker','run','--rm','-e','K6_NO_USAGE_REPORT=true',
                            '-e',f'SMARTLOO_LOAD_ORIGIN=http://host.docker.internal:{port}',
                            '-v',f'{out}:/evidence',IMAGE,'run','--vus','1','--iterations','1',
                            '/evidence/preflight.js'],stdout=log,stderr=subprocess.STDOUT,timeout=45,check=True)
        results = {}
        for phase, duration in [('warmup','60s'), ('measurement','300s')]:
            command = ['docker','run','--rm','--name','smartloo-load82-k6',
                       '-e','K6_NO_USAGE_REPORT=true',
                       '-e',f'SMARTLOO_LOAD_ORIGIN=http://host.docker.internal:{port}',
                       '-e',f'SMARTLOO_LOAD_DURATION={duration}',
                       '-e',f'SMARTLOO_LOAD_SUMMARY=/evidence/{phase}.json',
                       '-v',f'{ROOT / "scripts"}:/scripts:ro','-v',f'{out}:/evidence',
                       IMAGE,'run','--quiet','/scripts/nearby_load82.js']
            (out / f'{phase}-command.json').write_text(json.dumps(command,indent=2), encoding='utf-8')
            with (out / f'{phase}.log').open('w',encoding='utf-8') as log, (out / f'{phase}-resources.jsonl').open('w',encoding='utf-8') as stats:
                proc = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT)
                deadline = time.monotonic() + (120 if phase == 'warmup' else 360)
                try:
                    while proc.poll() is None:
                        if time.monotonic() > deadline:
                            subprocess.run(['docker','stop','smartloo-load82-k6'], check=False, capture_output=True)
                            raise TimeoutError('Load process exceeded its bounded phase budget')
                        sample = subprocess.run(['docker','stats','--no-stream','--format','{{json .}}',
                                                 'smartloo-pr75-postgis-1','smartloo-load82-k6'], capture_output=True,text=True)
                        stats.write(json.dumps(dict(time=datetime.now(timezone.utc).isoformat(),host=host_sample(),output=sample.stdout))+'\n')
                        stats.flush()
                        time.sleep(10)
                finally:
                    if proc.poll() is None:
                        subprocess.run(['docker','stop','smartloo-load82-k6'],check=False,capture_output=True)
                        proc.wait(timeout=20)
            results[phase] = proc.returncode
            print(f'{phase}: exit {proc.returncode}', flush=True)
            if not (out / f'{phase}.json').exists():
                raise RuntimeError('No load summary: inspect the preserved log before continuing')
        (out / 'exit-codes.json').write_text(json.dumps(results),encoding='utf-8')
        print((out / 'measurement.json').read_text(encoding='utf-8'))
        return results['measurement']
    finally:
        if server:
            server.should_exit=True
        if thread:
            thread.join(timeout=20)
        for child in children:
            if child.is_alive():
                child.terminate()
            child.join(timeout=10)
            if child.is_alive():
                child.kill()
                child.join(timeout=10)
        if listener:
            listener.close()
        if original is None:
            os.environ.pop('SMARTLOO_DB_NAME',None)
        else:
            os.environ['SMARTLOO_DB_NAME']=original
        with connect() as conn:
            conn.autocommit=True
            conn.execute(sql.SQL('DROP DATABASE {} WITH (FORCE)').format(sql.Identifier(name)))


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-name',default='load82')
    parser.add_argument('--workers',type=int,default=1)
    args=parser.parse_args()
    raise SystemExit(main(args.run_name,args.workers))
