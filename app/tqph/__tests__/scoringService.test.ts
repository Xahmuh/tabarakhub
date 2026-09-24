import {
  calculateComplianceScore,
  calculateAppraisalScore,
  getGradePoints,
  getComplianceColorBand
} from '../services/scoringService';
import {
  deriveCapaSeverity,
  calculateCapaDueDate,
  generateCapaTasksFromAudit
} from '../services/capaService';
import {
  NHRASection,
  AppraisalSection
} from '../types';

/**
 * Unit Test Suite for TQPH Foundation (Phase 1)
 * Executable via: npx tsx app/tqph/__tests__/scoringService.test.ts
 */

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedTests++;
  }
}

function assertEquals<T>(actual: T, expected: T, message: string) {
  const match = actual === expected;
  if (match) {
    console.log(`  ✓ ${message} [${actual}]`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}. Expected: ${expected}, Received: ${actual}`);
    failedTests++;
  }
}

console.log('\n======================================================');
console.log('  TQPH Phase 1: Scoring & Business Logic Test Suite  ');
console.log('======================================================\n');

// ── 1. NHRA Compliance Score Tests (Section 5.1) ───────────

console.log('--- 1. NHRA Compliance Score ---');

{
  // Test 1.1: All Fully Compliant
  const allFull: NHRASection[] = [
    {
      section_code: '1.0',
      title: 'License',
      items: [
        { code: '1.1', label: 'CR', status: 'fully_compliant', attachment_ids: [] },
        { code: '1.2', label: 'License', status: 'fully_compliant', attachment_ids: [] }
      ]
    }
  ];
  const res1 = calculateComplianceScore(allFull);
  assertEquals(res1.score, 100, 'All fully compliant items yield 100%');
  assertEquals(res1.applicableItems, 2, 'Total applicable count is 2');
  assertEquals(res1.fullyCompliantCount, 2, 'Fully compliant count is 2');

  // Test 1.2: All Partially Compliant
  const allPartial: NHRASection[] = [
    {
      section_code: '1.0',
      title: 'License',
      items: [
        { code: '1.1', label: 'CR', status: 'partially_compliant', attachment_ids: [] },
        { code: '1.2', label: 'License', status: 'partially_compliant', attachment_ids: [] }
      ]
    }
  ];
  const res2 = calculateComplianceScore(allPartial);
  assertEquals(res2.score, 50, 'All partially compliant items yield 50%');

  // Test 1.3: All Non-Compliant
  const allNon: NHRASection[] = [
    {
      section_code: '1.0',
      title: 'License',
      items: [
        { code: '1.1', label: 'CR', status: 'non_compliant', attachment_ids: [] },
        { code: '1.2', label: 'License', status: 'non_compliant', attachment_ids: [] }
      ]
    }
  ];
  const res3 = calculateComplianceScore(allNon);
  assertEquals(res3.score, 0, 'All non-compliant items yield 0%');

  // Test 1.4: Mixed items (2 full, 1 partial, 1 non -> (1.0 + 1.0 + 0.5 + 0) / 4 = 2.5 / 4 = 62.5%)
  const mixed: NHRASection[] = [
    {
      section_code: '1.0',
      title: 'License',
      items: [
        { code: '1.1', label: 'Item 1', status: 'fully_compliant', attachment_ids: [] },
        { code: '1.2', label: 'Item 2', status: 'fully_compliant', attachment_ids: [] },
        { code: '1.3', label: 'Item 3', status: 'partially_compliant', attachment_ids: [] },
        { code: '1.4', label: 'Item 4', status: 'non_compliant', attachment_ids: [] }
      ]
    }
  ];
  const res4 = calculateComplianceScore(mixed);
  assertEquals(res4.score, 62.5, 'Mixed items calculate accurate fractional score (62.5%)');

  // Test 1.5: N/A items excluded from denominator
  // 2 full (1.0 + 1.0), 2 N/A -> 2.0 / 2 = 100%
  const naTest: NHRASection[] = [
    {
      section_code: '1.0',
      title: 'License',
      items: [
        { code: '1.1', label: 'Item 1', status: 'fully_compliant', attachment_ids: [] },
        { code: '1.2', label: 'Item 2', status: 'fully_compliant', attachment_ids: [] },
        { code: '1.3', label: 'Item 3', status: 'not_applicable', attachment_ids: [] },
        { code: '1.4', label: 'Item 4', status: 'not_applicable', attachment_ids: [] }
      ]
    }
  ];
  const res5 = calculateComplianceScore(naTest);
  assertEquals(res5.score, 100, 'N/A items are excluded from denominator (100%)');
  assertEquals(res5.applicableItems, 2, 'Applicable items count reflects exclusion of N/A items');
  assertEquals(res5.notApplicableCount, 2, 'N/A count is recorded accurately');

  // Test 1.6: Edge case - All items N/A
  const allNa: NHRASection[] = [
    {
      section_code: '1.0',
      title: 'License',
      items: [
        { code: '1.1', label: 'Item 1', status: 'not_applicable', attachment_ids: [] },
        { code: '1.2', label: 'Item 2', status: 'not_applicable', attachment_ids: [] }
      ]
    }
  ];
  const res6 = calculateComplianceScore(allNa);
  assertEquals(res6.score, 100, 'All-N/A edge case safely defaults to 100% without division by zero');

  // Test 1.7: Section weighting overrides (Section 8, #1)
  const weightedSections: NHRASection[] = [
    {
      section_code: '1.0',
      title: 'Section 1 (Weight 1.0)',
      items: [{ code: '1.1', label: 'Item 1.1', status: 'fully_compliant', attachment_ids: [] }]
    },
    {
      section_code: '8.0',
      title: 'Section 8 (Weight 3.0)',
      items: [{ code: '8.1', label: 'Item 8.1', status: 'non_compliant', attachment_ids: [] }]
    }
  ];
  // With equalWeighting: (1 + 0) / 2 = 50%
  const unweightedRes = calculateComplianceScore(weightedSections);
  assertEquals(unweightedRes.score, 50, 'Default equal weighting computes 50%');

  // With custom weighting: (1*1 + 0*3) / (1 + 3) = 1/4 = 25%
  const customWeightedRes = calculateComplianceScore(weightedSections, {
    equalWeighting: false,
    sectionWeights: { '1.0': 1.0, '8.0': 3.0 },
    statusScoreValues: { fully_compliant: 1.0, partially_compliant: 0.5, non_compliant: 0.0 }
  });
  assertEquals(customWeightedRes.score, 25, 'Section weights override properly weights critical section (25%)');
}

// ── 2. Pharmacist Appraisal Score & Pass/Fail Boundaries (Section 5.2) ──

console.log('\n--- 2. Pharmacist Appraisal Score & Thresholds ---');

{
  // Test 2.1: Letter Grade to points conversion
  assertEquals(getGradePoints('A*'), 5, 'Grade A* = 5 points');
  assertEquals(getGradePoints('A'), 4, 'Grade A = 4 points');
  assertEquals(getGradePoints('B'), 3, 'Grade B = 3 points');
  assertEquals(getGradePoints('C'), 2, 'Grade C = 2 points');
  assertEquals(getGradePoints('F'), 1, 'Grade F = 1 point');

  // Test 2.2: Maximum score (30 criteria all A*) -> 150 points
  const perfectSections: AppraisalSection[] = [
    {
      section_id: 'I',
      title: 'Skills',
      criteria: Array.from({ length: 30 }, (_, i) => ({
        code: `C.${i + 1}`,
        label: `Criterion ${i + 1}`,
        grade: 'A*',
        points: 5
      }))
    }
  ];
  const perfRes = calculateAppraisalScore(perfectSections);
  assertEquals(perfRes.totalCreditScore, 150, '30 criteria at A* gives max 150 points');
  assertEquals(perfRes.passed, true, 'Score 150 passes (passed = true)');
  assertEquals(perfRes.percentage, 100, 'Score 150 is 100%');

  // Test 2.3: Boundary threshold - Score = 95 (Passing threshold)
  // 19 criteria with A* (19 * 5 = 95)
  const boundaryPass: AppraisalSection[] = [
    {
      section_id: 'I',
      title: 'Skills',
      criteria: Array.from({ length: 19 }, (_, i) => ({
        code: `C.${i + 1}`,
        label: `Criterion ${i + 1}`,
        grade: 'A*',
        points: 5
      }))
    }
  ];
  const passRes = calculateAppraisalScore(boundaryPass);
  assertEquals(passRes.totalCreditScore, 95, 'Total score is 95');
  assertEquals(passRes.passed, true, 'Score of exactly 95 PASSES');

  // Test 2.4: Boundary threshold - Score = 94 (Failing threshold)
  // 18 * 5 (90) + 1 * 4 (4) = 94
  const boundaryFail: AppraisalSection[] = [
    {
      section_id: 'I',
      title: 'Skills',
      criteria: [
        ...Array.from({ length: 18 }, (_, i) => ({
          code: `C.${i + 1}`,
          label: `Criterion ${i + 1}`,
          grade: 'A*' as const,
          points: 5
        })),
        { code: 'C.19', label: 'Criterion 19', grade: 'A' as const, points: 4 }
      ]
    }
  ];
  const failRes = calculateAppraisalScore(boundaryFail);
  assertEquals(failRes.totalCreditScore, 94, 'Total score is 94');
  assertEquals(failRes.passed, false, 'Score of 94 FAILS (< 95)');
}

// ── 3. Status Color Band Classification (Section 5.3) ──────

console.log('\n--- 3. Status Color Band Classification ---');

{
  assertEquals(getComplianceColorBand(100).band, 'Green', '100% is Green');
  assertEquals(getComplianceColorBand(95.0).band, 'Green', '95.0% boundary is Green');
  assertEquals(getComplianceColorBand(95.0).color, '#10B981', 'Green hex is #10B981');

  assertEquals(getComplianceColorBand(94.9).band, 'Amber', '94.9% boundary is Amber');
  assertEquals(getComplianceColorBand(85.0).band, 'Amber', '85.0% is Amber');
  assertEquals(getComplianceColorBand(80.0).band, 'Amber', '80.0% boundary is Amber');
  assertEquals(getComplianceColorBand(80.0).color, '#F59E0B', 'Amber hex is #F59E0B');

  assertEquals(getComplianceColorBand(79.9).band, 'Red', '79.9% boundary is Red');
  assertEquals(getComplianceColorBand(50.0).band, 'Red', '50.0% is Red');
  assertEquals(getComplianceColorBand(0).band, 'Red', '0% is Red');
  assertEquals(getComplianceColorBand(0).color, '#EF4444', 'Red hex is #EF4444');
}

// ── 4. CAPA Auto-Generation & Severity Mapping (Section 5.4 & Section 8) ─

console.log('\n--- 4. CAPA Auto-Generation & Severity Mapping ---');

{
  assertEquals(deriveCapaSeverity('1.0'), 'Critical', 'Section 1.0 maps to Critical severity');
  assertEquals(deriveCapaSeverity('7.0'), 'Critical', 'Section 7.0 maps to Critical severity');
  assertEquals(deriveCapaSeverity('8.0'), 'Critical', 'Section 8.0 maps to Critical severity');
  assertEquals(deriveCapaSeverity('5.0'), 'Major', 'Section 5.0 maps to Major severity');
  assertEquals(deriveCapaSeverity('6.0'), 'Major', 'Section 6.0 maps to Major severity');
  assertEquals(deriveCapaSeverity('2.0'), 'Minor', 'Section 2.0 maps to Minor severity');
  assertEquals(deriveCapaSeverity('3.0'), 'Minor', 'Section 3.0 maps to Minor severity');
  assertEquals(deriveCapaSeverity('4.0'), 'Minor', 'Section 4.0 maps to Minor severity');

  // Due date test (48 hours = 2 days)
  const lockedAt = '2026-09-01T10:00:00.000Z';
  const expectedDueDate = '2026-09-03T10:00:00.000Z';
  assertEquals(calculateCapaDueDate(lockedAt, 48), expectedDueDate, 'CAPA due date defaults to locked_at + 48 hours');

  // Auto-generation logic
  const auditSections: NHRASection[] = [
    {
      section_code: '1.0',
      title: 'License',
      items: [
        { code: '1.1', label: 'CR', status: 'fully_compliant', attachment_ids: [] },
        { code: '1.2', label: 'NHRA License', status: 'non_compliant', notes: 'Expired license', attachment_ids: [] }
      ]
    },
    {
      section_code: '2.0',
      title: 'Workplace',
      items: [
        // Partially compliant WITHOUT corrective action flag -> should NOT generate CAPA
        { code: '2.1', label: 'Uniform', status: 'partially_compliant', requires_corrective_action: false, attachment_ids: [] },
        // Partially compliant WITH corrective action flag -> SHOULD generate CAPA
        { code: '2.2', label: 'Flooring', status: 'partially_compliant', requires_corrective_action: true, notes: 'Missing non-slip mat', attachment_ids: [] }
      ]
    }
  ];

  const tasks = generateCapaTasksFromAudit('test-audit-01', auditSections, 'usr-bm-01', lockedAt);
  assertEquals(tasks.length, 2, 'Exactly 2 CAPA tasks generated (1 non-compliant + 1 flagged partial)');
  assertEquals(tasks[0].severity, 'Critical', 'First CAPA from Section 1.0 is Critical');
  assertEquals(tasks[0].element_code, '1.2', 'First CAPA links to item 1.2');
  assertEquals(tasks[1].severity, 'Minor', 'Second CAPA from Section 2.0 is Minor');
  assertEquals(tasks[1].element_code, '2.2', 'Second CAPA links to item 2.2');
  assertEquals(tasks[0].due_date, expectedDueDate, 'CAPA tasks have correct 48h due date');
}

console.log('\n======================================================');
console.log(`  Tests Completed: ${passedTests} passed, ${failedTests} failed`);
console.log('======================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
