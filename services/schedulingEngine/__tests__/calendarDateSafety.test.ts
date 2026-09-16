import { getCalendarDatesInRange, getSafeDateDetails } from '../index';

function testDateRangeSafety() {
  console.log('=== Testing Calendar Date Range & Timezone Safety ===\n');

  // Test 1: September 2026 Full Month
  const start = '2026-09-01';
  const end = '2026-09-30';
  const dates = getCalendarDatesInRange(start, end);

  console.log(`Testing range ${start} to ${end}:`);
  console.log(`Generated ${dates.length} days: ${dates[0]} -> ${dates[dates.length - 1]}`);

  if (dates.length !== 30) {
    throw new Error(`Expected 30 days, got ${dates.length}`);
  }
  if (dates[0] !== '2026-09-01') {
    throw new Error(`Expected start '2026-09-01', got '${dates[0]}' (Timezone shift detected!)`);
  }
  if (dates[dates.length - 1] !== '2026-09-30') {
    throw new Error(`Expected end '2026-09-30', got '${dates[dates.length - 1]}' (Day 30 missing!)`);
  }
  if (dates.includes('2026-08-31')) {
    throw new Error(`Found unexpected '2026-08-31' in September range!`);
  }
  console.log('  [PASS] 01/09/2026 to 30/09/2026 produces exactly 30 calendar days without 31/08 or missing 30/09');

  // Test 2: Safe Date Details
  const firstDayDetails = getSafeDateDetails('2026-09-01');
  if (firstDayDetails.formattedDate !== '01/09/2026' || firstDayDetails.dayNum !== 1 || firstDayDetails.dayNameShort !== 'Tue') {
    throw new Error(`Invalid first day details: ${JSON.stringify(firstDayDetails)}`);
  }
  console.log('  [PASS] SafeDateDetails for 2026-09-01: ' + JSON.stringify(firstDayDetails.formattedDate) + ' ' + firstDayDetails.dayNameShort);

  const lastDayDetails = getSafeDateDetails('2026-09-30');
  if (lastDayDetails.formattedDate !== '30/09/2026' || lastDayDetails.dayNum !== 30 || lastDayDetails.dayNameShort !== 'Wed') {
    throw new Error(`Invalid last day details: ${JSON.stringify(lastDayDetails)}`);
  }
  console.log('  [PASS] SafeDateDetails for 2026-09-30: ' + JSON.stringify(lastDayDetails.formattedDate) + ' ' + lastDayDetails.dayNameShort);

  // Test 3: Month Default Computation (String-based calculation used in wizard)
  const testNow = new Date('2026-09-13T07:14:20+03:00');
  const y = testNow.getFullYear();
  const m = String(testNow.getMonth() + 1).padStart(2, '0');
  const firstDay = `${y}-${m}-01`;
  const daysInMonth = new Date(y, testNow.getMonth() + 1, 0).getDate();
  const lastDay = `${y}-${m}-${String(daysInMonth).padStart(2, '0')}`;

  if (firstDay !== '2026-09-01') {
    throw new Error(`Expected wizard default firstDay '2026-09-01', got '${firstDay}'`);
  }
  if (lastDay !== '2026-09-30') {
    throw new Error(`Expected wizard default lastDay '2026-09-30', got '${lastDay}'`);
  }
  console.log(`  [PASS] Wizard default period calculation: ${firstDay} to ${lastDay}`);

  // Test 4: Date object input to getCalendarDatesInRange
  const localStartDate = new Date(2026, 8, 1); // Local Sept 1
  const localEndDate = new Date(2026, 8, 30);  // Local Sept 30
  const datesFromObjects = getCalendarDatesInRange(localStartDate, localEndDate);
  if (datesFromObjects[0] !== '2026-09-01' || datesFromObjects[datesFromObjects.length - 1] !== '2026-09-30') {
    throw new Error(`Date object input failed: ${datesFromObjects[0]} -> ${datesFromObjects[datesFromObjects.length - 1]}`);
  }
  console.log('  [PASS] Date object inputs safely preserve calendar dates');

  console.log('\n=== All Calendar Date Safety Tests Passed! ===\n');
}

testDateRangeSafety();
