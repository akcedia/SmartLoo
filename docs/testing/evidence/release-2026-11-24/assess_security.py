"""Bounded black-box HTTP assessment on uniquely named disposable local stores."""
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import time
from uuid import uuid4

import httpx
import jwt
import pymongo
from psycopg import sql

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from src.db import connect


def main(image):
    assert os.environ.get('SMARTLOO_DB_HOST')=='127.0.0.1'
    assert os.environ.get('SMARTLOO_DB_PORT')=='5439'
    name='smartloo_security24_'+uuid4().hex[:12]
    container=name.replace('_','-')
    original=os.environ.get('SMARTLOO_DB_NAME','smartloo')
    out=ROOT/'.venv'/name;out.mkdir()
    envfile=out/'private.env'
    secret=secrets.token_urlsafe(40)
    cases=[];started=False
    info=json.loads(subprocess.check_output(['docker','image','inspect',image],text=True))[0]
    report=dict(image=image,image_id=info['Id'],image_revision=info['Config'].get('Labels',{}).get('org.opencontainers.image.revision'),synthetic_only=True,live_model_calls=0,cases=cases)
    with connect() as conn:
        conn.autocommit=True
        conn.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(name)))
    try:
        os.environ['SMARTLOO_DB_NAME']=name
        with connect() as conn:
            for path in sorted((ROOT/'db/migrations').glob('*.sql')): conn.execute(path.read_text(encoding='utf-8'))
            conn.execute((ROOT/'db/seeds/fixtures.sql').read_text(encoding='utf-8'))
        networks=json.loads(subprocess.check_output(['docker','inspect','smartloo-pr75-postgis-1','--format','{{json .NetworkSettings.Networks}}'],text=True))
        assert len(networks)==1
        settings=dict(SMARTLOO_DB_HOST='smartloo-pr75-postgis-1',SMARTLOO_DB_PORT='5432',SMARTLOO_DB_NAME=name,SMARTLOO_DB_USER='smartloo',SMARTLOO_DB_PASSWORD='smartloo-dev-only',SMARTLOO_MONGO_URL='mongodb://host.docker.internal:27019',SMARTLOO_MONGO_DB=name,SMARTLOO_JWT_SECRET=secret,SMARTLOO_AI_PROFILE='')
        envfile.write_text(''.join(k+'='+v+'\n' for k,v in settings.items()),encoding='utf-8')
        subprocess.run(['docker','run','-d','--name',container,'--network',next(iter(networks)),'--read-only','--tmpfs','/tmp','--memory','512m','--env-file',str(envfile),'-p','127.0.0.1::8000',image],check=True,stdout=subprocess.DEVNULL)
        started=True
        port=subprocess.check_output(['docker','port',container,'8000'],text=True).strip().rsplit(':',1)[1]
        with httpx.Client(base_url='http://127.0.0.1:'+port,timeout=15,follow_redirects=False) as client:
            for _ in range(80):
                try:
                    if client.get('/healthz').status_code==200: break
                except httpx.HTTPError: pass
                time.sleep(.25)
            else: raise RuntimeError('Private API did not start')
            def check(label,method,path,expected,**kwargs):
                response=client.request(method,path,**kwargs)
                passed=response.status_code==expected
                cases.append(dict(case=label,expected=expected,actual=response.status_code,passed=passed))
                if not passed: raise AssertionError(label+' status '+str(response.status_code))
                return response
            admin='/api/v1/admin/metrics/summary'
            check('Guest ADMIN denied','GET',admin,401)
            check('SQL-like coordinate rejected','GET','/api/v1/toilets/nearby',422,params=dict(lat='41; DROP TABLE toilets',lon=29))
            check('Nonfinite coordinate rejected','GET','/api/v1/toilets/nearby',422,params=dict(lat='NaN',lon=29))
            check('Invalid amenity boolean rejected','GET','/api/v1/toilets/nearby',422,params=dict(lat=41,lon=29,is_free='false OR 1=1'))
            check('Invalid facility identifier rejected','GET','/api/v1/toilets/not-a-uuid',422)
            for path in ('/.env','/.venv/private.env','/src/auth.py','/assets/%2e%2e/%2e%2e/.env'):
                check('Private path denied: '+path,'GET',path,404)
            password=secrets.token_urlsafe(18)
            def account(label):
                email=label+'-'+uuid4().hex[:8]+'@example.com'
                user=check('Register '+label,'POST','/api/v1/auth/register',201,json=dict(email=email,password=password,display_name=label,role='ADMIN')).json()
                assert user['role']=='USER' and 'password_hash' not in user
                cases.append(dict(case='Registration cannot promote '+label,passed=True))
                token=check('Login '+label,'POST','/api/v1/auth/login',200,json=dict(email=email,password=password)).json()['access_token']
                return email,user,dict(Authorization='Bearer '+token)
            email,owner,owner_auth=account('Owner')
            _,other,other_auth=account('Other')
            check('USER cannot read ADMIN analytics','GET',admin,403,headers=owner_auth)
            check('USER cannot read moderation queue','GET','/api/v1/admin/suggestions',403,headers=owner_auth)
            forged=jwt.encode(dict(sub=owner['id'],role='ADMIN',exp=int(time.time())+3600),'wrong-test-key-at-least-thirty-two-bytes',algorithm='HS256')
            check('Forged ADMIN signature denied','GET',admin,401,headers=dict(Authorization='Bearer '+forged))
            check('Malformed bearer denied','GET',admin,401,headers=dict(Authorization='Bearer invalid'))
            toilet='00000000-0000-4000-8000-000000000001'
            reviews='/api/v1/toilets/'+toilet+'/reviews'
            check('Anonymous review write denied','POST',reviews,401,json=dict(cleanliness_score=4))
            check('Oversized review rejected','POST',reviews,422,headers=owner_auth,json=dict(cleanliness_score=4,comment='x'*1001))
            check('Fractional score rejected','POST',reviews,422,headers=owner_auth,json=dict(cleanliness_score=4.5))
            review=check('Owner creates synthetic review','POST',reviews,201,headers=owner_auth,json=dict(cleanliness_score=4,comment='Synthetic assessment observation.')).json()
            path='/api/v1/reviews/'+review['id']
            check('Other user edit denied','PATCH',path,403,headers=other_auth,json=dict(cleanliness_score=1))
            check('Other user delete denied','DELETE',path,403,headers=other_auth)
            listing=check('Denied edits preserve owner review','GET',reviews,200,headers=owner_auth).json()
            actual=next(row for row in listing['results'] if row['id']==review['id'])
            assert actual['cleanliness_score']==4 and actual['is_own']
            cases.append(dict(case='IDOR attempts do not change persisted review',passed=True))
            check('Owner cleanup remains allowed','DELETE',path,204,headers=owner_auth)
            check('Password byte limit enforced','POST','/api/v1/auth/register',422,json=dict(email='long@example.com',password='x'*73,display_name='Synthetic'))
            for i in range(5):
                check('Failed login recorded '+str(i+1),'POST','/api/v1/auth/login',401,json=dict(email=email,password='wrong'))
            check('Repeated login failures bounded','POST','/api/v1/auth/login',429,json=dict(email=email,password='wrong'))
        report['status']='passed'
    except Exception as exc:
        report['status']='failed';report['failure_type']=type(exc).__name__
        raise
    finally:
        if started: subprocess.run(['docker','rm','-f',container],check=True,stdout=subprocess.DEVNULL)
        envfile.unlink(missing_ok=True)
        with pymongo.MongoClient('mongodb://127.0.0.1:27019') as mongo: mongo.drop_database(name)
        os.environ['SMARTLOO_DB_NAME']=original
        with connect() as conn:
            conn.autocommit=True
            conn.execute(sql.SQL('DROP DATABASE {} WITH (FORCE)').format(sql.Identifier(name)))
        report['private_stores_removed']=True
        (out/'result.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        print(json.dumps(dict(status=report.get('status'),checks=len(cases),result_file=str(out/'result.json'),private_stores_removed=True)))

if __name__=='__main__': main(sys.argv[1])
