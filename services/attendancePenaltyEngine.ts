/**
 * Attendance Penalty Engine — Configurable Tiered Escalation
 * ============================================================
 * Hardened Spec v1.0
 *
 * Key Design Decisions:
 *   - Grace period applied FIRST, lateness measured AFTER grace (§5.1)
 *   - TERMINATION_FLAG is INERT — only creates a flag, never auto-deactivates (§5.3)
 *   - BHD deduction formula: NOTE — HRMS formula port is a BLOCKING DEPENDENCY (§1)
 *     Current formula uses workingHoursPerDay/30 as placeholder until Ahmed confirms
 *     the exact GCC 26-day convention from the HRMS Laravel system.
 *   - Escalation tiers reset per resetPeriod (MONTHLY/QUARTERLY/YEARLY/NEVER)
 *   - Waivers do NOT count toward escalation occurrence tracking
 */

import {
  AttendancePenaltyRule,
  AttendancePenaltyLedger,
  AttendanceDailyRecord,
  PenaltyRuleType,
  PenaltyActionType,
  PenaltyEscalationTier,
  AttendanceModuleConfig,
} from '../types';
import { Employee, EmployeeSalaryMatrix } from './workforceService';

// ============================================================================
// LOCAL STORAGE
// ============================================================================

const PENALTY_RULES_KEY = 'tabarak_attendance_penalty_rules_v1';
const PENALTY_LEDGER_KEY = 'tabarak_attendance_penalty_ledger_v1';

const memoryStorage = new Map<string, string>();

function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.getItem === 'function') {
      return window.localStorage.getItem(key);
    }
  } catch { /* ignore */ }
  return memoryStorage.get(key) || null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.setItem === 'function') {
      window.localStorage.setItem(key, value);
    }
  } catch { /* ignore */ }
  memoryStorage.set(key, value);
}

// ============================================================================
// DEFAULT BAHRAIN LABOR LAW-ALIGNED PENALTY RULES
// ============================================================================

const makeRule = (
  id: string,
  ruleType: PenaltyRuleType,
  name: string,
  nameAr: string,
  triggerCondition: AttendancePenaltyRule['triggerCondition'],
  tiers: AttendancePenaltyRule['escalationTiers'],
  resetPeriod: AttendancePenaltyRule['resetPeriod'] = 'MONTHLY'
): AttendancePenaltyRule => ({
  id,
  ruleType,
  name,
  nameAr,
  triggerCondition,
  escalationTiers: tiers,
  isActive: true,
  appliesTo: ['Pharmacist', 'Driver', 'Worker', 'Management'],
  resetPeriod,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export const DEFAULT_PENALTY_RULES: AttendancePenaltyRule[] = [
  // Late 1-15 min (AFTER grace period — §5.1)
  makeRule('rule-late-1-15', 'LATE_ARRIVAL', 'Late Arrival (1-15 min)', 'تأخر (1-15 دقيقة)',
    { minLateMinutes: 1, maxLateMinutes: 15 },
    [
      { tier: 1, occurrenceRange: [1, 1], action: 'VERBAL_WARNING', description: 'Verbal warning', descriptionAr: 'إنذار شفهي' },
      { tier: 2, occurrenceRange: [2, 2], action: 'WRITTEN_WARNING', description: 'Written warning', descriptionAr: 'إنذار كتابي' },
      { tier: 3, occurrenceRange: [3, 3], action: 'SALARY_DEDUCTION_DAYS', deductionValue: 0.25, description: '¼ day salary deduction', descriptionAr: 'خصم ربع يوم' },
      { tier: 4, occurrenceRange: [4, 4], action: 'SALARY_DEDUCTION_DAYS', deductionValue: 0.5, description: '½ day salary deduction', descriptionAr: 'خصم نصف يوم' },
      { tier: 5, occurrenceRange: [5, 99], action: 'SALARY_DEDUCTION_DAYS', deductionValue: 1, description: '1 day salary deduction', descriptionAr: 'خصم يوم واحد' },
    ]
  ),

  // Late 16-30 min
  makeRule('rule-late-16-30', 'LATE_ARRIVAL', 'Late Arrival (16-30 min)', 'تأخر (16-30 دقيقة)',
    { minLateMinutes: 16, maxLateMinutes: 30 },
    [
      { tier: 1, occurrenceRange: [1, 1], action: 'WRITTEN_WARNING', description: 'Written warning', descriptionAr: 'إنذار كتابي' },
      { tier: 2, occurrenceRange: [2, 2], action: 'SALARY_DEDUCTION_DAYS', deductionValue: 0.5, description: '½ day salary deduction', descriptionAr: 'خصم نصف يوم' },
      { tier: 3, occurrenceRange: [3, 3], action: 'SALARY_DEDUCTION_DAYS', deductionValue: 1, description: '1 day salary deduction', descriptionAr: 'خصم يوم واحد' },
      { tier: 4, occurrenceRange: [4, 4], action: 'SALARY_DEDUCTION_DAYS', deductionValue: 2, description: '2 day salary deduction', descriptionAr: 'خصم يومين' },
      { tier: 5, occurrenceRange: [5, 99], action: 'SALARY_DEDUCTION_DAYS', deductionValue: 3, description: '3 day salary deduction', descriptionAr: 'خصم ثلاثة أيام' },
    ]
  ),

  // Late 31-60 min
  makeRule('rule-late-31-60', 'LATE_ARRIVAL', 'Late Arrival (31-60 min)', 'تأخر (31-60 دقيقة)',
    { minLateMinutes: 31, maxLateMinutes: 60 },
    [
      { tier: 1, occurrenceRange: [1, 1], action: 'SALARY_DEDUCTION_DAYS', deductionValue: 0.5, description: '½ day salary deduction', descriptionAr: 'خصم نصف يوم' },
      { tier: 2, occurrenceRange: [2, 2], action: 'SALARY_DEDUCTION_DAYS', deductionValue: 1, description: '1 day salary deduction', descriptionAr: 'خصم يوم واحد' },
      { tier: 3, occurrenceRange: [3, 3], action: 'SALARY_DEDUCTION_DAYS', deductionValue: 2, description: '2 day salary deduction', descriptionAr: 'خصم يومين' },
      { tier: 4, occurrenceRange: [4, 4], action: 'SALARY_DEDUCTION_DAYS', deductionValue: 3, description: '3 day salary deduction', descriptionAr: 'خصم ثلاثة أيام' },
      { tier: 5, occurrenceRange: [5, 99], action: 'TERMINATION_FLAG', description: 'Flagged for HR review (termination consideration)', descriptionAr: 'رُفع للموارد البشرية (إنهاء خدمة)' },
    ]
  ),

  // Absent without excuse
  makeRule('rule-absent-no-excuse', 'ABSENT_NO_EXCUSE', 'Absent (No Excuse)', 'غياب بدون عذر',
    {},
    [
      { tier: 1, occurrenceRange: [1, 1], action: 'SALARY_DEDUCTION_DAYS', deductionValue: 1, description: '1 day salary deduction', descriptionAr: 'خصم يوم واحد' },
      { tier: 2, occurrenceRange: [2, 2], action: 'SALARY_DEDUCTION_DAYS', deductionValue: 2, description: '2 day salary deduction', descriptionAr: 'خصم يومين' },
      { tier: 3, occurrenceRange: [3, 3], action: 'SUSPENSION_DAYS', deductionValue: 3, description: '3 day suspension', descriptionAr: 'إيقاف 3 أيام' },
      { tier: 4, occurrenceRange: [4, 99], action: 'TERMINATION_FLAG', description: 'Flagged for HR review (termination consideration)', descriptionAr: 'رُفع للموارد البشرية (إنهاء خدمة)' },
    ],
    'QUARTERLY'
  ),

  // Absent without prior notice
  makeRule('rule-absent-no-notice', 'ABSENT_NO_NOTICE', 'Absent (No Prior Notice)', 'غياب بدون إخطار مسبق',
    {},
    [
      { tier: 1, occurrenceRange: [1, 1], action: 'SALARY_DEDUCTION_DAYS', deductionValue: 2, description: '2 day salary deduction', descriptionAr: 'خصم يومين' },
      { tier: 2, occurrenceRange: [2, 2], action: 'SUSPENSION_DAYS', deductionValue: 3, description: '3 day suspension', descriptionAr: 'إيقاف 3 أيام' },
      { tier: 3, occurrenceRange: [3, 99], action: 'TERMINATION_FLAG', description: 'Flagged for HR review (termination consideration)', descriptionAr: 'رُفع للموارد البشرية (إنهاء خدمة)' },
    ],
    'QUARTERLY'
  ),

  // Missing Punch
  makeRule('rule-missing-punch', 'MISSING_PUNCH', 'Missing Clock-In/Out Punch', 'نسيان بصمة الحضور/الانصراف',
    {},
    [
      { tier: 1, occurrenceRange: [1, 2], action: 'SALARY_DEDUCTION_FIXED', deductionValue: 5, description: '5.000 BHD deduction', descriptionAr: 'خصم 5.000 د.ب' },
      { tier: 2, occurrenceRange: [3, 99], action: 'SALARY_DEDUCTION_FIXED', deductionValue: 10, description: '10.000 BHD deduction', descriptionAr: 'خصم 10.000 د.ب' },
    ]
  ),

  // Outside Geofence
  makeRule('rule-outside-geofence', 'OUTSIDE_GEOFENCE', 'Clock-In Outside Geofence', 'تسجيل حضور خارج النطاق الجغرافي',
    { geofenceRequired: true },
    [
      { tier: 1, occurrenceRange: [1, 1], action: 'VERBAL_WARNING', description: 'Verbal warning', descriptionAr: 'إنذار شفهي' },
      { tier: 2, occurrenceRange: [2, 2], action: 'WRITTEN_WARNING', description: 'Written warning', descriptionAr: 'إنذار كتابي' },
      { tier: 3, occurrenceRange: [3, 99], action: 'SALARY_DEDUCTION_DAYS', deductionValue: 0.5, description: '½ day salary deduction', descriptionAr: 'خصم نصف يوم' },
    ]
  ),
];

// ============================================================================
// PENALTY ENGINE
// ============================================================================

export const attendancePenaltyEngine = {

  // ------------------------------------------------------------------
  // Rule Management
  // ------------------------------------------------------------------

  getRules(): AttendancePenaltyRule[] {
    try {
      const raw = safeGetItem(PENALTY_RULES_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    // Seed defaults on first access
    this.saveRules(DEFAULT_PENALTY_RULES);
    return [...DEFAULT_PENALTY_RULES];
  },

  saveRules(rules: AttendancePenaltyRule[]): void {
    safeSetItem(PENALTY_RULES_KEY, JSON.stringify(rules));
  },

  upsertRule(rule: AttendancePenaltyRule): void {
    const rules = this.getRules();
    const idx = rules.findIndex(r => r.id === rule.id);
    rule.updatedAt = new Date().toISOString();
    if (idx >= 0) {
      rules[idx] = rule;
    } else {
      rules.push(rule);
    }
    this.saveRules(rules);
  },

  deleteRule(ruleId: string): void {
    const rules = this.getRules().filter(r => r.id !== ruleId);
    this.saveRules(rules);
  },

  // ------------------------------------------------------------------
  // Penalty Ledger
  // ------------------------------------------------------------------

  getAllPenalties(): AttendancePenaltyLedger[] {
    try {
      const raw = safeGetItem(PENALTY_LEDGER_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },

  savePenalties(penalties: AttendancePenaltyLedger[]): void {
    safeSetItem(PENALTY_LEDGER_KEY, JSON.stringify(penalties));
  },

  // ------------------------------------------------------------------
  // CORE: Evaluate & Apply Penalties (§5.1, §5.3)
  // ------------------------------------------------------------------

  /**
   * Evaluate all active penalty rules against a daily attendance record.
   * Creates penalty ledger entries as appropriate.
   *
   * §5.1: lateMinutes in the daily record is ALREADY measured after grace period subtraction.
   * §5.3: TERMINATION_FLAG only creates a flag — never auto-deactivates.
   *
   * @returns Array of newly created penalty ledger entries
   */
  evaluateAndApplyPenalties(
    dailyRecord: AttendanceDailyRecord,
    employee: Employee,
    config: AttendanceModuleConfig
  ): AttendancePenaltyLedger[] {
    const rules = this.getRules().filter(r => r.isActive);
    const allPenalties = this.getAllPenalties();
    const newPenalties: AttendancePenaltyLedger[] = [];

    for (const rule of rules) {
      // Check if rule applies to this employee category
      if (!rule.appliesTo.includes(employee.category)) continue;

      // Check trigger conditions
      if (!this._doesRuleTrigger(rule, dailyRecord)) continue;

      // Count prior occurrences (excluding waived — waivers don't count toward escalation)
      const occurrenceCount = this._countOccurrences(
        employee.id,
        rule.ruleType,
        rule.resetPeriod,
        dailyRecord.date,
        allPenalties
      );
      const nextOccurrence = occurrenceCount + 1;

      // Find the matching escalation tier
      const tier = this._findEscalationTier(rule, nextOccurrence);
      if (!tier) continue; // no tier matches this occurrence count

      // Calculate BHD deduction
      // §1 NOTE: This formula is a PLACEHOLDER. Must be validated against HRMS's
      // exact GCC 26-day convention once Ahmed confirms the formula.
      const deductionBhd = this._calculateDeductionBhd(
        tier.action,
        tier.deductionValue || 0,
        employee,
        config
      );

      const penalty: AttendancePenaltyLedger = {
        id: `pen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        employeeId: employee.id,
        employeeName: employee.full_name,
        employeeCode: employee.code,
        date: dailyRecord.date,
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: rule.ruleType,
        tier: tier.tier,
        action: tier.action,
        deductionValue: tier.deductionValue || 0,
        deductionUnit: this._getDeductionUnit(tier.action),
        calculatedDeductionBhd: deductionBhd,
        occurrenceNumber: nextOccurrence,
        isWaived: false,
        linkedAttendanceRecordId: dailyRecord.id,
        notes: tier.description,
        createdAt: new Date().toISOString(),
      };

      newPenalties.push(penalty);
    }

    // Persist all new penalties
    if (newPenalties.length > 0) {
      const updated = [...allPenalties, ...newPenalties];
      this.savePenalties(updated);

      // Update daily record with penalty IDs
      const { attendanceService } = require('./attendanceService');
      const records = attendanceService.getAllDailyRecords();
      const idx = records.findIndex((r: AttendanceDailyRecord) => r.id === dailyRecord.id);
      if (idx >= 0) {
        records[idx].penaltyIds = [
          ...records[idx].penaltyIds,
          ...newPenalties.map(p => p.id),
        ];
        attendanceService.saveDailyRecords(records);
      }
    }

    return newPenalties;
  },

  // ------------------------------------------------------------------
  // TRIGGER CONDITION CHECK
  // ------------------------------------------------------------------

  _doesRuleTrigger(rule: AttendancePenaltyRule, record: AttendanceDailyRecord): boolean {
    const cond = rule.triggerCondition;

    switch (rule.ruleType) {
      case 'LATE_ARRIVAL': {
        if (record.status !== 'LATE' || record.lateMinutes <= 0) return false;
        if (cond.minLateMinutes != null && record.lateMinutes < cond.minLateMinutes) return false;
        if (cond.maxLateMinutes != null && record.lateMinutes > cond.maxLateMinutes) return false;
        return true;
      }
      case 'EARLY_DEPARTURE': {
        if (record.status !== 'EARLY_LEAVE' || record.earlyLeaveMinutes <= 0) return false;
        if (cond.minEarlyLeaveMinutes != null && record.earlyLeaveMinutes < cond.minEarlyLeaveMinutes) return false;
        return true;
      }
      case 'ABSENT_NO_EXCUSE':
      case 'ABSENT_NO_NOTICE': {
        return record.status === 'ABSENT';
      }
      case 'MISSING_PUNCH': {
        // Missing punch = clock-in exists but no clock-out (or vice versa) by end of day
        return (!record.actualClockIn && record.scheduledShiftCode != null) ||
               (!!record.actualClockIn && !record.actualClockOut && record.status !== 'ON_LEAVE');
      }
      case 'OUTSIDE_GEOFENCE': {
        if (!cond.geofenceRequired) return false;
        return record.clockInGeofence === 'OUTSIDE';
      }
      default:
        return false;
    }
  },

  // ------------------------------------------------------------------
  // OCCURRENCE COUNTING (for escalation tier selection)
  // ------------------------------------------------------------------

  _countOccurrences(
    employeeId: string,
    ruleType: PenaltyRuleType,
    resetPeriod: AttendancePenaltyRule['resetPeriod'],
    currentDate: string,
    allPenalties: AttendancePenaltyLedger[]
  ): number {
    const periodStart = this._getResetPeriodStart(resetPeriod, currentDate);

    return allPenalties.filter(p =>
      p.employeeId === employeeId &&
      p.ruleType === ruleType &&
      !p.isWaived &&          // §: waived penalties don't count toward escalation
      p.date >= periodStart &&
      p.date <= currentDate
    ).length;
  },

  _getResetPeriodStart(resetPeriod: AttendancePenaltyRule['resetPeriod'], currentDate: string): string {
    const d = new Date(currentDate + 'T00:00:00');
    switch (resetPeriod) {
      case 'MONTHLY':
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      case 'QUARTERLY': {
        const quarter = Math.floor(d.getMonth() / 3);
        return `${d.getFullYear()}-${String(quarter * 3 + 1).padStart(2, '0')}-01`;
      }
      case 'YEARLY':
        return `${d.getFullYear()}-01-01`;
      case 'NEVER':
        return '2000-01-01'; // effectively never resets
      default:
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    }
  },

  // ------------------------------------------------------------------
  // ESCALATION TIER SELECTION
  // ------------------------------------------------------------------

  _findEscalationTier(
    rule: AttendancePenaltyRule,
    occurrenceNumber: number
  ): AttendancePenaltyRule['escalationTiers'][0] | null {
    for (const tier of rule.escalationTiers) {
      const [min, max] = tier.occurrenceRange;
      if (occurrenceNumber >= min && occurrenceNumber <= max) {
        return tier;
      }
    }
    // If occurrence exceeds all defined ranges, use the highest tier
    if (rule.escalationTiers.length > 0) {
      const lastTier = rule.escalationTiers[rule.escalationTiers.length - 1];
      if (occurrenceNumber > lastTier.occurrenceRange[1]) {
        return lastTier;
      }
    }
    return null;
  },

  // ------------------------------------------------------------------
  // BHD DEDUCTION CALCULATION
  // ------------------------------------------------------------------

  /**
   * Calculate the BHD monetary deduction for a penalty action.
   *
   * ⚠️ HRMS MIGRATION NOTE (§1):
   * This formula currently uses: dailyRate = basicSalary / 30
   * The HRMS (Laravel) system is known to use a "GCC 26-day month" convention
   * and may distinguish per-employee-category rules. The exact formula must be
   * ported from HRMS and validated against historical output before this module
   * is considered production-ready for payroll integration.
   *
   * TODO: Replace this placeholder with HRMS-validated formula after Ahmed
   * confirms the calculation logic from the Laravel codebase.
   */
  _calculateDeductionBhd(
    action: PenaltyActionType,
    deductionValue: number,
    employee: Employee,
    config: AttendanceModuleConfig
  ): number {
    const salary = employee.salary_matrix;
    const basicSalary = salary?.basicSalary || 0;

    // §1 PLACEHOLDER: Using /30 until HRMS formula is confirmed.
    // HRMS may use /26 (GCC convention) — will be updated post-confirmation.
    const dailyRate = basicSalary / 30;
    const hourlyRate = dailyRate / config.workingHoursPerDay;

    switch (action) {
      case 'VERBAL_WARNING':
      case 'WRITTEN_WARNING':
        return 0; // warnings have no monetary deduction

      case 'SALARY_DEDUCTION_HOURS':
        return Math.round(hourlyRate * deductionValue * 1000) / 1000;

      case 'SALARY_DEDUCTION_DAYS':
        return Math.round(dailyRate * deductionValue * 1000) / 1000;

      case 'SALARY_DEDUCTION_FIXED':
        return deductionValue; // fixed BHD amount

      case 'SUSPENSION_DAYS':
        return Math.round(dailyRate * deductionValue * 1000) / 1000;

      case 'TERMINATION_FLAG':
        // §5.3: TERMINATION_FLAG is INERT. It NEVER triggers any automatic account
        // deactivation, payroll stoppage, or system-initiated employment action.
        // It only creates a flagged record for HR review.
        return 0;

      default:
        return 0;
    }
  },

  _getDeductionUnit(action: PenaltyActionType): 'HOURS' | 'DAYS' | 'BHD' {
    switch (action) {
      case 'SALARY_DEDUCTION_HOURS': return 'HOURS';
      case 'SALARY_DEDUCTION_DAYS':
      case 'SUSPENSION_DAYS': return 'DAYS';
      case 'SALARY_DEDUCTION_FIXED': return 'BHD';
      default: return 'BHD';
    }
  },

  // ------------------------------------------------------------------
  // WAIVER (§5.3)
  // ------------------------------------------------------------------

  /**
   * Waive a penalty — marks it as waived with audit trail.
   * Waived penalties do NOT count toward escalation occurrence tracking.
   */
  waivePenalty(penaltyId: string, managerId: string, reason: string): boolean {
    const penalties = this.getAllPenalties();
    const idx = penalties.findIndex(p => p.id === penaltyId);
    if (idx < 0) return false;

    penalties[idx].isWaived = true;
    penalties[idx].waivedBy = managerId;
    penalties[idx].waivedReason = reason;
    penalties[idx].waivedAt = new Date().toISOString();
    this.savePenalties(penalties);
    return true;
  },

  // ------------------------------------------------------------------
  // QUERY HELPERS
  // ------------------------------------------------------------------

  /** Get penalties for a specific employee in a month */
  getEmployeeMonthlyPenalties(employeeId: string, month: string): AttendancePenaltyLedger[] {
    return this.getAllPenalties().filter(
      p => p.employeeId === employeeId && p.date.startsWith(month)
    );
  },

  /** Get total BHD deductions for a specific employee in a month (excluding waived) */
  getEmployeeMonthlyDeductionBhd(employeeId: string, month: string): number {
    const penalties = this.getEmployeeMonthlyPenalties(employeeId, month);
    return penalties
      .filter(p => !p.isWaived)
      .reduce((sum, p) => sum + p.calculatedDeductionBhd, 0);
  },

  /** Get violation history for escalation tracking */
  getViolationHistory(
    employeeId: string,
    ruleType: PenaltyRuleType,
    resetPeriod: AttendancePenaltyRule['resetPeriod'],
    asOfDate: string
  ): { count: number; penalties: AttendancePenaltyLedger[] } {
    const periodStart = this._getResetPeriodStart(resetPeriod, asOfDate);
    const penalties = this.getAllPenalties().filter(p =>
      p.employeeId === employeeId &&
      p.ruleType === ruleType &&
      !p.isWaived &&
      p.date >= periodStart &&
      p.date <= asOfDate
    );
    return { count: penalties.length, penalties };
  },

  // ------------------------------------------------------------------
  // WHAT-IF SIMULATION (for Config Panel — §6)
  // ------------------------------------------------------------------

  /**
   * Simulate what penalty would be applied for a hypothetical scenario.
   * Does NOT persist anything — purely for preview in the admin config panel.
   */
  simulatePenalty(
    employee: Employee,
    ruleType: PenaltyRuleType,
    lateMinutes: number,
    config: AttendanceModuleConfig,
    existingOccurrences: number = 0
  ): {
    matchingRule: AttendancePenaltyRule | null;
    matchingTier: AttendancePenaltyRule['escalationTiers'][0] | null;
    calculatedBhd: number;
    occurrenceNumber: number;
  } {
    const rules = this.getRules().filter(
      r => r.isActive && r.ruleType === ruleType && r.appliesTo.includes(employee.category)
    );

    // For LATE_ARRIVAL, find the rule matching the late minutes range
    let matchingRule: AttendancePenaltyRule | null = null;
    if (ruleType === 'LATE_ARRIVAL') {
      matchingRule = rules.find(r => {
        const min = r.triggerCondition.minLateMinutes ?? 0;
        const max = r.triggerCondition.maxLateMinutes ?? Infinity;
        return lateMinutes >= min && lateMinutes <= max;
      }) || null;
    } else {
      matchingRule = rules[0] || null;
    }

    if (!matchingRule) {
      return { matchingRule: null, matchingTier: null, calculatedBhd: 0, occurrenceNumber: existingOccurrences + 1 };
    }

    const nextOccurrence = existingOccurrences + 1;
    const matchingTier = this._findEscalationTier(matchingRule, nextOccurrence);
    const calculatedBhd = matchingTier
      ? this._calculateDeductionBhd(matchingTier.action, matchingTier.deductionValue || 0, employee, config)
      : 0;

    return {
      matchingRule,
      matchingTier,
      calculatedBhd,
      occurrenceNumber: nextOccurrence,
    };
  },

  getAllRules(): AttendancePenaltyRule[] {
    return this.getRules();
  },

  getAllLedger(): AttendancePenaltyLedger[] {
    return this.getAllPenalties();
  },

  saveRule(rule: Partial<AttendancePenaltyRule> & { id: string }): void {
    const rules = this.getRules();
    const idx = rules.findIndex(r => r.id === rule.id);
    if (idx >= 0) {
      rules[idx] = { ...rules[idx], ...rule, updatedAt: new Date().toISOString() };
      this.saveRules(rules);
    }
  },

  resetToDefaults(): void {
    this.saveRules(DEFAULT_PENALTY_RULES);
  }
};
