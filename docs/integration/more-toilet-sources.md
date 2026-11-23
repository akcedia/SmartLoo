# More toilet locations: candidate sources (23 Nov 2026)

Research note for the external data adapter (#59, owner Emir). Nothing here is
imported; the live İBB directory stays the only data source until the adapter,
licence and attribution are reviewed. Counts are a one-off measurement on
23 Nov 2026 and will drift.

## Measured

| Source | What | Count (İstanbul) | Licence / attribution |
|---|---|---|---|
| İBB Şehir Tuvaletleri (current) | Municipal public toilets | 436 features in the GeoJSON download | İBB Açık Veri Lisansı |
| OpenStreetMap `amenity=toilets` | Standalone toilets (parks, stations, piers, mosques' public WCs) | 542; **~370 are more than 50 m from any İBB facility** (152 within 30 m, 172 within 50 m, 193 within 100 m) | ODbL 1.0, "© OpenStreetMap contributors"; a combined database must stay under ODbL (share-alike) |
| OpenStreetMap `toilets=yes` | Toilets inside other places: malls 19, restaurants 24, cafés 21, fuel stations 5, other 112 | 214 | ODbL 1.0 |

Tag coverage of the 542 `amenity=toilets` features: `fee` 242 (yes 162, no 73),
`wheelchair` 180, `opening_hours` 85, `changing_table` 44, `access` 186
(customers 16). Most features have no name (11 named). Unknown tags must stay
`null`/"bilinmiyor", as with İBB data.

Method: Overpass API, `area["ISO3166-2"="TR-34"]`, `nwr[amenity=toilets]` and
`nwr[toilets=yes]`, `out tags center`; distance to the nearest İBB point with the
haversine formula.

## How it could fit (proposal, not decided)

1. A second adapter next to `src/ibb_geojson.py`, `source = "osm"`,
   `source_id = "node/123"` etc., so the existing `(source, source_id)` upsert and
   ADMIN import keep re-imports idempotent.
2. Skip OSM features within ~50 m of an İBB facility (or link them as the same
   place) instead of showing duplicates.
3. Map tags: `fee=no → is_free=true`, `fee=yes → false`, `wheelchair=yes|limited → true`,
   `wheelchair=no → false`, `changing_table=yes|no`; `access=customers|private`
   either excluded or shown as "müşterilere açık". `opening_hours` needs a parser;
   until then leave hours unknown.
4. Show "© OpenStreetMap contributors" on the map and detail panel for OSM records;
   confirm with Özgür/instructor that ODbL share-alike is acceptable for the
   project database before importing.

## Not usable as a data source

- Google Places, Apple Maps, Yandex: terms forbid storing/re-publishing results;
  paid API keys are also out of scope. Opening them for directions only (as the
  directions button does) is fine.
- Scraping websites or apps: not allowed by their terms and not reproducible.

## Worth checking later (not verified here)

- Overture Maps "places" and Foursquare Open Source Places (open licences) may
  list malls, stations and fuel stations with toilets; check category coverage
  for İstanbul and licence terms first.
- Metro İstanbul / İDO / Şehir Hatları station facility lists on the İBB open
  data portal.
