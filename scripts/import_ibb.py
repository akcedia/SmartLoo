"""Download, review and explicitly apply a file-bound İBB source plan."""
import argparse
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.ibb_import import download, make_plan, apply_plan, digest

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("action", choices=("download", "plan", "apply"))
parser.add_argument("--source", type=Path, required=True)
parser.add_argument("--plan", type=Path)
parser.add_argument("--approve-plan", help="SHA-256 of the reviewed complete plan")
args = parser.parse_args()
try:
    if args.action == "download":
        raw = download()
        args.source.parent.mkdir(parents=True, exist_ok=True)
        temporary = args.source.with_suffix(args.source.suffix + ".tmp")
        temporary.write_bytes(raw)
        temporary.replace(args.source)
        print("Validated official source downloaded; database unchanged")
    else:
        if not args.plan:
            parser.error("--plan is required")
        raw = args.source.read_bytes()
        if args.action == "plan":
            plan = make_plan(raw)
            args.plan.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
            print(json.dumps({"plan_sha256": digest(plan), "source_rows": plan["source_rows"],
                              "unique_rows": plan["unique_rows"], "duplicate_rows": plan["duplicate_rows"],
                              "new_identities": len(plan["new_identities"]),
                              "possible_existing_matches": len(plan["possible_existing_matches"])}, ensure_ascii=False))
        else:
            plan = json.loads(args.plan.read_text(encoding="utf-8"))
            print(json.dumps(apply_plan(raw, plan, args.approve_plan), ensure_ascii=False))
except (ValueError, OSError) as exc:
    raise SystemExit(f"Import stopped: {exc}")
