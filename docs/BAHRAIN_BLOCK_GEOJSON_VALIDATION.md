# Bahrain Block GeoJSON — Validation Report

Validation of the downloaded Bahrain block-boundary dataset against the Delivery
Coverage module. Generated from local inspection of the source repository.

## Candidate source

- **Source folder:** `A:\ACTIONS\tabarakhub\bahrain-geojson-main`
- **Files present:** `areas.json` (3.0 MB, 187 area polygons), `blocks.json`
  (5.8 MB, 491 block polygons), `buildings.json` (89 MB, building points),
  `README.md`. No `LICENSE` file.
- **Selected file:** `blocks.json` — the only block-level boundary file.
  `areas.json` is area/governorate-level only; `buildings.json` is point data
  (not blocks) and far too large for frontend use.

## Block file evaluation (`blocks.json`)

| Property | Value |
|---|---|
| Top-level type | `FeatureCollection` |
| Feature count | **491** |
| Geometry types | `Polygon` (491 — no MultiPolygon/Point/Line) |
| Coordinate system | WGS84 lng/lat (bounds lng 50.32–50.82, lat 25.57–26.34 — matches Bahrain) |
| Block property candidates seen | `BLOCK_NO`, `BLOCK_AR` (blank), `OBJECTID` |
| **Selected block property** | **`BLOCK_NO`** (numeric, e.g. 101, 102, 905) |
| Block number range | 101 – 1218 |
| Duplicate block keys | **0** |
| Approx. size | 5.76 MB original → 3.23 MB optimized |

### Sample properties (first 5 features)

```
{"OBJECTID":476,"BLOCK_NO":101,"BLOCK_AR":" ","SHAPE.AREA":4060001.9,"SHAPE.LEN":9905.6}
{"OBJECTID":40, "BLOCK_NO":102,"BLOCK_AR":" ","SHAPE.AREA":185893.4, "SHAPE.LEN":1896.7}
{"OBJECTID":102,"BLOCK_NO":103,"BLOCK_AR":" ","SHAPE.AREA":352674.3, "SHAPE.LEN":3043.7}
{"OBJECTID":299,"BLOCK_NO":104,"BLOCK_AR":" ","SHAPE.AREA":118262.4, "SHAPE.LEN":1985.0}
{"OBJECTID":288,"BLOCK_NO":105,"BLOCK_AR":" ","SHAPE.AREA":113175.4, "SHAPE.LEN":1459.0}
```

## Compatibility with delivery `block_number`

Delivery `block_number` is stored as text (e.g. `'101'`, `'905'`). `BLOCK_NO` is
numeric and stringifies to the same form, so matching is exact after
`String(BLOCK_NO).trim()`.

Cross-check against the seeded `delivery_blocks` directory (454 blocks):

- **450 / 454 seeded blocks (99.1%) have a matching polygon.**
- Seeded blocks **without** geometry (4): `532`, `534`, `535`, `610`.
- Geometry blocks **not** in the current seed: **41** (renderable if such orders appear).

Live matching against actual `delivery_orders` is computed at runtime in the
dashboard ("N of M served blocks mapped"); it requires real Supabase delivery
data and is therefore environment-dependent, not asserted here.

## Optimization applied

`public/data/bahrain-blocks.geojson` is a derived copy:

- Coordinates rounded to **6 decimal places** (~0.1 m) — lossless at display
  scale, boundary shapes unchanged.
- Kept only `BLOCK_NO` (as a string); dropped `OBJECTID`, `SHAPE.AREA`,
  `SHAPE.LEN`, and the blank `BLOCK_AR`.
- Result: 5.76 MB → **3.23 MB** (56% of original).

The original `blocks.json` remains the source of truth in
`bahrain-geojson-main/`; regenerate from it to change precision.

## Limitations

- Static export dated **9 Sep 2021** (per README) — block boundaries may be
  out of date versus current cadastre.
- 3.23 MB is fetched lazily as a static asset only when the manager Block
  Coverage tab opens; it is **not** in the JS bundle. Still notable on slow
  mobile networks.
- Four seeded blocks have no polygon; they remain visible in the matrix view.

## License status

```text
Internal-use accepted.
External/commercial redistribution license not confirmed.
```

The Bahrain block map is **enabled for internal operational use**. The current
dataset is suitable for internal staging/operations, but its license is not
confirmed for external resale, redistribution, or commercial client packaging
(the source repository contains no LICENSE file; it is a 2021 static export of
what appear to be Bahrain cadastral block boundaries republished by a third
party). If this product is sold externally, replace the dataset with a
licensed/approved source or obtain written permission.

The map is **not blocked** and is not gated behind a production blocker; it is an
internal display aid over real delivery data, and coverage KPIs/recommendations
do not depend on it.
