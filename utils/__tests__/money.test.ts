/**
 * Unit Test Suite: Canonical BHD Money & Currency Utility
 *
 * Verifies that Bahraini Dinar financial calculations, scaling (3 decimal places),
 * rounding, negative numbers, null/undefined safety, string parsing, and display
 * formatting strictly conform to Bahrain financial conventions and Tabarak Hub architecture.
 */

import assert from 'node:assert';
import {
  formatBhdAmount,
  formatBhdWithCurrency,
  formatBhd,
  formatBhdCurrency,
  truncateBhd,
  toBhdStorageValue
} from '../money';

console.log('\n======================================================');
console.log('🧪 RUNNING CANONICAL BHD MONEY & CURRENCY TEST SUITE');
console.log('======================================================\n');

let passed = 0;
const test = (description: string, fn: () => void) => {
  try {
    fn();
    console.log(`  ✅ PASS: ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(err);
    process.exit(1);
  }
};

// --- 1. Basic 3-Decimal Formatting (formatBhdAmount) ---
console.log('--- 1. Basic 3-Decimal Formatting (formatBhdAmount) ---');

test('Formats integer as 3 decimal places', () => {
  assert.strictEqual(formatBhdAmount(5), '5.000');
  assert.strictEqual(formatBhdAmount(0), '0.000');
  assert.strictEqual(formatBhdAmount(100), '100.000');
});

test('Rounds correctly to 3 decimal places', () => {
  assert.strictEqual(formatBhdAmount(12.3454), '12.345');
  assert.strictEqual(formatBhdAmount(12.3456), '12.346');
  assert.strictEqual(formatBhdAmount(0.0005), '0.001');
  assert.strictEqual(formatBhdAmount(0.0004), '0.000');
});

test('Handles floating-point rounding quirks (e.g. 0.1 + 0.2)', () => {
  assert.strictEqual(formatBhdAmount(0.1 + 0.2), '0.300');
  assert.strictEqual(formatBhdAmount(1.005), '1.005');
});

test('Handles negative numbers', () => {
  assert.strictEqual(formatBhdAmount(-2.5), '-2.500');
  assert.strictEqual(formatBhdAmount(-0.001), '-0.001');
  assert.strictEqual(formatBhdAmount(-100), '-100.000');
});

// --- 2. Null, Undefined & Edge Cases ---
console.log('\n--- 2. Null, Undefined & Edge Cases ---');

test('Handles null safely with 0.000 fallback', () => {
  assert.strictEqual(formatBhdAmount(null), '0.000');
});

test('Handles undefined safely with 0.000 fallback', () => {
  assert.strictEqual(formatBhdAmount(undefined), '0.000');
});

test('Handles NaN and Infinity safely with 0.000 fallback', () => {
  assert.strictEqual(formatBhdAmount(NaN), '0.000');
  assert.strictEqual(formatBhdAmount(Infinity), '0.000');
  assert.strictEqual(formatBhdAmount(-Infinity), '0.000');
});

// --- 3. String Input Parsing & Normalization ---
console.log('\n--- 3. String Input Parsing & Normalization ---');

test('Parses plain string numbers', () => {
  assert.strictEqual(formatBhdAmount('12.5'), '12.500');
  assert.strictEqual(formatBhdAmount('0'), '0.000');
  assert.strictEqual(formatBhdAmount('-5.125'), '-5.125');
});

test('Strips "BHD" prefix or suffix from input string', () => {
  assert.strictEqual(formatBhdAmount('BHD 15.500'), '15.500');
  assert.strictEqual(formatBhdAmount('15.500 bhd'), '15.500');
  assert.strictEqual(formatBhdAmount('Bhd 2.25'), '2.250');
});

test('Strips thousands commas from input string', () => {
  assert.strictEqual(formatBhdAmount('1,250.750'), '1250.750');
  assert.strictEqual(formatBhdAmount('BHD 10,000.000'), '10000.000');
});

test('Handles invalid non-numeric strings with 0.000 fallback', () => {
  assert.strictEqual(formatBhdAmount('invalid'), '0.000');
  assert.strictEqual(formatBhdAmount(''), '0.000');
});

// --- 4. Currency Suffix Display (formatBhdWithCurrency & Aliases) ---
console.log('\n--- 4. Currency Suffix Display (formatBhdWithCurrency & Aliases) ---');

test('Appends "BHD" suffix with single space', () => {
  assert.strictEqual(formatBhdWithCurrency(10), '10.000 BHD');
  assert.strictEqual(formatBhdWithCurrency(0), '0.000 BHD');
  assert.strictEqual(formatBhdWithCurrency(-2.5), '-2.500 BHD');
  assert.strictEqual(formatBhdWithCurrency(null), '0.000 BHD');
});

test('formatBhd alias produces identical output', () => {
  assert.strictEqual(formatBhd(10), '10.000 BHD');
  assert.strictEqual(formatBhd(2.45), '2.450 BHD');
  assert.strictEqual(formatBhd(null), '0.000 BHD');
});

test('formatBhdCurrency alias produces identical output', () => {
  assert.strictEqual(formatBhdCurrency(100.5), '100.500 BHD');
});

// --- 5. Truncate & Storage Value Helpers ---
console.log('\n--- 5. Truncate & Storage Value Helpers ---');

test('truncateBhd returns a finite JS number rounded to 3 decimal places', () => {
  assert.strictEqual(truncateBhd(12.3456), 12.346);
  assert.strictEqual(truncateBhd('25.500'), 25.5);
  assert.strictEqual(truncateBhd(null), 0);
  assert.strictEqual(typeof truncateBhd(10), 'number');
});

test('toBhdStorageValue returns exact 3-decimal string for DB storage', () => {
  assert.strictEqual(toBhdStorageValue(45), '45.000');
  assert.strictEqual(toBhdStorageValue('12.3'), '12.300');
  assert.strictEqual(toBhdStorageValue(null), '0.000');
});

console.log('\n======================================================');
console.log(`📊 TEST RESULTS: ${passed} PASSED, 0 FAILED`);
console.log('======================================================\n');
console.log('🎉 ALL BHD MONEY & CURRENCY TESTS PASSED PERFECTLY!\n');
