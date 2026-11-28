# ZAP Scanning Report

ZAP by [Checkmarx](https://checkmarx.com/).


## Summary of Alerts

| Risk Level | Number of Alerts |
| --- | --- |
| High | 0 |
| Medium | 0 |
| Low | 3 |
| Informational | 2 |




## Insights

| Level | Reason | Site | Description | Statistic |
| --- | --- | --- | --- | --- |
| Medium | Exceeded High | http://api:8000 | Percentage of responses with status code 4xx | 99 % |
| Low | Warning |  | ZAP errors logged - see the zap.log file for details | 26    |
| Low | Warning |  | ZAP warnings logged - see the zap.log file for details | 30    |
| Info | Informational |  | Percentage of network failures | 1 % |
| Info | Informational | http://api:8000 | Percentage of endpoints with content type application/json | 98 % |
| Info | Informational | http://api:8000 | Percentage of endpoints with content type text/html | 1 % |
| Info | Informational | http://api:8000 | Percentage of endpoints with method DELETE | 4 % |
| Info | Informational | http://api:8000 | Percentage of endpoints with method GET | 67 % |
| Info | Informational | http://api:8000 | Percentage of endpoints with method PATCH | 7 % |
| Info | Informational | http://api:8000 | Percentage of endpoints with method POST | 20 % |
| Info | Informational | http://api:8000 | Count of total endpoints | 82    |
| Info | Informational | http://api:8000 | Percentage of slow responses | 3 % |







## Alerts

| Name | Risk Level | Number of Instances |
| --- | --- | --- |
| A Server Error response code was returned by the server | Low | 2 |
| Unexpected Content-Type was returned | Low | 2 |
| X-Content-Type-Options Header Missing | Low | 1 |
| A Client Error response code was returned by the server | Informational | 82 |
| Authentication Request Identified | Informational | 1 |




## Alert Detail



### [ A Server Error response code was returned by the server ](https://www.zaproxy.org/docs/alerts/100000/)



##### Low (High)

### Description

A response code of 503 was returned by the server.
This may indicate that the application is failing to handle unexpected input correctly.
Raised by the 'Alert on HTTP Response Code Error' script

* URL: http://api:8000/api/v1/toilets
  * Node Name: `http://api:8000/api/v1/toilets`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `503`
  * Other Info: ``
* URL: http://api:8000/api/v1/auth/login
  * Node Name: `http://api:8000/api/v1/auth/login ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``


Instances: 2

### Solution



### Reference



#### CWE Id: [ 388 ](https://cwe.mitre.org/data/definitions/388.html)


#### WASC Id: 20

#### Source ID: 4

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

### [ X-Content-Type-Options Header Missing ](https://www.zaproxy.org/docs/alerts/10021/)



##### Low (Medium)

### Description

The Anti-MIME-Sniffing header X-Content-Type-Options was not set to 'nosniff'. This allows older versions of Internet Explorer and Chrome to perform MIME-sniffing on the response body, potentially causing the response body to be interpreted and displayed as a content type other than the declared content type. Current (early 2014) and legacy versions of Firefox will use the declared content type (if one is set), rather than performing MIME-sniffing.

* URL: http://api:8000/openapi.json
  * Node Name: `http://api:8000/openapi.json`
  * Method: `GET`
  * Parameter: `x-content-type-options`
  * Attack: ``
  * Evidence: ``
  * Other Info: `This issue still applies to error type pages (401, 403, 500, etc.) as those pages are often still affected by injection issues, in which case there is still concern for browsers sniffing pages away from their actual content type.
At "High" threshold this scan rule will not alert on client or server error responses.`


Instances: 1

### Solution

Ensure that the application/web server sets the Content-Type header appropriately, and that it sets the X-Content-Type-Options header to 'nosniff' for all web pages.
If possible, ensure that the end user uses a standards-compliant and modern web browser that does not perform MIME-sniffing at all, or that can be directed by the web application/web server to not perform MIME-sniffing.

### Reference


* [ https://learn.microsoft.com/en-us/previous-versions/windows/internet-explorer/ie-developer/compatibility/gg622941(v=vs.85) ](https://learn.microsoft.com/en-us/previous-versions/windows/internet-explorer/ie-developer/compatibility/gg622941(v=vs.85))
* [ https://owasp.org/www-community/Security_Headers ](https://owasp.org/www-community/Security_Headers)


#### CWE Id: [ 693 ](https://cwe.mitre.org/data/definitions/693.html)


#### WASC Id: 15

#### Source ID: 3

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
* URL: http://api:8000/5838846249302598419
  * Node Name: `http://api:8000/5838846249302598419`
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
* URL: http://api:8000/api/8713467046302890301
  * Node Name: `http://api:8000/api/8713467046302890301`
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
* URL: http://api:8000/api/v1/7178065859935161400
  * Node Name: `http://api:8000/api/v1/7178065859935161400`
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
* URL: http://api:8000/api/v1/admin/4693718077420636748
  * Node Name: `http://api:8000/api/v1/admin/4693718077420636748`
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
* URL: http://api:8000/api/v1/admin/analytics/8088054207597761147
  * Node Name: `http://api:8000/api/v1/admin/analytics/8088054207597761147`
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
* URL: http://api:8000/api/v1/admin/metrics/398697081250566872
  * Node Name: `http://api:8000/api/v1/admin/metrics/398697081250566872`
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
* URL: http://api:8000/api/v1/admin/suggestions/7835060007683469016
  * Node Name: `http://api:8000/api/v1/admin/suggestions/7835060007683469016`
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
* URL: http://api:8000/api/v1/admin/toilets/8020269650197392059
  * Node Name: `http://api:8000/api/v1/admin/toilets/8020269650197392059`
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
* URL: http://api:8000/api/v1/auth/8093268979645323051
  * Node Name: `http://api:8000/api/v1/auth/8093268979645323051`
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
* URL: http://api:8000/api/v1/reviews/7054038851500077949
  * Node Name: `http://api:8000/api/v1/reviews/7054038851500077949`
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
* URL: http://api:8000/api/v1/toilets/2849621367790521226
  * Node Name: `http://api:8000/api/v1/toilets/2849621367790521226`
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
* URL: http://api:8000/api/v1/toilets/toilet_id/8866917747153673984
  * Node Name: `http://api:8000/api/v1/toilets/toilet_id/8866917747153673984`
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
* URL: http://api:8000/api/v1/users/7668027338796279870
  * Node Name: `http://api:8000/api/v1/users/7668027338796279870`
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


Instances: 82

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


