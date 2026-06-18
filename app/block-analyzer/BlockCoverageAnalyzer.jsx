import { useState, useMemo, useCallback, useEffect, useRef, createContext, useContext } from "react";
import { BackToModulesButton } from '../shared';
import { loadBahrainBlockGeometry } from '../delivery/bahrainBlockGeometry';

const DataContext = createContext();

// ─── DATA ─────────────────────────────────────────────────────────────────────
const EMPTY_COVERAGE_DATA = { Capital: {}, Muharraq: {}, North: {}, South: {} };

// ─── POPULATION DATA ──────────────────────────────────────────────────────────
const POP_DATA = {
  Capital:  { total:544290, bahraini:160297, non_bahraini:383993, males:368693, females:175597 },
  Muharraq: { total:289155, bahraini:141080, non_bahraini:148075, males:171095, females:118060 },
  North:    { total:419644, bahraini:298246, non_bahraini:121398, males:228919, females:190725 },
  South:    { total:323970, bahraini:127729, non_bahraini:196241, males:211168, females:112802 },
};
const TOTAL_POP = 1577059;

// Analyzer data starts empty. Admin-entered data is stored in browser storage
// until this module is migrated to a database-backed admin source.
const EMPTY_AREA_NAMES = {};
const EMPTY_PHARMACY_MAP = {};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const GOVS = ["Capital","Muharraq","North","South"];
const GOV_META = {
  Capital:  { color:"#3b82f6", ar:"محافظة العاصمة"   },
  Muharraq: { color:"#f59e0b", ar:"محافظة المحرق"      },
  North:    { color:"#10b981", ar:"المحافظة الشمالية"  },
  South:    { color:"#8b5cf6", ar:"المحافظة الجنوبية"  },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const Icon = ({ d, size=16, className="" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d}/>
  </svg>
);
const pctColor = p => p===100?"#059669":p>=70?"#10b981":p>=50?"#f59e0b":p>=25?"#ef4444":"#dc2626";
const pctBg    = p => p===100?"#ecfdf5":p>=70?"#d1fae5":p>=50?"#fffbeb":p>=25?"#fef2f2":"#fff1f2";

const COVERAGE_STORAGE_KEY = 'BCA_ADMIN_COVERAGE_DATA';
const PHARMACY_STORAGE_KEY = 'BCA_ADMIN_PHARMACY_MAP';
const AREA_STORAGE_KEY = 'BCA_ADMIN_AREA_NAMES';

const normalizeCoverageData = (value) => {
  const normalized = JSON.parse(JSON.stringify(EMPTY_COVERAGE_DATA));
  if (!value || typeof value !== "object") return normalized;

  GOVS.forEach(gov => {
    const zones = value[gov] && typeof value[gov] === "object" ? value[gov] : {};
    Object.entries(zones).forEach(([zone, data]) => {
      const name = String(zone || "").trim();
      if (!name) return;
      const covered = Array.isArray(data?.covered) ? data.covered : [];
      const gaps = Array.isArray(data?.gaps) ? data.gaps : [];
      const uniqueBlockCount = new Set([...covered, ...gaps].map(block => String(block))).size;
      const total = Math.max(Number(data?.total) || 0, uniqueBlockCount);
      normalized[gov][name] = {
        total,
        covered,
        gaps,
        coverage_pct: total ? Math.round((covered.length / total) * 100) : 0
      };
    });
  });

  return normalized;
};

const parseStoredJson = (key, fallback) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
};

const ProgressBar = ({ pct, color }) => (
  <div style={{background:"#f3f4f6",borderRadius:9999,height:6,overflow:"hidden"}}>
    <div style={{width:`${pct}%`,background:color,height:"100%",borderRadius:9999,transition:"width .5s ease"}}/>
  </div>
);

// ─── BAHRAIN BLOCK MAP ───────────────────────────────────────────────────────
const ANALYZER_MAP_W = 900;
const ANALYZER_MAP_H = 620;
const ANALYZER_MAP_PAD = 20;

const normalizeMapBlock = value => String(value ?? "").trim();

const ringsFromGeometry = (geometry) => {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return geometry.coordinates || [];
  if (geometry.type === "MultiPolygon") return (geometry.coordinates || []).flat();
  return [];
};

const MAP_ZOOM_MIN = 1;
const MAP_ZOOM_MAX = 3;
const MAP_ZOOM_STEP = 0.25;

const clampMapZoom = value => Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, Number(value.toFixed(2))));
const zoomTransform = zoom => (
  `translate(${ANALYZER_MAP_W / 2} ${ANALYZER_MAP_H / 2}) scale(${zoom}) translate(${-ANALYZER_MAP_W / 2} ${-ANALYZER_MAP_H / 2})`
);

const buildCoverageIndex = (coverageData, pharmacyMap = {}, areaNames = {}) => {
  const index = new Map();
  GOVS.forEach(gov => {
    const zones = coverageData[gov] || {};
    Object.entries(zones).forEach(([zone, data]) => {
      (data.covered || []).forEach(block => {
        const key = normalizeMapBlock(block);
        const pharmacies = pharmacyMap[key] || [];
        index.set(key, {
          blockNumber: key,
          gov,
          zone,
          status: "covered",
          count: pharmacies.length,
          pharmacies,
          area: areaNames[key] || pharmacies[0]?.area || "",
        });
      });
      (data.gaps || []).forEach(block => {
        const key = normalizeMapBlock(block);
        index.set(key, {
          blockNumber: key,
          gov,
          zone,
          status: "gap",
          count: 0,
          pharmacies: [],
          area: areaNames[key] || "",
        });
      });
    });
  });
  return index;
};

const getGeometryBounds = geometry => {
  if (!geometry?.available) return null;
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const feature of geometry.byBlock.values()) {
    for (const ring of ringsFromGeometry(feature.geometry)) {
      for (const [lng, lat] of ring) {
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    }
  }
  if (!Number.isFinite(minLng)) return null;
  return { minLng, maxLng, minLat, maxLat };
};

const createGeometryProjector = bounds => {
  if (!bounds) return null;
  const spanLng = bounds.maxLng - bounds.minLng || 1;
  const spanLat = bounds.maxLat - bounds.minLat || 1;
  const scale = Math.min(
    (ANALYZER_MAP_W - ANALYZER_MAP_PAD * 2) / spanLng,
    (ANALYZER_MAP_H - ANALYZER_MAP_PAD * 2) / spanLat
  );
  const offsetX = ANALYZER_MAP_PAD + ((ANALYZER_MAP_W - ANALYZER_MAP_PAD * 2) - spanLng * scale) / 2;
  const offsetY = ANALYZER_MAP_PAD + ((ANALYZER_MAP_H - ANALYZER_MAP_PAD * 2) - spanLat * scale) / 2;
  return ([lng, lat]) => ({
    x: offsetX + (lng - bounds.minLng) * scale,
    y: offsetY + (bounds.maxLat - lat) * scale,
  });
};

const buildAnalyzerMapPaths = (geometry, coverageIndex, activeGov = "all") => {
  if (!geometry?.available) return [];
  const project = createGeometryProjector(getGeometryBounds(geometry));
  if (!project) return [];

  const rows = [];
  for (const feature of geometry.byBlock.values()) {
    const blockNumber = normalizeMapBlock(feature.blockNumber);
    const info = coverageIndex.get(blockNumber);
    if (activeGov !== "all" && info?.gov !== activeGov) continue;

    let d = "";
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let sumX = 0;
    let sumY = 0;
    let pointCount = 0;

    for (const ring of ringsFromGeometry(feature.geometry)) {
      const points = ring
        .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat))
        .map(point => {
          const projected = project(point);
          minX = Math.min(minX, projected.x);
          maxX = Math.max(maxX, projected.x);
          minY = Math.min(minY, projected.y);
          maxY = Math.max(maxY, projected.y);
          sumX += projected.x;
          sumY += projected.y;
          pointCount += 1;
          return `${projected.x.toFixed(1)} ${projected.y.toFixed(1)}`;
        });
      if (points.length > 0) d += `M${points.join("L")}Z`;
    }

    if (d) {
      const bbox = {
        minX: Number.isFinite(minX) ? minX : 0,
        maxX: Number.isFinite(maxX) ? maxX : 0,
        minY: Number.isFinite(minY) ? minY : 0,
        maxY: Number.isFinite(maxY) ? maxY : 0,
      };
      rows.push({
        blockNumber,
        info,
        d,
        bbox,
        center: pointCount > 0
          ? { x: sumX / pointCount, y: sumY / pointCount }
          : { x: (bbox.minX + bbox.maxX) / 2, y: (bbox.minY + bbox.maxY) / 2 },
      });
    }
  }

  const statusRank = { gap: 2, covered: 3 };
  return rows.sort((a, b) => (statusRank[a.info?.status] || 1) - (statusRank[b.info?.status] || 1));
};

const blockMapTone = (info) => {
  if (!info) {
    return {
      label: "Not registered",
      fill: "#e5e7eb",
      hoverFill: "#cbd5e1",
      stroke: "#cbd5e1",
      text: "#64748b",
    };
  }
  if (info.status === "gap") {
    return {
      label: "Coverage gap",
      fill: "#fee2e2",
      hoverFill: "#fecaca",
      stroke: "#dc2626",
      text: "#b91c1c",
    };
  }
  if (info.count >= 5) {
    return {
      label: "Dense coverage",
      fill: "#0f766e",
      hoverFill: "#115e59",
      stroke: "#134e4a",
      text: "#0f766e",
    };
  }
  if (info.count >= 2) {
    return {
      label: "Covered",
      fill: "#7dd3fc",
      hoverFill: "#38bdf8",
      stroke: "#0284c7",
      text: "#0369a1",
    };
  }
  return {
    label: info.count === 0 ? "Covered, no detail" : "Light coverage",
    fill: info.count === 0 ? "#fef3c7" : "#bbf7d0",
    hoverFill: info.count === 0 ? "#fde68a" : "#86efac",
    stroke: info.count === 0 ? "#d97706" : "#16a34a",
    text: info.count === 0 ? "#b45309" : "#15803d",
  };
};

function BahrainAnalyzerMap({ activeGov, highlightedBlock }) {
  const { coverageData, pharmacyMap, areaNames } = useContext(DataContext);
  const [geometry, setGeometry] = useState(null);
  const [mapError, setMapError] = useState("");
  const [hoveredBlock, setHoveredBlock] = useState("");
  const [selectedBlock, setSelectedBlock] = useState("");
  const [mapZoom, setMapZoom] = useState(1);

  useEffect(() => {
    let mounted = true;
    loadBahrainBlockGeometry()
      .then(dataset => {
        if (!mounted) return;
        setGeometry(dataset);
        setMapError(dataset?.available ? "" : (dataset?.error || "Bahrain block geometry is unavailable."));
      })
      .catch(error => {
        if (mounted) setMapError(error?.message || "Bahrain block geometry is unavailable.");
      });
    return () => { mounted = false; };
  }, []);

  const coverageIndex = useMemo(
    () => buildCoverageIndex(coverageData, pharmacyMap, areaNames),
    [coverageData, pharmacyMap, areaNames]
  );

  const registeredStats = useMemo(() => {
    const rows = Array.from(coverageIndex.values()).filter(info => activeGov === "all" || info.gov === activeGov);
    const covered = rows.filter(info => info.status === "covered").length;
    const gaps = rows.filter(info => info.status === "gap").length;
    const pharmacies = rows.reduce((sum, info) => sum + info.count, 0);
    return { total: rows.length, covered, gaps, pharmacies };
  }, [activeGov, coverageIndex]);

  const paths = useMemo(
    () => buildAnalyzerMapPaths(geometry, coverageIndex, activeGov),
    [activeGov, coverageIndex, geometry]
  );

  const adjustMapZoom = useCallback((amount) => {
    setMapZoom(current => clampMapZoom(current + amount));
  }, []);

  const handleMapWheel = useCallback((event) => {
    event.preventDefault();
    adjustMapZoom(event.deltaY < 0 ? 0.15 : -0.15);
  }, [adjustMapZoom]);

  const activePath = useMemo(() => {
    const selected = selectedBlock || hoveredBlock;
    if (selected) return paths.find(path => path.blockNumber === selected) || null;
    if (highlightedBlock) return paths.find(path => path.blockNumber.includes(highlightedBlock)) || null;
    return null;
  }, [highlightedBlock, hoveredBlock, paths, selectedBlock]);

  const matchedRegisteredCount = useMemo(
    () => new Set(paths.filter(path => path.info).map(path => path.blockNumber)).size,
    [paths]
  );
  const unmatchedRegisteredCount = Math.max(registeredStats.total - matchedRegisteredCount, 0);
  const selectedInfo = activePath?.info;
  const selectedTone = blockMapTone(selectedInfo);

  return (
    <section className="glass-card rounded-2xl overflow-hidden mb-6">
      <div className="px-4 sm:px-5 py-4 border-b border-gray-100 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h3 className="font-bold text-gray-900 text-sm">Bahrain Block Map</h3>
          <p className="text-xs text-gray-400 mt-1">
            Pharmacy coverage by block{activeGov !== "all" ? ` · ${activeGov} Governorate` : ""}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
          {[
            { label: "Registered", value: registeredStats.total, color: "#4f46e5" },
            { label: "Covered", value: registeredStats.covered, color: "#059669" },
            { label: "Gaps", value: registeredStats.gaps, color: "#dc2626" },
            { label: "Pharmacies", value: registeredStats.pharmacies, color: "#0369a1" },
          ].map(item => (
            <div key={item.label} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 min-w-[104px]">
              <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{item.label}</div>
              <div className="text-sm font-black tabular-nums" style={{ color:item.color }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {mapError ? (
        <div className="m-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Bahrain map could not be loaded. Matrix and zone views are still available. {mapError}
        </div>
      ) : !geometry ? (
        <div className="p-5">
          <div className="h-[420px] rounded-xl bg-gray-100 animate-pulse" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 p-4 sm:p-5">
          <div
            className="relative min-h-[420px] rounded-xl border border-gray-100 bg-slate-50 overflow-hidden"
            onWheel={handleMapWheel}
          >
            <svg
              viewBox={`0 0 ${ANALYZER_MAP_W} ${ANALYZER_MAP_H}`}
              role="img"
              aria-label="Bahrain pharmacy coverage by block"
              className="h-[420px] sm:h-[520px] w-full"
            >
              <rect width={ANALYZER_MAP_W} height={ANALYZER_MAP_H} fill="#f8fafc" />
              <g transform={zoomTransform(mapZoom)}>
                <g>
                {paths.map(path => {
                  const tone = blockMapTone(path.info);
                  const isSelected = selectedBlock === path.blockNumber;
                  const isHovered = hoveredBlock === path.blockNumber;
                  const isHighlighted = highlightedBlock && path.blockNumber.includes(highlightedBlock);
                  const active = isSelected || isHovered || isHighlighted;
                  return (
                    <path
                      key={path.blockNumber}
                      d={path.d}
                      fill={active ? tone.hoverFill : tone.fill}
                      stroke={isSelected ? "#111827" : isHighlighted ? "#f59e0b" : tone.stroke}
                      strokeWidth={isSelected ? 2.4 : isHighlighted ? 1.8 : 0.65}
                      vectorEffect="non-scaling-stroke"
                      className="transition-colors duration-150"
                      style={{ cursor:"pointer" }}
                      onMouseEnter={() => setHoveredBlock(path.blockNumber)}
                      onMouseLeave={() => setHoveredBlock("")}
                      onClick={() => setSelectedBlock(current => current === path.blockNumber ? "" : path.blockNumber)}
                    >
                      <title>
                        {`Block ${path.blockNumber}${path.info?.area ? ` · ${path.info.area}` : ""} · ${tone.label}`}
                      </title>
                    </path>
                  );
                })}
              </g>
              {activePath && (
                <g pointerEvents="none">
                  <circle
                    cx={(activePath.bbox.minX + activePath.bbox.maxX) / 2}
                    cy={(activePath.bbox.minY + activePath.bbox.maxY) / 2}
                    r="16"
                    fill="#111827"
                    opacity="0.92"
                  />
                  <text
                    x={(activePath.bbox.minX + activePath.bbox.maxX) / 2}
                    y={(activePath.bbox.minY + activePath.bbox.maxY) / 2 + 4}
                    fill="white"
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="800"
                  >
                    {activePath.blockNumber}
                  </text>
                </g>
              )}
              </g>
            </svg>
            <div className="absolute right-3 top-3 rounded-xl border border-white/80 bg-white/95 p-1 shadow-sm backdrop-blur">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Zoom out"
                  onClick={() => adjustMapZoom(-MAP_ZOOM_STEP)}
                  className="h-8 w-8 rounded-lg border border-gray-200 text-sm font-black text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                  disabled={mapZoom <= MAP_ZOOM_MIN}
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => setMapZoom(1)}
                  className="h-8 min-w-[54px] rounded-lg border border-gray-200 px-2 text-[11px] font-black text-gray-600 hover:bg-gray-50"
                >
                  {Math.round(mapZoom * 100)}%
                </button>
                <button
                  type="button"
                  aria-label="Zoom in"
                  onClick={() => adjustMapZoom(MAP_ZOOM_STEP)}
                  className="h-8 w-8 rounded-lg bg-gray-900 text-sm font-black text-white hover:bg-gray-800 disabled:opacity-40"
                  disabled={mapZoom >= MAP_ZOOM_MAX}
                >
                  +
                </button>
              </div>
            </div>
            <div className="absolute left-3 bottom-3 rounded-lg border border-white/80 bg-white/90 px-3 py-2 shadow-sm backdrop-blur">
              <div className="flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                {[
                  { label: "Gap", color:"#dc2626" },
                  { label: "1 pharmacy", color:"#22c55e" },
                  { label: "2-4", color:"#38bdf8" },
                  { label: "5+", color:"#0f766e" },
                  { label: "Not registered", color:"#cbd5e1" },
                ].map(item => (
                  <span key={item.label} className="inline-flex items-center gap-1.5">
                    <span style={{ background:item.color }} className="h-2.5 w-2.5 rounded-sm" />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <aside className="rounded-xl border border-gray-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Selected Block</p>
                <h4 className="mt-1 text-2xl font-black text-gray-900">
                  {activePath ? activePath.blockNumber : "None"}
                </h4>
              </div>
              {selectedBlock && (
                <button
                  type="button"
                  onClick={() => setSelectedBlock("")}
                  className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-bold text-gray-500 hover:bg-gray-50"
                >
                  Clear
                </button>
              )}
            </div>

            {activePath ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border px-3 py-2" style={{ borderColor:selectedTone.stroke, background:`${selectedTone.fill}66` }}>
                  <div className="text-xs font-black" style={{ color:selectedTone.text }}>{selectedTone.label}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {selectedInfo?.gov || "Unassigned"}{selectedInfo?.zone ? ` · ${selectedInfo.zone}` : ""}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Area</p>
                  <p className="mt-1 text-sm font-semibold text-gray-800">{selectedInfo?.area || "No area name registered"}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Pharmacies</p>
                    <p className="mt-1 text-lg font-black text-gray-900">{selectedInfo?.count || 0}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Map Match</p>
                    <p className="mt-1 text-lg font-black text-gray-900">Yes</p>
                  </div>
                </div>

                {selectedInfo?.pharmacies?.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">Registered Pharmacies</p>
                    <div className="space-y-2 max-h-56 overflow-auto pr-1">
                      {selectedInfo.pharmacies.slice(0, 8).map((pharmacy, index) => (
                        <div key={`${pharmacy.name}-${index}`} className="rounded-lg border border-gray-100 px-3 py-2">
                          <p className="text-xs font-bold text-gray-800 leading-snug">{pharmacy.name}</p>
                          <p className="mt-1 text-[11px] text-gray-400">{pharmacy.group || "Independent"} · {pharmacy.type || "Pharmacy"}</p>
                        </div>
                      ))}
                    </div>
                    {selectedInfo.pharmacies.length > 8 && (
                      <p className="mt-2 text-xs font-semibold text-gray-400">
                        +{selectedInfo.pharmacies.length - 8} more pharmacies
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500">
                    {selectedInfo?.status === "gap"
                      ? "No pharmacy is registered in this block."
                      : "This polygon is available on the Bahrain map but is not registered in the analyzer dataset."}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-5 space-y-3 text-sm text-gray-500">
                <div className="rounded-lg bg-gray-50 px-3 py-3">
                  <p className="font-semibold text-gray-700">Map polygons loaded</p>
                  <p className="mt-1 text-xs text-gray-400">{paths.length} visible blocks from {geometry.featureCount} Bahrain polygons.</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-3">
                  <p className="font-semibold text-gray-700">Registered map matches</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {matchedRegisteredCount} matched{unmatchedRegisteredCount ? ` · ${unmatchedRegisteredCount} without polygon` : ""}.
                  </p>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}

// ─── BLOCK POPUP ─────────────────────────────────────────────────────────────
// Fixed position popup — positioned via getBoundingClientRect, no portal needed
function BlockPopup({ block, gov, triggerRef, onClose }) {
  const { pharmacyMap, areaNames } = useContext(DataContext);
  const pharmacies = pharmacyMap[String(block)] || [];
  const areaName   = areaNames[String(block)]   || "";
  const boxRef     = useRef(null);
  const m          = GOV_META[gov] || { color:"#6366f1" };

  // Compute position from trigger button
  const [pos, setPos] = useState({ top:0, left:0, width:320, ready:false });
  useEffect(() => {
    if (!triggerRef?.current) return;
    const r   = triggerRef.current.getBoundingClientRect();
    const W   = window.innerWidth;
    const H   = window.innerHeight;
    const PW  = Math.min(320, W - 16);
    const PH  = 420; // estimated popup height
    let left  = r.left;
    let top   = r.bottom + 8;
    if (left + PW > W - 8)  left = Math.max(8, W - PW - 8);
    if (top  + PH > H - 8)  top  = Math.max(8, r.top - PH - 8);
    setPos({ top, left, width: PW, ready:true });
  }, []);

  // Close on outside click / Escape
  useEffect(() => {
    const onMouse = (e) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target) &&
          !(triggerRef?.current?.contains(e.target)))
        onClose();
    };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    setTimeout(() => document.addEventListener("mousedown", onMouse), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const grouped = useMemo(() => {
    const g = {};
    pharmacies.forEach(p => {
      const k = p.group || p.name;
      if (!g[k]) g[k] = [];
      g[k].push(p);
    });
    return Object.entries(g).sort((a,b) => b[1].length - a[1].length);
  }, [pharmacies]);

  const hospitalCount = pharmacies.filter(p => p.type === "Hospital Pharmacy").length;
  const retailCount   = pharmacies.length - hospitalCount;

  if (!pos.ready) return null;

  return (
    <div
      ref={boxRef}
      style={{
        position: "fixed",
        top:      pos.top,
        left:     pos.left,
        width:    pos.width,
        zIndex:   99999,
      }}
      className="glass-card rounded-2xl overflow-hidden pointer-events-auto"
    >
      {/* ── Header ── */}
      <div style={{ background:`linear-gradient(135deg,${m.color}ee,${m.color}99)` }} className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white text-base">Block {block}</span>
              {areaName && (
                <span className="text-xs font-semibold text-white bg-white/25 px-2 py-0.5 rounded-full">
                  {areaName}
                </span>
              )}
              <span className="text-xs text-white/65">{gov}</span>
            </div>
            <div className="flex items-center gap-5 mt-2.5">
              {[
                { val:pharmacies.length, lbl:"pharmacies" },
                { val:grouped.length,    lbl:"groups"     },
                { val:hospitalCount,     lbl:"hospital"   },
              ].map(({ val, lbl }, i) => (
                <div key={lbl} className="flex items-center gap-4">
                  {i > 0 && <div style={{width:1,height:26,background:"rgba(255,255,255,.3)"}}/>}
                  <div className="text-center">
                    <div className="text-xl font-bold text-white leading-none">{val}</div>
                    <div style={{fontSize:10}} className="text-white/60 mt-0.5">{lbl}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors flex-shrink-0 mt-0.5">
            <Icon d="M18 6L6 18M6 6l12 12" size={14}/>
          </button>
        </div>
      </div>

      {/* ── Group list ── */}
      <div style={{ maxHeight:270, overflowY:"auto" }}>
        {grouped.length === 0
          ? <div className="px-4 py-8 text-sm text-gray-400 text-center">No pharmacy data found</div>
          : grouped.map(([groupName, pharms]) => (
            <div key={groupName}
              className="px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span style={{background:m.color,width:6,height:6,borderRadius:99,flexShrink:0,marginTop:2,display:"inline-block"}}/>
                    <span className="text-sm font-semibold text-gray-800 leading-snug">{groupName}</span>
                  </div>
                  {pharms.map((p, j) => (
                    <div key={j} className="ml-3.5 mt-1 flex items-center gap-1.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                        p.type==="Hospital Pharmacy"
                          ? "bg-purple-50 text-purple-700"
                          : "bg-blue-50 text-blue-700"
                      }`}>
                        {p.type==="Hospital Pharmacy"?"🏥":"💊"}
                      </span>
                      <span className="text-xs text-gray-500 truncate">{p.name}</span>
                    </div>
                  ))}
                </div>
                {pharms.length > 1 && (
                  <span style={{ color:m.color, background:`${m.color}18` }}
                    className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5">
                    ×{pharms.length}
                  </span>
                )}
              </div>
            </div>
          ))
        }
      </div>

      {/* ── Footer ── */}
      <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-400">{retailCount} retail · {hospitalCount} hospital</span>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">close ✕</button>
      </div>
    </div>
  );
}

// ─── BLOCK CHIP ──────────────────────────────────────────────────────────────
// Each covered block as a clickable chip that opens BlockPopup
function BlockChip({ block, gov, isCovered, isHighlighted }) {
  const { pharmacyMap, areaNames } = useContext(DataContext);
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const m = GOV_META[gov] || { color:"#10b981" };
  const pharmCount = isCovered
    ? (pharmacyMap[String(block)]?.length || 0)
    : 0;
  const areaName = areaNames[String(block)] || "";

  const toggle = useCallback((e) => {
    e.stopPropagation();
    if (isCovered) setOpen(o => !o);
  }, [isCovered]);

  if (isHighlighted) {
    // yellow highlight for search
    return (
      <div className="relative inline-block">
        <button ref={btnRef} onClick={toggle}
          style={{ background:"#fef08a", border:"2px solid #ca8a04", color:"#713f12" }}
          className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all">
          {block}
          {pharmCount > 0 && (
            <span style={{background:"#ca8a04",color:"white"}} className="ml-1 text-xs px-1 rounded-full font-bold">
              {pharmCount}
            </span>
          )}
        </button>
        {open && <BlockPopup block={block} gov={gov} triggerRef={btnRef} onClose={() => setOpen(false)}/>}
      </div>
    );
  }

  if (isCovered) {
    return (
      <div className="relative inline-block">
        <button ref={btnRef} onClick={toggle}
          style={open ? { background:m.color, borderColor:m.color, color:"white" } : {}}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all hover:scale-105 cursor-pointer ${
            open ? "" : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400"
          }`}>
          <span className="flex flex-col items-center leading-none">
            <span>{block}</span>
            {areaName && (
              <span
                title={areaName}
                style={{ fontSize:"9px", opacity: open ? 0.85 : 0.65, marginTop:1, maxWidth:80, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {areaName}
              </span>
            )}
          </span>
          {pharmCount > 0 && (
            <span style={open
              ? { background:"rgba(255,255,255,.3)", color:"white" }
              : { background:m.color, color:"white" }}
              className="ml-1 text-xs px-1 rounded-full font-bold">
              {pharmCount}
            </span>
          )}
        </button>
        {open && <BlockPopup block={block} gov={gov} triggerRef={btnRef} onClose={() => setOpen(false)}/>}
      </div>
    );
  }

  // Gap block – not clickable, just show number + area name
  return (
    <div className="px-2.5 py-1 rounded-lg text-xs font-bold border bg-red-50 border-red-200 text-red-700 flex flex-col items-center leading-none">
      <span>{block}</span>
      {areaName && (
        <span
          title={areaName}
          style={{ fontSize:"9px", opacity:0.65, marginTop:1, maxWidth:80, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          {areaName}
        </span>
      )}
    </div>
  );
}

// ─── ZONE CARD ────────────────────────────────────────────────────────────────
const ZoneCard = ({ gov, zone, data, isExpanded, onToggle, searchBlock }) => {
  const m = GOV_META[gov];
  const covered = Array.isArray(data.covered) ? data.covered : [];
  const gaps = Array.isArray(data.gaps) ? data.gaps : [];
  const total = Number(data.total) || covered.length + gaps.length;
  const pct   = Number.isFinite(data.coverage_pct) ? data.coverage_pct : (total ? Math.round((covered.length / total) * 100) : 0);
  const color = pctColor(pct);
  const bg    = pctBg(pct);

  return (
    <div className="glass-card rounded-xl overflow-visible hover-lift">
      <button onClick={onToggle}
        className="w-full flex items-start sm:items-center justify-between gap-3 px-3 sm:px-5 py-3 sm:py-4 text-left hover:bg-gray-50 transition-colors rounded-xl">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div style={{ background:`${m.color}20`, color:m.color }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0">
            {zone.replace("Zone ","")}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm text-gray-800">{zone}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {covered.length} covered · {gaps.length} gaps · {total} total
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <div className="w-24 hidden sm:block">
            <ProgressBar pct={pct} color={color}/>
          </div>
          <span style={{ color, background:bg }}
            className="text-xs font-bold px-2.5 py-1 rounded-full w-14 text-center">
            {pct===100?"✓ 100%":`${pct}%`}
          </span>
          <Icon d={isExpanded?"M19 9l-7 7-7-7":"M9 5l7 7-7 7"} size={14} className="text-gray-400"/>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-50 px-3 sm:px-5 py-4 space-y-4">
          {/* GAP blocks */}
          {gaps.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="w-2 h-2 rounded-full bg-red-400"/>
                <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">
                  {gaps.length} Blocks WITHOUT Pharmacy
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {gaps.map(b => (
                  <BlockChip key={b} block={b} gov={gov} isCovered={false}
                    isHighlighted={searchBlock && String(b).includes(searchBlock)}/>
                ))}
              </div>
            </div>
          )}

          {/* COVERED blocks */}
          {covered.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"/>
                <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">
                  {covered.length} Blocks WITH Pharmacy — click to view details
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {covered.map(b => (
                  <BlockChip key={b} block={b} gov={gov} isCovered={true}
                    isHighlighted={searchBlock && String(b).includes(searchBlock)}/>
                ))}
              </div>
            </div>
          )}

          {total > 0 && gaps.length === 0 && (
            <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
              <Icon d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" size={18}/>
              Full coverage — every block in this zone has a pharmacy!
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── SUMMARY STATS ────────────────────────────────────────────────────────────
const SummaryStats = ({ view }) => {
  const { coverageData } = useContext(DataContext);
  const stats = useMemo(() => {
    let tB=0, cB=0, gB=0;
    const src = view==="all" ? coverageData : { [view]: coverageData[view] || {} };
    Object.values(src).forEach(zones =>
      Object.values(zones || {}).forEach(z => {
        const covered = Array.isArray(z.covered) ? z.covered : [];
        const gaps = Array.isArray(z.gaps) ? z.gaps : [];
        tB += Number(z.total) || covered.length + gaps.length;
        cB += covered.length;
        gB += gaps.length;
      })
    );
    return { tB, cB, gB, pct: tB ? Math.round(cB/tB*100) : 0 };
  }, [coverageData, view]);

  const cards = [
    { label:"Total Blocks",   value:stats.tB,      color:"#6366f1", icon:"M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" },
    { label:"Blocks Covered", value:stats.cB,      color:"#059669", icon:"M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" },
    { label:"Uncovered Gaps", value:stats.gB,      color:"#dc2626", icon:"M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
    { label:"Coverage Rate",  value:`${stats.pct}%`, color:pctColor(stats.pct), icon:"M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      {cards.map(c => (
        <div key={c.label} className="glass-card rounded-xl p-4 hover-lift">
          <div className="flex items-start justify-between">
            <div>
              <p className="section-title mb-1">{c.label}</p>
              <p className="text-2xl font-bold text-gray-900">{c.value}</p>
            </div>
            <div style={{ background:`${c.color}15`, color:c.color }}
              className="w-10 h-10 rounded-xl flex items-center justify-center">
              <Icon d={c.icon} size={17}/>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── GOV FILTER BAR ───────────────────────────────────────────────────────────
const GovBar = ({ activeGov, setActiveGov }) => {
  const { coverageData } = useContext(DataContext);
  const govSummary = useMemo(() => GOVS.map(gov => {
    let total=0, covered=0;
    Object.values(coverageData[gov] || {}).forEach(z => {
      const coveredBlocks = Array.isArray(z.covered) ? z.covered : [];
      const gapBlocks = Array.isArray(z.gaps) ? z.gaps : [];
      total += Number(z.total) || coveredBlocks.length + gapBlocks.length;
      covered += coveredBlocks.length;
    });
    return { gov, gaps:Math.max(total-covered, 0), pct:total ? Math.round(covered/total*100) : 0 };
  }), [coverageData]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
      <button onClick={() => setActiveGov("all")}
        className={`w-full py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
          activeGov==="all"
            ? "border-gray-800 bg-gray-900 text-white shadow-md"
            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
        }`}>All Governorates</button>
      {govSummary.map(({ gov, gaps, pct }) => {
        const m = GOV_META[gov];
        const active = activeGov===gov;
        return (
          <button key={gov} onClick={() => setActiveGov(gov)}
            style={active ? { borderColor:m.color, background:m.color } : {}}
            className={`w-full py-3 px-3 rounded-xl text-sm font-semibold border-2 transition-all ${
              active ? "text-white shadow-md" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
            }`}>
            <div className="text-center">
              <div>{gov}</div>
              <div style={{ color: active ? "rgba(255,255,255,.8)" : pctColor(pct) }}
                className="text-xs font-normal mt-0.5">
                {gaps} gaps · {pct}%
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

// ─── GAPS ONLY TABLE ──────────────────────────────────────────────────────────
const GapsOnlyView = ({ govFilter }) => {
  const { coverageData, areaNames } = useContext(DataContext);
  const rows = useMemo(() => {
    const out = [];
    const govs = govFilter==="all" ? GOVS : [govFilter];
    govs.forEach(gov => {
      Object.entries(coverageData[gov] || {}).forEach(([zone, data]) => {
        const gaps = Array.isArray(data.gaps) ? data.gaps : [];
        const covered = Array.isArray(data.covered) ? data.covered : [];
        const total = Number(data.total) || covered.length + gaps.length;
        if (gaps.length > 0)
          out.push({ gov, zone, gaps, total, pct:total ? Math.round((covered.length / total) * 100) : 0 });
      });
    });
    return out.sort((a,b) => a.pct - b.pct);
  }, [coverageData, govFilter]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500"/>
          <h3 className="font-semibold text-gray-800">
            Uncovered Blocks — {rows.flatMap(r=>r.gaps).length} gaps across {rows.length} zones
          </h3>
        </div>
        <span className="text-xs text-gray-400">Sorted by worst coverage first</span>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["Governorate","Zone","Coverage","Gaps","Block Numbers"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map(({ gov, zone, gaps, total, pct }) => {
              const m = GOV_META[gov];
              return (
                <tr key={`${gov}-${zone}`} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span
                      className="badge font-semibold" style={{ color: m.color, backgroundColor: `${m.color}15` }}>{gov}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-medium text-xs">{zone}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16"><ProgressBar pct={pct} color={pctColor(pct)}/></div>
                      <span style={{ color:pctColor(pct) }} className="text-xs font-bold">{pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="bg-red-50 text-red-700 border border-red-200 text-xs font-bold px-2 py-0.5 rounded-full">
                      {gaps.length}/{total}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {gaps.map(b => {
                        const area = areaNames[String(b)] || "";
                        return (
                          <div key={b} className="flex flex-col items-center bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-2 py-0.5 rounded leading-none">
                            <span>{b}</span>
                            {area && <span style={{fontSize:"8px",opacity:.6}}>{area}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
};


// ─── POPULATION INTELLIGENCE VIEW ────────────────────────────────────────────
function PopulationGovernorateMap({ govStats }) {
  const { coverageData, areaNames } = useContext(DataContext);
  const [geometry, setGeometry] = useState(null);
  const [mapError, setMapError] = useState("");
  const [mapZoom, setMapZoom] = useState(1);

  useEffect(() => {
    let mounted = true;
    loadBahrainBlockGeometry()
      .then(dataset => {
        if (!mounted) return;
        setGeometry(dataset);
        setMapError(dataset?.available ? "" : (dataset?.error || "Bahrain block geometry is unavailable."));
      })
      .catch(error => {
        if (mounted) setMapError(error?.message || "Bahrain block geometry is unavailable.");
      });
    return () => { mounted = false; };
  }, []);

  const coverageIndex = useMemo(
    () => buildCoverageIndex(coverageData, {}, areaNames),
    [coverageData, areaNames]
  );
  const paths = useMemo(
    () => buildAnalyzerMapPaths(geometry, coverageIndex, "all"),
    [coverageIndex, geometry]
  );
  const statsByGov = useMemo(() => new Map(govStats.map(item => [item.gov, item])), [govStats]);
  const populationMax = useMemo(() => Math.max(...GOVS.map(gov => POP_DATA[gov].total)), []);

  const govLabels = useMemo(() => GOVS.map(gov => {
    const govPaths = paths.filter(path => path.info?.gov === gov);
    const stats = statsByGov.get(gov);
    if (!govPaths.length || !stats) return null;

    const minX = Math.min(...govPaths.map(path => path.bbox.minX));
    const maxX = Math.max(...govPaths.map(path => path.bbox.maxX));
    const minY = Math.min(...govPaths.map(path => path.bbox.minY));
    const maxY = Math.max(...govPaths.map(path => path.bbox.maxY));
    const rawX = (minX + maxX) / 2;
    const rawY = (minY + maxY) / 2;
    const x = Math.min(ANALYZER_MAP_W - 78, Math.max(78, rawX));
    const y = Math.min(ANALYZER_MAP_H - 34, Math.max(68, rawY));

    return {
      gov,
      x,
      y,
      stats,
      color: GOV_META[gov].color,
      share: Math.round((stats.pop / TOTAL_POP) * 100),
    };
  }).filter(Boolean), [paths, statsByGov]);

  const adjustMapZoom = useCallback((amount) => {
    setMapZoom(current => clampMapZoom(current + amount));
  }, []);

  const handleMapWheel = useCallback((event) => {
    event.preventDefault();
    adjustMapZoom(event.deltaY < 0 ? 0.15 : -0.15);
  }, [adjustMapZoom]);

  const sortedStats = [...govStats].sort((a, b) => b.pop - a.pop);

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 sm:px-5 py-4 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h3 className="font-bold text-gray-900 text-sm">Population Intel Map</h3>
          <p className="text-xs text-gray-400 mt-1">
            Governorate population totals projected onto the Bahrain block geometry.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {GOVS.map(gov => (
            <span
              key={gov}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-100 bg-gray-50 px-2.5 py-1 text-[11px] font-bold text-gray-600"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background:GOV_META[gov].color }} />
              {gov}
            </span>
          ))}
        </div>
      </div>

      {mapError ? (
        <div className="m-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Population map could not be loaded. Population tables are still available. {mapError}
        </div>
      ) : !geometry ? (
        <div className="p-5">
          <div className="h-[360px] rounded-xl bg-gray-100 animate-pulse" />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4 p-4 sm:p-5">
          <div
            className="relative min-h-[360px] rounded-xl border border-gray-100 overflow-hidden"
            style={{ background:"#f9eee9" }}
            onWheel={handleMapWheel}
          >
            <svg
              viewBox={`0 0 ${ANALYZER_MAP_W} ${ANALYZER_MAP_H}`}
              role="img"
              aria-label="Bahrain population by governorate"
              className="h-[360px] sm:h-[450px] w-full"
            >
              <rect width={ANALYZER_MAP_W} height={ANALYZER_MAP_H} fill="#f9eee9" />
              <g transform={zoomTransform(mapZoom)}>
                {paths.map(path => {
                  const gov = path.info?.gov;
                  const color = gov ? GOV_META[gov].color : "#d1d5db";
                  const stats = gov ? statsByGov.get(gov) : null;
                  const intensity = stats ? Math.max(0.22, (stats.pop / populationMax) * 0.46) : 0.18;
                  return (
                    <path
                      key={path.blockNumber}
                      d={path.d}
                      fill={gov ? `${color}${Math.round(intensity * 255).toString(16).padStart(2, "0")}` : "#e5e7eb"}
                      stroke={gov ? color : "#9ca3af"}
                      strokeWidth={gov ? 0.72 : 0.55}
                      vectorEffect="non-scaling-stroke"
                    >
                      <title>
                        {gov
                          ? `${gov} Governorate - ${POP_DATA[gov].total.toLocaleString()} population`
                          : `Block ${path.blockNumber} - Not assigned to analyzer data`}
                      </title>
                    </path>
                  );
                })}

                {govLabels.map(label => (
                  <g key={label.gov} transform={`translate(${label.x} ${label.y})`} pointerEvents="none">
                    <circle r="9" fill={label.color} stroke="white" strokeWidth="3" />
                    <line x1="0" y1="-8" x2="0" y2="-18" stroke={label.color} strokeWidth="2" />
                    <rect x="-66" y="-62" width="132" height="44" rx="10" fill="white" stroke={`${label.color}55`} strokeWidth="1.2" />
                    <text x="0" y="-44" textAnchor="middle" fill="#111827" fontSize="13" fontWeight="800">
                      {label.gov}
                    </text>
                    <text x="0" y="-28" textAnchor="middle" fill={label.color} fontSize="14" fontWeight="900">
                      {label.stats.pop.toLocaleString()}
                    </text>
                  </g>
                ))}
              </g>
            </svg>

            <div className="absolute right-3 top-3 rounded-xl border border-white/80 bg-white/95 p-1 shadow-sm backdrop-blur">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Zoom population map out"
                  onClick={() => adjustMapZoom(-MAP_ZOOM_STEP)}
                  className="h-8 w-8 rounded-lg border border-gray-200 text-sm font-black text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                  disabled={mapZoom <= MAP_ZOOM_MIN}
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => setMapZoom(1)}
                  className="h-8 min-w-[54px] rounded-lg border border-gray-200 px-2 text-[11px] font-black text-gray-600 hover:bg-gray-50"
                >
                  {Math.round(mapZoom * 100)}%
                </button>
                <button
                  type="button"
                  aria-label="Zoom population map in"
                  onClick={() => adjustMapZoom(MAP_ZOOM_STEP)}
                  className="h-8 w-8 rounded-lg bg-gray-900 text-sm font-black text-white hover:bg-gray-800 disabled:opacity-40"
                  disabled={mapZoom >= MAP_ZOOM_MAX}
                >
                  +
                </button>
              </div>
            </div>

            <div className="absolute left-3 bottom-3 rounded-lg border border-white/80 bg-white/90 px-3 py-2 shadow-sm backdrop-blur">
              <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Population intensity</div>
              <div className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-gray-500">
                <span>Lower</span>
                <span className="h-2.5 w-20 rounded-full" style={{ background:"linear-gradient(90deg,#e5e7eb,#3b82f6,#10b981,#8b5cf6)" }} />
                <span>Higher</span>
              </div>
            </div>
          </div>

          <aside className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Governorate Ranking</p>
            <div className="mt-3 space-y-3">
              {sortedStats.map(item => {
                const gm = GOV_META[item.gov];
                const share = Math.round((item.pop / TOTAL_POP) * 100);
                return (
                  <div key={item.gov} className="rounded-xl border border-gray-100 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-gray-900">{item.gov}</p>
                        <p className="text-[11px] text-gray-400">{share}% of Bahrain population</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black tabular-nums" style={{ color:gm.color }}>{item.pop.toLocaleString()}</p>
                        <p className="text-[10px] text-gray-400">{item.coveragePct}% coverage</p>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width:`${share}%`, background:gm.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

function PopulationView() {
  const { coverageData, areaNames } = useContext(DataContext);
  const [activeTab, setActiveTab] = useState("overview"); // overview | opportunities | density

  // Per-gov stats
  const govStats = useMemo(() => {
    return GOVS.map(gov => {
      const zones = coverageData[gov] || {};
      let total=0, covered=0, gaps=0;
      Object.values(zones).forEach(z => {
        const coveredBlocks = Array.isArray(z.covered) ? z.covered : [];
        const gapBlocks = Array.isArray(z.gaps) ? z.gaps : [];
        total   += Number(z.total) || coveredBlocks.length + gapBlocks.length;
        covered += coveredBlocks.length;
        gaps    += gapBlocks.length;
      });
      const pop        = POP_DATA[gov].total;
      const popPerBlock = total ? pop / total : 0;
      const estGapPop  = popPerBlock * gaps;
      const coveragePct = total ? Math.round(covered/total*100) : 0;
      const pharmacyPer100k = (covered / pop) * 100000;
      return { gov, total, covered, gaps, pop, popPerBlock, estGapPop, coveragePct, pharmacyPer100k };
    });
  }, [coverageData]);

  // Opportunity index: gap blocks weighted by pop density
  // Higher score = more urgent need
  const opportunityData = useMemo(() => {
    const rows = [];
    GOVS.forEach(gov => {
      const pop = POP_DATA[gov].total;
      const allBlocks = Object.values(coverageData[gov] || {}).reduce((a,z) => {
        const covered = Array.isArray(z.covered) ? z.covered : [];
        const gaps = Array.isArray(z.gaps) ? z.gaps : [];
        return a + (Number(z.total) || covered.length + gaps.length);
      }, 0);
      const popPerBlock = allBlocks ? pop / allBlocks : 0;
      
      // Group gap blocks by area
      const areaGaps = {};
      Object.entries(coverageData[gov] || {}).forEach(([zone, data]) => {
        const gaps = Array.isArray(data.gaps) ? data.gaps : [];
        gaps.forEach(block => {
          const area = areaNames[String(block)] || "Unknown area";
          if (!areaGaps[area]) areaGaps[area] = { blocks:[], zone, gov };
          areaGaps[area].blocks.push(block);
        });
      });

      Object.entries(areaGaps).forEach(([area, info]) => {
        if (info.blocks.length === 0) return;
        const estPop     = popPerBlock * info.blocks.length;
        const urgency    = estPop;  // simple: more pop → more urgent
        rows.push({
          gov, area,
          gapCount: info.blocks.length,
          popPerBlock: Math.round(popPerBlock),
          estPop: Math.round(estPop),
          urgency,
          blocks: info.blocks.sort((a,b)=>a-b),
        });
      });
    });
    return rows.sort((a,b) => b.urgency - a.urgency);
  }, [areaNames, coverageData]);

  const m = GOV_META;
  const totalPop = TOTAL_POP;

  // ── Overview tab ──
  const OverviewTab = () => (
    <div className="space-y-6">
      <PopulationGovernorateMap govStats={govStats} />

      {/* Population vs Coverage summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {govStats.map(gs => {
          const gm = m[gs.gov];
          const popShare = Math.round(gs.pop/totalPop*100);
          return (
            <div key={gs.gov} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div style={{color:gm.color}} className="text-xs font-bold uppercase tracking-wide mb-1">{gs.gov}</div>
                  <div className="text-2xl font-bold text-gray-900">{gs.pop.toLocaleString()}</div>
                  <div className="text-xs text-gray-400 mt-0.5">population · {popShare}% of Bahrain</div>
                </div>
                <div style={{background:`${gm.color}15`,color:gm.color}}
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold">
                  {popShare}%
                </div>
              </div>

              {/* Pop bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Share of total population</span>
                  <span>{gs.pop.toLocaleString()}</span>
                </div>
                <div style={{background:"#f3f4f6",borderRadius:99,height:8}}>
                  <div style={{width:`${popShare}%`,background:gm.color,height:8,borderRadius:99,transition:"width .5s"}}/>
                </div>
              </div>

              {/* Key metrics grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div style={{color:gm.color}} className="text-lg font-bold">{gs.coveragePct}%</div>
                  <div className="text-xs text-gray-400 mt-0.5">Block coverage</div>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-red-600">{gs.gaps}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Gap blocks</div>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-amber-600">{gs.pharmacyPer100k.toFixed(1)}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Pharmacies/100k</div>
                </div>
              </div>

              {/* Population in gaps */}
              <div className="mt-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <div className="text-xs text-red-700 font-medium">Est. population in gap blocks</div>
                <div className="text-sm font-bold text-red-700">{Math.round(gs.estGapPop).toLocaleString()}</div>
              </div>

              {/* Bahraini vs Non-Bahraini */}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="bg-blue-50 rounded-lg px-3 py-2 text-center">
                  <div className="text-sm font-bold text-blue-700">{Math.round(POP_DATA[gs.gov].bahraini/gs.pop*100)}%</div>
                  <div className="text-xs text-blue-400">Bahraini</div>
                </div>
                <div className="bg-purple-50 rounded-lg px-3 py-2 text-center">
                  <div className="text-sm font-bold text-purple-700">{Math.round(POP_DATA[gs.gov].non_bahraini/gs.pop*100)}%</div>
                  <div className="text-xs text-purple-400">Non-Bahraini</div>
                </div>
                <div className="bg-pink-50 rounded-lg px-3 py-2 text-center">
                  <div className="text-sm font-bold text-pink-700">{Math.round(POP_DATA[gs.gov].females/gs.pop*100)}%</div>
                  <div className="text-xs text-pink-400">Female</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pharmacy per capita comparison */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>💊</span> Pharmacies per 100,000 Population
        </h3>
        <div className="space-y-3">
          {[...govStats].sort((a,b) => b.pharmacyPer100k - a.pharmacyPer100k).map(gs => {
            const gm = m[gs.gov];
            const maxVal = Math.max(...govStats.map(g=>g.pharmacyPer100k));
            const barPct = maxVal ? gs.pharmacyPer100k/maxVal*100 : 0;
            return (
              <div key={gs.gov} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="w-full sm:w-24 text-sm font-semibold text-gray-700">{gs.gov}</div>
                <div className="flex-1">
                  <div style={{background:"#f3f4f6",borderRadius:99,height:28,overflow:"hidden",position:"relative"}}>
                    <div style={{width:`${barPct}%`,background:`${gm.color}30`,height:"100%",transition:"width .5s"}}/>
                    <div style={{position:"absolute",left:12,top:0,height:"100%",display:"flex",alignItems:"center"}}>
                      <span style={{color:gm.color}} className="text-sm font-bold">{gs.pharmacyPer100k.toFixed(1)}</span>
                      <span className="hidden md:inline text-xs text-gray-500 ml-1.5">per 100k · {gs.covered} pharmacies for {gs.pop.toLocaleString()} people</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          * Based on registered pharmacy blocks. WHO recommendation: ~20 pharmacies per 100,000 population.
        </p>
      </div>
    </div>
  );

  // ── Opportunities tab ──
  const OpportunitiesTab = () => {
    const [filterGov, setFilterGov] = useState("all");
    const filtered = filterGov==="all" ? opportunityData : opportunityData.filter(r=>r.gov===filterGov);
    const top = filtered.slice(0, 20);

    return (
      <div>
        {/* Top priority banner */}
        {opportunityData.length > 0 && (
          <div className="mb-5 bg-gradient-to-r from-red-600 to-orange-500 rounded-2xl p-5 text-white">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <div className="text-xs font-semibold opacity-80 uppercase tracking-wide mb-1">🏆 #1 Highest Priority Opportunity</div>
                <div className="text-2xl font-bold">{opportunityData[0].area}</div>
                <div className="text-sm opacity-80 mt-1">{opportunityData[0].gov} · {opportunityData[0].gapCount} uncovered blocks</div>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-3xl font-bold">{opportunityData[0].estPop.toLocaleString()}</div>
                <div className="text-xs opacity-80">estimated residents without pharmacy</div>
              </div>
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              {opportunityData[0].blocks.map(b => (
                <span key={b} className="bg-white/20 px-2 py-0.5 rounded text-xs font-bold">Block {b}</span>
              ))}
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {["all",...GOVS].map(g => {
            const active = filterGov===g;
            const gm = g==="all" ? null : m[g];
            return (
              <button key={g} onClick={() => setFilterGov(g)}
                style={active && gm ? {background:gm.color,borderColor:gm.color,color:"white"} :
                       active ? {background:"#111827",borderColor:"#111827",color:"white"} : {}}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                  active ? "" : "border-gray-200 bg-white text-gray-600"
                }`}>
                {g==="all"?"All":g}
              </button>
            );
          })}
        </div>

        {/* Opportunity table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-gray-50 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Area Opportunity Ranking — sorted by estimated population impact
            </span>
            <span className="text-xs text-gray-400">{filtered.length} areas</span>
          </div>
          <div className="divide-y divide-gray-50">
            {top.map((row, idx) => {
              const gm = m[row.gov];
              const maxEst = opportunityData[0]?.estPop || 1;
              const barPct = row.estPop/maxEst*100;
              const rankColor = idx===0?"#dc2626":idx<3?"#ea580c":idx<7?"#f59e0b":"#6b7280";
              return (
                <div key={`${row.gov}-${row.area}`}
                  className="px-3 sm:px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Rank badge */}
                      <div style={{background:`${rankColor}15`,color:rankColor,minWidth:28}}
                        className="text-sm font-black text-center py-1 rounded-lg flex-shrink-0">
                        #{idx+1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-800 text-sm">{row.area}</span>
                          <span style={{color:gm.color,background:`${gm.color}15`}}
                            className="text-xs px-2 py-0.5 rounded-full font-semibold">{row.gov}</span>
                        </div>
                        {/* Block chips */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {row.blocks.map(b => (
                            <span key={b} className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold px-1.5 py-0.5 rounded">
                              {b}
                            </span>
                          ))}
                        </div>
                        {/* Bar */}
                        <div className="mt-2" style={{background:"#f3f4f6",borderRadius:99,height:4}}>
                          <div style={{width:`${barPct}%`,background:rankColor,height:4,borderRadius:99,transition:"width .6s"}}/>
                        </div>
                      </div>
                    </div>
                    <div className="text-left sm:text-right flex-shrink-0">
                      <div className="text-base font-bold text-gray-800">{row.estPop.toLocaleString()}</div>
                      <div className="text-xs text-gray-400">est. residents</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {row.gapCount} blocks · ~{row.popPerBlock.toLocaleString()}/block
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const DensityTab = () => {
    const densityRows = govStats.map(gs => ({
      ...gs,
      score: gs.total ? Math.round((gs.pop/gs.total) * (100-gs.coveragePct) / 100 * 10) / 10 : 0,
    })).sort((a,b)=>b.score-a.score);

    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-xs text-amber-800 font-medium">
            <strong>Opportunity Score</strong> = (Population ÷ Blocks) × (1 − Coverage%) 
            — higher means more people per block AND lower current coverage.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {densityRows.map((gs, idx) => {
            const gm = m[gs.gov];
            const maxScore = densityRows[0]?.score || 0;
            const barPct   = maxScore ? gs.score/maxScore*100 : 0;
            return (
              <div key={gs.gov}
                className={`bg-white rounded-2xl border-2 shadow-sm p-4 sm:p-5 ${idx===0?"border-red-300":"border-gray-100"}`}>
                {idx===0 && gs.score > 0 && (
                  <div className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full inline-block mb-2">
                    🎯 HIGHEST PRIORITY
                  </div>
                )}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div style={{color:gm.color}} className="font-bold text-base">{gs.gov}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{gs.pop.toLocaleString()} people</div>
                  </div>
                  <div style={{background:`${gm.color}15`,color:gm.color}}
                    className="text-2xl font-black px-3 py-1 rounded-xl">
                    {gs.score}
                  </div>
                </div>
                <div style={{background:"#f3f4f6",borderRadius:99,height:10,overflow:"hidden"}}>
                  <div style={{width:`${barPct}%`,background:gm.color,height:10,borderRadius:99,transition:"width .6s"}}/>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-center">
                  <div>
                    <div className="text-sm font-bold text-gray-700">{Math.round(gs.popPerBlock).toLocaleString()}</div>
                    <div className="text-xs text-gray-400">Pop/block</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-red-600">{100-gs.coveragePct}%</div>
                    <div className="text-xs text-gray-400">Gap rate</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-700">{gs.gaps}</div>
                    <div className="text-xs text-gray-400">Open blocks</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Explanation */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h4 className="font-bold text-gray-800 mb-3">📊 How to read the scores</h4>
          <div className="space-y-2 text-sm text-gray-600">
            <p>• Scores are calculated only from configured coverage zones entered in this tool.</p>
            <p>• Empty governorates mean no admin-entered analyzer zones are available yet.</p>
            <p>• Do not treat this view as authoritative until the analyzer is migrated to a database-backed admin source.</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Tab switcher */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5 bg-white rounded-xl border border-gray-100 p-1.5 shadow-sm w-full">
        {[
          { id:"overview",       label:"📊 Population Overview" },
          { id:"opportunities",  label:"🎯 Opportunity Ranking" },
          { id:"density",        label:"🔥 Priority Score"     },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`w-full px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab===tab.id
                ? "bg-gray-900 text-white shadow"
                : "text-gray-600 hover:bg-gray-50"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab==="overview"      && <OverviewTab/>}
      {activeTab==="opportunities" && <OpportunitiesTab/>}
      {activeTab==="density"       && <DensityTab/>}
    </div>
  );
}

// ─── BLOCK SEARCH ─────────────────────────────────────────────────────────────
const BlockSearch = ({ onResult }) => {
  const { coverageData } = useContext(DataContext);
  const [val, setVal] = useState("");
  const search = () => {
    const num = parseInt(val.trim());
    if (!num) { onResult(null); return; }
    for (const gov of GOVS) {
      for (const [zone, data] of Object.entries(coverageData[gov] || {})) {
        const covered = Array.isArray(data.covered) ? data.covered : [];
        const gaps = Array.isArray(data.gaps) ? data.gaps : [];
        if (covered.includes(num)) { onResult({ block:num, gov, zone, status:"covered" }); return; }
        if (gaps.includes(num))    { onResult({ block:num, gov, zone, status:"gap"     }); return; }
      }
    }
    onResult({ block:num, gov:null, zone:null, status:"not_found" });
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
        Quick Block Lookup
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        <input value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()}
          placeholder="Enter block number (e.g. 502)..."
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        <button onClick={search}
          className="w-full sm:w-auto bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
          Search
        </button>
        {val && (
          <button onClick={()=>{setVal("");onResult(null);}}
            className="w-full sm:w-auto px-3 py-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg">✕</button>
        )}
      </div>
    </div>
  );
};

const AddPharmacyModal = ({ isOpen, onClose, onSave, coverageData }) => {
  const [gov, setGov] = useState(GOVS[0]);
  const [zone, setZone] = useState("");
  const [block, setBlock] = useState("");
  const [area, setArea] = useState("");
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [type, setType] = useState("Pharmacy");

  if (!isOpen) return null;

  const availableZones = coverageData[gov] ? Object.keys(coverageData[gov]) : [];

  const handleSubmit = (e) => {
    e.preventDefault();
    const normalizedZone = zone.trim();
    if (!block || !name || !normalizedZone) return;
    onSave({ gov, zone: normalizedZone, block, area, name, group: group || name, type });
    onClose();
    setBlock(""); setArea(""); setName(""); setGroup(""); setType("Pharmacy");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99999] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
        <h2 className="text-xl font-bold mb-4">Link Pharmacy to Block</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Governorate</label>
              <select className="w-full border rounded-lg p-2 bg-white" value={gov} onChange={e => {
                const nextGov = e.target.value;
                const nextZones = Object.keys(coverageData[nextGov] || {});
                setGov(nextGov);
                setZone(nextZones.includes(zone) ? zone : nextZones[0] || "");
              }}>
                {GOVS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Zone</label>
              <input
                required
                list="coverage-zone-options"
                className="w-full border rounded-lg p-2 bg-white"
                value={zone}
                onChange={e => setZone(e.target.value)}
                placeholder={availableZones[0] || "Create zone name"}
              />
              <datalist id="coverage-zone-options">
                {availableZones.map(z => <option key={z} value={z} />)}
              </datalist>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Block Number *</label>
              <input required type="number" className="w-full border rounded-lg p-2" value={block} onChange={e => setBlock(e.target.value)} placeholder="e.g. 502" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Area Name</label>
              <input type="text" className="w-full border rounded-lg p-2" value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. Jannusan" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Pharmacy Name *</label>
            <input required type="text" className="w-full border rounded-lg p-2" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Al-Dawaa Pharmacy" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Group Name</label>
              <input type="text" className="w-full border rounded-lg p-2" value={group} onChange={e => setGroup(e.target.value)} placeholder="Defaults to Name" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select className="w-full border rounded-lg p-2 bg-white" value={type} onChange={e => setType(e.target.value)}>
                <option>Pharmacy</option>
                <option>Hospital Pharmacy</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors">Save Link</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export function BlockCoverageAnalyzer({ onBack }) {
  const [coverageData, setCoverageData] = useState(() => {
    return normalizeCoverageData(parseStoredJson(COVERAGE_STORAGE_KEY, EMPTY_COVERAGE_DATA));
  });
  const [pharmacyMap, setPharmacyMap] = useState(() => {
    return parseStoredJson(PHARMACY_STORAGE_KEY, JSON.parse(JSON.stringify(EMPTY_PHARMACY_MAP)));
  });
  const [areaNames, setAreaNames] = useState(() => {
    return parseStoredJson(AREA_STORAGE_KEY, JSON.parse(JSON.stringify(EMPTY_AREA_NAMES)));
  });

  const [activeGov,    setActiveGov]    = useState("all");
  const [displayMode,  setDisplayMode]  = useState("zones");
  const [expandedZones,setExpandedZones] = useState({});
  const [searchResult, setSearchResult] = useState(null);
  const [searchHL,     setSearchHL]     = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const handleAddPharmacy = (data) => {
    const { gov, zone, block, area, name, group, type } = data;
    const numBlock = parseInt(block);
    
    const newPharmacyMap = { ...pharmacyMap };
    if (!newPharmacyMap[numBlock]) newPharmacyMap[numBlock] = [];
    newPharmacyMap[numBlock].push({ name, group, type, area });
    
    const newAreaNames = { ...areaNames };
    if (area) newAreaNames[numBlock] = area;

    const newCoverageData = JSON.parse(JSON.stringify(coverageData));
    if (!newCoverageData[gov]) newCoverageData[gov] = {};
    if (!newCoverageData[gov][zone]) {
      newCoverageData[gov][zone] = { total: 0, covered: [], gaps: [], coverage_pct: 0 };
    }
    const zData = newCoverageData[gov][zone];
    zData.covered = Array.isArray(zData.covered) ? zData.covered : [];
    zData.gaps = Array.isArray(zData.gaps) ? zData.gaps : [];
    
    if (zData.gaps.includes(numBlock)) {
      zData.gaps = zData.gaps.filter(b => b !== numBlock);
      if (!zData.covered.includes(numBlock)) zData.covered.push(numBlock);
    } else if (!zData.covered.includes(numBlock)) {
      zData.covered.push(numBlock);
    }
    zData.total = Math.max(Number(zData.total) || 0, new Set([...zData.covered, ...zData.gaps].map(b => String(b))).size);
    zData.coverage_pct = zData.total ? Math.round((zData.covered.length / zData.total) * 100) : 0;

    setPharmacyMap(newPharmacyMap);
    setAreaNames(newAreaNames);
    setCoverageData(newCoverageData);

    localStorage.setItem(PHARMACY_STORAGE_KEY, JSON.stringify(newPharmacyMap));
    localStorage.setItem(AREA_STORAGE_KEY, JSON.stringify(newAreaNames));
    localStorage.setItem(COVERAGE_STORAGE_KEY, JSON.stringify(newCoverageData));
  };

  const exportToExcel = async () => {
    const [{ default: ExcelJS }, { saveAs }] = await Promise.all([
      import('exceljs'),
      import('file-saver'),
    ]);
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Block Coverage');
    
    ws.columns = [
      { header: 'Governorate', key: 'gov', width: 15 },
      { header: 'Zone', key: 'zone', width: 12 },
      { header: 'Block', key: 'block', width: 10 },
      { header: 'Area', key: 'area', width: 25 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Pharmacies Count', key: 'pharmCount', width: 18 },
      { header: 'Pharmacies', key: 'pharmacies', width: 50 },
    ];

    for (const gov of GOVS) {
      for (const [zone, data] of Object.entries(coverageData[gov] || {})) {
        const covered = Array.isArray(data.covered) ? data.covered : [];
        const gaps = Array.isArray(data.gaps) ? data.gaps : [];
        for (const block of covered) {
          const pharms = pharmacyMap[String(block)] || [];
          ws.addRow({
            gov, zone, block,
            area: areaNames[String(block)] || '',
            status: 'Covered',
            pharmCount: pharms.length,
            pharmacies: pharms.map(p => p.name).join(', ')
          });
        }
        for (const block of gaps) {
          ws.addRow({
            gov, zone, block,
            area: areaNames[String(block)] || '',
            status: 'Gap',
            pharmCount: 0,
            pharmacies: ''
          });
        }
      }
    }

    const buf = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buf]), 'Block_Coverage_Data.xlsx');
  };

  const toggleZone = (gov, zone) => {
    const k = `${gov}__${zone}`;
    setExpandedZones(p => ({ ...p, [k]: !p[k] }));
  };
  const isExpanded = (gov, zone) => !!expandedZones[`${gov}__${zone}`];

  const expandAll = () => {
    const all = {};
    GOVS.forEach(gov => Object.keys(coverageData[gov] || {}).forEach(zone => { all[`${gov}__${zone}`]=true; }));
    setExpandedZones(all);
  };

  const handleSearch = (result) => {
    setSearchResult(result);
    if (result?.block) {
      setSearchHL(String(result.block));
      if (result.gov) {
        setActiveGov(result.gov);
        setDisplayMode("zones");
        if (result.zone) setExpandedZones(p => ({ ...p, [`${result.gov}__${result.zone}`]:true }));
      }
    } else { setSearchHL(""); }
  };

  const govData = activeGov==="all"
    ? Object.entries(coverageData)
    : [[activeGov, coverageData[activeGov] || {}]];

  const registeredBlockCount = useMemo(() => {
    const blocks = new Set();
    Object.values(coverageData).forEach(zones => {
      Object.values(zones || {}).forEach(data => {
        (data.covered || []).forEach(block => blocks.add(String(block)));
        (data.gaps || []).forEach(block => blocks.add(String(block)));
      });
    });
    return blocks.size;
  }, [coverageData]);

  const configuredZoneCount = useMemo(
    () => Object.values(coverageData).reduce((total, zones) => total + Object.keys(zones || {}).length, 0),
    [coverageData]
  );

  return (
    <DataContext.Provider value={{ coverageData, pharmacyMap, areaNames }}>
      <AddPharmacyModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSave={handleAddPharmacy} coverageData={coverageData} />
      <div className="min-h-screen bg-gray-50" style={{ fontFamily:"'Inter',system-ui,sans-serif" }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 sticky top-0 z-30 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            {onBack && <BackToModulesButton onClick={onBack} />}
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow">
              <Icon d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" size={17} className="text-white"/>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Block Coverage Analyzer</h1>
              <p className="text-xs text-gray-400">Bahrain Pharmacy Gap Analysis · {registeredBlockCount} registered blocks</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={()=>setIsAddModalOpen(true)}
              className="w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-medium transition-all bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm">
              + Link Pharmacy
            </button>
            <button onClick={exportToExcel}
              className="w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-medium transition-all bg-gray-800 text-white hover:bg-gray-900 shadow-sm flex items-center gap-2">
              <Icon d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" size={16}/>
              Export Excel
            </button>
            <button onClick={()=>setDisplayMode("zones")}
              className={`w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                displayMode==="zones"?"bg-gray-900 text-white":"bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}>Zone View</button>
            <button onClick={()=>setDisplayMode("gaps_only")}
              className={`w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                displayMode==="gaps_only"?"bg-red-600 text-white":"bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}>🔴 Gaps Only</button>
            <button onClick={()=>setDisplayMode("population")}
              className={`w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                displayMode==="population"?"bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md":"bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}>👥 Population Intel</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
        <BlockSearch onResult={handleSearch}/>

        {/* Search result banner */}
        {searchResult && (
          <div style={{
            background: searchResult.status==="covered"?"#ecfdf5":searchResult.status==="gap"?"#fef2f2":"#fafafa",
            borderColor: searchResult.status==="covered"?"#10b981":searchResult.status==="gap"?"#ef4444":"#d1d5db",
          }} className="rounded-xl border-2 p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-2xl">
              {searchResult.status==="covered"?"✅":searchResult.status==="gap"?"🔴":"❓"}
            </span>
            <div>
              {searchResult.status==="covered" && (
                <p className="font-semibold text-emerald-800">
                  Block <strong>{searchResult.block}</strong>
                  {areaNames?.[String(searchResult.block)] && ` (${areaNames[String(searchResult.block)]})`}
                  {" "}is covered — there is a registered pharmacy in this block.
                  <span className="ml-2 text-emerald-600 font-normal">{searchResult.gov} · {searchResult.zone}</span>
                </p>
              )}
              {searchResult.status==="gap" && (
                <p className="font-semibold text-red-800">
                  Block <strong>{searchResult.block}</strong>
                  {areaNames?.[String(searchResult.block)] && ` (${areaNames[String(searchResult.block)]})`}
                  {" "}has NO registered pharmacy — opportunity gap!
                  <span className="ml-2 text-red-600 font-normal">{searchResult.gov} · {searchResult.zone}</span>
                </p>
              )}
              {searchResult.status==="not_found" && (
                <p className="font-semibold text-gray-700">Block <strong>{searchResult.block}</strong> not found in registered Bahrain blocks.</p>
              )}
            </div>
          </div>
        )}

        {displayMode!=="population" && <SummaryStats view={activeGov}/>}
        {displayMode!=="population" && <GovBar activeGov={activeGov} setActiveGov={setActiveGov}/>}
        {displayMode!=="population" && <BahrainAnalyzerMap activeGov={activeGov} highlightedBlock={searchHL}/>}

        {displayMode==="gaps_only" && <GapsOnlyView govFilter={activeGov}/>}

        {displayMode==="population" && <PopulationView/>}

        {displayMode==="zones" && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <h3 className="font-semibold text-gray-800 text-sm">
                {activeGov==="all"?"All Governorates":activeGov} — Zone Breakdown
              </h3>
              <div className="flex flex-wrap gap-2">
                <button onClick={expandAll}
                  className="text-xs text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors font-medium">
                  Expand All
                </button>
                <button onClick={()=>setExpandedZones({})}
                  className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  Collapse All
                </button>
              </div>
            </div>
            {configuredZoneCount === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm font-semibold text-gray-500">
                No coverage zones configured yet.
              </div>
            ) : (
              <div className="space-y-8">
                {govData.map(([gov, zones]) => (
                <div key={gov}>
                  {activeGov==="all" && (
                    <div className="flex items-center gap-3 mb-3">
                      <span style={{ background:GOV_META[gov].color }} className="w-3 h-3 rounded-full"/>
                      <h4 className="font-bold text-gray-800">{gov} Governorate</h4>
                      <span className="text-xs text-gray-400">{GOV_META[gov].ar}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-3">
                    {Object.entries(zones).map(([zone, data]) => (
                      <ZoneCard key={zone} gov={gov} zone={zone} data={data}
                        isExpanded={isExpanded(gov,zone)} onToggle={()=>toggleZone(gov,zone)}
                        searchBlock={searchHL}/>
                    ))}
                  </div>
                </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Legend */}
        <div className="mt-8 bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Coverage Legend</h4>
          <div className="flex gap-6 flex-wrap">
            {[
              { range:"100%",   color:"#059669", label:"Full coverage"     },
              { range:"70–99%", color:"#10b981", label:"Good coverage"     },
              { range:"50–69%", color:"#f59e0b", label:"Moderate coverage" },
              { range:"25–49%", color:"#ef4444", label:"Low coverage"      },
              { range:"0–24%",  color:"#dc2626", label:"Critical gap"      },
            ].map(({ range, color, label }) => (
              <div key={range} className="flex items-center gap-2">
                <span style={{ background:color }} className="w-3 h-3 rounded-full"/>
                <span className="text-xs font-bold" style={{ color }}>{range}</span>
                <span className="text-xs text-gray-400">{label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 w-full sm:w-auto border-t sm:border-t-0 sm:border-l border-gray-200 pt-2 sm:pt-0 sm:ml-4 sm:pl-4">
              <span className="text-xs text-gray-500">🟢 Click any green block to see pharmacy details</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    </DataContext.Provider>
  );
}
