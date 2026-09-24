/**
 * Tabarak Quality & Performance Hub (TQPH)
 * Core TypeScript Interfaces (Section 6 & 7.2 of TQPH_Implementation_Spec.md)
 */

// ── Core Entities ─────────────────────────────────────────

export type UserRole = 'admin' | 'supervisor' | 'pharmacist' | 'branch_manager';

export interface Area {
  id: string;
  name: string; // Governorate / Area name
  supervisor_id?: string;
  code?: string;
}

export interface Branch {
  id: string;
  name: string;
  area_id: string;
  license_no: string;
  manager_name: string;
  code?: string;
  cr_number?: string;
}

export interface User {
  id: string;
  name: string;
  cpr: string; // Bahrain national ID — sensitive PII, see Section 9
  role: UserRole;
  branch_id?: string; // present for pharmacist / branch_manager
}

// ── Attachments ───────────────────────────────────────────

export type AttachmentOwnerType = 'nhra_audit_item' | 'capa_task';

export interface Attachment {
  id: string;
  owner_type: AttachmentOwnerType;
  owner_id: string;
  url: string;
  file_type: 'image/jpeg' | 'image/png' | 'application/pdf';
  uploaded_by: string; // user id
  uploaded_at: string; // ISO timestamp
}

// ── NHRA Audit ────────────────────────────────────────────

export type ComplianceStatus = 'fully_compliant' | 'partially_compliant' | 'non_compliant' | 'not_applicable';
export type AuditStatus = 'draft' | 'locked_submitted';

export interface NHRAChecklistItem {
  code: string; // e.g. "1.1", "5.4"
  label: string;
  status: ComplianceStatus;
  notes?: string;
  requires_corrective_action?: boolean; // manual flag for partially-compliant items
  attachment_ids: string[];
}

export interface NHRASection {
  section_code: string; // "1.0" through "8.0"
  title: string;
  items: NHRAChecklistItem[];
}

export interface NHRA_Audit {
  id: string;
  branch_id: string;
  supervisor_id: string;
  date: string; // ISO date
  status: AuditStatus;
  sections: NHRASection[]; // 1.0 License & Approvals, 2.0 Workplace Standards,
                            // 3.0 Policies & Procedures, 4.0 Medicine Price Compliance,
                            // 5.0 Records & Documentation, 6.0 Storage,
                            // 7.0 Semi-Controlled Register, 8.0 Controlled Register
  compliance_score: number; // 0–100, see Section 5.1
  violations_list: string[]; // CAPA_Task ids
  created_at: string;
  updated_at: string;
  locked_at?: string;
  submitted_by?: string; // user id
  amended: boolean;
}

// ── Pharmacist Appraisal ──────────────────────────────────

export type LetterGrade = 'A*' | 'A' | 'B' | 'C' | 'F';

export interface AppraisalCriterion {
  code: string; // e.g. "I.3", "IV.7"
  label: string;
  grade: LetterGrade;
  points: number; // 1–5, derived from grade
}

export interface AppraisalSection {
  section_id: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';
  title: string; // "Job Knowledge & Operational Skills", etc.
  criteria: AppraisalCriterion[];
}

export interface Pharmacist_Appraisal {
  id: string;
  pharmacist_id: string;
  branch_id: string;
  supervisor_id: string;
  month: number; // 1–12
  year: number;
  sections: AppraisalSection[]; // I–VI, 7+4+5+7+3+4 = 30 criteria
  total_credit_score: number; // max 150
  passed: boolean; // total_credit_score >= 95
  comments_and_improvement: string;
  status: AuditStatus;
  created_at: string;
  updated_at: string;
  locked_at?: string;
  submitted_by?: string;
  amended: boolean;
}

// ── CAPA ──────────────────────────────────────────────────

export type CAPASeverity = 'Critical' | 'Major' | 'Minor';
export type CAPAStatus = 'open' | 'resolved';

export interface CAPA_Task {
  id: string;
  audit_id: string;
  element_code: string; // links back to NHRAChecklistItem.code
  violation: string;
  required_action: string;
  severity: CAPASeverity;
  due_date: string; // ISO date, defaults to locked_at + 48h
  status: CAPAStatus;
  assigned_to: string; // branch_manager user id
  resolution_proof_url?: string;
  resolved_by?: string;
  resolved_at?: string;
}

// ── Distribution / Audit Trail ────────────────────────────

export type DistributionRecipient = 'branch_portal' | 'pharmacist_portal' | 'executive_admin';
export type DistributionStatus = 'pending' | 'sent' | 'failed';

export interface DistributionLog {
  id: string;
  source_type: 'nhra_audit' | 'appraisal';
  source_id: string;
  recipient_type: DistributionRecipient;
  recipient_id: string;
  channel: 'in_app' | 'email';
  status: DistributionStatus;
  sent_at?: string;
  error_message?: string;
}

// ── Addendum (post-lock correction path, Section 5.5) ─────

export interface Addendum {
  id: string;
  source_type: 'nhra_audit' | 'appraisal';
  source_id: string;
  reason: string;
  changes: Record<string, unknown>;
  approved_by?: string; // admin user id
  approved_at?: string;
  created_by: string;
  created_at: string;
}

// ── UI & Component Props (Section 7.2) ─────────────────────

export interface DropdownSearchProps<T> {
  items: T[];
  getLabel: (item: T) => string;
  getValue: (item: T) => string;
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  groupBy?: (item: T) => string; // e.g. group branches by area
  disabled?: boolean;
  clearable?: boolean;
  emptyStateLabel?: string; // "No branches found"
  className?: string;
  id?: string;
}

// ── Scoring & Visual Indicator Types ──────────────────────

export type StatusColorBandType = 'Green' | 'Amber' | 'Red';

export interface StatusColorBand {
  band: StatusColorBandType;
  color: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  label: string;
}
