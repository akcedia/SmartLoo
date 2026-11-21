"""Synthetic offline normalization demo; no download or persistence."""

import json
from copy import deepcopy

from src.ibb_geojson import normalize_geojson


def main():
    document = {"type": "FeatureCollection", "features": [{
        "type": "Feature", "geometry": {"type": "Point", "coordinates": [29.0, 41.0]},
        "properties": {"MAHAL_ADI": "Sentetik Örnek Tesis", "ILCE": "Örnek İlçe",
                       "TUVALET_DURUM": "Aktif", "BAKIM_ODASI": "Var", "X": 29.0, "Y": 41.0},
    }]}
    valid = normalize_geojson(document)
    seasonal = deepcopy(document)
    seasonal["features"][0]["properties"]["TUVALET_DURUM"] = "Dönemlik"
    rejected = normalize_geojson(seasonal)
    assert valid["valid"] and not valid["import_ready"]
    assert valid["candidates"][0]["has_baby_changing"] is None
    assert not rejected["valid"] and rejected["candidates"] == []
    print(json.dumps({"mode": "synthetic_offline_demo", "valid_normalization": valid,
                      "unresolved_seasonal_status": rejected}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
