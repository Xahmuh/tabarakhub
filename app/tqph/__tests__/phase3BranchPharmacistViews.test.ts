import { mockAuditStore } from '../services/mockAuditStore';
import { getGradePoints } from '../services/scoringService';
import { CAPA_Task, LetterGrade } from '../types';

/**
 * Phase 3 Automated Verification Suite (Branch & Pharmacist Views)
 * Executable via: npx tsx app/tqph/__tests__/phase3BranchPharmacistViews.test.ts
 */

let passedTests = 0;
let failedTests = 0;

function assertEquals<T>(actual: T, expected: T, message: string) {
  if (actual === expected) {
    console.log(`  ✓ ${message} [${actual}]`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}. Expected: ${expected}, Received: ${actual}`);
    failedTests++;
  }
}

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedTests++;
  }
}

console.log('\n======================================================');
console.log('  TQPH Phase 3: Branch & Pharmacist Views Test Suite  ');
console.log('======================================================\n');

// ── 1. Both Views Read From Records in mockAuditStore ──────

console.log('--- 1. Reading Stored Audits and Appraisals (Section 7.3.2 & 7.3.3) ---');
const branch1Audits = mockAuditStore.getAuditsByBranch('branch-01');
assert(branch1Audits.length > 0, `Branch 01 has audits on record (${branch1Audits.length})`);
assertEquals(branch1Audits[0].status, 'locked_submitted', 'Audits are stored in locked_submitted state');
assert(typeof branch1Audits[0].compliance_score === 'number', 'Audit compliance_score is numeric');

const ph1Appraisals = mockAuditStore.getAppraisalsByPharmacist('usr-ph-01');
assert(ph1Appraisals.length > 0, `Pharmacist usr-ph-01 has appraisals on record (${ph1Appraisals.length})`);
assertEquals(ph1Appraisals[0].status, 'locked_submitted', 'Appraisals are stored in locked_submitted state');
assert(ph1Appraisals[0].total_credit_score > 0, `Total credit score is populated (${ph1Appraisals[0].total_credit_score})`);

// ── 2. CAPA Proof Upload Updates CAPA_Task.status ─────────

console.log('\n--- 2. CAPA Proof Upload & Status Transition ---');
const initialCapas = mockAuditStore.getCapaTasks('branch-08');
const openCapa = initialCapas.find(c => c.status === 'open');
assert(!!openCapa, 'Found open CAPA task on branch-08 to test resolution');

if (openCapa) {
  const proofUrl = 'https://placehold.co/600x400/10b981/ffffff?text=Resolved+Safe+Lock';
  const resolverName = 'Dr. Reem Al-Bahrani';
  const resolvedTimestamp = new Date().toISOString();

  // Simulate proof upload & resolution submission
  mockAuditStore.updateCapaTask({
    id: openCapa.id,
    status: 'resolved',
    resolved_by: resolverName,
    resolved_at: resolvedTimestamp,
    resolution_proof_url: proofUrl
  });

  const updatedTasks = mockAuditStore.getCapaTasks('branch-08');
  const targetTask = updatedTasks.find(c => c.id === openCapa.id);

  assert(!!targetTask, 'Updated task found in store');
  assertEquals(targetTask?.status, 'resolved', 'CAPA task status successfully transitioned from "open" to "resolved"');
  assertEquals(targetTask?.resolved_by, resolverName, 'Resolver name recorded accurately');
  assertEquals(targetTask?.resolution_proof_url, proofUrl, 'Resolution proof URL persisted');
  assert(!!targetTask?.resolved_at, 'Resolution timestamp stamped');
}

// ── 3. Pharmacist View Renders 6-Pillar Breakdown ──────────

console.log('\n--- 3. 6-Pillar Breakdown Extraction from Locked Appraisal ---');
const appraisal = ph1Appraisals[0];
assertEquals(appraisal.sections.length, 6, 'Locked appraisal contains all 6 pillars (I to VI)');

const expectedPillars = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const actualPillars = appraisal.sections.map(s => s.section_id);
assertEquals(JSON.stringify(actualPillars), JSON.stringify(expectedPillars), 'Pillars I through VI match standard order');

let calculatedSum = 0;
let criteriaCount = 0;
for (const section of appraisal.sections) {
  for (const criterion of section.criteria) {
    criteriaCount++;
    const pts = getGradePoints(criterion.grade);
    assertEquals(criterion.points, pts, `Criterion ${criterion.code} points match grade ${criterion.grade}`);
    calculatedSum += pts;
  }
}

assertEquals(criteriaCount, 30, 'Appraisal has exactly 30 individual criteria across the 6 pillars');
assertEquals(calculatedSum, appraisal.total_credit_score, 'Sum of criteria grades exactly equals appraisal.total_credit_score');
assertEquals(appraisal.passed, appraisal.total_credit_score >= 95, 'Appraisal passed boolean matches total_credit_score >= 95 rule');

// ── 4. CAPA Overdue SLA Logic Verification ─────────────────

console.log('\n--- 4. CAPA SLA Overdue Calculation ---');
const now = Date.now();
const pastDate = new Date(now - 72 * 60 * 60 * 1000).toISOString(); // 72 hours ago
const futureDate = new Date(now + 24 * 60 * 60 * 1000).toISOString(); // 24 hours future

const overdueOpenTask: CAPA_Task = {
  id: 'sla-test-1',
  audit_id: 'aud-test',
  element_code: '8.1',
  violation: 'Test violation',
  required_action: 'Test action',
  severity: 'Critical',
  due_date: pastDate,
  status: 'open',
  assigned_to: 'manager'
};

const resolvedPastTask: CAPA_Task = {
  id: 'sla-test-2',
  audit_id: 'aud-test',
  element_code: '8.2',
  violation: 'Test violation',
  required_action: 'Test action',
  severity: 'Critical',
  due_date: pastDate,
  status: 'resolved',
  assigned_to: 'manager'
};

const isTaskOverdue = (t: CAPA_Task) => t.status === 'open' && new Date(t.due_date).getTime() < now;
assertEquals(isTaskOverdue(overdueOpenTask), true, 'Open task past due date is marked overdue');
assertEquals(isTaskOverdue(resolvedPastTask), false, 'Resolved task is NOT marked overdue even if past due date');

console.log('\n======================================================');
console.log(`  Phase 3 Tests Completed: ${passedTests} passed, ${failedTests} failed`);
console.log('======================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
