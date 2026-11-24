from decimal import Decimal
from uuid import UUID

from fastapi.testclient import TestClient

from src.app import create_app


def test_compiled_search_response_preserves_public_numeric_null_and_uuid_contract():
    row=dict(id=UUID('00000000-0000-4000-8000-000000000001'),name='Synthetic',
             latitude=Decimal('41.001'),longitude=Decimal('29.000'),district=None,address=None,
             has_disabled_access=None,has_baby_changing=False,is_free=True,price_try=Decimal('0'),
             opening_hours=None,status=None,is_open_now=None,average_cleanliness=Decimal('3.50'),
             review_count=2,distance_m=111.05)
    with TestClient(create_app(nearby_search=lambda **kwargs: [row])) as client:
        response=client.get('/api/v1/toilets/nearby?lat=41&lon=29')
    assert response.status_code==200
    result=response.json()
    expected={**row,'id':str(row['id']),'latitude':41.001,'longitude':29.0,
              'price_try':0.0,'average_cleanliness':3.5}
    assert result==dict(count=1,results=[expected])
    assert isinstance(result['results'][0]['latitude'],float)
    assert isinstance(result['results'][0]['average_cleanliness'],float)
    assert result['results'][0]['has_disabled_access'] is None
