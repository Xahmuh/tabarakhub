/**
 * Automated Test Suite: Competitor-Aware No-Orders Block Classification (Phase 4)
 *
 * Verifies:
 * 1. Precondition order: `outside-service-area` checked BEFORE competitor counts.
 * 2. All 4 classification outcomes for zero-order blocks.
 * 3. Tabarak branch filtering (Tabarak pharmacies must not count as competitors).
 * 4. Contested territory priority sorting (1 competitor > 2 competitors).
 * 5. Breakdown summary generation (single-competitor counts, category totals).
 * 6. Non-zero order blocks are excluded from no-order evaluation.
 */

import {
  classifyNoOrderBlock,
  getCompetitorsForBlock,
  isBlockInsideServiceArea,
  evaluateNoOrderBlocks
} from '../../utils/noOrdersClassification';
import {
  BranchDeliveryProfile,
  DeliveryBlockMetric
} from '../../../../types';
import { BlockGeometryDataset } from '../../bahrainBlockGeometry';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`, detail !== undefined ? detail : '');
    failCount++;
  }
}

console.log('\n🧪 RUNNING NO-ORDERS BLOCK CLASSIFICATION TEST SUITE\n');

// -----------------------------------------------------------------------------
// TEST SUITE 1: Pure Function classifyNoOrderBlock - Inside Service Area
// -----------------------------------------------------------------------------
console.log('--- TEST 1: Inside Service Area Classifications ---');
{
  // 0 competitors -> white-space
  assert(
    classifyNoOrderBlock(true, 0) === 'white-space',
    'Inside service area with 0 competitors classifies as "white-space"'
  );

  // 1 competitor -> contested
  assert(
    classifyNoOrderBlock(true, 1) === 'contested',
    'Inside service area with 1 competitor classifies as "contested"'
  );

  // 2 competitors -> contested
  assert(
    classifyNoOrderBlock(true, 2) === 'contested',
    'Inside service area with 2 competitors classifies as "contested"'
  );

  // 3 competitors -> saturated
  assert(
    classifyNoOrderBlock(true, 3) === 'saturated',
    'Inside service area with 3 competitors classifies as "saturated"'
  );

  // 5 competitors -> saturated
  assert(
    classifyNoOrderBlock(true, 5) === 'saturated',
    'Inside service area with 5 competitors classifies as "saturated"'
  );
}

// -----------------------------------------------------------------------------
// TEST SUITE 2: Strict Architectural Guardrail - Outside Service Area FIRST
// -----------------------------------------------------------------------------
console.log('\n--- TEST 2: Outside Service Area Precedence Guardrail ---');
{
  // Regardless of competitor count (0, 1, 2, 5, 20), outside-service-area MUST be returned!
  assert(
    classifyNoOrderBlock(false, 0) === 'outside-service-area',
    'Outside service area with 0 competitors returns "outside-service-area" (NOT white-space)'
  );

  assert(
    classifyNoOrderBlock(false, 1) === 'outside-service-area',
    'Outside service area with 1 competitor returns "outside-service-area" (CRITICAL: NEVER contested)'
  );

  assert(
    classifyNoOrderBlock(false, 2) === 'outside-service-area',
    'Outside service area with 2 competitors returns "outside-service-area" (CRITICAL: NEVER contested)'
  );

  assert(
    classifyNoOrderBlock(false, 4) === 'outside-service-area',
    'Outside service area with 4 competitors returns "outside-service-area" (NOT saturated)'
  );
}

// -----------------------------------------------------------------------------
// TEST SUITE 3: Tabarak Own Branch Exclusion in Competitor Fetching
// -----------------------------------------------------------------------------
console.log('\n--- TEST 3: Competitor Filtering (Excluding Tabarak Branches) ---');
{
  const mockCompetitorMap = {
    '109': [
      { name: 'Al Suwaifiyah Pharmacy', group: 'YMH', type: 'Pharmacy', area: 'Hidd' },
      { name: 'TABARAK Pharmacy', group: 'TABARAK PHARMACY', type: 'Pharmacy', area: 'Hidd' },
      { name: 'Hidd Life Care Pharmacy', group: 'LIFE CARE PHARMACY', type: 'Pharmacy', area: 'Hidd' }
    ],
    '324': [
      { name: 'Al Fateh Pharmacy', group: 'NASSER PHARMACY', type: 'Pharmacy', area: 'AlFateh' },
      { name: 'Tabarak Pharmacy Branch 2', group: 'TABARAK', type: 'Pharmacy', area: 'AlFateh' }
    ]
  };

  const comps109 = getCompetitorsForBlock('109', mockCompetitorMap);
  assert(comps109.length === 2, `Block 109 has 2 competitors (got ${comps109.length})`);
  assert(
    comps109.every(c => !c.name.toUpperCase().includes('TABARAK') && !(c.group || '').toUpperCase().includes('TABARAK')),
    'Block 109 competitor list excludes Tabarak Pharmacy'
  );

  const comps324 = getCompetitorsForBlock('324', mockCompetitorMap);
  assert(comps324.length === 1, `Block 324 has 1 competitor (got ${comps324.length})`);
  assert(comps324[0].name === 'Al Fateh Pharmacy', 'Block 324 competitor is Al Fateh Pharmacy');

  const compsEmpty = getCompetitorsForBlock('999', mockCompetitorMap);
  assert(compsEmpty.length === 0, 'Block with no competitors returns empty array');
}

// -----------------------------------------------------------------------------
// TEST SUITE 4: evaluateNoOrderBlocks Pipeline & Summary Metrics
// -----------------------------------------------------------------------------
console.log('\n--- TEST 4: Full evaluateNoOrderBlocks Pipeline ---');
{
  const makePoly = (lng: number, lat: number) => ({
    type: 'Polygon',
    coordinates: [
      [
        [lng, lat],
        [lng + 0.01, lat],
        [lng + 0.01, lat + 0.01],
        [lng, lat + 0.01],
        [lng, lat]
      ]
    ]
  });

  const byBlock = new Map();
  const rawFeatures = [
    { blockNumber: '101', geometry: makePoly(50.60, 26.25), raw: { BLK_NO: 101 } },
    { blockNumber: '102', geometry: makePoly(50.61, 26.25), raw: { BLK_NO: 102 } },
    { blockNumber: '103', geometry: makePoly(50.62, 26.25), raw: { BLK_NO: 103 } },
    { blockNumber: '104', geometry: makePoly(50.63, 26.25), raw: { BLK_NO: 104 } },
    { blockNumber: '999', geometry: makePoly(50.10, 25.50), raw: { BLK_NO: 999 } } // Far South/West, ~90km away
  ];
  rawFeatures.forEach(f => byBlock.set(f.blockNumber, f));

  const mockDataset: BlockGeometryDataset = {
    available: true,
    selectedProperty: 'BLK_NO',
    featureCount: rawFeatures.length,
    byBlock,
    duplicateKeys: 0
  };

  // Branch based at 101 with extendedRadiusKm = 8km
  const branchProfiles: BranchDeliveryProfile[] = [
    {
      id: 'branch-1',
      branchId: 'b-1',
      branchName: 'Main Hub',
      originBlockNumber: '101',
      coreRadiusKm: 3,
      standardRadiusKm: 5,
      extendedRadiusKm: 8,
      targetDeliveryMinutes: 25,
      warningDeliveryMinutes: 35,
      isDeliveryEnabled: true
    }
  ];

  const mockCompetitorMap = {
    '101': [{ name: 'Comp A', group: 'G1' }], // 1 comp -> contested (1)
    '102': [{ name: 'Comp B', group: 'G1' }, { name: 'Comp C', group: 'G2' }], // 2 comps -> contested (2)
    '103': [], // 0 comps -> white-space
    '104': [{ name: 'Comp D', group: 'G1' }, { name: 'Comp E', group: 'G2' }, { name: 'Comp F', group: 'G3' }], // 3 comps -> saturated
    '999': [{ name: 'Comp Far', group: 'G1' }] // Far outside -> outside-service-area
  };

  const blocks: DeliveryBlockMetric[] = [
    { blockNumber: '101', orderCount: 0, unresolved: false, branchBreakdown: [], shareOfTotal: 0, trend: 'stable' },
    { blockNumber: '102', orderCount: 0, unresolved: false, branchBreakdown: [], shareOfTotal: 0, trend: 'stable' },
    { blockNumber: '103', orderCount: 0, unresolved: false, branchBreakdown: [], shareOfTotal: 0, trend: 'stable' },
    { blockNumber: '104', orderCount: 0, unresolved: false, branchBreakdown: [], shareOfTotal: 0, trend: 'stable' },
    { blockNumber: '999', orderCount: 0, unresolved: false, branchBreakdown: [], shareOfTotal: 0, trend: 'stable' },
    // A block with active orders should be IGNORED by zero-order evaluation
    { blockNumber: '201', orderCount: 45, unresolved: false, branchBreakdown: [], shareOfTotal: 1, trend: 'up' }
  ];

  const { summary, analysisMap } = evaluateNoOrderBlocks({
    blocks,
    branchProfiles,
    dataset: mockDataset,
    competitorMap: mockCompetitorMap
  });

  assert(summary.totalNoOrderBlocks === 5, `Total no-order blocks evaluated is 5 (got ${summary.totalNoOrderBlocks})`);
  assert(summary.contestedCount === 2, `Contested count is 2 (got ${summary.contestedCount})`);
  assert(summary.contestedSingleCompetitorCount === 1, `Contested with exactly 1 competitor count is 1 (got ${summary.contestedSingleCompetitorCount})`);
  assert(summary.whiteSpaceCount === 1, `White-space count is 1 (got ${summary.whiteSpaceCount})`);
  assert(summary.saturatedCount === 1, `Saturated count is 1 (got ${summary.saturatedCount})`);
  assert(summary.outsideServiceAreaCount === 1, `Outside service area count is 1 (got ${summary.outsideServiceAreaCount})`);

  // Verify active order block 201 was NOT analyzed
  assert(!analysisMap.has('201'), 'Block 201 (with 45 orders) was excluded from zero-order analysis');

  // Verify contested blocks sorting: 1-competitor block (101) must come BEFORE 2-competitor block (102)
  assert(
    summary.contestedBlocks[0].blockNumber === '101' && summary.contestedBlocks[0].competitorCount === 1,
    'Contested territory list prioritizes 1-competitor block (101) first'
  );
  assert(
    summary.contestedBlocks[1].blockNumber === '102' && summary.contestedBlocks[1].competitorCount === 2,
    '2-competitor block (102) is second in contested territory list'
  );

  // Verify action recommendations
  assert(
    analysisMap.get('101')?.actionRecommendation.includes('Comp A'),
    'Contested 1-competitor recommendation mentions the competitor name'
  );
  assert(
    analysisMap.get('103')?.actionRecommendation.includes('Hold for manual validation'),
    'White-space recommendation suggests manual validation'
  );
  assert(
    analysisMap.get('999')?.actionRecommendation.includes('branch expansion'),
    'Outside service area recommendation routes to expansion'
  );
}

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log(`\n========================================`);
console.log(`TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
console.log(`========================================\n`);

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL NO-ORDERS CLASSIFICATION TESTS PASSED!\n');
}
