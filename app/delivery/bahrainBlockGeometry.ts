import { BahrainBlockGeometry } from '../../types';

/**
 * Optional Bahrain block-boundary geometry loader.
 *
 * Real polygons are served as a static asset at /data/bahrain-blocks.geojson
 * (see public/data/bahrain-blocks.metadata.json for provenance + license status).
 * If the file is absent or invalid, every export here degrades gracefully so the
 * Delivery Coverage dashboard keeps its matrix fallback and never crashes.
 *
 * No geometry is invented. No map API keys are used.
 */

const GEOJSON_URL = '/data/bahrain-blocks.geojson';

// Property names the GeoJSON might use for the block number, in priority order.
const BLOCK_PROPERTY_CANDIDATES = [
  'BLOCK_NO', 'block_number', 'block', 'BLOCK', 'BLOCKCODE', 'blockCode', 'block_no', 'BLOCK_NUMBER'
];

export interface BlockGeometryFeature {
  blockNumber: string;
  geometry: unknown; // GeoJSON geometry (Polygon | MultiPolygon)
  raw: Record<string, unknown>;
}

export interface BlockGeometryDataset {
  available: boolean;
  selectedProperty: string | null;
  featureCount: number;
  byBlock: Map<string, BlockGeometryFeature>;
  duplicateKeys: number;
  error?: string;
}

const EMPTY: BlockGeometryDataset = {
  available: false,
  selectedProperty: null,
  featureCount: 0,
  byBlock: new Map(),
  duplicateKeys: 0
};

/** Normalize a block value: stringify, trim, preserve leading zeros. */
export const normalizeBlockKey = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const pickBlockProperty = (props: Record<string, unknown>): string | null => {
  for (const candidate of BLOCK_PROPERTY_CANDIDATES) {
    if (candidate in props && normalizeBlockKey(props[candidate]).length > 0) return candidate;
  }
  // Case-insensitive second pass.
  const lowerMap = new Map(Object.keys(props).map(k => [k.toLowerCase(), k]));
  for (const candidate of BLOCK_PROPERTY_CANDIDATES) {
    const actual = lowerMap.get(candidate.toLowerCase());
    if (actual && normalizeBlockKey(props[actual]).length > 0) return actual;
  }
  return null;
};

let cache: BlockGeometryDataset | null = null;
let inflight: Promise<BlockGeometryDataset> | null = null;

/**
 * Load and index the block geometry once. Returns an empty (unavailable) dataset
 * on any failure — missing file, non-200, invalid JSON, or unrecognized schema.
 */
export const loadBahrainBlockGeometry = async (): Promise<BlockGeometryDataset> => {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async (): Promise<BlockGeometryDataset> => {
    try {
      const res = await fetch(GEOJSON_URL, { cache: 'force-cache' });
      if (!res.ok) return { ...EMPTY, error: `HTTP ${res.status}` };

      const json: any = await res.json();
      const features: any[] = Array.isArray(json?.features) ? json.features : [];
      if (features.length === 0) return { ...EMPTY, error: 'No features' };

      // Determine the block property from the first feature that has one.
      let selectedProperty: string | null = null;
      for (const f of features) {
        const prop = pickBlockProperty(f?.properties || {});
        if (prop) { selectedProperty = prop; break; }
      }
      if (!selectedProperty) return { ...EMPTY, error: 'No recognizable block property' };

      const byBlock = new Map<string, BlockGeometryFeature>();
      let duplicateKeys = 0;
      for (const f of features) {
        if (!f?.geometry) continue;
        const key = normalizeBlockKey((f.properties || {})[selectedProperty]);
        if (!key) continue;
        if (byBlock.has(key)) { duplicateKeys += 1; continue; }
        byBlock.set(key, { blockNumber: key, geometry: f.geometry, raw: f.properties || {} });
      }

      cache = {
        available: byBlock.size > 0,
        selectedProperty,
        featureCount: features.length,
        byBlock,
        duplicateKeys
      };
      return cache;
    } catch (e: any) {
      return { ...EMPTY, error: e?.message || 'Failed to load geometry' };
    } finally {
      inflight = null;
    }
  })();

  return inflight;
};

/** Resolve geometry for a delivery block number, or null if not present. */
export const geometryForBlock = (
  dataset: BlockGeometryDataset,
  blockNumber: string | null | undefined
): unknown | null => {
  const key = normalizeBlockKey(blockNumber);
  if (!key) return null;
  return dataset.byBlock.get(key)?.geometry ?? null;
};

/** Map a delivery block to the typed future-map hook shape. */
export const toBahrainBlockGeometry = (
  feature: BlockGeometryFeature,
  governorate?: string
): BahrainBlockGeometry => ({
  blockNumber: feature.blockNumber,
  governorate,
  polygonGeoJson: feature.geometry
});
