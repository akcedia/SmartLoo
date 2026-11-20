"""Fail a required suite when its JUnit evidence is missing, incomplete or skipped."""

import argparse
from pathlib import Path
import xml.etree.ElementTree as ET


def verify_report(path, minimum):
    cases = list(ET.parse(path).iter("testcase"))
    failures = sum(case.find("failure") is not None for case in cases)
    errors = sum(case.find("error") is not None for case in cases)
    skipped = sum(case.find("skipped") is not None for case in cases)
    passed = len(cases) - failures - errors - skipped
    print(f"{path}: {passed} passed, {failures} failed, {errors} errors, {skipped} skipped")
    if failures or errors or skipped or passed < minimum:
        raise ValueError(f"Required suite needs at least {minimum} passing cases and zero skips")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", type=Path)
    parser.add_argument("--minimum", type=int, required=True)
    args = parser.parse_args()
    if args.minimum < 1:
        parser.error("minimum must be positive")
    verify_report(args.report, args.minimum)
