"""Build and verify a labelled source candidate from a clean committed checkout.

Local preparation only: no GitHub write, tag, registry push or Learn submission.
File classification/completeness checks do not replace a credential-content audit.
"""
import hashlib
import json
from pathlib import Path, PurePosixPath
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PREFIX = 'SmartLoo/'
NOTICE = 'CANDIDATE-STATUS.txt'
FORBIDDEN_PARTS = {'.git', '.venv', 'node_modules', 'dist', '__pycache__', '.pytest_cache', '.scannerwork'}


def validate_paths(paths):
    for name in paths:
        path = PurePosixPath(name)
        lower = path.name.lower()
        if path.is_absolute() or '..' in path.parts or '\\' in name:
            raise ValueError('Unsafe archive path: ' + name)
        if any(part.lower() in FORBIDDEN_PARTS for part in path.parts):
            raise ValueError('Generated/private directory must not be packaged: ' + name)
        if lower != '.env.example' and (lower.startswith('.env') or lower.endswith('.env')):
            raise ValueError('Private environment file must not be packaged: ' + name)
        if path.suffix.lower() in {'.pem', '.key', '.p12', '.pfx', '.dump', '.sqlite', '.sqlite3'}:
            raise ValueError('Private credential/database artifact requires review: ' + name)
        if 'credentials' in lower and path.suffix.lower() == '.json':
            raise ValueError('Credential artifact requires review: ' + name)


def main():
    def git(*args):
        return subprocess.check_output(['git', *args], cwd=ROOT)
    if git('status', '--porcelain', '--untracked-files=normal').strip():
        raise SystemExit('Commit/review local changes first; candidate must identify one clean revision')
    revision = git('rev-parse', 'HEAD').decode().strip()
    paths = [p.decode('utf-8') for p in git('ls-tree', '-r', '--name-only', '-z', 'HEAD').split(b'\0') if p]
    validate_paths(paths)
    if NOTICE in paths:
        raise SystemExit('Reserved candidate notice name is already tracked')
    output = ROOT / '.venv/submission-candidates'
    output.mkdir(parents=True, exist_ok=True)
    archive = output / ('SmartLoo-candidate-' + revision[:12] + '.zip')
    if archive.exists():
        raise SystemExit('Candidate already exists; preserve it rather than overwrite')
    subprocess.run(['git', 'archive', '--format=zip', '--prefix=' + PREFIX,
                    '--output=' + str(archive), revision], cwd=ROOT, check=True)
    with zipfile.ZipFile(archive, 'a', compression=zipfile.ZIP_DEFLATED) as package:
        package.writestr(PREFIX + NOTICE,
            'LOCAL CANDIDATE ONLY - NOT FINAL / NOT SUBMITTED\nCommit: ' + revision +
            '\nOpen acceptance remains in docs/testing/FINAL-RELEASE-CHECKLIST-2026-11-24.md.\n'
            'Review final main, tests, reports and approvals before academic submission.\n')
    with zipfile.ZipFile(archive) as package:
        if package.testzip() is not None:
            raise RuntimeError('Candidate CRC verification failed')
        files = [entry.filename for entry in package.infolist() if not entry.is_dir()]
        expected = {PREFIX + path for path in paths} | {PREFIX + NOTICE}
        if set(files) != expected or len(files) != len(expected):
            raise RuntimeError('Candidate does not contain exactly the committed source plus its notice')
        validate_paths([name[len(PREFIX):] for name in files])
    report = dict(status='local candidate, not submitted', commit=revision,
                  tracked_file_count=len(paths), packaged_file_count=len(files),
                  bytes=archive.stat().st_size, sha256=hashlib.sha256(archive.read_bytes()).hexdigest(),
                  crc_verified=True, exact_committed_file_set_verified=True,
                  private_generated_path_guard_passed=True, full_credential_audit=False,
                  github_write=False, learn_submission=False)
    archive.with_suffix('.manifest.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))
    print('Local output: .venv/submission-candidates/' + archive.name)


if __name__ == '__main__':
    main()
