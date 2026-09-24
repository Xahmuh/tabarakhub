import {
  CAPA_Task,
  NHRA_Audit,
  NHRASection
} from '../types';

/**
 * Standard NHRA Checklist Template (Sections 1.0 - 8.0)
 * Reusable master template for simulated audits.
 */
export const STANDARD_NHRA_SECTIONS_TEMPLATE: NHRASection[] = [
  {
    section_code: '1.0',
    title: 'License & Approvals',
    items: [
      { code: '1.1', label: 'Valid Commercial Registration (CR) prominently displayed', status: 'fully_compliant', attachment_ids: [] },
      { code: '1.2', label: 'Valid NHRA Pharmacy Facility Operating License displayed', status: 'fully_compliant', attachment_ids: [] },
      { code: '1.3', label: 'Pharmacist-in-Charge valid NHRA professional license on record', status: 'fully_compliant', attachment_ids: [] },
      { code: '1.4', label: 'All on-duty pharmacy staff licensed and registered with NHRA', status: 'fully_compliant', attachment_ids: [] }
    ]
  },
  {
    section_code: '2.0',
    title: 'Workplace Standards',
    items: [
      { code: '2.1', label: 'Premises cleanliness, sanitation, and pest control contract valid', status: 'fully_compliant', attachment_ids: [] },
      { code: '2.2', label: 'Adequate lighting, non-slip flooring, and clean dispensing benches', status: 'fully_compliant', attachment_ids: [] },
      { code: '2.3', label: 'Clear separation between dispensary, customer waiting, and storeroom', status: 'fully_compliant', attachment_ids: [] },
      { code: '2.4', label: 'Staff wearing approved clean lab coats with legible NHRA ID badges', status: 'fully_compliant', attachment_ids: [] }
    ]
  },
  {
    section_code: '3.0',
    title: 'Policies & Procedures',
    items: [
      { code: '3.1', label: 'Standard Operating Procedures (SOP) manual available and signed by staff', status: 'fully_compliant', attachment_ids: [] },
      { code: '3.2', label: 'Adverse Drug Reaction (ADR) pharmacovigilance reporting form accessible', status: 'fully_compliant', attachment_ids: [] },
      { code: '3.3', label: 'Product recall and quarantine procedure documented and active', status: 'fully_compliant', attachment_ids: [] }
    ]
  },
  {
    section_code: '4.0',
    title: 'Medicine Price Compliance',
    items: [
      { code: '4.1', label: 'Every medication package bears legible barcode price label in BHD', status: 'fully_compliant', attachment_ids: [] },
      { code: '4.2', label: 'Retail prices strictly match official NHRA gazetted maximum price list', status: 'fully_compliant', attachment_ids: [] },
      { code: '4.3', label: 'Itemized receipts issued to all customers detailing medication names and prices', status: 'fully_compliant', attachment_ids: [] }
    ]
  },
  {
    section_code: '5.0',
    title: 'Records & Documentation',
    items: [
      { code: '5.1', label: 'Prescription archive maintained chronologically (minimum 2 years retention)', status: 'fully_compliant', attachment_ids: [] },
      { code: '5.2', label: 'Expired medication logbook and designated segregated quarantine box intact', status: 'fully_compliant', attachment_ids: [] },
      { code: '5.3', label: 'Approved pharmaceutical agent invoices and delivery notes archived', status: 'fully_compliant', attachment_ids: [] },
      { code: '5.4', label: 'Thermometer and hygrometer calibration certificates up-to-date', status: 'fully_compliant', attachment_ids: [] }
    ]
  },
  {
    section_code: '6.0',
    title: 'Storage & Cold Chain',
    items: [
      { code: '6.1', label: 'Dispensary ambient temperature recorded twice daily (controlled 15°C–25°C)', status: 'fully_compliant', attachment_ids: [] },
      { code: '6.2', label: 'Dedicated pharmaceutical refrigerator maintaining 2°C–8°C with digital logger', status: 'fully_compliant', attachment_ids: [] },
      { code: '6.3', label: 'Humidity maintained below 60% with continuous monitoring in dispensary', status: 'fully_compliant', attachment_ids: [] },
      { code: '6.4', label: 'Protection of photosensitive medications from direct sun exposure', status: 'fully_compliant', attachment_ids: [] }
    ]
  },
  {
    section_code: '7.0',
    title: 'Semi-Controlled Register',
    items: [
      { code: '7.1', label: 'Semi-controlled drugs register maintained with patient full name and CPR', status: 'fully_compliant', attachment_ids: [] },
      { code: '7.2', label: 'Prescribing physician license number and clinic stamp verified on each prescription', status: 'fully_compliant', attachment_ids: [] },
      { code: '7.3', label: 'Monthly physical count reconciled against electronic dispensing records', status: 'fully_compliant', attachment_ids: [] }
    ]
  },
  {
    section_code: '8.0',
    title: 'Controlled Register',
    items: [
      { code: '8.1', label: 'Controlled (Narcotic/Psychotropic) drugs stored in bolted, heavy-gauge steel safe', status: 'fully_compliant', attachment_ids: [] },
      { code: '8.2', label: 'Official NHRA Red Book register updated immediately upon dispensation', status: 'fully_compliant', attachment_ids: [] },
      { code: '8.3', label: 'Safe keys held exclusively by the designated Pharmacist-in-Charge', status: 'fully_compliant', attachment_ids: [] },
      { code: '8.4', label: 'Zero discrepancy between physical stock balance and Red Book entries', status: 'fully_compliant', attachment_ids: [] }
    ]
  }
];

import { MOCK_BRANCHES } from './mockBranches';
import { MOCK_USERS } from './mockUsers';

// Helper to clone standard template
export function getFreshChecklistTemplate(): NHRASection[] {
  return JSON.parse(JSON.stringify(STANDARD_NHRA_SECTIONS_TEMPLATE));
}

// ── Seeded CAPA Tasks ──────────────────────────────────────
const supervisors = MOCK_USERS.filter(u => u.role === 'supervisor');
const sup1 = supervisors[0]?.id || 'a8074b0d-669e-4d4e-8ff3-ab0219e35790';
const sup2 = supervisors[1]?.id || 'b455e337-3202-4835-8d81-508729195268';

export const MOCK_CAPA_TASKS: CAPA_Task[] = [
  {
    id: 'capa-001',
    audit_id: 'audit-2026-08-01',
    element_code: '6.2',
    violation: 'Refrigerator temperature recorded at 9.4°C exceeding 2-8°C threshold for biologicals',
    required_action: 'Calibrate refrigerator sensor, service cooling unit, and provide 7-day temperature log',
    severity: 'Major',
    due_date: '2026-08-20T10:00:00.000Z',
    status: 'resolved',
    assigned_to: MOCK_BRANCHES[1]?.manager_name || 'Dr. Noor Al-Mansoor',
    resolved_by: MOCK_BRANCHES[1]?.manager_name || 'Dr. Noor Al-Mansoor',
    resolved_at: '2026-08-21T14:30:00.000Z',
    resolution_proof_url: 'https://placehold.co/600x400/png?text=Refrigerator+Calibration+Report'
  },
  {
    id: 'capa-002',
    audit_id: 'audit-2026-09-08',
    element_code: '8.1',
    violation: 'Controlled drugs safe key was left in drawer rather than with Pharmacist-in-Charge',
    required_action: 'Enforce strict key-custody protocol and sign acknowledgment of controlled substances regulation',
    severity: 'Critical',
    due_date: '2026-09-08T12:00:00.000Z',
    status: 'open',
    assigned_to: MOCK_BRANCHES[7]?.manager_name || 'Dr. Reem Al-Bahrani'
  },
  {
    id: 'capa-003',
    audit_id: 'audit-2026-09-08',
    element_code: '4.1',
    violation: 'Four boxes of imported dietary supplements lacked official BHD price tags',
    required_action: 'Reprice and scan all shelf inventory against NHRA approved price database',
    severity: 'Minor',
    due_date: '2026-09-08T12:00:00.000Z',
    status: 'open',
    assigned_to: MOCK_BRANCHES[7]?.manager_name || 'Dr. Reem Al-Bahrani'
  },
  {
    id: 'capa-004',
    audit_id: 'audit-2026-09-03',
    element_code: '5.2',
    violation: 'Expired eye drops not isolated in designated red quarantine box',
    required_action: 'Immediate quarantine in locked container and complete return-to-vendor manifest',
    severity: 'Major',
    due_date: '2026-09-12T14:00:00.000Z',
    status: 'resolved',
    assigned_to: MOCK_BRANCHES[2]?.manager_name || 'Branch Manager',
    resolved_by: MOCK_BRANCHES[2]?.manager_name || 'Branch Manager',
    resolved_at: '2026-09-13T09:15:00.000Z',
    resolution_proof_url: 'https://placehold.co/600x400/png?text=Quarantine+Box+Photo'
  },
  {
    id: 'capa-005',
    audit_id: 'audit-2026-09-21',
    element_code: '6.2',
    violation: 'Backup biological refrigerator temperature alarm threshold not tested',
    required_action: 'Perform emergency generator simulation and document alarm trip point',
    severity: 'Critical',
    due_date: '2026-09-22T10:00:00.000Z',
    status: 'open',
    assigned_to: MOCK_BRANCHES[20]?.manager_name || 'Branch Manager'
  },
  {
    id: 'capa-006',
    audit_id: 'audit-2026-09-14',
    element_code: '5.1',
    violation: 'Prescription archives for Q2 2026 awaiting final indexing in storeroom',
    required_action: 'Complete chronological filing and submit archival certificate',
    severity: 'Minor',
    due_date: '2026-09-24T14:00:00.000Z',
    status: 'open',
    assigned_to: MOCK_BRANCHES[13]?.manager_name || 'Branch Manager'
  },
  {
    id: 'capa-007',
    audit_id: 'audit-2026-09-18',
    element_code: '4.2',
    violation: 'Minor discrepancy on shelf label for OTC antacid',
    required_action: 'Re-label shelf edge with official gazetted BHD price tag',
    severity: 'Minor',
    due_date: '2026-09-23T12:00:00.000Z',
    status: 'open',
    assigned_to: MOCK_BRANCHES[17]?.manager_name || 'Branch Manager'
  },
  {
    id: 'capa-008',
    audit_id: 'audit-2026-09-12',
    element_code: '2.2',
    violation: 'Minor tile crack near rear dispensary sink area',
    required_action: 'Repair flooring with non-porous antimicrobial sealant',
    severity: 'Minor',
    due_date: '2026-09-25T16:00:00.000Z',
    status: 'open',
    assigned_to: MOCK_BRANCHES[11]?.manager_name || 'Branch Manager'
  }
];

// Helper to generate a standardized audit
function createMockAudit(
  id: string,
  branchId: string,
  supervisorId: string,
  date: string,
  score: number,
  violations: string[] = []
): NHRA_Audit {
  return {
    id,
    branch_id: branchId,
    supervisor_id: supervisorId,
    date,
    status: 'locked_submitted',
    compliance_score: score,
    violations_list: violations,
    created_at: `${date}T09:00:00.000Z`,
    updated_at: `${date}T12:00:00.000Z`,
    locked_at: `${date}T12:00:00.000Z`,
    submitted_by: supervisorId,
    amended: false,
    sections: STANDARD_NHRA_SECTIONS_TEMPLATE.map(sec => ({
      ...sec,
      items: sec.items.map(it => ({ ...it, status: 'fully_compliant' }))
    }))
  };
}

// ── Realistic Audit Scores for all 21 Bahrain Branches ──
const AUDIT_SCORES = [
  99.2, 98.8, 98.4, 97.9, 97.5, 96.8, 96.2, 76.8, 95.1, 94.6, // Green (>=95) with idx 7 (branch-08) at 76.8
  93.8, 92.5, 91.9, 90.4, 88.7, 87.2, 85.6, 83.1, 81.4, 95.7, // Amber (80-94.9)
  78.4                                                         // Red (<80)
];

// ── Seeded Audits for all 21 Real Branches in September 2026 + August History ──
export const MOCK_AUDITS: NHRA_Audit[] = [
  ...MOCK_BRANCHES.map((b, idx) => {
    const score = AUDIT_SCORES[idx] ?? 95.0;
    const supervisorId = idx % 2 === 0 ? sup1 : sup2;
    const day = String((idx % 12) + 4).padStart(2, '0');
    const date = `2026-09-${day}`;
    const id = `audit-2026-09-${String(idx + 1).padStart(2, '0')}`;

    let violations: string[] = [];
    if (idx === 7) violations = ['capa-002', 'capa-003'];
    else if (idx === 20) violations = ['capa-005'];
    else if (idx === 11) violations = ['capa-008'];
    else if (idx === 13) violations = ['capa-006'];
    else if (idx === 17) violations = ['capa-007'];

    return createMockAudit(id, b.id, supervisorId, date, score, violations);
  }),

  // ── Previous Month (August 2026 Audits) ──────────────────────────────────
  createMockAudit('audit-2026-08-01', MOCK_BRANCHES[1]?.id || 'branch-11', sup2, '2026-08-18', 96.4, ['capa-001']),
  createMockAudit('audit-2026-08-02', MOCK_BRANCHES[0]?.id || 'branch-01', sup1, '2026-08-15', 97.5, []),
  createMockAudit('audit-2026-08-03', MOCK_BRANCHES[3]?.id || 'branch-04', sup1, '2026-08-16', 98.8, []),
  createMockAudit('audit-2026-08-04', MOCK_BRANCHES[5]?.id || 'branch-13', sup2, '2026-08-17', 96.2, [])
];
