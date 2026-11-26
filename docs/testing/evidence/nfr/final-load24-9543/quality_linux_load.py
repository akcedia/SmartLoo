"""NFR-T01 in the locally built Linux API image on the private test DB network.

Build smartloo:review-security24 from this exact committed checkout first. The API has
one uvicorn worker by explicit CLI option, 2 CPU quota and 1 GiB RAM. k6 and API share the test bridge;
the Windows driver only provisions/observes. No cloud hosting is claimed.
"""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import time
from urllib.request import urlopen
import uuid

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
sys.path.insert(0,str(ROOT/'scripts'))
from psycopg import sql
from src.db import connect
from quality_nearby_load import seed_database,host_sample,IMAGE


def main(run_name,workers=2,cpus=2,abort_on_warmup_failure=False):
    if not re.fullmatch('[a-z0-9_-]+',run_name):
        raise SystemExit('Use a simple local run name')
    if os.getenv('SMARTLOO_DB_PORT')!='5439' or os.getenv('SMARTLOO_DB_HOST','127.0.0.1') not in ('localhost','127.0.0.1'):
        raise SystemExit('Only the known loopback test SQL server on 5439 is permitted')
    os.chdir(ROOT)
    out=ROOT/'.venv'/run_name
    out.mkdir(parents=True,exist_ok=True)
    if (out/'environment.json').exists():
        raise SystemExit('Preserve prior evidence; select a new run name')
    subprocess.run(['git','diff','--exit-code','HEAD','--','src','frontend/src','db','tests','requirements-runtime.txt'],check=True)
    revision=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
    info=json.loads(subprocess.check_output(['docker','image','inspect','smartloo:review-security24'],text=True))[0]
    image_revision=info['Config'].get('Labels',{}).get('org.opencontainers.image.revision')
    if not image_revision:
        raise SystemExit('Image revision label required')
    subprocess.run(['git','diff','--exit-code',image_revision,revision,'--','src','frontend','db','tests','requirements-runtime.txt','docker/Dockerfile.cloud'],check=True)
    if image_revision != subprocess.check_output(['git','rev-parse','befd422'],text=True).strip():
        raise SystemExit('Rebuild the API image with this checkout revision label')
    networks=json.loads(subprocess.check_output(['docker','inspect','smartloo-pr75-postgis-1','--format','{{json .NetworkSettings.Networks}}'],text=True))
    if len(networks)!=1:
        raise SystemExit('Do not infer the test network among multiple candidates')
    network=next(iter(networks))
    name='smartloo_load82_'+uuid.uuid4().hex[:12]
    original=os.environ.get('SMARTLOO_DB_NAME')
    api_started=False
    with connect() as conn:
        conn.autocommit=True
        conn.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(name)))
    try:
        os.environ['SMARTLOO_DB_NAME']=name
        with connect() as conn:
            seed_database(conn)
            assert conn.execute('SELECT count(*) AS n FROM toilets').fetchone()['n']==10000
            versions=conn.execute('SELECT version(),postgis_full_version()').fetchone()
            indexes=conn.execute("SELECT indexname,indexdef FROM pg_indexes WHERE tablename='toilets'").fetchall()
        env=dict(SMARTLOO_DB_HOST='smartloo-pr75-postgis-1',SMARTLOO_DB_PORT='5432',SMARTLOO_DB_NAME=name,
                 SMARTLOO_DB_USER=os.getenv('SMARTLOO_DB_USER','smartloo'),
                 SMARTLOO_DB_PASSWORD=os.getenv('SMARTLOO_DB_PASSWORD','smartloo-dev-only'),
                 SMARTLOO_JWT_SECRET=secrets.token_urlsafe(40),SMARTLOO_MONGO_URL='mongodb://host.docker.internal:27019')
        if any('\n' in value or '\r' in value for value in env.values()):
            raise ValueError('Environment values must not contain line breaks')
        env_file=out/'private-api.env'
        env_file.write_text(''.join(key+'='+value+'\n' for key,value in env.items()),encoding='utf-8')
        subprocess.run(['docker','run','-d','--name','smartloo-load82-api','--label','smartloo.task=quality82',
                        '--label','smartloo.run='+name,'--network',network,'--network-alias','api',
                        '--cpus',str(cpus),'--memory','1g','--read-only','--tmpfs','/tmp',
                        '--env-file',str(env_file),'-p','127.0.0.1::8000','smartloo:review-security24',
                        'python','-m','uvicorn','src.app:create_app','--factory','--host','0.0.0.0',
                        '--port','8000','--workers',str(workers),'--no-access-log'],
                       check=True,stdout=subprocess.DEVNULL)
        api_started=True
        published=subprocess.check_output(['docker','port','smartloo-load82-api','8000'],text=True).strip()
        origin='http://127.0.0.1:'+published.rsplit(':',1)[1]
        for attempt in range(100):
            try:
                with urlopen(origin+'/api/v1/toilets/nearby?lat=41.1&lon=29&radius=1000',timeout=1) as response:
                    if response.status==200:
                        break
            except (OSError,TimeoutError):
                time.sleep(.2)
        else:
            raise RuntimeError('Linux API did not become ready')
        metadata=dict(application_sha=revision,image_application_sha=image_revision,app_inputs_identical=True,api_image_id=info['Id'],api_image='smartloo:review-security24',
                      start_utc=datetime.now(timezone.utc).isoformat(),records=10000,workers=workers,
                      api_cpu_quota=cpus,api_memory_bytes=1073741824,api_nonroot=info['Config']['User'],
                      database_versions=versions,indexes=indexes,k6_image=IMAGE,
                      container_network=network,target='Linux containers on private test network',
                      driver='Windows provisioning/observation only',initial_host=host_sample(),
                      live_directory_modified=False,cloud_hosting=False)
        (out/'environment.json').write_text(json.dumps(metadata,default=str,indent=2),encoding='utf-8')
        worker_list=subprocess.check_output(['docker','top','smartloo-load82-api'],text=True)
        (out/'api-processes.txt').write_text(worker_list,encoding='utf-8')
        results={}
        for phase,duration in [('warmup','60s'),('measurement','300s')]:
            command=['docker','run','--rm','--name','smartloo-load82-k6','--network',network,
                     '-e','K6_NO_USAGE_REPORT=true','-e','SMARTLOO_LOAD_ORIGIN=http://smartloo-load82-api:8000',
                     '-e','SMARTLOO_LOAD_DURATION='+duration,'-e','SMARTLOO_LOAD_SUMMARY=/evidence/'+phase+'.json',
                     '-v',str(ROOT/'.venv')+':/scripts:ro','-v',str(out)+':/evidence',IMAGE,
                     'run','--quiet','/scripts/nearby_load82.js']
            (out/(phase+'-command.json')).write_text(json.dumps(command,indent=2),encoding='utf-8')
            with (out/(phase+'.log')).open('w',encoding='utf-8') as log,(out/(phase+'-resources.jsonl')).open('w',encoding='utf-8') as stats:
                proc=subprocess.Popen(command,stdout=log,stderr=subprocess.STDOUT)
                deadline=time.monotonic()+(120 if phase=='warmup' else 360)
                try:
                    while proc.poll() is None:
                        if time.monotonic()>deadline:
                            raise TimeoutError('Linux load phase exceeded its budget')
                        sample=subprocess.run(['docker','stats','--no-stream','--format','{{json .}}',
                                               'smartloo-pr75-postgis-1','smartloo-load82-api','smartloo-load82-k6'],
                                              capture_output=True,text=True,check=False)
                        # The first sample can race container creation; retain its
                        # status instead of aborting an otherwise valid load run.
                        stats.write(json.dumps(dict(time=datetime.now(timezone.utc).isoformat(),host=host_sample(),
                                                    output=sample.stdout,sample_exit=sample.returncode,sample_error=sample.stderr))+'\n')
                        stats.flush()
                        time.sleep(10)
                finally:
                    if proc.poll() is None:
                        subprocess.run(['docker','stop','smartloo-load82-k6'],check=False,capture_output=True)
                        proc.wait(timeout=20)
            results[phase]=proc.returncode
            print(phase+': exit '+str(proc.returncode),flush=True)
            if not (out/(phase+'.json')).exists():
                raise RuntimeError('Missing summary; inspect the retained phase log')
            if phase=='warmup' and proc.returncode and abort_on_warmup_failure:
                (out/'diagnostic-only.json').write_text(json.dumps(dict(status='candidate warmup failed',
                    formal_five_minute_measurement=False,exit_code=proc.returncode)),encoding='utf-8')
                return proc.returncode
        (out/'exit-codes.json').write_text(json.dumps(results),encoding='utf-8')
        summary=json.loads((out/'measurement.json').read_text())
        print(json.dumps({key:summary['metrics'][key] for key in ('http_req_duration','http_reqs','checks','http_req_failed')},indent=2))
        return results['measurement']
    finally:
        private_env=out/'private-api.env'
        if private_env.exists():
            private_env.unlink()
        if api_started:
            with (out/'api.log').open('w',encoding='utf-8') as log:
                subprocess.run(['docker','logs','smartloo-load82-api'],stdout=log,stderr=subprocess.STDOUT,check=False)
            subprocess.run(['docker','rm','-f','smartloo-load82-api'],check=False,capture_output=True)
        if original is None:
            os.environ.pop('SMARTLOO_DB_NAME',None)
        else:
            os.environ['SMARTLOO_DB_NAME']=original
        with connect() as conn:
            conn.autocommit=True
            conn.execute(sql.SQL('DROP DATABASE {} WITH (FORCE)').format(sql.Identifier(name)))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-name',default='load82-linux')
    parser.add_argument('--workers',type=int,choices=(1,2,4),default=2)
    parser.add_argument('--cpus',type=int,choices=(1,2,4),default=2)
    parser.add_argument('--abort-on-warmup-failure',action='store_true')
    args=parser.parse_args()
    raise SystemExit(main(args.run_name,args.workers,args.cpus,args.abort_on_warmup_failure))
