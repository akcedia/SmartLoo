"""Enumerate every test module and link it to FR/NFRs; fail on omissions.

Links express verification scope, not proof that all requirement targets are met.
Backend execution counts are read from the supplied real JUnit artifact.
"""
import argparse
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
BACKEND = {
    "account_deletion": "FR-10 NFR-03 NFR-08", "account_deletion_integration": "FR-10 NFR-03 NFR-08",
    "admin_analytics": "FR-06 FR-07 NFR-03 NFR-04", "admin_analytics_integration": "FR-06 FR-07 NFR-03 NFR-04",
    "admin_import": "FR-07 NFR-03 NFR-04", "admin_import_postgres": "FR-07 NFR-03 NFR-04",
    "ai_boundaries": "FR-04 NFR-02 NFR-08", "ai_consistency_contract": "FR-03 FR-04 FR-10 NFR-08",
    "ai_guarded_publication": "FR-03 FR-04 NFR-08", "ai_openai": "FR-04 NFR-02 NFR-08",
    "ai_recommendations": "FR-02 FR-04 NFR-02", "ai_restricted_policy": "FR-04 NFR-08",
    "ai_review_adapter": "FR-03 FR-04 NFR-08", "ai_summary_service": "FR-04 NFR-02 NFR-07 NFR-08",
    "auth_password_bytes": "FR-08 NFR-03 NFR-04", "auth_postgres": "FR-08 NFR-03",
    "auth_timing_dummy": "FR-08 NFR-03 NFR-04", "cloud_app": "FR-09 NFR-04 NFR-07",
    "facility_admin": "FR-05 FR-10 NFR-03", "gemini_http_acceptance": "FR-04 NFR-02 NFR-08",
    "gemini_provider": "FR-04 NFR-02 NFR-08", "gemini_recommendation_followup": "FR-04 NFR-02 NFR-08",
    "ibb_geojson": "FR-07 NFR-04", "ibb_import": "FR-07 NFR-04", "ibb_import_postgres": "FR-07 NFR-04",
    "local_runtime": "NFR-09", "nearby_pool": "FR-01 NFR-01 NFR-07",
    "nearby_postgis": "FR-01 FR-02 NFR-01 NFR-04", "nearby_response": "FR-01 FR-02 NFR-01 NFR-04",
    "nearby_safety": "FR-01 FR-02 NFR-04", "recommendation_http": "FR-02 FR-04 NFR-02 NFR-04",
    "recommendation_wiring": "FR-01 FR-04 NFR-07",
    "requirements": "FR-01 FR-02 FR-03 FR-04 FR-05 FR-06 FR-07 FR-08 FR-09 FR-10 NFR-03 NFR-04 NFR-08",
    "review_consistency": "FR-03 FR-04 FR-10 NFR-08", "review_publication": "FR-03 FR-04 NFR-08",
    "review_scores_mongo": "FR-03 FR-06 FR-07 NFR-08", "reviews": "FR-03 NFR-03 NFR-04 NFR-08",
    "reviews_integration": "FR-03 FR-10 NFR-03 NFR-08", "suggestions": "FR-05 FR-10 NFR-03 NFR-04",
    "summary_http": "FR-03 FR-04 NFR-02 NFR-08", "toilet_detail": "FR-01 FR-09 NFR-04",
    "turkish_ai_acceptance": "FR-04 NFR-08", "zap_regressions": "FR-08 FR-09 NFR-04",
}
FRONTEND = {
    "app/a11y.test.jsx": "FR-09 NFR-05 NFR-06",
    "features/admin/admin.live.jsx": "FR-06 FR-07 NFR-03 NFR-08",
    "features/admin/contract.test.jsx": "FR-06 FR-07 NFR-04",
    "features/auth/accountDeletion.live.jsx": "FR-10 NFR-03 NFR-08",
    "features/auth/accountDeletion.test.jsx": "FR-10 NFR-03 NFR-08",
    "features/auth/auth.test.jsx": "FR-08 NFR-03 NFR-04",
    "features/map/ai.live.jsx": "FR-04 NFR-02 NFR-08",
    "features/map/cityDirectory.test.jsx": "FR-01 FR-02 FR-07 FR-09 NFR-04",
    "features/map/directions.test.jsx": "FR-09 NFR-08",
    "features/map/layout.test.jsx": "FR-02 FR-09 NFR-05 NFR-06",
    "features/map/map.test.jsx": "FR-03 FR-04 FR-09 NFR-04 NFR-06",
    "features/map/MapView.density.test.jsx": "FR-09 NFR-05",
    "features/map/markerDensity.test.js": "FR-09 NFR-05",
    "features/map/recommendationPanel.test.jsx": "FR-02 FR-04 NFR-10",
    "features/map/reviewSession.test.jsx": "FR-03 FR-08 NFR-03 NFR-08",
    "features/suggestions/suggestion.test.jsx": "FR-05 FR-08 NFR-03 NFR-04",
    "features/admin/api/admin.test.js": "FR-06 FR-07 NFR-04",
    "features/admin/api/httpAdapter.test.js": "FR-06 FR-07 FR-08 NFR-03",
    "features/admin/components/components.test.jsx": "FR-06 FR-07 NFR-05 NFR-06",
    "features/admin/import/adminImport.live.jsx": "FR-07 NFR-03 NFR-04",
    "features/admin/import/AdminImport.test.jsx": "FR-07 NFR-03 NFR-04",
    "features/admin/import/importApi.test.js": "FR-07 NFR-03 NFR-04",
    "features/admin/moderation/moderation.live.jsx": "FR-05 FR-10 NFR-03 NFR-08",
    "features/admin/moderation/moderation.test.jsx": "FR-05 FR-10 NFR-03 NFR-08",
    "features/admin/moderation/moderationRace.test.jsx": "FR-05 FR-10 NFR-03 NFR-08",
    "shared/http/apiClient.test.js": "FR-08 NFR-03 NFR-04",
    "shared/i18n/i18n.test.jsx": "NFR-10", "shared/session/session.test.js": "FR-08 FR-10 NFR-03 NFR-08",
    "shared/settings/settings.test.jsx": "FR-09 NFR-05 NFR-06 NFR-10", "shared/theme/theme.test.jsx": "NFR-05 NFR-06",
}


def build(junit):
    cases = ET.parse(junit).findall(".//testcase")
    results = {}
    for case in cases:
        module = next((p for p in case.get("classname", "").split(".") if p.startswith("test_")), None)
        if module:
            results.setdefault(module, []).append(case)
    rows = []
    paths = sorted((ROOT / "tests").glob("test_*.py"))
    assert {p.stem[5:] for p in paths} == set(BACKEND), "Unmapped Python test module"
    for path in paths:
        measured = results.get(path.stem, [])
        failures = sum(bool(x.findall("failure") or x.findall("error") or x.findall("skipped")) for x in measured)
        rows.append(dict(file=str(path.relative_to(ROOT)).replace("\\", "/"), requirements=BACKEND[path.stem[5:]].split(),
                         evidence="evidence/coverage/backend-junit.xml", junit_cases=len(measured),
                         execution="passed" if measured and not failures else "failed or unmeasured"))
    actual_front = {str(p.relative_to(ROOT / "frontend/src")).replace("\\", "/") for p in (ROOT / "frontend/src").rglob("*")
                    if p.is_file() and (".test." in p.name or ".live." in p.name)}
    assert actual_front == set(FRONTEND), "Unmapped frontend test module"
    for name, ids in sorted(FRONTEND.items()):
        rows.append(dict(file="frontend/src/" + name, requirements=ids.split(),
                         evidence="evidence/coverage/frontend-test-summary.json" if ".test." in name else "evidence/coverage/mounted-main-workflows.json",
                         execution="mounted integration scope" if ".live." in name else "frontend component scope"))
    rows.extend([
        dict(file="tests/release_checks.test.cjs", requirements=["NFR-09"], evidence="evidence/coverage/release-guards.log", execution="Node deployment guards"),
        dict(file="integration/ai_redis_suite.py", requirements=["FR-04", "NFR-02", "NFR-07"], evidence="evidence/coverage/mounted-main-workflows.json", execution="real Redis component scope"),
    ])
    catalog = json.loads((ROOT / "tests/requirements_cases.json").read_text(encoding="utf-8"))
    tc_names = [case for case in cases if "test_requirements" in case.get("classname", "")]
    automated_ids = {"TC-" + m.group(1) for case in tc_names if (m := re.match(r"test_tc_(\d+)", case.get("name", "")))}
    acceptance = []
    for spec in catalog:
        acceptance.append(dict(id=spec["id"], requirement=spec["requirement"], title=spec["title"],
                               file="tests/test_requirements.py" if spec["id"] in automated_ids else "docs/REQUIREMENTS.MD section 5.1; manual browser procedure",
                               mode=spec["verification"]["mode"], automated_pass=spec["id"] in automated_ids))
    # TC-22/23 remain explicit manual procedures, not invented executable files.
    for row in acceptance:
        if not row["automated_pass"]:
            row["file"] = "docs/REQUIREMENTS.MD section 5.1; historical browser evidence and final UI review scopes"
    fr = {f"FR-{n:02}" for n in range(1, 11)}
    nfr = {f"NFR-{n:02}" for n in range(1, 11)}
    mapped = {item for row in rows for item in row["requirements"]}
    return dict(definition="A linked test module counts as traced; this is not full acceptance or production conformance.",
                python_modules=len(paths), frontend_modules=len(actual_front), modules=rows, acceptance=acceptance,
                requirements=dict(functional_mapped=len(fr & mapped), functional_total=10, functional_percent=100 * len(fr & mapped) / 10,
                                  nonfunctional_mapped=len(nfr & mapped), nonfunctional_total=10, nonfunctional_percent=100 * len(nfr & mapped) / 10),
                acceptance_mapped_percent=100 * len(acceptance) / 48, automated_acceptance_ids=len(automated_ids),
                automated_acceptance_percent=100 * len(automated_ids) / 48, automated_catalog_instances=len(tc_names))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--junit", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    data = build(args.junit)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({key: data[key] for key in ("python_modules", "frontend_modules", "requirements", "automated_acceptance_ids", "automated_catalog_instances")}))
