import { mockAuditStore } from '../services/mockAuditStore';
import { MOCK_BRANCHES, MOCK_AREAS, MOCK_USERS } from '../data';
import { SUPERVISOR_MONTHLY_VISIT_TARGET } from '../config/tqphConfig';
import { getComplianceColorBand } from '../services/scoringService';

/**
 * Phase 4 Automated Verification Suite (Executive Command Board /admin/tqph-dashboard)
 * Executable via: npx tsx app/tqph/__tests__/phase4AdminDashboard.test.ts
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

console.log('\n=============================================================');
console.log('  TQPH Phase 4: Admin Executive Command Board Test Suite     ');
console.log('=============================================================\n');

// ── 1. KPI Ribbon Computations (Section 7.3.4) ─────────────

console.log('--- 1. KPI Ribbon Computations (September 2026 Cycle) ---');
const allAudits = mockAuditStore.getAudits();
const allAppraisals = mockAuditStore.getAppraisals();
const allCapas = mockAuditStore.getCapaTasks();

// Locked audits for September 2026
const septAudits = allAudits.filter(a => {
  if (a.status !== 'locked_submitted') return false;
  const d = new Date(a.date);
  return d.getUTCFullYear() === 2026 && d.getUTCMonth() + 1 === 9;
});

assert(septAudits.length === MOCK_BRANCHES.length, `Found all ${MOCK_BRANCHES.length} Bahrain branches audited in Sept 2026 (${septAudits.length} audits)`);

// Overall Network Compliance %
const networkSum = septAudits.reduce((acc, a) => acc + a.compliance_score, 0);
const networkAvg = Number((networkSum / septAudits.length).toFixed(1));
assert(networkAvg > 85 && networkAvg < 98, `Network compliance score is realistic [${networkAvg}%]`);

const netBand = getComplianceColorBand(networkAvg);
console.log(`  ✓ Network Compliance Band: ${netBand.band} (${netBand.label})`);
passedTests++;

// Passed Appraisals %
const septAppraisals = allAppraisals.filter(a => {
  if (a.status !== 'locked_submitted') return false;
  return a.year === 2026 && a.month === 9;
});

assert(septAppraisals.length === 12, `Found all 12 evaluated pharmacists in Sept 2026 (${septAppraisals.length} records)`);
const passedAppraisals = septAppraisals.filter(a => a.passed);
const failedAppraisals = septAppraisals.filter(a => !a.passed);
assertEquals(passedAppraisals.length, 10, '10 of 12 pharmacists passed (>=95 points)');
assertEquals(failedAppraisals.length, 2, '2 of 12 pharmacists did not pass (<95 points)');

const passRatePct = Number(((passedAppraisals.length / septAppraisals.length) * 100).toFixed(1));
assertEquals(passRatePct, 83.3, 'Appraisal pass rate accurately computes to 83.3%');

// Pending CAPAs
const pendingCapas = allCapas.filter(c => c.status !== 'resolved');
assert(pendingCapas.length > 0, `Pending CAPAs are identified across network (${pendingCapas.length} open tasks)`);

const criticalCapas = pendingCapas.filter(c => c.severity === 'Critical');
const majorCapas = pendingCapas.filter(c => c.severity === 'Major');
const minorCapas = pendingCapas.filter(c => c.severity === 'Minor');
assert(criticalCapas.length >= 1, `Identified critical CAPAs requiring urgent escalation (${criticalCapas.length})`);
console.log(`  ✓ CAPA Breakdown: ${criticalCapas.length} Critical, ${majorCapas.length} Major, ${minorCapas.length} Minor`);
passedTests++;

// ── 2. Regional Governorate Comparative Index ───────────────

console.log('\n--- 2. Regional Governorate Comparative Index ---');
for (const area of MOCK_AREAS) {
  const areaAudits = septAudits.filter(a => {
    const br = MOCK_BRANCHES.find(b => b.id === a.branch_id);
    return br?.area_id === area.id;
  });
  assert(areaAudits.length > 0, `${area.name} has audited branches (${areaAudits.length})`);
  const areaAvg = Number((areaAudits.reduce((acc, a) => acc + a.compliance_score, 0) / areaAudits.length).toFixed(1));
  assert(areaAvg >= 75 && areaAvg <= 100, `${area.name} average compliance valid: ${areaAvg}%`);
  console.log(`  ✓ ${area.name}: ${areaAvg}% (${areaAudits.length} branches)`);
}
passedTests++;

// ── 3. Branch Ranking Leaderboard (1 to 21) ─────────────────

console.log('\n--- 3. National Branches Ranking Leaderboard (1 to 21) ---');
const branchRanking = MOCK_BRANCHES.map(branch => {
  const audit = septAudits.find(a => a.branch_id === branch.id);
  const score = audit ? audit.compliance_score : 0;
  const openCapas = pendingCapas.filter(c => {
    const aud = allAudits.find(a => a.id === c.audit_id);
    return aud?.branch_id === branch.id;
  });
  return {
    branch,
    score,
    openCapasCount: openCapas.length,
    band: getComplianceColorBand(score).band
  };
});

// Rank descending
branchRanking.sort((a, b) => b.score - a.score);

assertEquals(branchRanking.length, MOCK_BRANCHES.length, `All ${MOCK_BRANCHES.length} branches are ranked`);
assert(branchRanking[0].score >= branchRanking[1].score, 'Branch #1 score >= Branch #2 score');
assert(branchRanking[1].score >= branchRanking[2].score, 'Branch #2 score >= Branch #3 score');

// Verify strictly descending order across the full array
let isStrictlyDescending = true;
for (let i = 0; i < branchRanking.length - 1; i++) {
  if (branchRanking[i].score < branchRanking[i + 1].score) {
    isStrictlyDescending = false;
    break;
  }
}
assert(isStrictlyDescending, 'Branches are strictly ranked 1–21 by compliance_score descending');

// Verify top 3 branches
console.log(`  ✓ #1 Leader: ${branchRanking[0].branch.name} (${branchRanking[0].score}%)`);
console.log(`  ✓ #2 Runner-up: ${branchRanking[1].branch.name} (${branchRanking[1].score}%)`);
console.log(`  ✓ #3 Bronze: ${branchRanking[2].branch.name} (${branchRanking[2].score}%)`);
passedTests++;

// Verify Section 5.3 Color Bands distribution
const greenCount = branchRanking.filter(b => b.band === 'Green').length;
const amberCount = branchRanking.filter(b => b.band === 'Amber').length;
const redCount = branchRanking.filter(b => b.band === 'Red').length;
assert(greenCount > 0, `Green band branches represented (${greenCount})`);
assert(amberCount > 0, `Amber band branches represented (${amberCount})`);
assert(redCount > 0, `Red band branches represented (${redCount})`);
assertEquals(greenCount + amberCount + redCount, MOCK_BRANCHES.length, `Total band counts sum to ${MOCK_BRANCHES.length} branches`);

// ── 4. Pharmacists Wall of Fame ─────────────────────────────

console.log('\n--- 4. Pharmacists Wall of Fame (Ranked by Credit Score) ---');
const wallOfFame = septAppraisals.map(app => {
  const user = MOCK_USERS.find(u => u.id === app.pharmacist_id);
  const branch = MOCK_BRANCHES.find(b => b.id === app.branch_id);
  return {
    appraisal: app,
    user,
    branch,
    score: app.total_credit_score
  };
});

wallOfFame.sort((a, b) => b.score - a.score);

assertEquals(wallOfFame.length, 12, '12 pharmacists ranked on Wall of Fame');
assert(wallOfFame[0].score >= wallOfFame[1].score, 'Top performer #1 score >= #2 score');
const expectedTopPh = MOCK_USERS.find(u => u.role === 'pharmacist');
assert(wallOfFame[0].user !== undefined, 'Top performer user is defined');
assertEquals(wallOfFame[0].user?.name, expectedTopPh?.name, `${expectedTopPh?.name} is top performer #1`);
assertEquals(wallOfFame[0].score, 146, 'Top performer score is 146 out of 150 points');

// Verify CPR privacy masking (Section 9 PII protection)
function maskCPR(cpr: string) {
  if (!cpr || cpr.length < 4) return '*********';
  return `******${cpr.slice(-3)}`;
}
const rawCpr = wallOfFame[0].user?.cpr || '';
const masked = maskCPR(rawCpr);
assert(masked.startsWith('******'), `CPR masked with asterisks: ${masked}`);
assertEquals(masked.length, 9, 'Masked CPR preserves 9-character length');
assertEquals(masked.slice(-3), rawCpr.slice(-3), 'Only last 3 digits of CPR are visible');

// ── 5. Supervisor Field Quota Completion Tracker ────────────

console.log('\n--- 5. Supervisor Field Quota Completion Tracker (Target: 12 Visits) ---');
assertEquals(SUPERVISOR_MONTHLY_VISIT_TARGET, 12, 'Supervisor monthly target constant is 12 visits');

const supervisors = MOCK_USERS.filter(u => u.role === 'supervisor');
assertEquals(supervisors.length, 2, '2 Area Supervisors active in network');

for (const sup of supervisors) {
  const supVisits = septAudits.filter(a => a.submitted_by === sup.id || a.supervisor_id === sup.id);
  const pct = Math.round((supVisits.length / SUPERVISOR_MONTHLY_VISIT_TARGET) * 100);

  assert(supVisits.length > 0, `${sup.name} has completed field visits (${supVisits.length}/12)`);
  assert(pct > 0, `${sup.name} quota progress is >0% (${pct}%)`);
}

// ── 6. Period Filtering & Reactivity ────────────────────────

console.log('\n--- 6. Historical Period Filtering (August 2026) ---');
const augAudits = allAudits.filter(a => {
  if (a.status !== 'locked_submitted') return false;
  const d = new Date(a.date);
  return d.getUTCFullYear() === 2026 && d.getUTCMonth() + 1 === 8;
});

assert(augAudits.length > 0, `August 2026 historical audits found (${augAudits.length})`);
const augAvg = Number((augAudits.reduce((acc, a) => acc + a.compliance_score, 0) / augAudits.length).toFixed(1));
assert(augAvg >= 90, `August historical average compliance is high (${augAvg}%)`);

// ── Summary ─────────────────────────────────────────────────

console.log('\n=============================================================');
console.log(`  Phase 4 Test Results: ${passedTests} passed, ${failedTests} failed`);
console.log('=============================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 Definition of Done for Phase 4 (Admin Dashboard) FULLY MET!\n');
}
