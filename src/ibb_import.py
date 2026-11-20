"""Reviewed, file-bound İBB import plans. No network or writes at app startup."""
from decimal import Decimal
import hashlib
import json
import uuid
from urllib.request import urlopen, Request, build_opener, HTTPRedirectHandler

from psycopg.types.json import Jsonb

from src.db import connect
from src.ibb_geojson import normalize_geojson, _no_duplicate_keys, _no_nonfinite
from src.review_coordination import review_lock_key

RESOURCE = "9585ab4a-d160-4541-8a41-b86eeec4c1cc"
URL = f"https://data.ibb.gov.tr/dataset/8789b75c-bae9-4acb-8287-bfc0ba88c8ea/resource/{RESOURCE}/download/sehir_tuvaletleri_verisi.geojson"
LICENSE = "https://data.ibb.gov.tr/license"
STATUSES = {"Aktif": "ACTIVE", "Pasif": "CLOSED", "Dönemlik": None, None: None}
DISTRICTS = "Adalar,Arnavutköy,Ataşehir,Avcılar,Bağcılar,Bahçelievler,Bakırköy,Başakşehir,Bayrampaşa,Beşiktaş,Beykoz,Beylikdüzü,Beyoğlu,Büyükçekmece,Çatalca,Çekmeköy,Esenler,Esenyurt,Eyüpsultan,Fatih,Gaziosmanpaşa,Güngören,Kadıköy,Kağıthane,Kartal,Küçükçekmece,Maltepe,Pendik,Sancaktepe,Sarıyer,Silivri,Sultanbeyli,Sultangazi,Şile,Şişli,Tuzla,Ümraniye,Üsküdar,Zeytinburnu".split(",")


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
                      default=lambda number: str(number.normalize()) if isinstance(number, Decimal) else str(number))


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def upper_tr(text):
    return text.translate(str.maketrans({"i": "İ", "ı": "I"})).upper()


def stage(raw):
    """Keep original numeric precision for identity, validate through Emir's adapter."""
    document = json.loads(raw.decode("utf-8-sig"), parse_float=Decimal,
                          object_pairs_hook=_no_duplicate_keys, parse_constant=_no_nonfinite)
    if not isinstance(document, dict) or not isinstance(document.get("features"), list) or not document["features"]:
        raise ValueError("Nonempty FeatureCollection required")
    # Exact full-feature duplicates only. Different metadata at the same identity
    # is still rejected by the normalizer; no fuzzy/coordinate-only merge.
    features, indexes, seen = [], [], {}
    for i, feature in enumerate(document["features"]):
        key = canonical(feature)
        if key in seen:
            indexes[seen[key]].append(i)
        else:
            seen[key] = len(features)
            features.append(feature)
            indexes.append([i])
    validation_document = json.loads(json.dumps({**document, "features": features}, default=float))
    normalized = normalize_geojson(validation_document, allowed_statuses=("Aktif", "Pasif", "Dönemlik"))
    if not normalized["valid"]:
        raise ValueError(canonical(normalized["errors"]))
    district_names = {upper_tr(name): name for name in DISTRICTS}
    rows = []
    for feature, candidate, source_indexes in zip(features, normalized["candidates"], indexes):
        try:
            district = district_names[upper_tr(candidate["district"])]
        except KeyError:
            raise ValueError("Unknown Istanbul district") from None
        lon, lat = feature["geometry"]["coordinates"]
        if not -180 <= lon <= 180 or not -90 <= lat <= 90:
            raise ValueError("Coordinate exceeds exact numeric bounds")
        for field, axis in (("X", lon), ("Y", lat)):
            if field in feature["properties"] and abs(Decimal(str(feature["properties"][field])) - Decimal(str(axis))) > Decimal("0.00000001"):
                raise ValueError("Exact X/Y precision disagrees with geometry")
        def number(value):
            return format(Decimal(str(value)).normalize(), "f")
        identity = ["ibb", "v1", district, candidate["name"], number(lon), number(lat)]
        source_id = "v1:" + digest(identity)
        properties = candidate["source_properties"]
        rows.append({"source_id": source_id, "identity": identity,
                     "name": candidate["name"], "district": district,
                     "longitude": number(lon), "latitude": number(lat),
                     "status": STATUSES[properties.get("TUVALET_DURUM")],
                     "source_properties": properties, "source_indexes": source_indexes})
    # Different source spellings must not collide after approved district mapping.
    if len({r["source_id"] for r in rows}) != len(rows):
        raise ValueError("Normalized identity collision; manual resolution required")
    return {"policy": "ibb-v1", "resource_id": RESOURCE,
            "source_sha256": hashlib.sha256(raw).hexdigest(),
            "source_rows": len(document["features"]), "unique_rows": len(rows),
            "duplicate_rows": len(document["features"]) - len(rows), "rows": rows}


def make_plan(raw):
    staged = stage(raw)
    with connect() as conn:
        registry = {row["fingerprint"]: str(row["toilet_id"]) for row in conn.execute(
            "SELECT fingerprint, toilet_id FROM external_source_identities WHERE source='ibb'")}
        old = conn.execute("SELECT id::text, name, district, latitude, longitude FROM toilets WHERE source='ibb'").fetchall()
    staged["targets"] = {r["source_id"]: registry.get(r["source_id"], str(uuid.uuid4())) for r in staged["rows"]}
    staged["new_identities"] = [r["source_id"] for r in staged["rows"] if r["source_id"] not in registry]
    staged["not_present_source_ids"] = sorted(set(registry) - {r["source_id"] for r in staged["rows"]})
    # Name/position changes are proposals, never silently matched or deleted.
    staged["possible_existing_matches"] = {
        r["source_id"]: [row["id"] for row in old if
            (row["district"] == r["district"] and row["name"] == r["name"]) or
            (abs(float(row["latitude"]) - float(r["latitude"])) < .00001 and
             abs(float(row["longitude"]) - float(r["longitude"])) < .00001)]
        for r in staged["rows"] if r["source_id"] not in registry
    }
    staged["possible_existing_matches"] = {k: v for k, v in staged["possible_existing_matches"].items() if v}
    return staged


def apply_plan(raw, plan, approved_sha256):
    if digest(plan) != approved_sha256:
        raise ValueError("Explicit approval must match the exact plan SHA-256")
    staged = stage(raw)
    if any(plan.get(key) != value for key, value in staged.items()):
        raise ValueError("Plan does not match source bytes or current normalization policy")
    if set(plan.get("targets", {})) != {r["source_id"] for r in staged["rows"]}:
        raise ValueError("Every source identity needs one reviewed target UUID")
    targets = {key: str(uuid.UUID(value)) for key, value in plan["targets"].items()}
    if len(set(targets.values())) != len(targets):
        raise ValueError("Multiple batch records target one facility; manual resolution required")
    counts = {"inserted": 0, "updated": 0, "unchanged": 0}
    with connect() as conn:
        # Serializes imports. All writes, registry and provenance commit together.
        if not conn.execute("SELECT pg_try_advisory_xact_lock(-610061) AS acquired").fetchone()["acquired"]:
            raise ValueError("Another external import is running")
        acquired = conn.execute("SELECT bool_and(pg_try_advisory_xact_lock(k)) AS acquired FROM unnest(%s::bigint[]) AS keys(k)",
                                (sorted({review_lock_key(v) for v in targets.values()}),)).fetchone()["acquired"]
        if not acquired or conn.execute("SELECT EXISTS(SELECT 1 FROM review_operations WHERE toilet_id=ANY(%s::uuid[])) AS pending",
                                        (list(targets.values()),)).fetchone()["pending"]:
            raise ValueError("Review operation busy or requires repair; import unchanged")
        baseline = conn.execute("SELECT id::text,name,district,latitude,longitude FROM toilets WHERE source='ibb'").fetchall()
        for row in staged["rows"]:
            key, target = row["source_id"], targets[row["source_id"]]
            registered = conn.execute("SELECT toilet_id::text FROM external_source_identities WHERE source='ibb' AND fingerprint=%s", (key,)).fetchone()
            if registered and registered["toilet_id"] != target:
                raise ValueError("Existing source identity cannot be reassigned")
            possible_match = any((old["district"] == row["district"] and old["name"] == row["name"]) or
                                 (abs(float(old["latitude"]) - float(row["latitude"])) < .00001 and
                                  abs(float(old["longitude"]) - float(row["longitude"])) < .00001) for old in baseline)
            if possible_match and not registered and not conn.execute(
                "SELECT 1 FROM toilets WHERE id=%s AND source='ibb'", (target,)).fetchone():
                raise ValueError("Possible rename/relocation needs a reviewed existing UUID alias")
            existing = conn.execute("SELECT source FROM toilets WHERE id=%s", (target,)).fetchone()
            if existing and existing["source"] != "ibb":
                raise ValueError("Import cannot overwrite another source's facility")
            values = (row["name"], row["district"], row["latitude"], row["longitude"], row["status"], Jsonb(row["source_properties"]))
            if existing:
                changed = conn.execute("""UPDATE toilets SET name=%s,district=%s,latitude=%s,longitude=%s,status=%s,source_properties=%s
                    WHERE id=%s AND (name,district,latitude,longitude,status,source_properties) IS DISTINCT FROM
                    (%s,%s,%s::numeric(9,6),%s::numeric(9,6),%s::toilet_status,%s::jsonb)""",
                    (*values, target, *values)).rowcount
                counts["updated" if changed else "unchanged"] += 1
            else:
                conn.execute("""INSERT INTO toilets (name,district,latitude,longitude,status,source_properties,id,source,source_id)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,'ibb',%s)""", (*values, target, key))
                counts["inserted"] += 1
            conn.execute("""INSERT INTO external_source_identities (source,fingerprint,toilet_id,identity)
                VALUES ('ibb',%s,%s,%s) ON CONFLICT (source,fingerprint) DO NOTHING""", (key, target, Jsonb(row["identity"])))
        conn.execute("""INSERT INTO external_import_runs (source,resource_id,file_sha256,plan_sha256,source_rows,unique_rows,duplicate_rows)
            VALUES ('ibb',%s,%s,%s,%s,%s,%s)""", (RESOURCE, staged["source_sha256"], approved_sha256,
                                                 staged["source_rows"], staged["unique_rows"], staged["duplicate_rows"]))
    return {**counts, **{k: staged[k] for k in ("source_rows", "unique_rows", "duplicate_rows")}}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args):
        raise ValueError("Unexpected source redirect; existing database unchanged")


def download():
    with build_opener(NoRedirect).open(Request(URL, headers={"User-Agent": "SmartLoo/1.0"}), timeout=30) as response:
        raw = response.read(5_000_001)
    if len(raw) > 5_000_000:
        raise ValueError("Source exceeds 5 MB")
    stage(raw)  # No empty, invalid or partial snapshot replaces a valid download.
    return raw
