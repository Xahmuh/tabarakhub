import {
  AppraisalCriterion,
  AppraisalSection,
  LetterGrade,
  Pharmacist_Appraisal
} from '../types';

/**
 * Standard 6-Pillar Pharmacist Appraisal Template (Section 5.2 & Section 6)
 * Total of 30 criteria: 7 + 4 + 5 + 7 + 3 + 4 = 30 criteria (Max 150 points)
 */
export const STANDARD_APPRAISAL_SECTIONS_TEMPLATE: AppraisalSection[] = [
  {
    section_id: 'I',
    title: 'Job Knowledge & Operational Skills',
    criteria: [
      { code: 'I.1', label: 'Pharmacological knowledge of drug interactions and contraindications', grade: 'A', points: 4 },
      { code: 'I.2', label: 'Dispensing speed, accuracy, and double-check protocol', grade: 'A', points: 4 },
      { code: 'I.3', label: 'Proficiency in pharmacy management system (POS & ERP)', grade: 'A', points: 4 },
      { code: 'I.4', label: 'Compounding skills and extemporaneous preparation techniques', grade: 'B', points: 3 },
      { code: 'I.5', label: 'Handling of OTC inquiries and self-care recommendations', grade: 'A', points: 4 },
      { code: 'I.6', label: 'Insurance claim processing and pre-authorization handling', grade: 'A', points: 4 },
      { code: 'I.7', label: 'Knowledge of new pharmaceutical molecules and guidelines', grade: 'B', points: 3 }
    ]
  },
  {
    section_id: 'II',
    title: 'Customer Care & Communication',
    criteria: [
      { code: 'II.1', label: 'Clear patient counseling regarding dosage regimens and adverse effects', grade: 'A*', points: 5 },
      { code: 'II.2', label: 'Empathy, patience, and active listening during customer consultations', grade: 'A', points: 4 },
      { code: 'II.3', label: 'Professional handling of customer complaints and disputed returns', grade: 'B', points: 3 },
      { code: 'II.4', label: 'Bilingual communication effectiveness (Arabic / English)', grade: 'A', points: 4 }
    ]
  },
  {
    section_id: 'III',
    title: 'Regulatory Compliance & Accuracy',
    criteria: [
      { code: 'III.1', label: 'Strict adherence to NHRA controlled & semi-controlled regulations', grade: 'A*', points: 5 },
      { code: 'III.2', label: 'Verification of patient CPR and physician licensing before dispensing', grade: 'A', points: 4 },
      { code: 'III.3', label: 'Accurate logging of Red Book entries without clerical errors', grade: 'A*', points: 5 },
      { code: 'III.4', label: 'Compliance with cold chain temperature log verification protocols', grade: 'A', points: 4 },
      { code: 'III.5', label: 'Prompt reporting of suspected adverse reactions or counterfeit alerts', grade: 'A', points: 4 }
    ]
  },
  {
    section_id: 'IV',
    title: 'Inventory & Stock Management',
    criteria: [
      { code: 'IV.1', label: 'FEFO (First-Expired, First-Out) stock rotation adherence', grade: 'A', points: 4 },
      { code: 'IV.2', label: 'Daily inspection of short-expiry items and timely escalation', grade: 'B', points: 3 },
      { code: 'IV.3', label: 'Participation in periodic physical cycle counts and stock audits', grade: 'A', points: 4 },
      { code: 'IV.4', label: 'Proper quarantine of damaged or recalled medications', grade: 'A', points: 4 },
      { code: 'IV.5', label: 'Receiving supplier shipments and matching purchase orders', grade: 'A', points: 4 },
      { code: 'IV.6', label: 'Minimizing product wastage and damaged package write-offs', grade: 'B', points: 3 },
      { code: 'IV.7', label: 'Maintaining neat, organized, and standardized shelf layout', grade: 'A', points: 4 }
    ]
  },
  {
    section_id: 'V',
    title: 'Teamwork & Professional Conduct',
    criteria: [
      { code: 'V.1', label: 'Collaboration with pharmacy colleagues and smooth shift handover', grade: 'A', points: 4 },
      { code: 'V.2', label: 'Adherence to Tabarak grooming standards, uniform, and hygiene', grade: 'A*', points: 5 },
      { code: 'V.3', label: 'Receptiveness to constructive feedback and continuous learning', grade: 'A', points: 4 }
    ]
  },
  {
    section_id: 'VI',
    title: 'Attendance & Reliability',
    criteria: [
      { code: 'VI.1', label: 'Punctuality at shift start and scheduled handover times', grade: 'A', points: 4 },
      { code: 'VI.2', label: 'Attendance consistency and compliance with duty roster', grade: 'A', points: 4 },
      { code: 'VI.3', label: 'Flexibility in covering emergency branch relief shifts', grade: 'B', points: 3 },
      { code: 'VI.4', label: 'Compliance with company leave request notice policies', grade: 'A', points: 4 }
    ]
  }
];

export function getFreshAppraisalTemplate(): AppraisalSection[] {
  return JSON.parse(JSON.stringify(STANDARD_APPRAISAL_SECTIONS_TEMPLATE));
}

// Helper to generate a standardized appraisal
function createMockAppraisal(
  id: string,
  pharmacistId: string,
  branchId: string,
  supervisorId: string,
  month: number,
  year: number,
  score: number,
  passed: boolean,
  comments: string,
  dateStr: string
): Pharmacist_Appraisal {
  const base = Math.floor(score / 30);
  const remainder = score % 30;
  let criterionIndex = 0;

  const pointsToGrade = (pts: number): LetterGrade => {
    if (pts >= 5) return 'A*';
    if (pts === 4) return 'A';
    if (pts === 3) return 'B';
    if (pts === 2) return 'C';
    return 'F';
  };

  return {
    id,
    pharmacist_id: pharmacistId,
    branch_id: branchId,
    supervisor_id: supervisorId,
    month,
    year,
    status: 'locked_submitted',
    total_credit_score: score,
    passed,
    comments_and_improvement: comments,
    created_at: `${dateStr}T10:00:00.000Z`,
    updated_at: `${dateStr}T12:00:00.000Z`,
    locked_at: `${dateStr}T12:00:00.000Z`,
    submitted_by: supervisorId,
    amended: false,
    sections: STANDARD_APPRAISAL_SECTIONS_TEMPLATE.map(sec => ({
      ...sec,
      criteria: sec.criteria.map((c): AppraisalCriterion => {
        const pts = criterionIndex < remainder ? base + 1 : base;
        criterionIndex++;
        return {
          ...c,
          points: pts,
          grade: pointsToGrade(pts)
        };
      })
    }))
  };
}

import { MOCK_BRANCHES } from './mockBranches';
import { MOCK_USERS } from './mockUsers';

// ── Seeded Pharmacist Appraisals (Multiple Months & Pass/Fail variance) ─────
const phs = MOCK_USERS.filter(u => u.role === 'pharmacist');
const sups = MOCK_USERS.filter(u => u.role === 'supervisor');
const sup1 = sups[0]?.id || 'a8074b0d-669e-4d4e-8ff3-ab0219e35790';
const sup2 = sups[1]?.id || 'b455e337-3202-4835-8d81-508729195268';

const SCORES_AND_COMMENTS = [
  { score: 146, passed: true, comments: 'Top performer across the network. Exceptional regulatory diligence in Red Book reconciliation and superb patient counseling.', day: '05' },
  { score: 142, passed: true, comments: 'Outstanding clinical accuracy, exemplary customer relations, and perfect FEFO stock rotation adherence.', day: '06' },
  { score: 138, passed: true, comments: 'Remarkable speed and precision in dispensing. Excellent initiative in mentor-training junior pharmacy technicians.', day: '09' },
  { score: 135, passed: true, comments: 'Consistent high performer. Flawless management of controlled medication registers and zero dispensing errors.', day: '09' },
  { score: 132, passed: true, comments: 'Strong customer care ratings and thorough knowledge of new pharmacological guidelines.', day: '07' },
  { score: 128, passed: true, comments: 'Solid reliability and outstanding customer satisfaction ratings in the Muharraq branch.', day: '06' },
  { score: 124, passed: true, comments: 'Dependable team player with sound compounding skills and fast insurance claim approvals.', day: '08' },
  { score: 118, passed: true, comments: 'Good customer communication. Recommend continuous focus on daily temperature log timeliness.', day: '11' },
  { score: 112, passed: true, comments: 'Satisfactory adherence to operational SOPs. Advised to participate actively in weekly stock cycle counts.', day: '10' },
  { score: 104, passed: true, comments: 'Good clinical competence. Recommended to focus on stock rotation (FEFO) and faster insurance claim resolution.', day: '05' },
  { score: 88, passed: false, comments: 'Did not achieve minimum passing standard (95 pts). Required to attend refresher training on OTC guidelines and register compliance.', day: '11' },
  { score: 86, passed: false, comments: 'Requires immediate refresher training on NHRA controlled drugs custody protocols and daily temperature logging adherence.', day: '08' }
];

export const MOCK_APPRAISALS: Pharmacist_Appraisal[] = [
  // ── September 2026 Appraisals (Top 12 Active Pharmacists) ───────────────────
  ...SCORES_AND_COMMENTS.map((item, idx) => {
    const ph = phs[idx] || phs[0];
    const branch = MOCK_BRANCHES.find(b => b.id === ph.branch_id) || MOCK_BRANCHES[idx % MOCK_BRANCHES.length];
    const supervisorId = idx % 2 === 0 ? sup1 : sup2;
    const dateStr = `2026-09-${item.day}`;
    const id = `appraisal-2026-09-${String(idx + 1).padStart(2, '0')}`;

    return createMockAppraisal(
      id,
      ph.id,
      branch.id,
      supervisorId,
      9,
      2026,
      item.score,
      item.passed,
      item.comments,
      dateStr
    );
  }),

  // ── August 2026 Appraisals (Historical) ────────────────────────────────────
  createMockAppraisal(
    'appraisal-2026-08-01',
    phs[6]?.id || phs[0]?.id,
    MOCK_BRANCHES[1]?.id || MOCK_BRANCHES[0].id,
    sup2,
    8,
    2026,
    126,
    true,
    'Solid reliability and outstanding customer satisfaction ratings in the Muharraq branch.',
    '2026-08-18'
  ),
  createMockAppraisal(
    'appraisal-2026-08-02',
    phs[0]?.id,
    MOCK_BRANCHES[0]?.id,
    sup1,
    8,
    2026,
    140,
    true,
    'Consistently stellar performance and proactive adherence to NHRA standards.',
    '2026-08-15'
  )
];
