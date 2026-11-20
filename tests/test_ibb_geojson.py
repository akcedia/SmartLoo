"""Synthetic normalization evidence; no downloads, real raw data or DB writes."""

import json
import unittest
from copy import deepcopy

from src.ibb_geojson import normalize_geojson


def feature(name="Örnek Tesis", lon=29.0, lat=41.0, **properties):
    return {"type": "Feature", "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {"MAHAL_ADI": name, "ILCE": "Örnek İlçe", "TUVALET_DURUM": "Aktif", **properties}}


def collection(*rows):
    return {"type": "FeatureCollection", "features": list(rows)}


class GeoJSONTests(unittest.TestCase):
    def assert_rejected(self, document, code):
        result = normalize_geojson(document)
        self.assertFalse(result["valid"])
        self.assertFalse(result["import_ready"])
        self.assertEqual(result["candidates"], [])
        self.assertIn(code, [e["code"] for e in result["errors"]])
        return result

    def test_A01_A04_known_coordinate_order(self):
        result = normalize_geojson(collection(feature(X=29.0, Y=41.0)))
        self.assertTrue(result["valid"])
        row = result["candidates"][0]
        self.assertEqual((row["longitude"], row["latitude"]), (29.0, 41.0))
        self.assertNotIn("status", row)
        self.assertNotIn("id", row)
        self.assertNotIn("source_id", row)

    def test_A02_unknown_fields_and_unverified_bakim_odasi(self):
        result = normalize_geojson(collection(feature(BAKIM_ODASI="Var", TUVALET_TIP="Sabit")))
        row = result["candidates"][0]
        for field in ("has_disabled_access", "has_baby_changing", "is_free", "price_try", "opening_hours"):
            self.assertIsNone(row[field])
        self.assertEqual(row["source_properties"]["BAKIM_ODASI"], "Var")

    def test_A03_invalid_coordinates_and_types(self):
        for lon, lat in ((181, 41), (29, 95), (True, 41), ("29", 41), (float("nan"), 41),
                         (29, float("inf")), (10 ** 500, 41)):
            with self.subTest(lon_type=type(lon).__name__, lat_type=type(lat).__name__):
                self.assert_rejected(collection(feature(lon=lon, lat=lat)), "INVALID_COORDINATE")

    def test_coordinate_boundaries(self):
        for lon, lat in ((-180, -90), (180, 90), (0, 0)):
            self.assertTrue(normalize_geojson(collection(feature(lon=lon, lat=lat)))["valid"])

    def test_A05_mismatch_and_tolerance(self):
        self.assert_rejected(collection(feature(X=30)), "COORDINATE_MISMATCH")
        self.assertTrue(normalize_geojson(collection(feature(X=29.00000001)))["valid"])
        self.assert_rejected(collection(feature(X=29.00000002)), "COORDINATE_MISMATCH")

    def test_A06_one_bad_record_rejects_entire_batch(self):
        result = self.assert_rejected(collection(feature(), feature(name=" ")), "MISSING_REQUIRED_FIELD")
        self.assertEqual(result["errors"][0]["feature_index"], 1)

    def test_geometry_is_never_replaced_by_XY(self):
        row = feature(X=29, Y=41)
        row.pop("geometry")
        self.assert_rejected(collection(row), "INVALID_GEOMETRY")

    def test_nonpoint_or_3D_geometry_is_rejected(self):
        row = feature()
        row["geometry"]["type"] = "LineString"
        self.assert_rejected(collection(row), "INVALID_GEOMETRY")
        row = feature()
        row["geometry"]["coordinates"].append(0)
        self.assert_rejected(collection(row), "INVALID_COORDINATE")

    def test_A08_duplicate_identity_is_not_merged(self):
        self.assert_rejected(collection(feature(), feature()), "IDENTITY_CONFLICT")
        self.assert_rejected(collection(feature(lon=29, lat=41), feature(lon=29.0, lat=41.0)), "IDENTITY_CONFLICT")

    def test_A09_same_coordinate_different_name_is_not_merged(self):
        result = normalize_geojson(collection(feature("Tesis A"), feature("Tesis B")))
        self.assertTrue(result["valid"])
        self.assertEqual(len(result["candidates"]), 2)
        self.assertEqual(result["warnings"][0]["code"], "SHARED_COORDINATE")
        self.assertFalse(result["import_ready"])

    def test_A11_seasonal_or_unknown_status_blocks_batch(self):
        for value in ("Dönemlik", "Bilinmeyen", ""):
            self.assert_rejected(collection(feature(TUVALET_DURUM=value)), "UNRESOLVED_STATUS")

    def test_active_inactive_retained_without_opening_hour_claim(self):
        for value in ("Aktif", "Pasif"):
            row = normalize_geojson(collection(feature(TUVALET_DURUM=value)))["candidates"][0]
            self.assertEqual(row["source_properties"]["TUVALET_DURUM"], value)
            self.assertIsNone(row["opening_hours"])
            self.assertNotIn("is_open", row)

    def test_optional_absent_and_null_are_unknown_but_wrong_types_fail(self):
        row = normalize_geojson(collection(feature(BAKIM_ODASI=None)))["candidates"][0]
        self.assertIsNone(row["source_properties"]["BAKIM_ODASI"])
        self.assert_rejected(collection(feature(BAKIM_ODASI=True)), "INVALID_FIELD_TYPE")
        self.assert_rejected(collection(feature(X=None)), "INVALID_COORDINATE")

    def test_required_names_and_length(self):
        for name in (None, "", " "):
            self.assert_rejected(collection(feature(name=name)), "MISSING_REQUIRED_FIELD")
        self.assert_rejected(collection(feature(name=123)), "INVALID_FIELD_TYPE")
        self.assert_rejected(collection(feature(name="a" * 151)), "FIELD_TOO_LONG")
        self.assertTrue(normalize_geojson(collection(feature(name="a" * 150)))["valid"])

    def test_NFC_and_spacing_preserve_Turkish_and_case(self):
        result = normalize_geojson(collection(feature(name="  U\u0308sku\u0308dar  İskele  ")))
        self.assertEqual(result["candidates"][0]["name"], "Üsküdar İskele")

    def test_unknown_properties_do_not_become_facility_facts(self):
        row = normalize_geojson(collection(feature(is_free=True, has_disabled_access=True, usage_count=999)))["candidates"][0]
        self.assertIsNone(row["is_free"])
        self.assertIsNone(row["has_disabled_access"])
        self.assertNotIn("usage_count", row)
        self.assertNotIn("average_cleanliness", row)

    def test_invalid_document_or_feature(self):
        for document in (None, [], {}, {"type": "FeatureCollection", "features": None}, collection(None)):
            self.assert_rejected(document, "INVALID_DOCUMENT")

    def test_json_duplicate_keys_nonfinite_and_malformed_are_rejected(self):
        for document in ('{"type":"FeatureCollection","type":"Feature"}',
                         '{"type":"FeatureCollection","features":[],"x":NaN}', 'bad JSON'):
            self.assert_rejected(document, "INVALID_DOCUMENT")

    def test_json_string_and_mapping_agree_and_inputs_are_unchanged(self):
        document = collection(feature())
        before = deepcopy(document)
        self.assertEqual(normalize_geojson(document), normalize_geojson(json.dumps(document)))
        self.assertEqual(document, before)

    def test_no_automatic_import_permission_even_for_valid_or_empty_batch(self):
        for document in (collection(), collection(feature())):
            result = normalize_geojson(document)
            self.assertTrue(result["valid"])
            self.assertFalse(result["import_ready"])
            self.assertIn("approved_source_identity", result["pending_decisions"])


if __name__ == "__main__":
    unittest.main()
