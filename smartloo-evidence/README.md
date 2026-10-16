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
