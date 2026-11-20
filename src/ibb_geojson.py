"""Read-only GeoJSON normalization for #59, adapter-ai-contract sections 3–5.

Produces internal candidates, never SQL rows, permanent/source IDs or writes.
valid=True means only that normalization passed. Production import always
requires separately approved source identity, status mapping and persistence.
"""

import json
from decimal import Decimal
from math import isfinite
import unicodedata

XY_TOLERANCE = Decimal("0.00000001")
RAW_TEXT_FIELDS = ("TUVALET_DURUM", "TUVALET_TIP", "BAKIM_ODASI", "HIZMET_YERI")


def _no_duplicate_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate_key")
        result[key] = value
    return result


def _no_nonfinite(_):
    raise ValueError("nonfinite_json")


def _number(value):
    if type(value) not in (int, float):
        return False
    try:
        return isfinite(value)
    except OverflowError:
        return False


def _text(value):
    return " ".join(unicodedata.normalize("NFC", value).split())


def _numeric_key(value):
    # For duplicate review only, not a permanent ID/fingerprint. No SQL rounding.
    return Decimal(str(value)).normalize()


def normalize_geojson(document, *, allowed_statuses=("Aktif", "Pasif")):
    errors, candidates, warnings = [], [], []

    def error(index, field, code, message):
        errors.append({"feature_index": index, "field": field, "code": code, "message": message})

    def result():
        return {"valid": not errors, "candidates": candidates if not errors else [],
                "errors": errors, "warnings": warnings, "import_ready": False,
                "pending_decisions": ["approved_source_identity", "approved_status_mapping", "persistence_integration"]}

    if isinstance(document, str):
        try:
            document = json.loads(document, object_pairs_hook=_no_duplicate_keys, parse_constant=_no_nonfinite)
        except (ValueError, RecursionError):
            error(None, "document", "INVALID_DOCUMENT", "Expected an unambiguous finite JSON document.")
            return result()
    if not isinstance(document, dict) or document.get("type") != "FeatureCollection" or not isinstance(document.get("features"), list):
        error(None, "document", "INVALID_DOCUMENT", "Expected a FeatureCollection with a features array.")
        return result()

    identities, coordinates = {}, {}
    for index, feature in enumerate(document["features"]):
        start_errors = len(errors)
        if not isinstance(feature, dict) or feature.get("type") != "Feature":
            error(index, "type", "INVALID_DOCUMENT", "Expected a GeoJSON Feature.")
            continue
        geometry, properties = feature.get("geometry"), feature.get("properties")
        if not isinstance(geometry, dict) or geometry.get("type") != "Point":
            error(index, "geometry", "INVALID_GEOMETRY", "Expected Point geometry; X/Y are not a geometry fallback.")
            continue
        point = geometry.get("coordinates")
        if not isinstance(point, list) or len(point) != 2 or not all(_number(value) for value in point):
            error(index, "geometry.coordinates", "INVALID_COORDINATE", "Expected exactly two finite JSON numbers: longitude, latitude.")
            continue
        lon, lat = point
        if not -180 <= lon <= 180:
            error(index, "geometry.coordinates[0]", "INVALID_COORDINATE", "Longitude must be between -180 and 180.")
        if not -90 <= lat <= 90:
            error(index, "geometry.coordinates[1]", "INVALID_COORDINATE", "Latitude must be between -90 and 90.")
        if not isinstance(properties, dict):
            error(index, "properties", "INVALID_FIELD_TYPE", "Expected source properties object.")
            continue
        normalized = {}
        for source, target in (("MAHAL_ADI", "name"), ("ILCE", "district")):
            value = properties.get(source)
            if value is None or (isinstance(value, str) and not _text(value)):
                error(index, "properties." + source, "MISSING_REQUIRED_FIELD", "Name and district must be nonempty text.")
            elif not isinstance(value, str):
                error(index, "properties." + source, "INVALID_FIELD_TYPE", "Name and district must be text.")
            else:
                normalized[target] = _text(value)
                if target == "name" and len(normalized[target]) > 150:
                    error(index, "properties." + source, "FIELD_TOO_LONG", "Facility name exceeds the shared 150-character limit.")
        raw = {}
        for field in RAW_TEXT_FIELDS:
            if field not in properties:
                continue
            value = properties[field]
            # Explicit null is retained as unknown; no truthy conversion.
            if value is not None and not isinstance(value, str):
                error(index, "properties." + field, "INVALID_FIELD_TYPE", "Optional metadata must be text or null.")
            else:
                raw[field] = value
        for field, axis in (("X", lon), ("Y", lat)):
            if field not in properties:
                continue
            value = properties[field]
            if not _number(value):
                error(index, "properties." + field, "INVALID_COORDINATE", "Supplied X/Y must be finite numbers.")
            elif abs(Decimal(str(value)) - Decimal(str(axis))) > XY_TOLERANCE:
                error(index, "properties." + field, "COORDINATE_MISMATCH", "Supplied X/Y disagrees with geometry.")
            else:
                raw[field] = value
        status = properties.get("TUVALET_DURUM")
        # Known labels are retained only; even these are NOT approved SQL maps.
        if isinstance(status, str) and status not in allowed_statuses:
            error(index, "properties.TUVALET_DURUM", "UNRESOLVED_STATUS", "Source status requires an approved mapping/calendar.")
        if len(errors) != start_errors:
            continue
        coordinate_key = (_numeric_key(lon), _numeric_key(lat))
        candidate_key = (normalized["district"], normalized["name"], *coordinate_key)
        if candidate_key in identities:
            error(index, "identity", "IDENTITY_CONFLICT", "Repeated normalized identity needs review; no automatic merge.")
            continue
        identities[candidate_key] = index
        if coordinate_key in coordinates:
            warnings.append({"feature_index": index, "code": "SHARED_COORDINATE",
                             "related_feature_index": coordinates[coordinate_key]})
        coordinates[coordinate_key] = index
        candidates.append({**normalized, "longitude": lon, "latitude": lat,
            "has_disabled_access": None, "has_baby_changing": None, "is_free": None,
            "price_try": None, "opening_hours": None, "source_properties": raw})
    return result()
