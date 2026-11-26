# ZAP Scanning Report

ZAP by [Checkmarx](https://checkmarx.com/).


## Summary of Alerts

| Risk Level | Number of Alerts |
| --- | --- |
| High | 0 |
| Medium | 0 |
| Low | 0 |
| Informational | 1 |




## Insights

| Level | Reason | Site | Description | Statistic |
| --- | --- | --- | --- | --- |
| Low | Warning |  | ZAP errors logged - see the zap.log file for details | 9    |
| Info | Informational |  | Percentage of network failures | 52 % |
| Info | Informational | http://api:8000 | Percentage of responses with status code 2xx | 77 % |
| Info | Informational | http://api:8000 | Percentage of responses with status code 4xx | 22 % |
| Info | Informational | http://api:8000 | Percentage of endpoints with content type application/json | 25 % |
| Info | Informational | http://api:8000 | Percentage of endpoints with content type application/manifest+json | 12 % |
| Info | Informational | http://api:8000 | Percentage of endpoints with content type image/png | 25 % |
| Info | Informational | http://api:8000 | Percentage of endpoints with content type text/css | 12 % |
| Info | Informational | http://api:8000 | Percentage of endpoints with content type text/html | 12 % |
| Info | Informational | http://api:8000 | Percentage of endpoints with content type text/javascript | 12 % |
| Info | Informational | http://api:8000 | Percentage of endpoints with method GET | 100 % |
| Info | Informational | http://api:8000 | Count of total endpoints | 8    |







## Alerts

| Name | Risk Level | Number of Instances |
| --- | --- | --- |
| Modern Web Application | Informational | 1 |




## Alert Detail



### [ Modern Web Application ](https://www.zaproxy.org/docs/alerts/10109/)



##### Informational (Medium)

### Description

The application appears to be a modern web application. If you need to explore it automatically then the Client Spider may well be more effective than the standard one.

* URL: http://api:8000/
  * Node Name: `http://api:8000/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script>
      // Resolve the theme before first paint (same rules as src/shared/theme/theme.js).
      (function () {
        var pref = "light";
        try {
          var saved = localStorage.getItem("smartloo.theme");
          if (["system", "light", "dark"].indexOf(saved) !== -1) pref = saved;
        } catch (e) {}
        var dark = pref === "dark" || (pref === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
        document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
        document.querySelector('meta[name="theme-color"]').setAttribute("content", dark ? "#030405" : "#ffffff");
        try { if (localStorage.getItem("smartloo.reduceMotion") === "on") document.documentElement.setAttribute("data-motion", "reduce"); } catch (e) {}
      })();
    </script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`


Instances: 1

### Solution

This is an informational alert and so no changes are required.

### Reference




#### Source ID: 3


