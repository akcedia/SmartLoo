# ZAP Scanning Report

ZAP by [Checkmarx](https://checkmarx.com/).


## Summary of Alerts

| Risk Level | Number of Alerts |
| --- | --- |
| High | 0 |
| Medium | 0 |
| Low | 1 |
| Informational | 2 |




## Insights

| Level | Reason | Site | Description | Statistic |
| --- | --- | --- | --- | --- |
| Medium | Exceeded High | http://api:8000 | Percentage of responses with status code 4xx | 99 % |
| Low | Warning |  | ZAP errors logged - see the zap.log file for details | 22    |
| Low | Warning |  | ZAP warnings logged - see the zap.log file for details | 30    |
| Info | Informational |  | Percentage of network failures | 1 % |
| Info | Informational | http://api:8000 | Percentage of responses with status code 2xx | 2 % |
| Info | Informational | http://api:8000 | Percentage of endpoints with content type application/json | 98 % |
| Info | Informational | http://api:8000 | Percentage of endpoints with content type text/html | 1 % |
| Info | Informational | http://api:8000 | Percentage of endpoints with method DELETE | 4 % |
| Info | Informational | http://api:8000 | Percentage of endpoints with method GET | 66 % |
| Info | Informational | http://api:8000 | Percentage of endpoints with method PATCH | 7 % |
| Info | Informational | http://api:8000 | Percentage of endpoints with method POST | 20 % |
| Info | Informational | http://api:8000 | Count of total endpoints | 81    |
| Info | Informational | http://api:8000 | Percentage of slow responses | 3 % |







## Alerts

| Name | Risk Level | Number of Instances |
| --- | --- | --- |
| Unexpected Content-Type was returned | Low | 2 |
| A Client Error response code was returned by the server | Informational | 83 |
| Authentication Request Identified | Informational | 1 |




## Alert Detail



### [ Unexpected Content-Type was returned ](https://www.zaproxy.org/docs/alerts/100001/)



##### Low (High)

### Description

A Content-Type of text/html was returned by the server.
This is not one of the types expected to be returned by an API.
Raised by the 'Alert on Unexpected Content Types' script

* URL: http://api:8000
  * Node Name: `http://api:8000`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://api:8000/
  * Node Name: `http://api:8000/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``


Instances: 2

### Solution



### Reference




#### Source ID: 4

### [ A Client Error response code was returned by the server ](https://www.zaproxy.org/docs/alerts/100000/)



##### Informational (High)

### Description

A response code of 422 was returned by the server.
This may indicate that the application is failing to handle unexpected input correctly.
Raised by the 'Alert on HTTP Response Code Error' script

* URL: http://api:8000/api/v1/reviews/review_id
  * Node Name: `http://api:8000/api/v1/reviews/review_id`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://api:8000/api/v1/reviews/review_id/
  * Node Name: `http://api:8000/api/v1/reviews/review_id/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `405`
  * Other Info: ``
* URL: http://api:8000/api/v1/users/me
  * Node Name: `http://api:8000/api/v1/users/me`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://api:8000/api/v1/users/me/
  * Node Name: `http://api:8000/api/v1/users/me/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `405`
  * Other Info: ``
* URL: http://api:8000/2484406369278706560
  * Node Name: `http://api:8000/2484406369278706560`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api
  * Node Name: `http://api:8000/api`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/
  * Node Name: `http://api:8000/api/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/7901156403810840550
  * Node Name: `http://api:8000/api/7901156403810840550`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1
  * Node Name: `http://api:8000/api/v1`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/
  * Node Name: `http://api:8000/api/v1/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/5403552316342564373
  * Node Name: `http://api:8000/api/v1/5403552316342564373`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/admin
  * Node Name: `http://api:8000/api/v1/admin`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/admin/
  * Node Name: `http://api:8000/api/v1/admin/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/admin/399293602600446976
  * Node Name: `http://api:8000/api/v1/admin/399293602600446976`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/admin/actuator/health
  * Node Name: `http://api:8000/api/v1/admin/actuator/health`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/admin/analytics
  * Node Name: `http://api:8000/api/v1/admin/analytics`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/admin/analytics/
  * Node Name: `http://api:8000/api/v1/admin/analytics/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/admin/analytics/8528955405171225429
  * Node Name: `http://api:8000/api/v1/admin/analytics/8528955405171225429`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/admin/analytics/export%3Fformat=csv&district=&from=&to=
  * Node Name: `http://api:8000/api/v1/admin/analytics/export (district,format,from,to)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://api:8000/api/v1/admin/analytics/export/
  * Node Name: `http://api:8000/api/v1/admin/analytics/export/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/admin/metrics
  * Node Name: `http://api:8000/api/v1/admin/metrics`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/admin/metrics/
  * Node Name: `http://api:8000/api/v1/admin/metrics/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/admin/metrics/6515130387194854268
  * Node Name: `http://api:8000/api/v1/admin/metrics/6515130387194854268`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/admin/metrics/summary%3Fdistrict=&from=&to=
  * Node Name: `http://api:8000/api/v1/admin/metrics/summary (district,from,to)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://api:8000/api/v1/admin/metrics/summary/
  * Node Name: `http://api:8000/api/v1/admin/metrics/summary/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/admin/suggestions
  * Node Name: `http://api:8000/api/v1/admin/suggestions`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://api:8000/api/v1/admin/suggestions%3Fstatus=pending&limit=50&offset=0
  * Node Name: `http://api:8000/api/v1/admin/suggestions (limit,offset,status)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://api:8000/api/v1/admin/suggestions/
  * Node Name: `http://api:8000/api/v1/admin/suggestions/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/admin/suggestions/6357668535715065540
  * Node Name: `http://api:8000/api/v1/admin/suggestions/6357668535715065540`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/admin/toilets
  * Node Name: `http://api:8000/api/v1/admin/toilets`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/admin/toilets/
  * Node Name: `http://api:8000/api/v1/admin/toilets/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/admin/toilets/8825062492116289009
  * Node Name: `http://api:8000/api/v1/admin/toilets/8825062492116289009`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/auth
  * Node Name: `http://api:8000/api/v1/auth`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/auth/
  * Node Name: `http://api:8000/api/v1/auth/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/auth/4310789308160645782
  * Node Name: `http://api:8000/api/v1/auth/4310789308160645782`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/recommendations%3Flat=1.2&lon=1.2&radius=1000&open_now=false&has_disabled_access=&has_baby_changing=&is_free=
  * Node Name: `http://api:8000/api/v1/recommendations (has_baby_changing,has_disabled_access,is_free,lat,lon,open_now,radius)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `422`
  * Other Info: ``
* URL: http://api:8000/api/v1/recommendations/
  * Node Name: `http://api:8000/api/v1/recommendations/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/reviews
  * Node Name: `http://api:8000/api/v1/reviews`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/reviews/
  * Node Name: `http://api:8000/api/v1/reviews/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/reviews/2993698472716863986
  * Node Name: `http://api:8000/api/v1/reviews/2993698472716863986`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/toilets%3Fopen_now=false&has_disabled_access=&has_baby_changing=&is_free=
  * Node Name: `http://api:8000/api/v1/toilets (has_baby_changing,has_disabled_access,is_free,open_now)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `422`
  * Other Info: ``
* URL: http://api:8000/api/v1/toilets/
  * Node Name: `http://api:8000/api/v1/toilets/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/toilets/999503081583319010
  * Node Name: `http://api:8000/api/v1/toilets/999503081583319010`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `422`
  * Other Info: ``
* URL: http://api:8000/api/v1/toilets/nearby%3Flat=1.2&lon=1.2&radius=1000&open_now=false&has_disabled_access=&has_baby_changing=&is_free=
  * Node Name: `http://api:8000/api/v1/toilets/nearby (has_baby_changing,has_disabled_access,is_free,lat,lon,open_now,radius)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `422`
  * Other Info: ``
* URL: http://api:8000/api/v1/toilets/nearby/
  * Node Name: `http://api:8000/api/v1/toilets/nearby/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/toilets/toilet_id
  * Node Name: `http://api:8000/api/v1/toilets/toilet_id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `422`
  * Other Info: ``
* URL: http://api:8000/api/v1/toilets/toilet_id/
  * Node Name: `http://api:8000/api/v1/toilets/toilet_id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/toilets/toilet_id/8662066786213827354
  * Node Name: `http://api:8000/api/v1/toilets/toilet_id/8662066786213827354`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/toilets/toilet_id/reviews%3Flimit=20&offset=0
  * Node Name: `http://api:8000/api/v1/toilets/toilet_id/reviews (limit,offset)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/toilets/toilet_id/reviews%3Flimit=http%253A%252F%252Fwww.google.com%252F&offset=0
  * Node Name: `http://api:8000/api/v1/toilets/toilet_id/reviews (limit,offset)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `422`
  * Other Info: ``
* URL: http://api:8000/api/v1/toilets/toilet_id/reviews/
  * Node Name: `http://api:8000/api/v1/toilets/toilet_id/reviews/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/toilets/toilet_id/summary
  * Node Name: `http://api:8000/api/v1/toilets/toilet_id/summary`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `422`
  * Other Info: ``
* URL: http://api:8000/api/v1/toilets/toilet_id/summary/
  * Node Name: `http://api:8000/api/v1/toilets/toilet_id/summary/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/users
  * Node Name: `http://api:8000/api/v1/users`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/users/
  * Node Name: `http://api:8000/api/v1/users/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/users/7803286955138245371
  * Node Name: `http://api:8000/api/v1/users/7803286955138245371`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/openapi.json/
  * Node Name: `http://api:8000/openapi.json/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://api:8000/api/v1/admin/suggestions/suggestion_id
  * Node Name: `http://api:8000/api/v1/admin/suggestions/suggestion_id ()({status})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://api:8000/api/v1/admin/suggestions/suggestion_id/
  * Node Name: `http://api:8000/api/v1/admin/suggestions/suggestion_id/ ()({status})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `405`
  * Other Info: ``
* URL: http://api:8000/api/v1/admin/toilets/toilet_id
  * Node Name: `http://api:8000/api/v1/admin/toilets/toilet_id ()({status})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://api:8000/api/v1/admin/toilets/toilet_id/
  * Node Name: `http://api:8000/api/v1/admin/toilets/toilet_id/ ()({status})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `405`
  * Other Info: ``
* URL: http://api:8000/api/v1/reviews/review_id
  * Node Name: `http://api:8000/api/v1/reviews/review_id ()({"cleanliness_score":10,"comment":Zaproxy dolore alias impedit expedita quisquam.,"tags":["John Doe"]})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `422`
  * Other Info: ``
* URL: http://api:8000/api/v1/reviews/review_id/
  * Node Name: `http://api:8000/api/v1/reviews/review_id/ ()({"cleanliness_score":10,"comment":Zaproxy dolore alias impedit expedita quisquam.,"tags":["John Doe"]})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `405`
  * Other Info: ``
* URL: http://api:8000/api/v1/admin/import
  * Node Name: `http://api:8000/api/v1/admin/import`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://api:8000/api/v1/admin/import/
  * Node Name: `http://api:8000/api/v1/admin/import/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `405`
  * Other Info: ``
* URL: http://api:8000/api/v1/auth/login
  * Node Name: `http://api:8000/api/v1/auth/login ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://api:8000/api/v1/auth/login
  * Node Name: `http://api:8000/api/v1/auth/login ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `422`
  * Other Info: ``
* URL: http://api:8000/api/v1/auth/login
  * Node Name: `http://api:8000/api/v1/auth/login ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://api:8000/api/v1/auth/login/
  * Node Name: `http://api:8000/api/v1/auth/login/ ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `405`
  * Other Info: ``
* URL: http://api:8000/api/v1/auth/register
  * Node Name: `http://api:8000/api/v1/auth/register ()({email,password,display_name})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `409`
  * Other Info: ``
* URL: http://api:8000/api/v1/auth/register
  * Node Name: `http://api:8000/api/v1/auth/register ()({email,password,display_name})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `422`
  * Other Info: ``
* URL: http://api:8000/api/v1/auth/register/
  * Node Name: `http://api:8000/api/v1/auth/register/ ()({email,password,display_name})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `405`
  * Other Info: ``
* URL: http://api:8000/api/v1/toilets/suggest
  * Node Name: `http://api:8000/api/v1/toilets/suggest ()({name,district,latitude,longitude,has_disabled_access,has_baby_changing,is_free})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://api:8000/api/v1/toilets/suggest/
  * Node Name: `http://api:8000/api/v1/toilets/suggest/ ()({name,district,latitude,longitude,has_disabled_access,has_baby_changing,is_free})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `405`
  * Other Info: ``
* URL: http://api:8000/api/v1/toilets/toilet_id/reviews
  * Node Name: `http://api:8000/api/v1/toilets/toilet_id/reviews ()({"cleanliness_score":10,"comment":Zaproxy dolore alias impedit expedita quisquam.,"tags":["John Doe"]})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `422`
  * Other Info: ``
* URL: http://api:8000/api/v1/toilets/toilet_id/reviews/
  * Node Name: `http://api:8000/api/v1/toilets/toilet_id/reviews/ ()({"cleanliness_score":10,"comment":Zaproxy dolore alias impedit expedita quisquam.,"tags":["John Doe"]})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `405`
  * Other Info: ``
* URL: http://api:8000/computeMetadata/v1/
  * Node Name: `http://api:8000/computeMetadata/v1/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `405`
  * Other Info: ``
* URL: http://api:8000/latest/meta-data/
  * Node Name: `http://api:8000/latest/meta-data/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `405`
  * Other Info: ``
* URL: http://api:8000/metadata/instance
  * Node Name: `http://api:8000/metadata/instance`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `405`
  * Other Info: ``
* URL: http://api:8000/metadata/v1
  * Node Name: `http://api:8000/metadata/v1`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `405`
  * Other Info: ``
* URL: http://api:8000/opc/v1/instance/
  * Node Name: `http://api:8000/opc/v1/instance/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `405`
  * Other Info: ``
* URL: http://api:8000/opc/v2/instance/
  * Node Name: `http://api:8000/opc/v2/instance/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `405`
  * Other Info: ``
* URL: http://api:8000/openstack/latest/meta_data.json
  * Node Name: `http://api:8000/openstack/latest/meta_data.json`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `405`
  * Other Info: ``


Instances: 83

### Solution



### Reference



#### CWE Id: [ 388 ](https://cwe.mitre.org/data/definitions/388.html)


#### WASC Id: 20

#### Source ID: 4

### [ Authentication Request Identified ](https://www.zaproxy.org/docs/alerts/10111/)



##### Informational (High)

### Description

The given request has been identified as an authentication request. The 'Other Info' field contains a set of key=value lines which identify any relevant fields. If the request is in a context which has an Authentication Method set to "Auto-Detect" then this rule will change the authentication to match the request identified.

* URL: http://api:8000/api/v1/auth/login
  * Node Name: `http://api:8000/api/v1/auth/login ()({email,password})`
  * Method: `POST`
  * Parameter: `email`
  * Attack: ``
  * Evidence: `password`
  * Other Info: `userParam=email
userValue=zaproxy@example.com
passwordParam=password`


Instances: 1

### Solution

This is an informational alert rather than a vulnerability and so there is nothing to fix.

### Reference


* [ https://www.zaproxy.org/docs/desktop/addons/authentication-helper/auth-req-id/ ](https://www.zaproxy.org/docs/desktop/addons/authentication-helper/auth-req-id/)



#### Source ID: 3


