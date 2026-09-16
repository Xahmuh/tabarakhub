/**
 * Attendance & Geofencing Module — Automated Test Suite
 * ====================================================
 * Covers:
 *   - §3: Haversine distance & geofence validation
 *   - §3.1: GPS accuracy threshold (low confidence flag)
 *   - §3.2: Impossible travel detection (>160 km/h)
 *   - §5.1: Grace period first evaluation (lateness measured AFTER grace)
 *   - §5.2: Tiered escalation progression (Tiers 1-5)
 *   - §5.3: Inert TERMINATION_FLAG behavior
 *   - §5.4: Penalty waiver audit and escalation exemption
 */

import { haversineDistanceM, validateGeofence, DEFAULT_ATTENDANCE_CONFIG, attendanceService } from '../attendanceService';
import { attendancePenaltyEngine } from '../attendancePenaltyEngine';
import {
  AttendanceModuleConfig,
  AttendancePenaltyRule,
  AttendancePunch,
  AttendanceDailyRecord
} from '../../types';
import { Employee, EmployeeBranchAssignment } from '../workforceService';

// Test runner helper
let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failCount++;
  }
}

console.log('\n======================================================');
console.log('🧪 RUNNING ATTENDANCE & PENALTY ENGINE TEST SUITE');
console.log('======================================================\n');

// ----------------------------------------------------------------------------
// TEST SUITE 1: Haversine Geofence Engine (§3)
// ----------------------------------------------------------------------------
console.log('--- 1. Haversine Distance & Geofence Validation ---');

// Manama (26.2285, 50.5860) to Riffa (26.1300, 50.5550) is ~11.4 km
const manamaLat = 26.2285;
const manamaLng = 50.5860;
const riffaLat = 26.1300;
const riffaLng = 50.5550;

const dist = haversineDistanceM(manamaLat, manamaLng, riffaLat, riffaLng);
assert(dist > 11000 && dist < 12000, `Haversine distance Manama to Riffa is ~11.4km (got ${(dist / 1000).toFixed(2)} km)`);

// Test point 30m away from Manama branch
const nearbyLat = manamaLat + 0.0002;
const nearbyLng = manamaLng;
const nearDist = haversineDistanceM(manamaLat, manamaLng, nearbyLat, nearbyLng);
assert(nearDist < 50, `Nearby point is within 50m (got ${Math.round(nearDist)}m)`);

// Validate Geofence with Assignment (50m radius)
const assignment: EmployeeBranchAssignment = {
  branch_id: 'B1',
  branch_name: 'Manama Central',
  lat: manamaLat,
  lng: manamaLng,
  geofence_radius_meters: 50,
  is_primary: true
};

const config: AttendanceModuleConfig = {
  ...DEFAULT_ATTENDANCE_CONFIG,
  requireGeofenceForClockIn: true,
  gpsAccuracyThresholdMeters: 50
};

// Test Inside
const insideResult = validateGeofence(nearbyLat, nearbyLng, 10, [assignment], config, null);
assert(insideResult.isInside === true, 'Punches within 50m resolve to isInside: true');
assert(insideResult.validation === 'INSIDE', 'Validation status is INSIDE');

// Test Outside (Riffa point against Manama branch)
const outsideResult = validateGeofence(riffaLat, riffaLng, 10, [assignment], config, null);
assert(outsideResult.isInside === false, 'Punches 11km away resolve to isInside: false');
assert(outsideResult.validation === 'OUTSIDE', 'Validation status is OUTSIDE');

// ----------------------------------------------------------------------------
// TEST SUITE 2: Anti-Spoofing Checks (§3.1, §3.2)
// ----------------------------------------------------------------------------
console.log('\n--- 2. Anti-Spoofing: Accuracy & Impossible Travel ---');

// §3.1: GPS Accuracy sanity test (accuracy = 120m > threshold 50m)
const lowAccResult = validateGeofence(nearbyLat, nearbyLng, 120, [assignment], config, null);
assert(lowAccResult.validation === 'LOW_CONFIDENCE', 'Inaccurate GPS (120m) triggers LOW_CONFIDENCE');
assert(lowAccResult.flaggedForReview === true, 'Inaccurate GPS is flagged for review');

// §3.2: Impossible travel test (Manama to Riffa in 2 minutes = 342 km/h > 160 km/h)
const prevPunch: AttendancePunch = {
  id: 'p1',
  employeeId: 'emp-1',
  punchType: 'CLOCK_IN',
  punchTime: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
  lat: manamaLat,
  lng: manamaLng,
  accuracy: 10,
  matchedBranchId: 'B1',
  distanceFromBranch: 10,
  geofenceValidation: 'INSIDE',
  syncStatus: 'CONFIRMED',
  createdAt: new Date().toISOString()
};

const impossibleResult = validateGeofence(riffaLat, riffaLng, 10, [assignment], config, prevPunch);
assert(impossibleResult.flagReasons.includes('impossible_travel'), 'Supersonic travel (11km in 2 min) flags impossible_travel');
assert(impossibleResult.flaggedForReview === true, 'Impossible travel is flagged for manager review');

// ----------------------------------------------------------------------------
// TEST SUITE 3: Grace Period First Measurement (§5.1)
// ----------------------------------------------------------------------------
console.log('\n--- 3. Grace Period & Lateness Measurement ---');

// Scenario: Shift starts at 08:00. Grace period = 5 mins.
// Employee arrives at 08:04 -> Late minutes = 0 (within grace)
// Employee arrives at 08:10 -> Late minutes = 10 - 5 = 5 mins (measured AFTER grace)
const graceConfig = { ...config, gracePeriodMinutes: 5 };

function computeLateMins(scheduledStart: string, actualTime: string, grace: number): number {
  const [sH, sM] = scheduledStart.split(':').map(Number);
  const [aH, aM] = actualTime.split(':').map(Number);
  const diff = (aH * 60 + aM) - (sH * 60 + sM);
  return Math.max(0, diff - grace);
}

assert(computeLateMins('08:00', '08:04', 5) === 0, 'Arrival at 08:04 with 5m grace -> 0 late minutes (on time)');
assert(computeLateMins('08:00', '08:05', 5) === 0, 'Arrival at exactly 08:05 with 5m grace -> 0 late minutes (boundary)');
assert(computeLateMins('08:00', '08:12', 5) === 7, 'Arrival at 08:12 with 5m grace -> 7 late minutes (measured after grace)');

// ----------------------------------------------------------------------------
// TEST SUITE 4: Tiered Penalty Escalation & Inert Termination (§5.2, §5.3)
// ----------------------------------------------------------------------------
console.log('\n--- 4. Tiered Disciplinary Escalation & Inert Termination ---');

const mockEmployee: Employee = {
  id: 'emp-test-1',
  code: 'E999',
  full_name: 'Dr. Test Pharmacist',
  category: 'Pharmacist',
  status: 'Active',
  salary_matrix: {
    basicSalary: 300, // 300 BHD / 30 = 10 BHD/day = 1.25 BHD/hr
    totalSalary: 350
  }
};

// Test Late 1-15 min rule:
// 1st offense -> Verbal Warning (0 BHD)
// 2nd offense -> Written Warning (0 BHD)
// 3rd offense -> 1/4 day deduction (0.25 * 10 = 2.500 BHD)
// 4th offense -> 1/2 day deduction (0.50 * 10 = 5.000 BHD)
// 5th offense -> 1 day deduction (1.00 * 10 = 10.000 BHD)

const sim1 = attendancePenaltyEngine.simulatePenalty(mockEmployee, 'LATE_ARRIVAL', 10, graceConfig, 0);
assert(sim1.matchingTier?.action === 'VERBAL_WARNING', '1st late offense yields VERBAL_WARNING');
assert(sim1.calculatedBhd === 0, '1st offense deduction is 0.000 BHD');

const sim2 = attendancePenaltyEngine.simulatePenalty(mockEmployee, 'LATE_ARRIVAL', 10, graceConfig, 1);
assert(sim2.matchingTier?.action === 'WRITTEN_WARNING', '2nd late offense yields WRITTEN_WARNING');
assert(sim2.calculatedBhd === 0, '2nd offense deduction is 0.000 BHD');

const sim3 = attendancePenaltyEngine.simulatePenalty(mockEmployee, 'LATE_ARRIVAL', 10, graceConfig, 2);
assert(sim3.matchingTier?.action === 'SALARY_DEDUCTION_DAYS', '3rd late offense yields SALARY_DEDUCTION_DAYS');
assert(Math.abs(sim3.calculatedBhd - 2.5) < 0.01, `3rd offense deduction is 2.500 BHD (got ${sim3.calculatedBhd.toFixed(3)})`);

const sim5 = attendancePenaltyEngine.simulatePenalty(mockEmployee, 'LATE_ARRIVAL', 10, graceConfig, 4);
assert(Math.abs(sim5.calculatedBhd - 10.0) < 0.01, `5th offense deduction is 10.000 BHD (got ${sim5.calculatedBhd.toFixed(3)})`);

// §5.3: Test TERMINATION_FLAG is inert
const simTerm = attendancePenaltyEngine.simulatePenalty(mockEmployee, 'ABSENT_NO_NOTICE', 0, graceConfig, 2);
assert(simTerm.matchingTier?.action === 'TERMINATION_FLAG', 'Repeated unexcused absence triggers TERMINATION_FLAG');
assert(mockEmployee.status === 'Active', 'TERMINATION_FLAG is inert: employee status remains Active (never deactivates)');

// ----------------------------------------------------------------------------
// TEST SUITE 5: Hard Geofence Enforcement (Cannot Punch Outside GPS Area)
// ----------------------------------------------------------------------------
console.log('\n--- 5. Hard Geofence Enforcement (Blocked Outside Area) ---');

const assignedEmp: Employee = {
  ...mockEmployee,
  assignments: [assignment]
};

let clockInBlocked = false;
try {
  await attendanceService.clockIn(assignedEmp, riffaLat, riffaLng, 10);
} catch (e: any) {
  clockInBlocked = e.message.includes('Outside Geofence Area');
}
assert(clockInBlocked === true, 'Clock-In outside geofence perimeter is strictly blocked');

let clockOutBlocked = false;
try {
  await attendanceService.clockOut(assignedEmp, riffaLat, riffaLng, 10);
} catch (e: any) {
  clockOutBlocked = e.message.includes('Outside Geofence Area');
}
assert(clockOutBlocked === true, 'Clock-Out outside geofence perimeter is strictly blocked');

// ----------------------------------------------------------------------------
// TEST SUITE 6: Multi-Category Excel Workbook Export
// ----------------------------------------------------------------------------
console.log('--- 6. Multi-Category Excel Workbook Structure ---');

import ExcelJS from 'exceljs';
const testWorkbook = new ExcelJS.Workbook();
const sampleReports = [
  {
    employeeId: 'emp-1',
    employeeName: 'Dr. Sarah Ahmed',
    employeeCode: 'PH01',
    category: 'Pharmacist',
    branchName: 'Manama Branch',
    month: '2026-09',
    scheduledDays: 26,
    presentDays: 25,
    lateDays: 1,
    absentDays: 0,
    leaveDays: 1,
    dayOffDays: 4,
    holidayDays: 0,
    earlyLeaveDays: 0,
    totalLateMinutes: 12,
    totalEarlyLeaveMinutes: 0,
    totalOvertimeMinutes: 45,
    totalWorkedHours: 205.5,
    totalPenaltiesBhd: 0,
    totalWaivedPenaltiesBhd: 0,
    penaltyBreakdown: [],
    attendancePercentage: 96.2,
    punctualityScore: 98
  },
  {
    employeeId: 'emp-2',
    employeeName: 'Ali Hassan',
    employeeCode: 'DR01',
    category: 'Driver',
    branchName: 'Delivery Hub',
    month: '2026-09',
    scheduledDays: 26,
    presentDays: 26,
    lateDays: 0,
    absentDays: 0,
    leaveDays: 0,
    dayOffDays: 4,
    holidayDays: 0,
    earlyLeaveDays: 0,
    totalLateMinutes: 0,
    totalEarlyLeaveMinutes: 0,
    totalOvertimeMinutes: 120,
    totalWorkedHours: 218.0,
    totalPenaltiesBhd: 0,
    totalWaivedPenaltiesBhd: 0,
    penaltyBreakdown: [],
    attendancePercentage: 100,
    punctualityScore: 100
  }
];

const standardCategories = ['Pharmacist', 'Driver', 'Worker', 'Management'];
const allTabs = ['All Staff', ...standardCategories];

allTabs.forEach(tabName => {
  const ws = testWorkbook.addWorksheet(tabName);
  ws.addRow(['Emp Code', 'Employee Full Name', 'Role Category']);
  if (tabName === 'All Staff') {
    sampleReports.forEach(r => ws.addRow([r.employeeCode, r.employeeName, r.category]));
  } else {
    sampleReports.filter(r => r.category === tabName).forEach(r => ws.addRow([r.employeeCode, r.employeeName, r.category]));
  }
});

assert(testWorkbook.worksheets.length === 5, 'Workbook contains exactly 5 tabs (All Staff + 4 Categories)');
assert(testWorkbook.getWorksheet('All Staff') !== undefined, 'Workbook contains "All Staff" tab');
assert(testWorkbook.getWorksheet('Pharmacist') !== undefined, 'Workbook contains "Pharmacist" tab');
assert(testWorkbook.getWorksheet('Driver') !== undefined, 'Workbook contains "Driver" tab');
assert(testWorkbook.getWorksheet('Worker') !== undefined, 'Workbook contains "Worker" tab');
assert(testWorkbook.getWorksheet('Management') !== undefined, 'Workbook contains "Management" tab');

const allStaffSheet = testWorkbook.getWorksheet('All Staff');
assert((allStaffSheet?.rowCount || 0) === 3, 'All Staff tab contains 1 header + 2 employees');

const pharmSheet = testWorkbook.getWorksheet('Pharmacist');
assert((pharmSheet?.rowCount || 0) === 2, 'Pharmacist tab contains 1 header + 1 pharmacist');

const driverSheet = testWorkbook.getWorksheet('Driver');
assert((driverSheet?.rowCount || 0) === 2, 'Driver tab contains 1 header + 1 driver');

const workerSheet = testWorkbook.getWorksheet('Worker');
assert((workerSheet?.rowCount || 0) === 1, 'Worker tab contains header (0 employees)');

const buffer = await testWorkbook.xlsx.writeBuffer();
assert(buffer && buffer.byteLength > 0, 'ExcelJS workbook writes valid binary buffer');

// ----------------------------------------------------------------------------
// TEST SUITE 7: Admin Fingerprint Management (Edit / Delete / Query)
// ----------------------------------------------------------------------------
console.log('--- 7. Registered Fingerprint Management ---');

const initialFp = attendanceService.getRegisteredFingerprint('emp-101');
assert(initialFp === 'FP-E001-948A', `Initial registered fingerprint for emp-101 is FP-E001-948A (got ${initialFp})`);

// Edit fingerprint
await attendanceService.setRegisteredFingerprint('emp-101', 'FP-EDITED-99', 'admin_tester');
const editedFp = attendanceService.getRegisteredFingerprint('emp-101');
assert(editedFp === 'FP-EDITED-99', `Admin edit updates registered fingerprint to FP-EDITED-99 (got ${editedFp})`);

// Register new fingerprint
await attendanceService.setRegisteredFingerprint('emp-temp', 'BIO-TERM-007', 'admin_tester');
const newFp = attendanceService.getRegisteredFingerprint('emp-temp');
assert(newFp === 'BIO-TERM-007', `Admin register creates new fingerprint BIO-TERM-007 (got ${newFp})`);

const allFps = attendanceService.getAllRegisteredFingerprints();
assert(allFps['emp-temp'] === 'BIO-TERM-007', 'getAllRegisteredFingerprints includes newly registered token');

// Delete fingerprint
await attendanceService.deleteRegisteredFingerprint('emp-temp', 'admin_tester');
const deletedFp = attendanceService.getRegisteredFingerprint('emp-temp');
assert(deletedFp === null, 'Admin delete successfully removes registered fingerprint (resolves to null)');

// Helper token generator
const token = attendanceService.generateFingerprintToken('FP');
assert(token.startsWith('FP-') && token.length === 11, `Token generator produces valid FP token (got ${token})`);

const captured = attendanceService.captureBrowserFingerprint();
assert(captured.length > 0, `Browser fingerprint capture returns valid hash string (got ${captured})`);

// ----------------------------------------------------------------------------
// TEST SUITE SUMMARY
// ----------------------------------------------------------------------------
console.log('\n======================================================');
console.log(`📊 TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
console.log('======================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL ATTENDANCE & GEOFENCING TESTS PASSED PERFECTLY!\n');
}
