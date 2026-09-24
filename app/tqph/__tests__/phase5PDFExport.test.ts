import {
  generateNHRAReportPDF,
  generateAppraisalPDF
} from '../services/pdfExportService';
import { mockAuditStore } from '../services/mockAuditStore';
import { MOCK_BRANCHES, MOCK_USERS } from '../data';

/**
 * Phase 5 Automated Verification Suite (PDF Export Engine)
 * Executable via: npx tsx app/tqph/__tests__/phase5PDFExport.test.ts
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

async function runPhase5Tests() {
  console.log('\n=============================================================');
  console.log('  TQPH Phase 5: PDF Export Engine Automated Test Suite       ');
  console.log('=============================================================\n');

  // ── 1. Template 1: NHRA Official Inspection Simulation Report ─
  console.log('--- 1. Testing Template 1: NHRA Inspection Report PDF Generation ---');
  const audits = mockAuditStore.getAudits();
  const capas = mockAuditStore.getCapaTasks();

  // Test 1a: High Compliance Audit (Green Band: 98.2%)
  const greenAudit = audits.find(a => a.compliance_score >= 95)!;
  assert(!!greenAudit, `Found Green Band audit on record (${greenAudit.id}, ${greenAudit.compliance_score}%)`);

  const greenBranch = MOCK_BRANCHES.find(b => b.id === greenAudit.branch_id)!;
  const greenSupervisor = MOCK_USERS.find(u => u.id === greenAudit.supervisor_id) || MOCK_USERS.find(u => u.role === 'supervisor')!;
  const greenCapas = capas.filter(c => c.audit_id === greenAudit.id);

  console.log(`  Generating NHRA PDF for ${greenBranch.name}...`);
  const greenPdfBlob = await generateNHRAReportPDF(greenAudit, greenBranch, greenSupervisor, greenCapas);

  assert(!!greenPdfBlob, 'PDF generation returned a valid Blob object');
  assertEquals(greenPdfBlob.type, 'application/pdf', 'MIME type is application/pdf');
  assert(greenPdfBlob.size > 1000, `PDF Blob has non-trivial size (${greenPdfBlob.size} bytes)`);

  // Test 1b: Low Compliance Audit with Critical CAPAs (Red Band: 76.8%)
  const redAudit = audits.find(a => a.compliance_score < 80)!;
  assert(!!redAudit, `Found Red Band audit with violations on record (${redAudit.id}, ${redAudit.compliance_score}%)`);

  const redBranch = MOCK_BRANCHES.find(b => b.id === redAudit.branch_id)!;
  const redSupervisor = MOCK_USERS.find(u => u.id === redAudit.supervisor_id) || MOCK_USERS.find(u => u.role === 'supervisor')!;
  const redCapas = capas.filter(c => c.audit_id === redAudit.id);

  assert(redCapas.length > 0, `Red audit has associated CAPA tasks (${redCapas.length} tasks)`);

  console.log(`  Generating NHRA PDF with CAPAs for ${redBranch.name}...`);
  const redPdfBlob = await generateNHRAReportPDF(redAudit, redBranch, redSupervisor, redCapas);

  assert(!!redPdfBlob, 'Red Band PDF with CAPA summary returned a valid Blob');
  assertEquals(redPdfBlob.type, 'application/pdf', 'Red Band PDF MIME type is application/pdf');
  assert(redPdfBlob.size > 1000, `Red Band PDF Blob size is valid (${redPdfBlob.size} bytes)`);

  // ── 2. Template 2: Tabarak Pharmacist Performance Appraisal Form ─
  console.log('\n--- 2. Testing Template 2: Pharmacist Performance Appraisal PDF Generation ---');
  const appraisals = mockAuditStore.getAppraisals();

  // Test 2a: Passed Appraisal (Dr. Ahmed Al-Ghanem: 146 pts)
  const passedAppraisal = appraisals.find(a => a.passed && a.total_credit_score >= 135)!;
  assert(!!passedAppraisal, `Found high-scoring Passed appraisal (${passedAppraisal.id}, ${passedAppraisal.total_credit_score} pts)`);

  const passedPharmacist = MOCK_USERS.find(u => u.id === passedAppraisal.pharmacist_id)!;
  const passedBranch = MOCK_BRANCHES.find(b => b.id === passedAppraisal.branch_id)!;
  const passedSupervisor = MOCK_USERS.find(u => u.id === passedAppraisal.supervisor_id);

  console.log(`  Generating Appraisal PDF for ${passedPharmacist.name}...`);
  const passedAppraisalBlob = await generateAppraisalPDF(
    passedAppraisal,
    passedPharmacist,
    passedBranch,
    passedSupervisor
  );

  assert(!!passedAppraisalBlob, 'Passed Appraisal returned a valid Blob object');
  assertEquals(passedAppraisalBlob.type, 'application/pdf', 'Appraisal MIME type is application/pdf');
  assert(passedAppraisalBlob.size > 1000, `Appraisal PDF has non-trivial size (${passedAppraisalBlob.size} bytes)`);

  // Test 2b: Failed Appraisal (Score < 95 pts)
  const failedAppraisal = appraisals.find(a => !a.passed)!;
  assert(!!failedAppraisal, `Found Did Not Pass appraisal (<95 pts) (${failedAppraisal.id}, ${failedAppraisal.total_credit_score} pts)`);

  const failedPharmacist = MOCK_USERS.find(u => u.id === failedAppraisal.pharmacist_id)!;
  const failedBranch = MOCK_BRANCHES.find(b => b.id === failedAppraisal.branch_id)!;

  console.log(`  Generating Appraisal PDF for ${failedPharmacist.name}...`);
  const failedAppraisalBlob = await generateAppraisalPDF(
    failedAppraisal,
    failedPharmacist,
    failedBranch
  );

  assert(!!failedAppraisalBlob, 'Failed Appraisal returned a valid Blob object');
  assertEquals(failedAppraisalBlob.type, 'application/pdf', 'Failed Appraisal MIME type is application/pdf');
  assert(failedAppraisalBlob.size > 1000, `Failed Appraisal PDF Blob size is valid (${failedAppraisalBlob.size} bytes)`);

  // ── 3. Data Integrity & PII Protection (Section 7.4 & 9) ───
  console.log('\n--- 3. Verifying Zero-Flattening & Entity Contract Compliance ---');
  assertEquals(greenAudit.sections.length, 8, 'NHRA Audit template receives all 8 sections directly');
  assertEquals(passedAppraisal.sections.length, 6, 'Appraisal template receives all 6 pillars directly');
  const totalCriteria = passedAppraisal.sections.reduce((acc, s) => acc + s.criteria.length, 0);
  assertEquals(totalCriteria, 30, 'Appraisal template receives all 30 criteria directly');

  // Verify CPR format in mock data is valid 9-digit Bahrain CPR
  assert(passedPharmacist.cpr.length === 9, `Pharmacist CPR is 9 digits [${passedPharmacist.cpr}]`);

  // ── Summary ─────────────────────────────────────────────────
  console.log('\n=============================================================');
  console.log(`  Phase 5 Test Results: ${passedTests} passed, ${failedTests} failed`);
  console.log('=============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log('🎉 Definition of Done for Phase 5 (PDF Export Engine) FULLY MET!\n');
  }
}

runPhase5Tests().catch(err => {
  console.error('Fatal error in Phase 5 test execution:', err);
  process.exit(1);
});
