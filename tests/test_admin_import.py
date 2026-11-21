"""HTTP validation and isolated atomic ADMIN import contract."""
from copy import deepcopy
import json

import pytest

from tests.test_requirements import ADMIN, U, auth, env
from src.admin_import import MAX_BYTES

PATH = '/api/v1/admin/import'


def row(**changes):
    return dict({'source':'test', 'source_id':'stable-1', 'name':'Üsküdar WC', 'district':'Üsküdar',
                 'latitude':41.01, 'longitude':29.01}, **changes)


@pytest.mark.parametrize("headers,status", [({}, 401), (auth(U), 403), (auth(ADMIN, 'ADMIN', expired=True), 401),
    (auth(ADMIN,'ADMIN',key='tampered-test-signing-key-at-least-32-bytes'),401)])
def test_import_auth_runs_before_parsing(env, headers, status):
    response = env.client.post(PATH, headers={**headers, 'Content-Type':'application/json'}, content=b'not JSON')
    assert response.status_code == status


@pytest.mark.parametrize("content,media", [
    (b'[]','application/json'), (b'{}','application/json'), (b'[{','application/json'),
    (b'[{"source":"one","source":"two"}]','application/json'),
    (b'[{"latitude":NaN}]','application/json'), (b'\xff','application/json'),
    (b'source,source\na,b\n','text/csv'), (b'source,name\na,b,c\n','text/csv')])
def test_import_rejects_malformed_batch_without_changes(env, content, media):
    before = deepcopy(env.store['toilets'])
    response = env.client.post(PATH, headers={**auth(ADMIN,'ADMIN'),'Content-Type':media}, content=content)
    assert response.status_code == 422
    assert response.json()['errors']
    assert env.store['toilets'] == before


@pytest.mark.parametrize("field,value", [('latitude', True), ('longitude', 181), ('name',''),
    ('has_disabled_access',1), ('has_baby_changing','false'), ('is_free','true'),
    ('price_try',-1), ('status','Aktif'), ('review_count',999), ('id','invented-id')])
def test_import_invalid_row_has_safe_row_errors_and_zero_writes(env, field, value):
    record = row()
    record[field] = value
    before = deepcopy(env.store['toilets'])
    response = env.client.post(PATH, headers=auth(ADMIN,'ADMIN'), json=[record])
    assert response.status_code == 422
    assert response.json()['errors'][0]['row'] == 1
    assert env.store['toilets'] == before


def test_import_duplicate_identity_and_conflicting_fee_are_atomic(env):
    before = deepcopy(env.store['toilets'])
    for records in ([row(), row()], [row(is_free=True, price_try=20)]):
        assert env.client.post(PATH, headers=auth(ADMIN,'ADMIN'), json=records).status_code == 422
        assert env.store['toilets'] == before


def test_import_omitted_metadata_preserved_and_explicit_null_stays_unknown(env):
    original = row(is_free=False, price_try=10, has_disabled_access=True, status='ACTIVE')
    assert env.client.post(PATH, headers=auth(ADMIN,'ADMIN'), json=[original]).status_code == 200
    key = next(k for k,v in env.store['toilets'].items() if v.get('source_id') == 'stable-1')
    env.store['toilets'][key].update(review_count=5, average_cleanliness=4, review_version=9)
    result = env.client.post(PATH, headers=auth(ADMIN,'ADMIN'), json=[row()]).json()
    assert result == dict(inserted=0,updated=1,unchanged=1,rejected=0)
    saved = env.store['toilets'][key]
    assert (saved['is_free'],saved['price_try'],saved['review_count'],saved['review_version']) == (False,10,5,9)
    assert env.client.post(PATH, headers=auth(ADMIN,'ADMIN'), json=[row(has_disabled_access=None)]).status_code == 200
    assert env.store['toilets'][key]['has_disabled_access'] is None
    assert env.store['toilets'][key]['review_version'] == 10


def test_import_request_size_and_media_are_bounded(env):
    assert env.client.post(PATH, headers={**auth(ADMIN,'ADMIN'),'Content-Type':'text/plain'}, content=b'[]').status_code == 415
    assert env.client.post(PATH, headers={**auth(ADMIN,'ADMIN'),'Content-Type':'application/json'}, content=b' '*(MAX_BYTES+1)).status_code == 413
    assert env.client.post(PATH, headers=auth(ADMIN,'ADMIN'), json=[row()]*1001).status_code == 422


def test_import_csv_bom_booleans_and_unknown_values(env):
    content = '\ufeffsource,source_id,name,district,latitude,longitude,is_free,has_baby_changing,status\ntest,csv-1,Çamlıca WC,Üsküdar,41,29,false,,\n'
    result = env.client.post(PATH, headers={**auth(ADMIN,'ADMIN'),'Content-Type':'text/csv; charset=utf-8'}, content=content.encode())
    assert result.status_code == 200, result.text
    record = next(v for v in env.store['toilets'].values() if v.get('source_id') == 'csv-1')
    assert record['is_free'] is False and record['has_baby_changing'] is None and record['status'] is None
