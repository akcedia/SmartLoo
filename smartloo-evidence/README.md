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
The profile was regenerated from the supplied evidence ZIP and matched the committed JSON exactly, including file hashes. Include the two `*.metadata.json` files beside the script as well as the GeoJSON and XLSX files for complete hash equality. Run in a separate working directory or copy profile.json first, since the script overwrites it. A verified shared raw-download URL remains to be added; raw XLSX files are not committed here.
