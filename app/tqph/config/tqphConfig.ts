import { CAPASeverity, LetterGrade } from '../types';

/**
 * Tabarak Quality & Performance Hub (TQPH)
 * Centralized Configuration & Section 8 Assumptions Requiring Sign-Off.
 *
 * All business rule defaults are gathered here as configurable values,
 * allowing humans to override parameters in one place without touching component logic.
 */

// ── 1. NHRA Compliance Scoring Configuration (Section 5.1 & Section 8, #1) ──

export interface NHRAScoringConfig {
  /**
   * If true, every applicable checklist item contributes equally.
   * If false, calculations use sectionWeights.
   */
  equalWeighting: boolean;

  /**
   * Optional section-specific weights, applied when equalWeighting is false.
   * e.g., { '1.0': 1.5, '7.0': 2.0, '8.0': 2.0, '2.0': 0.8 }
   */
  sectionWeights: Record<string, number>;

  /**
   * Value assigned to each status:
   * - fully_compliant: 1.0 (100%)
   * - partially_compliant: 0.5 (50%)
   * - non_compliant: 0.0 (0%)
   */
  statusScoreValues: {
    fully_compliant: number;
    partially_compliant: number;
    non_compliant: number;
  };
}

export const DEFAULT_NHRA_SCORING_CONFIG: NHRAScoringConfig = {
  equalWeighting: true,
  sectionWeights: {},
  statusScoreValues: {
    fully_compliant: 1.0,
    partially_compliant: 0.5,
    non_compliant: 0.0
  }
};

// ── 2. Pharmacist Appraisal Scoring Configuration (Section 5.2) ──────────

export interface AppraisalScoringConfig {
  passThreshold: number; // 95 points
  maxScore: number; // 150 points
  totalCriteriaCount: number; // 30 criteria across 6 sections
  gradePointsMap: Record<LetterGrade, number>;
}

export const DEFAULT_APPRAISAL_SCORING_CONFIG: AppraisalScoringConfig = {
  passThreshold: 95,
  maxScore: 150,
  totalCriteriaCount: 30,
  gradePointsMap: {
    'A*': 5,
    'A': 4,
    'B': 3,
    'C': 2,
    'F': 1
  }
};

// ── 3. Status Color Bands (Section 5.3 & Section 8, #6) ──────────────────

export interface ColorBandConfig {
  greenMin: number; // >= 95%
  amberMin: number; // 80% to 94.9%
  colors: {
    green: {
      hex: string;
      label: string;
      textColor: string;
      bgColor: string;
      borderColor: string;
    };
    amber: {
      hex: string;
      label: string;
      textColor: string;
      bgColor: string;
      borderColor: string;
    };
    red: {
      hex: string;
      label: string;
      textColor: string;
      bgColor: string;
      borderColor: string;
    };
  };
}

export const DEFAULT_COLOR_BAND_CONFIG: ColorBandConfig = {
  greenMin: 95,
  amberMin: 80,
  colors: {
    green: {
      hex: '#10B981',
      label: 'Compliant / Pass',
      textColor: 'text-emerald-700',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200'
    },
    amber: {
      hex: '#F59E0B',
      label: 'Partial / Warning',
      textColor: 'text-amber-700',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200'
    },
    red: {
      hex: '#EF4444',
      label: 'Non-Compliant / Fail',
      textColor: 'text-red-700',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    }
  }
};

// ── 4. CAPA Auto-Generation Configuration (Section 5.4 & Section 8, #2, #3, #4) ─

export interface CapaAutoConfig {
  autoGenerateOnNonCompliant: boolean;
  autoGenerateOnPartialRequiresAction: boolean;
  defaultDueHours: number; // 48 hours
  sectionSeverityMap: Record<string, CAPASeverity>;
}

export const DEFAULT_CAPA_AUTO_CONFIG: CapaAutoConfig = {
  autoGenerateOnNonCompliant: true,
  autoGenerateOnPartialRequiresAction: true,
  defaultDueHours: 48,
  sectionSeverityMap: {
    '1.0': 'Critical', // License & Approvals
    '2.0': 'Minor',    // Workplace Standards
    '3.0': 'Minor',    // Policies & Procedures
    '4.0': 'Minor',    // Medicine Price Compliance
    '5.0': 'Major',    // Records & Documentation
    '6.0': 'Major',    // Storage
    '7.0': 'Critical', // Semi-Controlled Register
    '8.0': 'Critical'  // Controlled Register
  }
};

// ── 5. Post-Lock Immutability & Addendum Configuration (Section 5.5 & Section 8, #5) ──

export interface ImmutabilityConfig {
  lockedRecordImmutable: boolean;
  allowAdminAddendum: boolean;
  requireAdminApprovalForAddendum: boolean;
}

export const DEFAULT_IMMUTABILITY_CONFIG: ImmutabilityConfig = {
  lockedRecordImmutable: true,
  allowAdminAddendum: true,
  requireAdminApprovalForAddendum: true
};

// ── 6. Monthly Target Completion (Section 4 & 7.3.4) ──────────────────────

export const SUPERVISOR_MONTHLY_VISIT_TARGET = 12;
