import {
  AppraisalSection,
  LetterGrade,
  NHRASection,
  StatusColorBand
} from '../types';
import {
  AppraisalScoringConfig,
  ColorBandConfig,
  DEFAULT_APPRAISAL_SCORING_CONFIG,
  DEFAULT_COLOR_BAND_CONFIG,
  DEFAULT_NHRA_SCORING_CONFIG,
  NHRAScoringConfig
} from '../config/tqphConfig';

/**
 * Tabarak Quality & Performance Hub (TQPH)
 * Scoring & Business Logic Service (Section 5)
 * Pure, isolated, unit-testable calculation functions.
 */

// ── 1. NHRA Compliance Scoring (Section 5.1) ─────────────────────────────

export interface ComplianceScoreResult {
  score: number; // 0 to 100, rounded to 1 decimal place
  totalItems: number;
  applicableItems: number;
  fullyCompliantCount: number;
  partiallyCompliantCount: number;
  nonCompliantCount: number;
  notApplicableCount: number;
  sectionBreakdown: Record<string, {
    sectionCode: string;
    title: string;
    score: number;
    totalItems: number;
    applicableItems: number;
  }>;
}

/**
 * Calculate NHRA compliance score based on Section 5.1.
 * Fully Compliant = 100% (1.0)
 * Partially Compliant = 50% (0.5)
 * Non-Compliant = 0% (0.0)
 * N/A = excluded from denominator
 *
 * compliance_score = (Σ item_score / count_of_applicable_items) × 100
 */
export function calculateComplianceScore(
  sections: NHRASection[],
  config: NHRAScoringConfig = DEFAULT_NHRA_SCORING_CONFIG
): ComplianceScoreResult {
  let totalItems = 0;
  let applicableItems = 0;
  let fullyCompliantCount = 0;
  let partiallyCompliantCount = 0;
  let nonCompliantCount = 0;
  let notApplicableCount = 0;

  let weightedSum = 0;
  let totalApplicableWeight = 0;

  const sectionBreakdown: ComplianceScoreResult['sectionBreakdown'] = {};

  for (const section of sections) {
    const secWeight = config.equalWeighting
      ? 1
      : (config.sectionWeights[section.section_code] ?? 1);

    let secTotal = 0;
    let secApplicable = 0;
    let secScoreSum = 0;

    for (const item of section.items) {
      totalItems++;
      secTotal++;

      if (item.status === 'not_applicable') {
        notApplicableCount++;
        continue;
      }

      applicableItems++;
      secApplicable++;

      let itemValue = 0;
      if (item.status === 'fully_compliant') {
        itemValue = config.statusScoreValues.fully_compliant;
        fullyCompliantCount++;
      } else if (item.status === 'partially_compliant') {
        itemValue = config.statusScoreValues.partially_compliant;
        partiallyCompliantCount++;
      } else if (item.status === 'non_compliant') {
        itemValue = config.statusScoreValues.non_compliant;
        nonCompliantCount++;
      }

      secScoreSum += itemValue;
      weightedSum += itemValue * secWeight;
      totalApplicableWeight += secWeight;
    }

    const secScore = secApplicable > 0
      ? Math.round((secScoreSum / secApplicable) * 1000) / 10
      : 100;

    sectionBreakdown[section.section_code] = {
      sectionCode: section.section_code,
      title: section.title,
      score: secScore,
      totalItems: secTotal,
      applicableItems: secApplicable
    };
  }

  // Edge case: if no applicable items exist, default to 100%
  const finalScore = totalApplicableWeight > 0
    ? Math.round((weightedSum / totalApplicableWeight) * 1000) / 10
    : 100;

  return {
    score: finalScore,
    totalItems,
    applicableItems,
    fullyCompliantCount,
    partiallyCompliantCount,
    nonCompliantCount,
    notApplicableCount,
    sectionBreakdown
  };
}

// ── 2. Pharmacist Appraisal Scoring (Section 5.2) ─────────────────────────

export interface AppraisalScoreResult {
  totalCreditScore: number; // 0 to maxScore (default 150)
  maxPossibleScore: number; // 150
  passed: boolean; // totalCreditScore >= 95
  percentage: number; // (totalCreditScore / maxPossibleScore) * 100
  criteriaCount: number; // expected 30
  sectionScores: Record<string, {
    sectionId: string;
    title: string;
    points: number;
    maxPoints: number;
    criteriaCount: number;
  }>;
}

/**
 * Returns numeric points (1-5) for a given LetterGrade (Section 5.2):
 * A* = 5, A = 4, B = 3, C = 2, F = 1
 */
export function getGradePoints(
  grade: LetterGrade,
  config: AppraisalScoringConfig = DEFAULT_APPRAISAL_SCORING_CONFIG
): number {
  return config.gradePointsMap[grade] ?? 1;
}

/**
 * Calculate Pharmacist Appraisal score based on Section 5.2.
 * 30 criteria across 6 sections (7+4+5+7+3+4), each rated 1–5.
 * total_credit_score = Σ (criterion rating), max 150.
 * passed = total_credit_score >= 95.
 */
export function calculateAppraisalScore(
  sections: AppraisalSection[],
  config: AppraisalScoringConfig = DEFAULT_APPRAISAL_SCORING_CONFIG
): AppraisalScoreResult {
  let totalCreditScore = 0;
  let criteriaCount = 0;
  const sectionScores: AppraisalScoreResult['sectionScores'] = {};

  for (const section of sections) {
    let secPoints = 0;
    const secCriteriaCount = section.criteria.length;

    for (const criterion of section.criteria) {
      criteriaCount++;
      const pts = getGradePoints(criterion.grade, config);
      secPoints += pts;
    }

    totalCreditScore += secPoints;

    sectionScores[section.section_id] = {
      sectionId: section.section_id,
      title: section.title,
      points: secPoints,
      maxPoints: secCriteriaCount * 5,
      criteriaCount: secCriteriaCount
    };
  }

  const passed = totalCreditScore >= config.passThreshold;
  const percentage = config.maxScore > 0
    ? Math.round((totalCreditScore / config.maxScore) * 1000) / 10
    : 0;

  return {
    totalCreditScore,
    maxPossibleScore: config.maxScore,
    passed,
    percentage,
    criteriaCount,
    sectionScores
  };
}

// ── 3. Status Color Band Classification (Section 5.3 & Section 8, #6) ────

/**
 * Map a percentage score (0-100) to its Section 5.3 status color band:
 * Green: >= 95%
 * Amber: 80% to 94.9%
 * Red: < 80%
 */
export function getComplianceColorBand(
  score: number,
  config: ColorBandConfig = DEFAULT_COLOR_BAND_CONFIG
): StatusColorBand {
  if (score >= config.greenMin) {
    return {
      band: 'Green',
      color: config.colors.green.hex,
      textColor: config.colors.green.textColor,
      bgColor: config.colors.green.bgColor,
      borderColor: config.colors.green.borderColor,
      label: config.colors.green.label
    };
  }

  if (score >= config.amberMin) {
    return {
      band: 'Amber',
      color: config.colors.amber.hex,
      textColor: config.colors.amber.textColor,
      bgColor: config.colors.amber.bgColor,
      borderColor: config.colors.amber.borderColor,
      label: config.colors.amber.label
    };
  }

  return {
    band: 'Red',
    color: config.colors.red.hex,
    textColor: config.colors.red.textColor,
    bgColor: config.colors.red.bgColor,
    borderColor: config.colors.red.borderColor,
    label: config.colors.red.label
  };
}
