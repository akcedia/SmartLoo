// NFR-T01. Use only with the disposable local API provisioned by the runner.
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import exec from 'k6/execution';

const origin = __ENV.SMARTLOO_LOAD_ORIGIN;
if (!origin || !/^http:\/\/(127\.0\.0\.1|host\.docker\.internal|smartloo-load82-api):[0-9]+$/.test(origin)) {
  throw new Error('An explicit local test API is required');
}
export const requests = [
  'lat=41.10&lon=29.00&radius=1000',
  'lat=41.10&lon=29.00&radius=1000&open_now=true',
  'lat=41.10&lon=29.00&radius=1500&has_disabled_access=true',
  'lat=41.10&lon=29.008&radius=1500&is_free=false',
  'lat=41.10&lon=29.00&radius=2000&is_free=true&has_baby_changing=true',
  'lat=40.98&lon=28.76&radius=500',
  'lat=41.02&lon=28.848&radius=1000&has_disabled_access=false',
  'lat=41.06&lon=28.936&radius=2000&open_now=true&is_free=true',
  'lat=41.18&lon=29.16&radius=3000&has_baby_changing=false',
  'lat=41.22&lon=29.24&radius=1000&is_free=false&has_disabled_access=false',
];
const statusCounts = new Counter('status_responses');
export const options = {
  scenarios: { nearby: { executor: 'constant-vus', vus: 50, duration: __ENV.SMARTLOO_LOAD_DURATION || '300s', gracefulStop: '10s' } },
  maxRedirects: 0,
  thresholds: {
    checks: ['rate==1'],
    http_req_failed: ['rate==0'],
    http_req_duration: ['avg<250', 'p(95)<250'],
  },
};
export default function () {
  const index = (__VU - 1 + exec.scenario.iterationInTest) % requests.length;
  const response = http.get(`${origin}/api/v1/toilets/nearby?${requests[index]}`, { timeout: '15s', tags: { mix: String(index) } });
  statusCounts.add(1, { status: String(response.status) });
  check(response, { '2xx response': r => r.status >= 200 && r.status < 300 });
}
export function handleSummary(data) {
  return { [__ENV.SMARTLOO_LOAD_SUMMARY || '/evidence/summary.json']: JSON.stringify(data, null, 2) };
}
