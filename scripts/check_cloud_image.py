"""Offline cloud image smoke test; no ports, credentials or databases exposed."""
import argparse
import subprocess
from uuid import uuid4


CHECKS = '''
import json, os, pathlib, time, urllib.request, urllib.error
base = 'http://127.0.0.1:8085'
for attempt in range(80):
    try:
        urllib.request.urlopen(base + '/healthz', timeout=1).close()
        break
    except (OSError, urllib.error.URLError):
        time.sleep(0.25)
else:
    raise RuntimeError('Image did not become live')
checks = []
for path, expected in [('/', 200), ('/sign-in', 200), ('/admin', 200),
                       ('/healthz', 200), ('/assets/missing.js', 404),
                       ('/manifest.webmanifest', 200), ('/icons/favicon-32.png', 200),
                       ('/icons/apple-touch-icon.png', 200), ('/icons/icon-192.png', 200),
                       ('/icons/icon-512.png', 200), ('/icons/icon-maskable-512.png', 200),
                       ('/api/v1/admin/metrics/summary', 401),
                       ('/api/v1/toilets/nearby?lat=100&lon=29', 422)]:
    try:
        with urllib.request.urlopen(base + path, timeout=5) as response:
            status = response.status
    except urllib.error.HTTPError as error:
        status = error.code
    assert status == expected, (path, status, expected)
    checks.append(dict(path=path, status=status))
assert os.getuid() == 10001
assert pathlib.Path('/etc/ssl/certs/ca-certificates.crt').is_file()
print(json.dumps(dict(checks=checks, uid=os.getuid(), ca_bundle=True)))
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--image', default='smartloo-cloud:free82')
    args = parser.parse_args()
    name = 'smartloo-cloud-smoke-' + uuid4().hex[:12]
    subprocess.run(['docker', 'run', '--rm', '-d', '--name', name,
                    '--network', 'none', '--memory', '512m', '-e', 'PORT=8085', args.image],
                   check=True, capture_output=True, text=True)
    try:
        result = subprocess.run(['docker', 'exec', '-i', name, 'python', '-'],
                                input=CHECKS, capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError(result.stderr)
        print(result.stdout.strip())
    finally:
        subprocess.run(['docker', 'stop', '--time', '10', name], check=True, capture_output=True)


if __name__ == '__main__':
    main()
