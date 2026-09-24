/**
 * ============================================================================
 * Control Center Module: Enterprise Multi-Branch Pharmacy Management System
 * Automated Verification Test Suite for Zod Schemas & Domain Models
 * ============================================================================
 * Run via: npx tsx app/control-center/__tests__/validation.test.ts
 */

import {
  CreateBranchSchema,
  CreateCommercialRegistrationSchema,
  CreateBranchDeliveryZoneSchema,
  CreateBranchStaffAssignmentSchema,
  CreateOperationalAreaSchema,
  CreateOperationalZoneSchema
} from '../validation/schemas';
import samplePayload from '../fixtures/samplePayload.json';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedTests++;
  }
}

console.log('\n=============================================================');
console.log('  Control Center: Domain Schema & Validation Test Suite      ');
console.log('=============================================================\n');

// ----------------------------------------------------------------------------
// 1. Validate Sample Production Payload
// ----------------------------------------------------------------------------
console.log('--- 1. Testing Sample Production Payload against Zod Schemas ---');

try {
  const parsedBranch = CreateBranchSchema.parse(samplePayload.branch);
  assert(parsedBranch.branch_code === 'T005', 'Branch T005 parsed and validated successfully');
  assert(parsedBranch.start_shift_radius_meters === 120, 'Start shift radius (120m) within 10m-1000m range');
} catch (e: any) {
  console.error('Branch parse error:', e.errors || e);
  assert(false, 'Branch sample payload failed schema validation');
}

try {
  const parsedCr = CreateCommercialRegistrationSchema.parse(samplePayload.commercial_registration);
  assert(parsedCr.cr_number === '127506-05', 'Commercial Registration parsed successfully');
  assert(parsedCr.vat_account_number === '200012750600002', '15-digit Bahrain VAT account verified');
} catch (e: any) {
  console.error('CR parse error:', e.errors || e);
  assert(false, 'CR sample payload failed schema validation');
}

try {
  const parsedDelivery = CreateBranchDeliveryZoneSchema.parse(samplePayload.delivery_zone);
  assert(parsedDelivery.origin_block === '929', 'Delivery Zone origin block 929 validated');
  assert(parsedDelivery.target_min === 25 && parsedDelivery.warning_min === 40, 'SLA timers validated');
} catch (e: any) {
  console.error('Delivery Zone parse error:', e.errors || e);
  assert(false, 'Delivery Zone sample payload failed schema validation');
}

samplePayload.staff_assignments.forEach((staff, idx) => {
  try {
    const parsedStaff = CreateBranchStaffAssignmentSchema.parse(staff);
    assert(parsedStaff.role === staff.role, `Staff Assignment #${idx + 1} (${staff.user.name}) validated`);
  } catch (e: any) {
    console.error(`Staff #${idx + 1} parse error:`, e.errors || e);
    assert(false, `Staff assignment #${idx + 1} failed schema validation`);
  }
});

// ----------------------------------------------------------------------------
// 2. Geofencing & Start Shift Radius Constraints (10m to 1000m)
// ----------------------------------------------------------------------------
console.log('\n--- 2. Testing Geofencing & Start Shift Radius Guardrails ---');

const baseBranch = { ...samplePayload.branch };

// Test lower bound breach (< 10m)
const tooSmallRadius = CreateBranchSchema.safeParse({
  ...baseBranch,
  start_shift_radius_meters: 5
});
assert(!tooSmallRadius.success, 'start_shift_radius_meters = 5m is strictly rejected (< 10m)');

// Test upper bound breach (> 1000m)
const tooLargeRadius = CreateBranchSchema.safeParse({
  ...baseBranch,
  start_shift_radius_meters: 1500
});
assert(!tooLargeRadius.success, 'start_shift_radius_meters = 1500m is strictly rejected (> 1000m)');

// Test boundary edge: 10m (inclusive)
const minBoundary = CreateBranchSchema.safeParse({
  ...baseBranch,
  start_shift_radius_meters: 10
});
assert(minBoundary.success, 'start_shift_radius_meters = 10m boundary is valid');

// Test boundary edge: 1000m (inclusive)
const maxBoundary = CreateBranchSchema.safeParse({
  ...baseBranch,
  start_shift_radius_meters: 1000
});
assert(maxBoundary.success, 'start_shift_radius_meters = 1000m boundary is valid');

// Test GPS co-dependency: lat provided without lng
const latWithoutLng = CreateBranchSchema.safeParse({
  ...baseBranch,
  latitude: 26.1312,
  longitude: null
});
assert(!latWithoutLng.success, 'Latitude provided without Longitude is rejected');

// Test GPS co-dependency: both omitted or null
const gpsOmitted = CreateBranchSchema.safeParse({
  ...baseBranch,
  latitude: null,
  longitude: null
});
assert(gpsOmitted.success, 'Both coordinates omitted/null is accepted');

// ----------------------------------------------------------------------------
// 3. Delivery Zone Tiers & SLA Timers Progression
// ----------------------------------------------------------------------------
console.log('\n--- 3. Testing Delivery Zone Progression & SLA Timers ---');

const baseDelivery = { ...samplePayload.delivery_zone };

// Invalid distance tiers: standard <= core
const invalidTier1 = CreateBranchDeliveryZoneSchema.safeParse({
  ...baseDelivery,
  core_km: 10,
  standard_km: 8,
  extended_km: 15
});
assert(!invalidTier1.success, 'standard_km <= core_km is rejected');

// Invalid distance tiers: extended <= standard
const invalidTier2 = CreateBranchDeliveryZoneSchema.safeParse({
  ...baseDelivery,
  core_km: 3,
  standard_km: 15,
  extended_km: 12
});
assert(!invalidTier2.success, 'extended_km <= standard_km is rejected');

// Invalid SLA timers: warning_min < target_min
const invalidSla = CreateBranchDeliveryZoneSchema.safeParse({
  ...baseDelivery,
  target_min: 45,
  warning_min: 30
});
assert(!invalidSla.success, 'warning_min < target_min is rejected');

// Valid SLA equal boundary: warning_min === target_min
const validEqualSla = CreateBranchDeliveryZoneSchema.safeParse({
  ...baseDelivery,
  target_min: 30,
  warning_min: 30
});
assert(validEqualSla.success, 'warning_min === target_min is valid boundary');

// ----------------------------------------------------------------------------
// 4. Bahrain Regulatory RegEx Formatting (Block, Phone, VAT, CR)
// ----------------------------------------------------------------------------
console.log('\n--- 4. Testing Bahrain Regulatory Identifiers ---');

// Invalid Block number
const invalidBlock = CreateBranchSchema.safeParse({
  ...baseBranch,
  block_number: 'XYZ99'
});
assert(!invalidBlock.success, 'Invalid Bahrain block "XYZ99" is rejected');

// Valid 3-digit and 4-digit Bahrain blocks
const validBlock3 = CreateBranchSchema.safeParse({ ...baseBranch, block_number: '743' });
const validBlock4 = CreateBranchSchema.safeParse({ ...baseBranch, block_number: '1012' });
assert(validBlock3.success, 'Valid 3-digit Bahrain block "743" accepted');
assert(validBlock4.success, 'Valid 4-digit Bahrain block "1012" accepted');

// Invalid Bahrain VAT number (< 15 digits)
const invalidVat = CreateCommercialRegistrationSchema.safeParse({
  ...samplePayload.commercial_registration,
  vat_account_number: '200012345'
});
assert(!invalidVat.success, 'Invalid VAT number (non-15 digits) is rejected');

// Invalid Phone number
const invalidPhone = CreateBranchSchema.safeParse({
  ...baseBranch,
  phone_mobile: '12345'
});
assert(!invalidPhone.success, 'Invalid short phone number is rejected');

// ----------------------------------------------------------------------------
// 5. Staff Assignment Temporal Constraint (start_date <= end_date)
// ----------------------------------------------------------------------------
console.log('\n--- 5. Testing Staff Assignment Temporal Guardrails ---');

const baseStaff = {
  branch_id: samplePayload.branch.id,
  user_id: '87041928-3000-4000-a000-000000000001',
  role: 'Pharmacist' as const,
  assignment_type: 'Primary Base' as const,
  start_date: '2026-06-01'
};

const invalidEndDate = CreateBranchStaffAssignmentSchema.safeParse({
  ...baseStaff,
  end_date: '2026-05-01' // earlier than start_date
});
assert(!invalidEndDate.success, 'end_date earlier than start_date is rejected');

const validEndDate = CreateBranchStaffAssignmentSchema.safeParse({
  ...baseStaff,
  end_date: '2026-12-31'
});
assert(validEndDate.success, 'end_date on or after start_date is accepted');

const nullEndDate = CreateBranchStaffAssignmentSchema.safeParse({
  ...baseStaff,
  end_date: null
});
assert(nullEndDate.success, 'null end_date (permanent assignment) is accepted');

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------
console.log('\n=============================================================');
console.log(`  Test Results: ${passedTests} passed, ${failedTests} failed out of ${totalTests} tests`);
console.log('=============================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 All Control Center validation and schema tests passed!\n');
}
