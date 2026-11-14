# SmartLoo Evidence

Supporting data and analysis scripts for Issue #14.

- profile.json: Dataset profiling results.
- profile_sources.py: Python profiling script.

## Reproducing the Analysis

### Requirements
- Python 3
- openpyxl

### Instructions

Place the original GeoJSON and XLSX files in the same directory as `profile_sources.py`.

The XLSX files must contain a worksheet named `Veri`.

Install the required dependency:

```bash
python3 -m pip install openpyxl
```

Run the analysis:

```bash
python3 profile_sources.py
```

The script generates `profile.json` containing:
- Source file SHA-256 hashes
- Dataset record counts
- Duplicate record analysis
- Field statistics
- Facility matching analysis

**Note:** Running the script overwrites the existing `profile.json`.

SHA-256 checksums for the original XLSX, GeoJSON and metadata files are recorded under the `files` key in `profile.json`.

## Independent reproduction, 24 October 2026
The profile was regenerated from the supplied evidence ZIP and matched the committed JSON exactly, including file hashes. Include the two `*.metadata.json` files beside the script as well as the GeoJSON and XLSX files for complete hash equality. Run in a separate working directory or copy profile.json first, since the script overwrites it. The verified existing raw-package link and the access-check limits are recorded below; raw XLSX files are not committed here.

## Raw package access and reproducible commands (25 October)

Shared raw package: [SmartLoo_Evidence_Package.zip](https://drive.google.com/file/d/1LIb0Os6XRlFNi_wjheVSSiH_bhEPk060/view?usp=drive_link).

Package checked on 25 October 2026: 39,250,814 bytes; Drive modified time 16 October 2026, 22:01:52 UTC. Archive SHA-256: `03b577bfbb980b82b01c092cb74eb338b245c2f3af1b7900814156c7b0bb1a92`. This is the existing package supplied by Emir, not a fresh İBB download.

Access check: the connected owner account downloaded the ZIP successfully; Drive permission metadata lists Özgür as a reader. The file is restricted to the listed accounts. No download was executed in Özgür's session, and access for every other team member is not established. Those recipients must request access from the owner if needed; no sharing permissions were changed.

Open the link while signed into an authorized Google account, download the ZIP using Drive's download action, and extract it. Set RAW_EVIDENCE_DIR below to the extracted `SmartLoo_Evidence_Package` folder. The ZIP contains all six required raw inputs, plus README and DataStore samples; profile_sources.py/profile.json come from this repository, not from the old ZIP. A complete raw package does not require those two repository files to be added to the archive. Do not commit raw XLSX files.

Required raw files (original bytes and filenames):

- `9585ab4a-d160-4541-8a41-b86eeec4c1cc.geojson`
- `5cc31ccc-af58-4f39-8ddb-044b140b2728.xlsx`
- `8994ef18-64cf-4d77-a96e-667ddbaebc98.xlsx`
- `35aaebc1-7e60-458e-9707-4dd00ee7b98c.xlsx`
- `sehir-tuvaletleri-veri-seti.metadata.json`
- `sehir-tuvaletleri-kullanim-istatistikleri.metadata.json`

Run from repository root on the reviewed weekly branch. Set RAW_EVIDENCE_DIR to the actual extracted directory containing these six files; it is a local path, not a download URL. The commands use a separate working directory because profile_sources.py writes beside itself.

```sh
export RAW_EVIDENCE_DIR="/absolute/path/to/extracted/raw-files"
python3 -m venv /tmp/smartloo-profile-venv
/tmp/smartloo-profile-venv/bin/python -m pip install openpyxl==3.1.5
/tmp/smartloo-profile-venv/bin/python - <<'PY'
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile

evidence = Path("smartloo-evidence").resolve()
raw = Path(os.environ["RAW_EVIDENCE_DIR"]).resolve()
expected = json.loads((evidence / "profile.json").read_text(encoding="utf-8"))
work = Path(tempfile.mkdtemp(prefix="smartloo-profile-"))
shutil.copy2(evidence / "profile_sources.py", work)
for name, spec in expected["files"].items():
    source = raw / name
    payload = source.read_bytes()
    if len(payload) != spec["bytes"] or hashlib.sha256(payload).hexdigest() != spec["sha256"]:
        raise SystemExit(f"Raw-file mismatch: {name}")
    shutil.copy2(source, work / name)
subprocess.run([sys.executable, str(work / "profile_sources.py")], check=True)
actual = json.loads((work / "profile.json").read_text(encoding="utf-8"))
if actual != expected:
    raise SystemExit(f"Profile mismatch; inspect {work}")
print("PASS: all six raw hashes/sizes and complete profile JSON match")
print("GeoJSON records:", actual["facility"]["rows"])
print("XLSX rows:", sum(item["rows"] for item in actual["usage"].values()))
print("Working directory:", work)
PY
```

Expected aggregate counts: 422 GeoJSON records and 1,048,575 XLSX rows (373,933 + 284,137 + 390,505). These are source-record counts, not verified unique physical facilities. Usage counts are neither hygiene scores nor live occupancy.

The script profiles every XLSX/GeoJSON in its own directory and includes *.metadata.json in the manifest. Copying only the manifest-listed inputs into a clean directory avoids accidental extra inputs. Name-matching candidates use lossy normalization; they are not approved facility joins or the proposed production fingerprint.

Local reproduction on 25 October used the raw files already present in the workspace and the script/profile from weekly commit `28c0fa99d903862f41a97d1ec4374d5a5846dad0`. Both the profile script and the Python block above were executed in separate working directories with openpyxl 3.1.5: the entire generated JSON and all six file hashes/sizes matched the committed profile. The subsequently downloaded Drive ZIP contains all six inputs with identical sizes and SHA-256 hashes. This links the successful command run to the shared package without repeating the full analysis. Recipient-session download remains untested; permission metadata and owner-session download are the verified access evidence.
