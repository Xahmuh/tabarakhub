/**
 * Automated Test Suite: Jenks Natural Breaks Demand Classification
 *
 * Verifies Fisher-Jenks Natural Breaks optimization for delivery block demand:
 * 1. Skewed distributions (long-tailed data)
 * 2. 10 vs 100 regression test (must land in different tiers)
 * 3. All-zero / empty map (returns null / neutral)
 * 4. Single active block (single class, no crash)
 * 5. All-identical values (single class, no crash)
 * 6. Fewer active blocks than 5 classes (graceful fallback)
 * 7. Tight / consecutive ranges (strictly non-overlapping bounds)
 * 8. Performance test on 2,000+ blocks (< 100ms)
 * 9. Absolute count ranges on legend items (no percentiles)
 * 10. Percentile rank helper accuracy
 */

import {
  computeDemandThresholds,
  computeDemandLegendItems,
  activityTone,
  computeBlockPercentileRank,
  DEMAND_COLORS,
  DemandThresholds
} from '../BlockCoverageMap';
import { DeliveryBlockMetric } from '../../../../types';

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

function makeMockBlocks(counts: number[]): DeliveryBlockMetric[] {
  return counts.map((count, index) => ({
    blockNumber: `B${index + 1}`,
    orderCount: count,
    unresolved: false,
    branchBreakdown: [],
    shareOfTotal: count / (counts.reduce((a, b) => a + b, 0) || 1),
    trend: 'stable'
  }));
}

console.log('\n🧪 RUNNING JENKS NATURAL BREAKS DEMAND CLASSIFICATION TEST SUITE\n');

// -----------------------------------------------------------------------------
// TEST SUITE 1: Normal Skewed Distribution & 10 vs 100 Regression Test
// -----------------------------------------------------------------------------
console.log('--- TEST 1: Skewed Distribution & 10 vs 100 Regression ---');
{
  // Typical delivery profile: 50 with 1, 20 with 2, 15 with 3, 7 with 5, 4 with 8, 2 with 10, 1 with 40, 1 with 100
  const counts: number[] = [];
  for (let i = 0; i < 50; i++) counts.push(1);
  for (let i = 0; i < 20; i++) counts.push(2);
  for (let i = 0; i < 15; i++) counts.push(3);
  for (let i = 0; i < 7; i++) counts.push(5);
  for (let i = 0; i < 4; i++) counts.push(8);
  for (let i = 0; i < 2; i++) counts.push(10);
  counts.push(40);
  counts.push(100);

  const blocks = makeMockBlocks(counts);
  const thresholds = computeDemandThresholds(blocks);

  assert(thresholds !== null, 'Thresholds computed for skewed dataset');
  if (thresholds) {
    const { b1, b2, b3, b4, max } = thresholds;
    assert(max === 100, `Max is 100 (got ${max})`);
    assert(
      b1 < b2 && b2 < b3 && b3 < b4 && b4 < max,
      `Bounds are strictly increasing: 1 <= ${b1} < ${b2} < ${b3} < ${b4} < ${max}`
    );
    assert(
      Number.isInteger(b1) && Number.isInteger(b2) && Number.isInteger(b3) && Number.isInteger(b4),
      'All threshold bounds are whole integers'
    );

    // CRITICAL ACCEPTANCE CRITERIA: 10 vs 100 land in different tiers!
    const tone10 = activityTone(10, thresholds);
    const tone100 = activityTone(100, thresholds);

    assert(
      tone10.label !== tone100.label,
      `10-order block (${tone10.label}) and 100-order block (${tone100.label}) land in DIFFERENT tiers`
    );
    assert(
      tone100.label === 'Hotspot' && tone100.fill === DEMAND_COLORS.hotspot.fill,
      '100-order block lands in Hotspot tier with dark red-purple color'
    );
    assert(
      tone10.label !== 'Hotspot',
      '10-order block does NOT land in Hotspot tier'
    );

    // Verify lower bounds
    const tone1 = activityTone(1, thresholds);
    assert(tone1.label === 'Low', '1-order block lands in Low tier');
  }
}

// -----------------------------------------------------------------------------
// TEST SUITE 2: All-Zero / Empty Map (Edge Case 1)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 2: All-Zero Map & Empty Blocks ---');
{
  const emptyBlocks: DeliveryBlockMetric[] = [];
  const thresholdsEmpty = computeDemandThresholds(emptyBlocks);
  assert(thresholdsEmpty === null, 'computeDemandThresholds returns null for empty array');

  const zeroBlocks = makeMockBlocks([0, 0, 0, 0, 0]);
  const thresholdsZero = computeDemandThresholds(zeroBlocks);
  assert(thresholdsZero === null, 'computeDemandThresholds returns null when all order counts are 0');

  const toneZero = activityTone(0, thresholdsZero);
  assert(
    toneZero.fill === DEMAND_COLORS.none.fill,
    'activityTone returns neutral "none" color for 0 orders when thresholds is null'
  );

  const toneNegative = activityTone(-5, thresholdsZero);
  assert(
    toneNegative.fill === DEMAND_COLORS.none.fill,
    'activityTone returns neutral "none" color for negative orders'
  );
}

// -----------------------------------------------------------------------------
// TEST SUITE 3: Single Active Block (Edge Case 3)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 3: Single Active Block ---');
{
  const blocks = makeMockBlocks([0, 0, 7, 0]);
  const thresholds = computeDemandThresholds(blocks);

  assert(thresholds !== null, 'Thresholds returned for single active block');
  if (thresholds) {
    assert(thresholds.uniqueCount === 1, `uniqueCount is 1 (got ${thresholds.uniqueCount})`);
    assert(thresholds.max === 7, `max is 7 (got ${thresholds.max})`);
    const tone = activityTone(7, thresholds);
    assert(tone.fill === DEMAND_COLORS.low.fill, 'Single active block lands in Low/Served tier');
  }
}

// -----------------------------------------------------------------------------
// TEST SUITE 4: All-Identical Values (Edge Case 3)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 4: All-Identical Order Counts ---');
{
  const blocks = makeMockBlocks([5, 5, 5, 5, 5, 5, 5, 5]);
  const thresholds = computeDemandThresholds(blocks);

  assert(thresholds !== null, 'Thresholds returned for identical order counts');
  if (thresholds) {
    assert(thresholds.uniqueCount === 1, 'uniqueCount is 1');
    assert(thresholds.max === 5, 'max is 5');
    const tone = activityTone(5, thresholds);
    assert(tone.fill === DEMAND_COLORS.low.fill, 'All identical blocks render as Low/Served');
  }
}

// -----------------------------------------------------------------------------
// TEST SUITE 5: Fewer Active Blocks than 5 Classes (Edge Case 2)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 5: Fewer Active Blocks Than Classes ---');
{
  // 2 distinct values
  const blocks2 = makeMockBlocks([2, 2, 2, 25, 25]);
  const t2 = computeDemandThresholds(blocks2);
  assert(t2 !== null && t2.uniqueCount === 2, '2 distinct values handled gracefully');
  if (t2) {
    const toneLow = activityTone(2, t2);
    const toneHigh = activityTone(25, t2);
    assert(toneLow.label === 'Low', 'Lower value lands in Low');
    assert(toneHigh.label === 'Hotspot', 'Higher value lands in Hotspot');
  }

  // 3 distinct values
  const blocks3 = makeMockBlocks([1, 1, 5, 5, 50]);
  const t3 = computeDemandThresholds(blocks3);
  assert(t3 !== null && t3.uniqueCount === 3, '3 distinct values handled gracefully');
  if (t3) {
    assert(activityTone(1, t3).label === 'Low', 'Value 1 lands in Low');
    assert(activityTone(5, t3).label === 'Medium', 'Value 5 lands in Medium');
    assert(activityTone(50, t3).label === 'Hotspot', 'Value 50 lands in Hotspot');
  }

  // 4 distinct values
  const blocks4 = makeMockBlocks([1, 3, 8, 80]);
  const t4 = computeDemandThresholds(blocks4);
  assert(t4 !== null && t4.uniqueCount === 4, '4 distinct values handled gracefully');
  if (t4) {
    assert(activityTone(1, t4).label === 'Low', 'Value 1 lands in Low');
    assert(activityTone(3, t4).label === 'Medium', 'Value 3 lands in Medium');
    assert(activityTone(8, t4).label === 'High', 'Value 8 lands in High');
    assert(activityTone(80, t4).label === 'Hotspot', 'Value 80 lands in Hotspot');
  }
}

// -----------------------------------------------------------------------------
// TEST SUITE 6: Tight / Consecutive Integers (Degenerate Spread Guardrail)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 6: Consecutive Integers Guardrail ---');
{
  const blocks = makeMockBlocks([1, 2, 3, 4, 5]);
  const thresholds = computeDemandThresholds(blocks);
  assert(thresholds !== null, 'Thresholds computed for consecutive 1..5');
  if (thresholds) {
    const { b1, b2, b3, b4, max } = thresholds;
    assert(
      b1 === 1 && b2 === 2 && b3 === 3 && b4 === 4 && max === 5,
      `Exact unit breaks for 1..5: b1=${b1}, b2=${b2}, b3=${b3}, b4=${b4}, max=${max}`
    );
    assert(
      activityTone(1, thresholds).label === 'Low' &&
      activityTone(2, thresholds).label === 'Medium' &&
      activityTone(3, thresholds).label === 'High' &&
      activityTone(4, thresholds).label === 'Very high' &&
      activityTone(5, thresholds).label === 'Hotspot',
      'Each integer 1..5 maps to Low, Medium, High, Very High, Hotspot respectively'
    );
  }
}

// -----------------------------------------------------------------------------
// TEST SUITE 7: Large Block Counts Performance (Edge Case 4)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 7: Large Block Counts (2,000 blocks) Performance ---');
{
  const largeCounts: number[] = [];
  for (let i = 0; i < 2000; i++) {
    // Skewed: 80% between 1-5, 15% between 6-20, 5% between 21-150
    const rand = Math.random();
    if (rand < 0.8) {
      largeCounts.push(Math.floor(Math.random() * 5) + 1);
    } else if (rand < 0.95) {
      largeCounts.push(Math.floor(Math.random() * 15) + 6);
    } else {
      largeCounts.push(Math.floor(Math.random() * 130) + 21);
    }
  }

  const blocks = makeMockBlocks(largeCounts);
  const start = performance.now();
  const thresholds = computeDemandThresholds(blocks);
  const durationMs = performance.now() - start;

  assert(thresholds !== null, 'Thresholds computed for 2,000 blocks');
  assert(
    durationMs < 100,
    `Performance acceptable: 2,000 blocks processed in ${durationMs.toFixed(2)}ms (< 100ms budget)`
  );
}

// -----------------------------------------------------------------------------
// TEST SUITE 8: Percentile Rank Calculation
// -----------------------------------------------------------------------------
console.log('\n--- TEST 8: Percentile Rank Calculation ---');
{
  const blocks = makeMockBlocks([1, 2, 3, 4, 5, 10, 20, 50, 100, 200]);
  const rank200 = computeBlockPercentileRank(200, blocks);
  assert(rank200?.rankLabel === 'Top 10%', `Highest block (1 of 10) is Top 10% (got ${rank200?.rankLabel})`);

  const rank1 = computeBlockPercentileRank(1, blocks);
  assert(rank1?.rankLabel === 'Top 100%', `Lowest block is Top 100% (got ${rank1?.rankLabel})`);

  const rank0 = computeBlockPercentileRank(0, blocks);
  assert(rank0 === null, '0-order block returns null rank');
}

// -----------------------------------------------------------------------------
// TEST SUITE 9: Visual Contrast & Colors
// -----------------------------------------------------------------------------
console.log('\n--- TEST 9: Hotspot Color & Contrast ---');
{
  assert(DEMAND_COLORS.hotspot !== undefined, 'DEMAND_COLORS has hotspot tier');
  assert(DEMAND_COLORS.hotspot.fill === '#7c3aed', 'Hotspot fill is dark red-purple #7c3aed');
  assert(DEMAND_COLORS.very_high.fill === '#ef4444', 'Very high fill is red #ef4444');
  assert(DEMAND_COLORS.hotspot.fill !== DEMAND_COLORS.very_high.fill, 'Hotspot and Very High fills are distinct');
}

// -----------------------------------------------------------------------------
// TEST SUITE 10: Legend Renders Absolute Count Ranges (Not Percentiles)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 10: Legend Absolute Count Ranges ---');
{
  const counts = [1, 1, 2, 2, 3, 5, 8, 10, 40, 100];
  const blocks = makeMockBlocks(counts);
  const thresholds = computeDemandThresholds(blocks);
  assert(thresholds !== null, 'Thresholds computed for legend test');

  const legendItems = computeDemandLegendItems(thresholds);
  assert(legendItems.length >= 6, `Legend has full items (got ${legendItems.length})`);

  // Verify labels format absolute numbers
  const lowItem = legendItems.find(i => i.label.startsWith('Low'));
  const medItem = legendItems.find(i => i.label.startsWith('Medium'));
  const highItem = legendItems.find(i => i.label.startsWith('High'));
  const vHighItem = legendItems.find(i => i.label.startsWith('Very high'));
  const hotspotItem = legendItems.find(i => i.label.startsWith('Hotspot'));

  assert(lowItem !== undefined, 'Low tier exists in legend');
  assert(medItem !== undefined, 'Medium tier exists in legend');
  assert(highItem !== undefined, 'High tier exists in legend');
  assert(vHighItem !== undefined, 'Very high tier exists in legend');
  assert(hotspotItem !== undefined, 'Hotspot tier exists in legend');

  // Verify all tier labels use count ranges and NO raw percentiles
  for (const item of legendItems) {
    assert(!item.label.includes('%'), `Legend label "${item.label}" contains NO percentage or percentile rank`);
  }

  // Verify neutral legend on null thresholds (empty map)
  const nullLegend = computeDemandLegendItems(null);
  assert(nullLegend.length === 2, 'Null thresholds produces neutral legend (No orders + Selected)');
  assert(nullLegend[0].label === 'No orders', 'Null legend has No orders');
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
  console.log('🎉 ALL JENKS NATURAL BREAKS TESTS PASSED!\n');
}
