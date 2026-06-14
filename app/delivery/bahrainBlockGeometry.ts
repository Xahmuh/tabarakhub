import { BahrainBlockGeometry, BranchDeliveryProfile, DeliveryZoneClass } from '../../types';

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

const GOVERNORATE_PROPERTY_CANDIDATES = [
  'governorate', 'Governorate', 'GOVERNORATE', 'gov', 'GOV', 'governorate_name', 'GOVERNORATE_NAME'
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

export interface GeoPoint {
  lng: number;
  lat: number;
}

export interface BranchMarkerPoint {
  branchCode: string;
  originBlockNumber: string;
  point: GeoPoint | null;
  status: 'mapped' | 'unmapped';
  reason?: string;
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

export const getBlockPolygon = (
  dataset: BlockGeometryDataset,
  blockNumber: string | null | undefined
): BlockGeometryFeature | null => {
  const key = normalizeBlockKey(blockNumber);
  if (!key) return null;
  return dataset.byBlock.get(key) || null;
};

/** Return a real governorate property from the GeoJSON if the dataset carries one. */
export const getBlockGovernorate = (
  dataset: BlockGeometryDataset,
  blockNumber: string | null | undefined
): string | null => {
  const feature = getBlockPolygon(dataset, blockNumber);
  if (!feature) return null;
  for (const candidate of GOVERNORATE_PROPERTY_CANDIDATES) {
    const value = feature.raw[candidate];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  const lowerMap = new Map(Object.keys(feature.raw).map(key => [key.toLowerCase(), key]));
  for (const candidate of GOVERNORATE_PROPERTY_CANDIDATES) {
    const actual = lowerMap.get(candidate.toLowerCase());
    if (!actual) continue;
    const value = feature.raw[actual];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return null;
};

const ringsFromGeometry = (geometry: any): Array<Array<[number, number]>> => {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates || [];
  if (geometry.type === 'MultiPolygon') return (geometry.coordinates || []).flat();
  return [];
};

const centroidFromRing = (ring: Array<[number, number]>): { point: GeoPoint; weight: number } | null => {
  if (!Array.isArray(ring) || ring.length === 0) return null;
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    if (![x1, y1, x2, y2].every(Number.isFinite)) continue;
    const cross = x1 * y2 - x2 * y1;
    twiceArea += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }

  if (Math.abs(twiceArea) < 1e-12) {
    const valid = ring.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
    if (valid.length === 0) return null;
    return {
      point: {
        lng: valid.reduce((sum, [x]) => sum + x, 0) / valid.length,
        lat: valid.reduce((sum, [, y]) => sum + y, 0) / valid.length
      },
      weight: 1
    };
  }

  return {
    point: {
      lng: cx / (3 * twiceArea),
      lat: cy / (3 * twiceArea)
    },
    weight: Math.abs(twiceArea)
  };
};

const centroidForGeometry = (geometry: unknown): GeoPoint | null => {
  const parts = ringsFromGeometry(geometry).map(centroidFromRing).filter(Boolean) as Array<{ point: GeoPoint; weight: number }>;
  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
  if (parts.length === 0 || totalWeight <= 0) return null;

  return {
    lng: parts.reduce((sum, part) => sum + part.point.lng * part.weight, 0) / totalWeight,
    lat: parts.reduce((sum, part) => sum + part.point.lat * part.weight, 0) / totalWeight
  };
};

export const getBlockCentroid = (
  dataset: BlockGeometryDataset,
  blockNumber: string | null | undefined
): GeoPoint | null => {
  const feature = getBlockPolygon(dataset, blockNumber);
  if (!feature) return null;
  return centroidForGeometry(feature.geometry);
};

export const getBranchMarkerPoint = (
  dataset: BlockGeometryDataset,
  branchCode: string,
  originBlockNumber: string | null | undefined
): BranchMarkerPoint => {
  const block = normalizeBlockKey(originBlockNumber);
  if (!block) {
    return { branchCode, originBlockNumber: '', point: null, status: 'unmapped', reason: 'missing origin block' };
  }

  const point = getBlockCentroid(dataset, block);
  if (!point) {
    return { branchCode, originBlockNumber: block, point: null, status: 'unmapped', reason: 'origin block not found in GeoJSON' };
  }

  return { branchCode, originBlockNumber: block, point, status: 'mapped' };
};

export const calculateDistanceKm = (pointA: GeoPoint | null | undefined, pointB: GeoPoint | null | undefined): number | null => {
  if (!pointA || !pointB) return null;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(pointB.lat - pointA.lat);
  const dLng = toRad(pointB.lng - pointA.lng);
  const lat1 = toRad(pointA.lat);
  const lat2 = toRad(pointB.lat);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const classifyDistanceZone = (
  distanceKm: number | null | undefined,
  profile: Pick<BranchDeliveryProfile, 'coreRadiusKm' | 'standardRadiusKm' | 'extendedRadiusKm'> | null | undefined
): DeliveryZoneClass => {
  if (distanceKm === null || distanceKm === undefined || !Number.isFinite(distanceKm) || !profile) return 'unavailable';
  if (distanceKm <= profile.coreRadiusKm) return 'core';
  if (distanceKm <= profile.standardRadiusKm) return 'standard';
  if (distanceKm <= profile.extendedRadiusKm) return 'extended';
  return 'outside_range';
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
