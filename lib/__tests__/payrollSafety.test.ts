import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertSinglePublishedAssignmentPerDay, getLeaveDaysInMonth, getPayrollMonthBounds, isValidBahrainIban } from '../payrollSafety';

test('a leave spanning two months is counted only in the current pay month', () => {
  assert.equal(getLeaveDaysInMonth('2026-10-30', '2026-11-03', '2026-10'), 2);
  assert.equal(getLeaveDaysInMonth('2026-10-30', '2026-11-03', '2026-11'), 3);
  assert.equal(getLeaveDaysInMonth('2026-10-30', '2026-11-03', '2026-12'), 0);
});

test('month bounds and date validation handle February and invalid input', () => {
  assert.deepEqual(getPayrollMonthBounds('2028-02'), { start: '2028-02-01', end: '2028-02-29' });
  assert.throws(() => getLeaveDaysInMonth('2026-02-30', '2026-03-01', '2026-02'));
  assert.throws(() => getLeaveDaysInMonth('2026-10-03', '2026-10-01', '2026-10'));
});

test('Bahrain IBAN checks both structure and check digits', () => {
  assert.equal(isValidBahrainIban('BH67 BMAG 0000 1299 1234 56'), true);
  assert.equal(isValidBahrainIban('BH00BMAG00001299123456'), false);
  assert.equal(isValidBahrainIban('BH67BMAG00001299123457'), false);
  assert.equal(isValidBahrainIban(''), false);
});

test('two published schedule versions cannot silently double-pay one day', () => {
  assert.doesNotThrow(() => assertSinglePublishedAssignmentPerDay([
    { employee_id: 'a', date: '2026-10-01' },
    { employee_id: 'a', date: '2026-10-02' }
  ]));
  assert.throws(() => assertSinglePublishedAssignmentPerDay([
    { employee_id: 'a', date: '2026-10-01' },
    { employee_id: 'a', date: '2026-10-01' }
  ]));
});
