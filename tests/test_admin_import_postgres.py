"""Private migrated database per test; never changes the real imported directory."""
import csv
import io
import os
import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from psycopg.types.json import Jsonb

from src.app import create_app
from src.db import connect
from src.ibb_import import make_plan, apply_plan, digest
from src.review_coordination import PostgresReviewCoordination
from tests.test_ibb_import import raw, feature
from tests.test_ibb_import_postgres import database

pytestmark = pytest.mark.skipif(os.getenv('SMARTLOO_TEST_POSTGIS') != '1', reason='Explicit test PostGIS required')
KEY = 'admin-import-tests-only-signing-key-at-least-32-bytes'
PATH = '/api/v1/admin/import'


def record(identity='one', **changes):
    return dict({'source':'qa','source_id':identity,'name':'Test WC','district':'Üsküdar','latitude':41.01,'longitude':29.01},**changes)


@pytest.fixture
def admin(database):
    with TestClient(create_app(jwt_secret=KEY)) as client:
        email = f'import-{uuid.uuid4().hex}@example.com'
        response = client.post('/api/v1/auth/register',json=dict(email=email,password='TestOnly1234',display_name='Import QA'))
        assert response.status_code == 201
        key = response.json()['id']
        with connect() as conn:
            conn.execute("UPDATE users SET role='ADMIN' WHERE id=%s",(key,))
        token = client.post('/api/v1/auth/login',json=dict(email=email,password='TestOnly1234')).json()['access_token']
        yield client, {'Authorization':'Bearer '+token}, key


def send(client, headers, rows, fmt='json'):
    if fmt == 'json':
        return client.post(PATH,headers=headers,json=rows)
    output = io.StringIO()
    writer = csv.DictWriter(output,fieldnames=list(rows[0]))
    writer.writeheader(); writer.writerows(rows)
    return client.post(PATH,headers={**headers,'Content-Type':'text/csv'},content=output.getvalue())


@pytest.mark.parametrize('fmt',['json','csv'])
def test_live_import_repetition_preserves_ids_scores_provider_id_and_omitted_metadata(admin,fmt):
    client,headers,_ = admin
    rows = [record(ibb_source_id='IBB-QA-1')]
    assert send(client,headers,rows,fmt).json()['inserted'] == 1
    with connect() as conn:
        before = conn.execute('SELECT * FROM toilets').fetchone()
        key = before['id']
        assert before['status'] is None and before['is_free'] is None
        conn.execute("UPDATE toilets SET average_cleanliness=4.25,review_count=4,review_version=8,is_free=true,price_try=0,status='ACTIVE' WHERE id=%s",(key,))
    assert send(client,headers,rows,fmt).json() == dict(inserted=0,updated=1,unchanged=1,rejected=0)
    changed = [record(name='Yeni WC',status='CLOSED')]
    response = send(client,headers,changed,fmt)
    assert response.status_code == 200, response.text
    with connect() as conn:
        saved = conn.execute('SELECT * FROM toilets').fetchone()
        assert saved['id'] == key and saved['ibb_source_id'] == 'IBB-QA-1'
        assert (saved['average_cleanliness'],saved['review_count'],saved['review_version']) == (4.25,4,9)
        assert saved['is_free'] is True and saved['price_try'] == 0 and saved['status'] == 'CLOSED'


def test_live_import_invalid_batch_does_not_update_an_earlier_valid_row(admin):
    client,headers,_ = admin
    assert send(client,headers,[record()]).status_code == 200
    first=record(); first['name']='Must roll back'
    invalid=record('two'); invalid['latitude']=95
    result=send(client,headers,[first,invalid])
    assert result.status_code == 422 and result.json()['errors'][0]['row'] == 2
    with connect() as conn:
        assert conn.execute('SELECT name FROM toilets').fetchall() == [{'name':'Test WC'}]


def test_live_import_sql_failure_after_first_insert_rolls_back_entire_batch(admin):
    client,headers,_=admin
    with connect() as conn:
        conn.execute("""CREATE FUNCTION fail_admin_import() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
            IF NEW.name='Fail' THEN RAISE EXCEPTION 'synthetic private SQL error'; END IF; RETURN NEW; END $$;
            CREATE TRIGGER fail_admin_import BEFORE INSERT ON toilets FOR EACH ROW EXECUTE FUNCTION fail_admin_import();""")
    bad=record('two'); bad['name']='Fail'
    result=send(client,headers,[record(),bad])
    assert result.status_code == 503 and 'synthetic' not in result.text
    with connect() as conn:
        assert conn.execute('SELECT count(*) AS n FROM toilets').fetchone()['n'] == 0


def test_live_import_busy_and_durable_pending_review_block_all_writes(admin):
    client,headers,user=admin
    send(client,headers,[record()])
    with connect() as conn:
        key=str(conn.execute('SELECT id FROM toilets').fetchone()['id'])
    changed=record(); changed['name']='Not applied'
    with PostgresReviewCoordination().guard(key) as writer:
        assert send(client,headers,[record('new'),changed]).status_code == 503
        writer.begin(str(uuid.uuid4()),None,author_id=user)
    with TestClient(create_app(jwt_secret=KEY)) as restarted:
        assert send(restarted,headers,[record('new'),changed]).status_code == 503
    with connect() as conn:
        assert conn.execute('SELECT name FROM toilets').fetchall() == [{'name':'Test WC'}]


def test_live_import_provider_collision_rolls_back_prior_valid_insert(admin):
    client,headers,_=admin
    assert send(client,headers,[record(ibb_source_id='provider-1')]).status_code == 200
    result=send(client,headers,[record('new'),record('collision',ibb_source_id='provider-1')])
    assert result.status_code == 409
    with connect() as conn:
        assert conn.execute('SELECT source_id FROM toilets').fetchall() == [{'source_id':'one'}]


def test_live_import_raw_registry_alias_preserved_and_identity_edits_require_plan(admin):
    client,headers,_=admin
    source=raw(feature())
    plan=make_plan(source)
    apply_plan(source,plan,digest(plan))
    with connect() as conn:
        old=conn.execute('SELECT * FROM toilets').fetchone()
        conn.execute("INSERT INTO external_source_identities(source,fingerprint,toilet_id,identity) VALUES ('ibb','reviewed-alias',%s,%s)",(old['id'],Jsonb(['reviewed alias'])))
    row=dict(source='ibb',source_id='reviewed-alias',name=old['name'],district=old['district'],
             latitude=float(old['latitude']),longitude=float(old['longitude']),has_disabled_access=True)
    assert send(client,headers,[row]).status_code == 200
    with connect() as conn:
        saved=conn.execute('SELECT * FROM toilets').fetchone()
        assert saved['id'] == old['id'] and saved['source_id'] == old['source_id']
        assert saved['has_disabled_access'] is True and saved['review_version'] == 1
    changed={**row,'name':'Unreviewed rename'}
    assert send(client,headers,[record('new'),changed]).status_code == 422
    assert send(client,headers,[{**row,'status':'CLOSED'}]).status_code == 422
    assert send(client,headers,[{**row,'source_id':'v1:unregistered'}]).status_code == 409
    assert apply_plan(source,plan,digest(plan))['unchanged'] == 1
    with connect() as conn:
        assert conn.execute('SELECT count(*) AS n FROM toilets').fetchone()['n'] == 1
        assert conn.execute('SELECT has_disabled_access FROM toilets').fetchone()['has_disabled_access'] is True


def test_live_import_concurrent_retries_keep_one_identity_and_recheck_actual_role(admin):
    client,headers,user=admin
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda _: send(client,headers,[record()]),range(2)))
    assert all(response.status_code in (200,503) for response in results)
    assert any(response.status_code == 200 for response in results)
    assert send(client,headers,[record()]).status_code == 200
    with connect() as conn:
        assert conn.execute('SELECT count(*) AS n FROM toilets').fetchone()['n'] == 1
        conn.execute("UPDATE users SET role='USER' WHERE id=%s",(user,))
    assert send(client,headers,[record('forbidden')]).status_code == 403


def test_live_import_shares_the_raw_import_mutex(admin):
    client,headers,_=admin
    with connect() as raw_import:
        raw_import.execute('SELECT pg_advisory_xact_lock(-610061)')
        assert send(client,headers,[record()]).status_code == 503
    with connect() as conn:
        assert conn.execute('SELECT count(*) AS n FROM toilets').fetchone()['n'] == 0
