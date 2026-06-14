# Bahrain Block GeoJSON — Integration

How the real Bahrain block polygons are wired into Delivery Coverage Analytics.

## Where the data came from

- Downloaded repo: `bahrain-geojson-main` (README: "Bahrain GeoJSON — Areas/Blocks
  boundaries, Buildings locations. Export Date: 9 Sep 2021"). No LICENSE file.
- File used: `bahrain-geojson-main/blocks.json` — 491 `Polygon` features, block id
  in `BLOCK_NO`. See `docs/BAHRAIN_BLOCK_GEOJSON_VALIDATION.md` for the full
  evaluation.

## License status

```text
Internal-use accepted.
External/commercial redistribution license not confirmed.
```

The Bahrain block map is **enabled for internal operational use**. The current
dataset is suitable for internal staging/operations, but its license is not
confirmed for external resale, redistribution, or commercial client packaging
(no license accompanies the source). If this product is sold externally, replace
the dataset with a licensed/approved source or obtain written permission. This is
recorded in `public/data/bahrain-blocks.metadata.json` and `PRODUCTION_GAPS.md`.
The map is not blocked and is not gated behind a production blocker.

## Files added

- `public/data/bahrain-blocks.geojson` — optimized polygons (BLOCK_NO + geometry,
  6-decimal coords, 3.23 MB). Served statically; fetched lazily by the coverage tab.
- `public/data/bahrain-blocks.metadata.json` — provenance, counts, selected
  property, optimization, seed coverage, and license status.
- `app/delivery/bahrainBlockGeometry.ts` — loader + matcher.
- `app/delivery/components/BlockCoverageMap.tsx` — inline SVG block map (no library).

## How block matching works

`bahrainBlockGeometry.ts` loads `/data/bahrain-blocks.geojson` once (cached) and
indexes features by a **flexible block property**, trying these names in order:

```
BLOCK_NO, block_number, block, BLOCK, BLOCKCODE, blockCode, block_no, BLOCK_NUMBER
```

(then a case-insensitive pass). For the current dataset it selects `BLOCK_NO`.

Values are **normalized** before comparison: `String(value).trim()`, preserving
leading zeros, so they compare safely against delivery `block_number` (text).
The dashboard then matches each served block from `DeliveryCoverageSummary.blocks`
to a polygon by normalized key.

The loader is **fail-safe**: a missing file, non-200 response, invalid JSON, or
unrecognized schema returns an "unavailable" dataset and the dashboard keeps its
matrix fallback. It never throws into the UI.

## What is used as the block number

`BLOCK_NO` (numeric in the source, stored as a string in the integrated copy).

## Coverage behaviour (what the manager sees)

- **Geometry available:** an emerald banner "Bahrain block geometry loaded (N
  polygons) — X of Y served blocks mapped". A **Map / Matrix** toggle appears;
  Map renders the real polygons coloured by order volume (click for branch
  breakdown). Served blocks without geometry remain in Matrix view.
- **Geometry unavailable/invalid:** the original blue notice and the matrix
  fallback only. No map, no fake geography.

The map is a plain inline SVG (equirectangular projection of the real polygons) —
**no map library, no tiles, no API keys.**

## How to replace the dataset later

1. Drop a newer GeoJSON `FeatureCollection` (Polygon/MultiPolygon, one feature
   per block) at `public/data/bahrain-blocks.geojson`.
2. If its block id uses a different property name, add it to
   `BLOCK_PROPERTY_CANDIDATES` in `app/delivery/bahrainBlockGeometry.ts`.
3. Update `public/data/bahrain-blocks.metadata.json` (counts, property, license).
4. To re-optimize from a raw source, round coordinates and keep only the block id
   property (the generation approach is documented in the validation report).

Do not introduce paid map APIs or expose any map key in the frontend.

## Why the matrix fallback still exists

- It is the guaranteed view when geometry is missing, invalid, or still loading.
- Four seeded blocks (and any future unmatched blocks) have no polygon — the
  matrix still shows them.
- The matrix groups by governorate/area for analytical reading even when the map
  is available (toggle).

## Internal-use status

The Bahrain block map is **accepted for internal use** and stays enabled. The
geometry is a display aid over real delivery data; coverage KPIs and
recommendations do not depend on it. The only open item is the **external
redistribution license**, which is not confirmed — that affects commercial resale
or packaging of this product to third parties, not internal operation. Overall
project status remains **B) dedicated-client staging-ready only**.
