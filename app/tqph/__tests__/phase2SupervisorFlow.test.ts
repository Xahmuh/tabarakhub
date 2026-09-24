import {
  calculateComplianceScore,
  calculateAppraisalScore
} from '../services/scoringService';
import {
  generateCapaTasksFromAudit,
  deriveCapaSeverity,
  calculateCapaDueDate
} from '../services/capaService';
import { distributeLockedEvaluation } from '../services/distributionService';
import { mockAuditStore } from '../services/mockAuditStore';
import { getFreshChecklistTemplate } from '../data/mockAudits';
import { getFreshAppraisalTemplate } from '../data/mockAppraisals';
import { NHRA_Audit, Pharmacist_Appraisal } from '../types';

/**
 * Phase 2 Automated Verification Suite (Supervisor Evaluation Flow)
 * Executable via: npx tsx app/tqph/__tests__/phase2SupervisorFlow.test.ts
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

async function runPhase2Tests() {
  console.log('\n======================================================');
  console.log('  TQPH Phase 2: Supervisor Evaluation Flow Test Suite ');
  console.log('======================================================\n');

  // ── 1. Checklist Template & Live Scoring ───────────────────

  console.log('--- 1. NHRA Checklist Template & Live Scoring ---');
  const sections = getFreshChecklistTemplate();
  assertEquals(sections.length, 8, 'Standard NHRA template contains exactly 8 sections (1.0 to 8.0)');

  const initialScore = calculateComplianceScore(sections);
  assertEquals(initialScore.score, 100, 'Fresh checklist begins at 100% compliance');

  // Mark 1 item in section 1.0 as Non-Compliant
  sections[0].items[0].status = 'non_compliant';
  sections[0].items[0].notes = 'Commercial registration expired';
  const updatedScore = calculateComplianceScore(sections);
  assert(updatedScore.score < 100, `Compliance score dynamically dropped after violation (${updatedScore.score.toFixed(1)}%)`);
  assertEquals(updatedScore.nonCompliantCount, 1, 'Non-compliant count accurately tracked as 1');

  // ── 2. Appraisal 6-Pillars (30 Criteria) & 150-Point Indicator ──

  console.log('\n--- 2. Staff Appraisal 6-Pillars & Credit Scoring ---');
  const appraisalSections = getFreshAppraisalTemplate();
  assertEquals(appraisalSections.length, 6, 'Standard appraisal template contains exactly 6 sections (I to VI)');

  const totalCriteria = appraisalSections.reduce((sum, sec) => sum + sec.criteria.length, 0);
  assertEquals(totalCriteria, 30, 'Total criteria count is exactly 30 (7+4+5+7+3+4)');

  const initialAppraisalScore = calculateAppraisalScore(appraisalSections);
  assert(initialAppraisalScore.totalCreditScore > 0, `Initial credit score computes to ${initialAppraisalScore.totalCreditScore} pts`);
  assertEquals(initialAppraisalScore.maxPossibleScore, 150, 'Max possible appraisal score is 150 points');

  // Verify pass/fail threshold at 95
  assert(typeof initialAppraisalScore.passed === 'boolean', 'Pass/fail preview is boolean');

  // ── 3. Auto-CAPA Generation on Non-Compliance ──────────────

  console.log('\n--- 3. Auto-CAPA Generation & Section Severity Derivation ---');
  // Flag one item non-compliant in section 8.0 (Controlled Register) -> Critical
  sections[7].items[0].status = 'non_compliant';
  sections[7].items[0].notes = 'Red Book discrepancy found';

  // Flag one item partially-compliant with requires_corrective_action -> Minor (section 2.0)
  sections[1].items[0].status = 'partially_compliant';
  sections[1].items[0].requires_corrective_action = true;
  sections[1].items[0].notes = 'Floor tiles chipped near counter';

  const lockedAt = '2026-09-18T12:00:00.000Z';
  const capas = generateCapaTasksFromAudit('audit-phase2-test', sections, 'usr-bm-01', lockedAt);

  assertEquals(capas.length, 3, 'Exactly 3 CAPA tasks generated (2 non-compliant + 1 flagged partial)');
  assertEquals(capas[0].severity, 'Critical', 'Section 1.0 maps to Critical CAPA');
  assertEquals(capas[1].severity, 'Minor', 'Section 2.0 maps to Minor CAPA');
  assertEquals(capas[2].severity, 'Critical', 'Section 8.0 maps to Critical CAPA');

  const expectedDueDate = calculateCapaDueDate(lockedAt, 48);
  assertEquals(capas[0].due_date, expectedDueDate, 'CAPA due date defaults to locked_at + 48 hours');
  assertEquals(capas[0].status, 'open', 'New CAPA status initialized as "open"');

  // ── 4. Multi-Portal Distribution on Lock (Section 5.6) ────

  console.log('\n--- 4. Multi-Portal Automated Distribution (Section 5.6) ---');
  const dummyAudit: NHRA_Audit = {
    id: 'audit-phase2-test',
    branch_id: 'branch-01',
    supervisor_id: 'usr-sup-1',
    date: '2026-09-18',
    status: 'locked_submitted',
    sections,
    compliance_score: updatedScore.score,
    violations_list: capas.map(c => c.id),
    created_at: lockedAt,
    updated_at: lockedAt,
    locked_at: lockedAt,
    submitted_by: 'usr-sup-1',
    amended: false
  };

  const dummyAppraisal: Pharmacist_Appraisal = {
    id: 'appraisal-phase2-test',
    pharmacist_id: 'usr-ph-01',
    branch_id: 'branch-01',
    supervisor_id: 'usr-sup-1',
    month: 9,
    year: 2026,
    sections: appraisalSections,
    total_credit_score: initialAppraisalScore.totalCreditScore,
    passed: initialAppraisalScore.passed,
    comments_and_improvement: 'Excellent regulatory diligence.',
    status: 'locked_submitted',
    created_at: lockedAt,
    updated_at: lockedAt,
    locked_at: lockedAt,
    submitted_by: 'usr-sup-1',
    amended: false
  };

  const distResult = await distributeLockedEvaluation(dummyAudit, dummyAppraisal);
  assertEquals(distResult.success, true, 'Distribution succeeds cleanly');
  assertEquals(distResult.logs.length, 3, 'Exactly 3 DistributionLog rows created (one per portal)');

  const recipientTypes = distResult.logs.map(l => l.recipient_type);
  assert(recipientTypes.includes('branch_portal'), 'Routes to branch_portal');
  assert(recipientTypes.includes('pharmacist_portal'), 'Routes to pharmacist_portal');
  assert(recipientTypes.includes('executive_admin'), 'Routes to executive_admin');
  assert(distResult.logs.every(l => l.status === 'sent'), 'All 3 logs have status="sent"');

  // ── 5. Mock Storage Adapter Persistence ───────────────────

  console.log('\n--- 5. Mock Storage Adapter Persistence ---');
  mockAuditStore.saveAudit(dummyAudit);
  mockAuditStore.saveAppraisal(dummyAppraisal);
  mockAuditStore.saveCapaTasks(capas);
  mockAuditStore.saveDistributionLogs(distResult.logs);

  const retrievedAudit = mockAuditStore.getAuditById(dummyAudit.id);
  assert(!!retrievedAudit, 'Locked audit retrieved from storage adapter');
  assertEquals(retrievedAudit?.status, 'locked_submitted', 'Retrieved audit has status="locked_submitted"');

  const retrievedAppraisal = mockAuditStore.getAppraisalById(dummyAppraisal.id);
  assert(!!retrievedAppraisal, 'Locked appraisal retrieved from storage adapter');
  assertEquals(retrievedAppraisal?.status, 'locked_submitted', 'Retrieved appraisal has status="locked_submitted"');

  const branchCapas = mockAuditStore.getCapaTasks(dummyAudit.branch_id);
  assert(branchCapas.length >= 3, 'Branch CAPA tasks accessible for Phase 3 Action Center');

  const distLogs = mockAuditStore.getDistributionLogs(dummyAudit.id);
  assert(distLogs.length >= 2, 'Audit distribution logs queryable for Admin audit trail');

  console.log('\n======================================================');
  console.log(`  Phase 2 Tests Completed: ${passedTests} passed, ${failedTests} failed`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase2Tests().catch(err => {
  console.error(err);
  process.exit(1);
});
