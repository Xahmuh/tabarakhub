import { supabaseClient } from '../lib/supabaseClient';
import {
  OperationalRenewalRecord,
  OperationalRenewalInput,
  OperationalRenewalHistory,
  OperationalRenewalAttachment,
  OperationalRenewalActivity,
  OperationalRenewalSettings,
  OperationalRenewalFilters,
  OperationalRenewalKpis,
  OperationalRenewalType,
  AlertSeverity,
  RenewalWorkflowStatus,
  RenewalCostCenter,
  RenewalCostCenterType,
  RenewalBudgetSummary,
  RenewalMonthlyBudget,
  RenewalCostCenterBudget,
  RenewalTariffRule,
  TariffLookupResult,
  WPDurationMonths
} from '../types';
import { crService } from './crService';
import { workforceService, Employee } from './workforceService';
import { branchService } from './branchService';
import { expenseService } from './expenseService';

// Local storage keys for dual-layer offline fallback resilience
export const LOCAL_STORAGE_RENEWALS_KEY = 'tabarak_operational_renewals_v1';
export const LOCAL_STORAGE_HISTORY_KEY = 'tabarak_operational_renewal_history_v1';
export const LOCAL_STORAGE_ATTACHMENTS_KEY = 'tabarak_operational_renewal_attachments_v1';
export const LOCAL_STORAGE_ACTIVITIES_KEY = 'tabarak_operational_renewal_activities_v1';
export const LOCAL_STORAGE_SETTINGS_KEY = 'tabarak_operational_renewal_settings_v1';
export const LOCAL_STORAGE_TARIFFS_KEY = 'tabarak_operational_renewal_tariffs_v2';
export const RENEWALS_UPDATED_EVENT = 'tabarak_operational_renewals_updated';

// Default standard renewal tariffs in BHD (Bahrain Dinar)
export const DEFAULT_RENEWAL_TARIFFS: Record<OperationalRenewalType, number> = {
  CR: 50.000,                  // Commercial Registration annual renewal
  CHAMBER_OF_COMMERCE: 25.000, // Chamber of Commerce (BCCI)
  NHRA: 300.000,               // NHRA legacy fallback (average)
  NHRA_PHARMACY: 500.000,      // NHRA Pharmacy 3-year facility license
  NHRA_PHARMACIST: 100.000,    // NHRA Pharmacist professional license
  WORK_PERMIT: 0.000,          // User specifies duration tier or custom fee
  FLEET_VEHICLE: 75.000,       // Traffic registration, compulsory insurance & inspection
  OTHER: 30.000
};

// Configurable Master Tariff Rules Seeds (with per-entity / duration overrides)
export const DEFAULT_TARIFF_RULES: RenewalTariffRule[] = [
  // Commercial Registration (CR)
  {
    id: 'tariff-cr-default',
    renewalType: 'CR',
    label: 'Commercial Registration (Standard)',
    baseCostBHD: 50.000,
    isDefault: true,
    isActive: true,
    notes: 'Standard annual MOIC Commercial Registration renewal fee'
  },
  // Commercial Registration (CR) - Damistan (D002) Override (Special Activities)
  {
    id: 'tariff-cr-damistan-d002',
    renewalType: 'CR',
    label: 'CR Renewal – Damistan Pharmacy (D002 Custom)',
    baseCostBHD: 250.000,
    entityPattern: 'Damistan',
    branchCode: 'D002',
    isDefault: false,
    isActive: true,
    notes: 'Special multi-activity & pharmacy license CR renewal fee for Damistan (D002)'
  },
  // Chamber of Commerce (BCCI)
  {
    id: 'tariff-coc-default',
    renewalType: 'CHAMBER_OF_COMMERCE',
    label: 'Chamber of Commerce (BCCI)',
    baseCostBHD: 25.000,
    isDefault: true,
    isActive: true,
    notes: 'Annual BCCI Chamber of Commerce membership fee'
  },
  // Work Permits (LMRA) - 6 Months
  {
    id: 'tariff-wp-6m',
    renewalType: 'WORK_PERMIT',
    durationMonths: 6,
    label: 'Work Permit – 6 Months (LMRA)',
    baseCostBHD: 102.500,
    isDefault: false,
    isActive: true,
    notes: '6-Month LMRA expat work permit and healthcare fee (102.500 BD)'
  },
  // Work Permits (LMRA) - 12 Months
  {
    id: 'tariff-wp-12m',
    renewalType: 'WORK_PERMIT',
    durationMonths: 12,
    label: 'Work Permit – 12 Months (1 Year)',
    baseCostBHD: 205.000,
    isDefault: false,
    isActive: true,
    notes: 'Standard 1-year LMRA expat work permit and healthcare fee (205.000 BD)'
  },
  // Work Permits (LMRA) - 24 Months
  {
    id: 'tariff-wp-24m',
    renewalType: 'WORK_PERMIT',
    durationMonths: 24,
    label: 'Work Permit – 24 Months (2 Years)',
    baseCostBHD: 395.000,
    isDefault: false,
    isActive: true,
    notes: 'Standard 2-year LMRA expat work permit and healthcare fee (395.000 BD)'
  },
  // NHRA Pharmacy Facility License
  {
    id: 'tariff-nhra-pharm-default',
    renewalType: 'NHRA_PHARMACY',
    label: 'NHRA Pharmacy Facility License (Standard)',
    baseCostBHD: 500.000,
    isDefault: true,
    isActive: true,
    notes: 'Standard 3-year NHRA pharmacy facility operating license'
  },
  // NHRA Pharmacist Professional License
  {
    id: 'tariff-nhra-phst-default',
    renewalType: 'NHRA_PHARMACIST',
    label: 'NHRA Pharmacist License (Professional Practice)',
    baseCostBHD: 100.000,
    isDefault: true,
    isActive: true,
    notes: 'Pharmacist professional practice license renewal'
  },
  // Fleet Vehicles
  {
    id: 'tariff-fleet-default',
    renewalType: 'FLEET_VEHICLE',
    label: 'Vehicle Registration & Insurance',
    baseCostBHD: 75.000,
    isDefault: true,
    isActive: true,
    notes: 'Traffic Directorate annual registration, inspection, and insurance'
  },
  // Other Operational Documents
  {
    id: 'tariff-other-default',
    renewalType: 'OTHER',
    label: 'Other Operational Licenses',
    baseCostBHD: 30.000,
    isDefault: true,
    isActive: true,
    notes: 'Municipal, civil defense, advertising and signboard renewals'
  }
];

export const DEFAULT_SETTINGS: OperationalRenewalSettings = {
  id: 'global',
  criticalDays: 7,
  urgentDays: 30,
  warningDays: 60,
  upcomingDays: 90,
  reminderIntervals: [90, 60, 30, 14, 7, 1],
  enabledTypes: ['CR', 'CHAMBER_OF_COMMERCE', 'NHRA_PHARMACY', 'NHRA_PHARMACIST', 'WORK_PERMIT', 'FLEET_VEHICLE', 'OTHER']
};

/**
 * Get current date in Bahrain local time (YYYY-MM-DD)
 */
export const getBahrainTodayStr = (): string => {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bahrain' });
  } catch {
    return new Date().toISOString().split('T')[0];
  }
};

/**
 * Calculate days remaining dynamically from expiryDate and today's date in Bahrain.
 * Negative value indicates expired.
 */
export const calculateDaysRemaining = (expiryDateStr?: string | null, todayStr?: string): number => {
  if (!expiryDateStr) return 999;
  const today = todayStr || getBahrainTodayStr();

  const [expY, expM, expD] = expiryDateStr.split('T')[0].split('-').map(Number);
  const [todY, todM, todD] = today.split('-').map(Number);

  if (isNaN(expY) || isNaN(expM) || isNaN(expD)) return 999;

  const expUtc = Date.UTC(expY, expM - 1, expD);
  const todUtc = Date.UTC(todY, todM - 1, todD);

  const diffMs = expUtc - todUtc;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
};

/**
 * Determine severity level dynamically from days remaining based on configured thresholds.
 */
export const calculateSeverity = (
  daysRemaining: number,
  settings: OperationalRenewalSettings = DEFAULT_SETTINGS
): AlertSeverity => {
  if (daysRemaining < 0) return 'EXPIRED';
  if (daysRemaining <= settings.criticalDays) return 'CRITICAL';
  if (daysRemaining <= settings.urgentDays) return 'URGENT';
  if (daysRemaining <= settings.warningDays) return 'WARNING';
  if (daysRemaining <= settings.upcomingDays) return 'UPCOMING';
  return 'NORMAL';
};

/**
 * Severity sorting rank (lower number = higher urgency)
 */
export const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  EXPIRED: 1,
  CRITICAL: 2,
  URGENT: 3,
  WARNING: 4,
  UPCOMING: 5,
  NORMAL: 6
};

/**
 * Sort renewal records by urgency:
 * 1. Expired
 * 2. Critical
 * 3. Urgent
 * 4. Warning
 * 5. Upcoming
 * 6. Normal
 * Within same severity, nearest expiry date first.
 */
export const sortRenewalsByUrgency = (records: OperationalRenewalRecord[]): OperationalRenewalRecord[] => {
  return [...records].sort((a, b) => {
    const rankA = SEVERITY_ORDER[a.severity] || 99;
    const rankB = SEVERITY_ORDER[b.severity] || 99;
    if (rankA !== rankB) return rankA - rankB;
    return a.daysRemaining - b.daysRemaining;
  });
};

/**
 * Resolves the operational display name for any renewal record.
 * If the record represents a branch or is linked to a branch (Branch CR or NHRA Pharmacy license),
 * it returns the branch's operational code name (e.g. "Tabarak Pharmacy - Jerdab (T001)" or "Jerdab (T001)").
 */
export const getOperationalEntityDisplayName = (record: OperationalRenewalRecord): string => {
  if (
    record.branchName &&
    (record.entityType === 'BRANCH' ||
     record.renewalType === 'CR' ||
     record.renewalType === 'NHRA_PHARMACY' ||
     record.renewalType === 'NHRA')
  ) {
    return record.branchName;
  }

  if (record.metadata?.operationalBranchName) {
    return record.metadata.operationalBranchName;
  }

  if (record.metadata?.operationalName) {
    return record.metadata.operationalName;
  }

  if (record.entityType === 'BRANCH' && record.metadata?.branchCode && !record.entityName.includes(record.metadata.branchCode)) {
    return `${record.entityName} (${record.metadata.branchCode})`;
  }

  return record.entityName;
};

/**
 * Calculate target payment date (defaults to leadDays before expiry date, default 15)
 */
export const calculateDefaultPaymentDate = (expiryDateStr?: string | null, leadDays: number = 15): string | undefined => {
  if (!expiryDateStr) return undefined;
  try {
    const d = new Date(expiryDateStr);
    if (isNaN(d.getTime())) return undefined;
    d.setDate(d.getDate() - (leadDays || 15));
    return d.toISOString().split('T')[0];
  } catch {
    return undefined;
  }
};

/**
 * Intelligent Cost Center Resolver based on document type, branch and metadata
 */
export const resolveSmartCostCenter = (
  renewalType: OperationalRenewalType,
  branchName?: string,
  branchId?: string,
  entityName?: string,
  metadata?: any
): { code: string; name: string; type: RenewalCostCenterType } => {
  const branchCandidate = branchName || metadata?.operationalBranchName || metadata?.branchName || '';
  const codeMatch = branchCandidate.match(/\(([A-Z]\d{3})\)/i) || (metadata?.branchCode ? [null, metadata.branchCode] : null);
  if (codeMatch && codeMatch[1]) {
    const code = codeMatch[1].toUpperCase();
    return {
      code: `CC-${code}`,
      name: branchCandidate || `Branch ${code}`,
      type: 'BRANCH'
    };
  }

  // Functional & Regulatory Cost Centers
  if (renewalType === 'WORK_PERMIT') {
    if (branchCandidate) {
      return {
        code: `CC-HR-${branchCandidate.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'WP'}`,
        name: `${branchCandidate} — LMRA Work Permits`,
        type: 'BRANCH'
      };
    }
    return {
      code: 'CC-LMRA-WP',
      name: 'LMRA Work Permits & Expat Visas',
      type: 'REGULATORY'
    };
  }

  if (renewalType === 'NHRA_PHARMACIST') {
    return {
      code: 'CC-NHRA-STF',
      name: 'NHRA Healthcare Staff Licenses',
      type: 'REGULATORY'
    };
  }

  if (renewalType === 'NHRA_PHARMACY') {
    if (branchCandidate) {
      return {
        code: `CC-NHRA-${branchCandidate.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'PH'}`,
        name: `${branchCandidate} — NHRA Pharmacy License`,
        type: 'BRANCH'
      };
    }
    return {
      code: 'CC-NHRA-FACILITY',
      name: 'NHRA Pharmacy Facilities',
      type: 'REGULATORY'
    };
  }

  if (renewalType === 'CR' || renewalType === 'CHAMBER_OF_COMMERCE') {
    if (metadata?.isMaster || (entityName && (entityName.includes('W.L.L') || entityName.includes('Master')))) {
      return {
        code: 'CC-HQ-GRP',
        name: 'Tabarak Group Holding (HQ)',
        type: 'HOLDING'
      };
    }
    if (branchCandidate) {
      return {
        code: `CC-CR-${branchCandidate.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'BR'}`,
        name: `${branchCandidate} — ${renewalType === 'CHAMBER_OF_COMMERCE' ? 'Chamber of Commerce' : 'Commercial Registration'}`,
        type: 'BRANCH'
      };
    }
    return {
      code: 'CC-CR-MOIC',
      name: renewalType === 'CHAMBER_OF_COMMERCE' ? 'Chamber of Commerce (BCCI)' : 'Commercial Registrations (MOIC)',
      type: 'REGULATORY'
    };
  }

  if (renewalType === 'FLEET_VEHICLE') {
    return {
      code: 'CC-FLEET-LOG',
      name: 'Fleet Vehicles & Logistics',
      type: 'DEPARTMENT'
    };
  }

  return {
    code: 'CC-GEN-OPS',
    name: 'General Operations & Compliance',
    type: 'DEPARTMENT'
  };
};

/**
 * Synchronous read of tariffs from localStorage (or seed with DEFAULT_TARIFF_RULES)
 */
export const getTariffsSync = (): RenewalTariffRule[] => {
  if (typeof window === 'undefined') return DEFAULT_TARIFF_RULES;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TARIFFS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_TARIFFS_KEY, JSON.stringify(DEFAULT_TARIFF_RULES));
      return DEFAULT_TARIFF_RULES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_TARIFF_RULES;
  } catch {
    return DEFAULT_TARIFF_RULES;
  }
};

/**
 * Smart tariff resolution based on renewal type, duration (for WP: 6/12/24),
 * entity name, CR number, or branch code overrides.
 */
export const lookupTariff = (params: {
  renewalType: OperationalRenewalType;
  durationMonths?: number;
  entityName?: string;
  documentNumber?: string;
  branchCode?: string;
  branchName?: string;
  documentType?: string;
}): TariffLookupResult => {
  const tariffs = getTariffsSync();
  const activeTariffs = tariffs.filter(t => t.isActive !== false);

  const cleanEntity = (params.entityName || '').toLowerCase().trim();
  const cleanDocNo = (params.documentNumber || '').toLowerCase().trim();
  const cleanBranch = (params.branchCode || params.branchName || '').toLowerCase().trim();

  // 1. Check for specific Entity / CR Number / Branch override (highest priority)
  for (const t of activeTariffs) {
    if (t.renewalType !== params.renewalType) continue;
    if (t.isDefault) continue;

    // Check entity pattern (e.g. CR number or pharmacy name or employee name)
    if (t.entityPattern) {
      const pat = t.entityPattern.toLowerCase().trim();
      const matches = (cleanEntity && cleanEntity.includes(pat)) ||
                      (cleanDocNo && cleanDocNo.includes(pat)) ||
                      (cleanBranch && cleanBranch.includes(pat));
      if (matches) {
        if (params.renewalType === 'WORK_PERMIT' && t.durationMonths && params.durationMonths) {
          if (t.durationMonths === params.durationMonths) {
            return {
              cost: t.baseCostBHD,
              matchedRule: t,
              ruleLabel: t.label,
              isCustomOverride: true,
              paymentLeadDays: t.paymentLeadDays,
              targetPaymentDate: t.targetPaymentDate
            };
          }
        } else {
          return {
            cost: t.baseCostBHD,
            matchedRule: t,
            ruleLabel: t.label,
            isCustomOverride: true,
            paymentLeadDays: t.paymentLeadDays,
            targetPaymentDate: t.targetPaymentDate
          };
        }
      }
    }

    // Check branch code (e.g. T001, T002, D002)
    if (t.branchCode) {
      const bCode = t.branchCode.toLowerCase().trim();
      if (cleanBranch.includes(bCode) || cleanEntity.includes(bCode) || cleanDocNo.includes(bCode)) {
        return {
          cost: t.baseCostBHD,
          matchedRule: t,
          ruleLabel: t.label,
          isCustomOverride: true,
          paymentLeadDays: t.paymentLeadDays,
          targetPaymentDate: t.targetPaymentDate
        };
      }
    }
  }

  // 2. For WORK_PERMIT, match by durationMonths (6, 12, 24)
  if (params.renewalType === 'WORK_PERMIT') {
    if (params.durationMonths) {
      const durationMatch = activeTariffs.find(
        t => t.renewalType === 'WORK_PERMIT' && t.durationMonths === params.durationMonths
      );
      if (durationMatch) {
        return {
          cost: durationMatch.baseCostBHD,
          matchedRule: durationMatch,
          ruleLabel: durationMatch.label,
          isCustomOverride: false,
          paymentLeadDays: durationMatch.paymentLeadDays,
          targetPaymentDate: durationMatch.targetPaymentDate
        };
      }
    }
    // No automatic standard default for WORK_PERMIT - user specifies fee or chooses duration
    return {
      cost: 0,
      ruleLabel: 'Work Permit (User-Specified Fee)',
      isCustomOverride: false,
      paymentLeadDays: 15
    };
  }

  // 3. Match category default rule
  const defaultRule = activeTariffs.find(
    t => t.renewalType === params.renewalType && t.isDefault
  );
  if (defaultRule) {
    return {
      cost: defaultRule.baseCostBHD,
      matchedRule: defaultRule,
      ruleLabel: defaultRule.label,
      isCustomOverride: false,
      paymentLeadDays: defaultRule.paymentLeadDays,
      targetPaymentDate: defaultRule.targetPaymentDate
    };
  }

  // 4. Any active rule of that renewalType (in case isDefault was not set)
  const anyRule = activeTariffs.find(t => t.renewalType === params.renewalType);
  if (anyRule) {
    return {
      cost: anyRule.baseCostBHD,
      matchedRule: anyRule,
      ruleLabel: anyRule.label,
      isCustomOverride: false,
      paymentLeadDays: anyRule.paymentLeadDays,
      targetPaymentDate: anyRule.targetPaymentDate
    };
  }

  // 5. Fallback to DEFAULT_RENEWAL_TARIFFS map
  const fallback = DEFAULT_RENEWAL_TARIFFS[params.renewalType] ?? 50.000;
  return {
    cost: fallback,
    ruleLabel: `${params.renewalType} Standard Tariff`,
    isCustomOverride: false
  };
};

/**
 * Format helper for mappers
 */
const toRenewalRecord = (
  row: any,
  settings: OperationalRenewalSettings = DEFAULT_SETTINGS,
  todayStr = getBahrainTodayStr()
): OperationalRenewalRecord => {
  const expiryDate = row.expiry_date || row.expiryDate || '';
  const days = calculateDaysRemaining(expiryDate, todayStr);
  const sev = calculateSeverity(days, settings);

  const rawEntityName =
    row.entity_name ||
    row.entityName ||
    row.name ||
    row.title ||
    'Unnamed Entity';

  const branchName =
    row.branch_name ||
    row.branchName ||
    (typeof row.branch === 'object' && row.branch?.name ? row.branch.name : undefined);

  const rawRenewalType: OperationalRenewalType =
    row.renewal_type ||
    row.renewalType ||
    'OTHER';

  const entityType =
    row.entity_type ||
    row.entityType ||
    'OTHER';

  // If the record belongs to a branch (or is a CR / branch license linked to a branch),
  // prioritize the operational branch code name
  let entityName = rawEntityName;
  if (
    branchName &&
    (entityType === 'BRANCH' ||
     rawRenewalType === 'CR' ||
     rawRenewalType === 'NHRA' ||
     rawRenewalType === 'NHRA_PHARMACY')
  ) {
    entityName = branchName;
  }

  const documentType =
    row.document_type ||
    row.documentType ||
    'Document';

  const documentNumber =
    row.document_number ||
    row.documentNumber ||
    '—';

  let renewalType: OperationalRenewalType = rawRenewalType;
  if (rawRenewalType === 'NHRA') {
    if (
      entityType === 'EMPLOYEE' ||
      (documentType && documentType.toLowerCase().includes('pharmacist')) ||
      (entityName && entityName.toLowerCase().includes('pharmacist'))
    ) {
      renewalType = 'NHRA_PHACIST' as any === 'NHRA_PHARMACIST' ? 'NHRA_PHARMACIST' : 'NHRA_PHARMACIST';
    } else {
      renewalType = 'NHRA_PHARMACY';
    }
  }

  const renewalStatus =
    row.renewal_status ||
    row.renewalStatus ||
    'NOT_STARTED';

  const responsibleUserName =
    row.responsible_user_name ||
    row.responsibleUserName ||
    undefined;

  const responsibleUserId =
    row.responsible_user_id ||
    row.responsibleUserId ||
    undefined;

  const issueDate =
    row.issue_date ||
    row.issueDate ||
    undefined;

  const priority =
    row.priority ||
    undefined;

  const notes =
    row.notes ||
    undefined;

  const isActive =
    row.is_active !== undefined
      ? Boolean(row.is_active)
      : (row.isActive !== undefined ? Boolean(row.isActive) : true);

  const metadata =
    typeof row.metadata === 'object' && row.metadata !== null
      ? row.metadata
      : {};

  const attachmentsCount =
    Number(row.attachments_count ?? row.attachmentsCount ?? 0);

  const historyCount =
    Number(row.history_count ?? row.historyCount ?? 0);

  const createdBy =
    row.created_by ||
    row.createdBy ||
    undefined;

  const createdAt =
    row.created_at ||
    row.createdAt ||
    new Date().toISOString();

  const updatedBy =
    row.updated_by ||
    row.updatedBy ||
    undefined;

  const updatedAt =
    row.updated_at ||
    row.updatedAt ||
    createdAt;

  // Cost Center & Financial Budgeting mapping
  const smartCostCenter = resolveSmartCostCenter(renewalType, branchName, row.branch_id || row.branchId, entityName, metadata);
  const costCenterCode = row.cost_center_code || row.costCenterCode || smartCostCenter.code;
  const costCenterName = row.cost_center_name || row.costCenterName || smartCostCenter.name;

  const rawDuration =
    row.renewal_duration_months ||
    row.renewalDurationMonths ||
    metadata?.renewalDurationMonths;

  const renewalDurationMonths =
    renewalType === 'WORK_PERMIT'
      ? (rawDuration ? Number(rawDuration) : 12)
      : rawDuration;

  const tariffResult = lookupTariff({
    renewalType,
    durationMonths: renewalDurationMonths,
    entityName,
    documentNumber,
    branchCode: row.branch_id || row.branchId || metadata?.branchCode,
    branchName,
    documentType
  });

  // The estimated cost MUST be dynamically determined by lookupTariff from the user's active Tariff Control rules
  // unless this specific record has an explicit manual lock saved by the user.
  const isManuallyOverridden = Boolean(metadata?.manualCostOverride);
  const estimatedCost = isManuallyOverridden && (row.estimated_cost !== undefined || row.estimatedCost !== undefined)
    ? Number(row.estimated_cost ?? row.estimatedCost)
    : Number(tariffResult.cost);

  const actualCost =
    row.actual_cost !== undefined && row.actual_cost !== null
      ? Number(row.actual_cost)
      : row.actualCost !== undefined && row.actualCost !== null
      ? Number(row.actualCost)
      : undefined;

  const currency = row.currency || 'BHD';

  const paymentStatus =
    row.payment_status ||
    row.paymentStatus ||
    (actualCost !== undefined && actualCost > 0 ? 'PAID' : 'UNPAID');

  const isDateManuallyOverridden = Boolean(metadata?.manualDateOverride);
  let plannedPaymentDate: string | undefined;
  if (isDateManuallyOverridden && (row.planned_payment_date || row.plannedPaymentDate)) {
    plannedPaymentDate = row.planned_payment_date || row.plannedPaymentDate;
  } else if (tariffResult.targetPaymentDate) {
    plannedPaymentDate = tariffResult.targetPaymentDate;
  } else {
    const lead = tariffResult.paymentLeadDays ?? 15;
    plannedPaymentDate = calculateDefaultPaymentDate(expiryDate, lead);
  }

  const paidAt = row.paid_at || row.paidAt || undefined;
  const paymentMethod = row.payment_method || row.paymentMethod || undefined;
  const paymentReference = row.payment_reference || row.paymentReference || undefined;

  return {
    id: String(row.id || `rnw-${Date.now()}`),
    renewalType,
    entityType,
    entityId: row.entity_id || row.entityId || undefined,
    entityName,
    documentType,
    documentNumber,
    branchId: row.branch_id || row.branchId || undefined,
    branchName,
    issueDate,
    expiryDate,
    renewalStatus,
    priority,
    responsibleUserId,
    responsibleUserName,
    notes,
    isActive,
    metadata,
    attachmentsCount,
    historyCount,
    createdBy,
    createdAt,
    updatedBy,
    updatedAt,
    daysRemaining: days,
    severity: sev,
    costCenterCode,
    costCenterName,
    estimatedCost,
    actualCost,
    currency,
    paymentStatus,
    plannedPaymentDate,
    paidAt,
    paymentMethod,
    paymentReference,
    renewalDurationMonths
  };
};

/**
 * Helper to synchronize renewal dates directly to the upstream entity
 * (Employee in workforceService, CR in crService, or Vehicle in expenseService)
 */
export const syncRenewalToMasterEntity = async (
  record: OperationalRenewalRecord | { renewalType: OperationalRenewalType; entityType: string; entityId?: string; entityName: string; documentNumber?: string; metadata?: any },
  newExpiryDate: string,
  newDocumentNumber?: string,
  notes?: string
): Promise<void> => {
  try {
    const isEmployee =
      record.entityType === 'EMPLOYEE' ||
      record.renewalType === 'WORK_PERMIT' ||
      record.renewalType === 'NHRA_PHARMACIST' ||
      (record.renewalType === 'OTHER' && (
        record.metadata?.licenseType === 'Passport' ||
        (record as any).documentType?.toLowerCase().includes('passport')
      ));

    if (isEmployee) {
      const empId = record.metadata?.employeeId || (record.entityType === 'EMPLOYEE' ? record.entityId : undefined);
      const empCode = record.metadata?.employeeCode;
      const cprNo = record.metadata?.cprNumber || (record.documentNumber?.startsWith('WP-') ? record.documentNumber.replace('WP-', '') : undefined);

      const allEmployees = await workforceService.getAllEmployees();
      const targetEmp = allEmployees.find(e =>
        (empId && (e.id === empId || e.code === empId)) ||
        (empCode && e.code.toUpperCase() === empCode.toUpperCase()) ||
        (cprNo && (e.cpr_number === cprNo || e.salary_matrix?.expatCpr === cprNo)) ||
        (record.entityName && (
          e.full_name.trim().toLowerCase() === record.entityName.trim().toLowerCase() ||
          record.entityName.toLowerCase().startsWith(e.full_name.toLowerCase()) ||
          e.full_name.toLowerCase().startsWith(record.entityName.toLowerCase())
        ))
      );

      if (targetEmp) {
        const currentSm = targetEmp.salary_matrix || {};
        let empModified = false;

        if (record.renewalType === 'WORK_PERMIT') {
          targetEmp.wp_expiry_date = newExpiryDate;
          targetEmp.salary_matrix = {
            ...currentSm,
            wpExpiryDate: newExpiryDate,
            visaExpiryDate: newExpiryDate
          };
          empModified = true;
        } else if (record.renewalType === 'NHRA_PHARMACIST') {
          targetEmp.salary_matrix = {
            ...currentSm,
            nhraExpiryDate: newExpiryDate,
            ...(newDocumentNumber ? { nhraLicenseNo: newDocumentNumber } : {})
          };
          empModified = true;
        } else if (record.renewalType === 'OTHER') {
          targetEmp.passport_expiry_date = newExpiryDate;
          targetEmp.salary_matrix = {
            ...currentSm,
            expatPpExpiryDate: newExpiryDate,
            ppExpiryDate: newExpiryDate,
            ...(newDocumentNumber ? { expatPp: newDocumentNumber } : {})
          };
          if (newDocumentNumber) {
            targetEmp.passport_number = newDocumentNumber;
          }
          empModified = true;
        }

        if (empModified) {
          targetEmp.updated_at = new Date().toISOString();
          if (notes) {
            targetEmp.notes = targetEmp.notes
              ? `[Renewed ${getBahrainTodayStr()}: ${notes}]\n${targetEmp.notes}`
              : `[Renewed ${getBahrainTodayStr()}: ${notes}]`;
          }
          await workforceService.saveEmployee(targetEmp, targetEmp.assignments || []);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('tabarak_workforce_updated'));
          }
        }
      }
    } else if (
      record.renewalType === 'CR' ||
      record.renewalType === 'CHAMBER_OF_COMMERCE' ||
      record.renewalType === 'NHRA_PHARMACY'
    ) {
      const crId = record.metadata?.crId || record.entityId;
      const crNumber = record.metadata?.crNumber || record.documentNumber;
      const allCrs = await crService.list();
      const targetCr = allCrs.find(c =>
        (crId && (c.id === crId || c.cr_number === crId)) ||
        (crNumber && c.cr_number === crNumber) ||
        (record.metadata?.crName && c.cr_name.toLowerCase() === record.metadata.crName.toLowerCase()) ||
        c.cr_name.toLowerCase() === record.entityName.toLowerCase()
      );

      if (targetCr) {
        if (record.renewalType === 'CR' || record.renewalType === 'CHAMBER_OF_COMMERCE') {
          targetCr.expiry_date = newExpiryDate;
        } else if (record.renewalType === 'NHRA_PHARMACY') {
          targetCr.nhra_expiry_date = newExpiryDate;
          if (newDocumentNumber) {
            targetCr.nhra_license_no = newDocumentNumber;
          }
        }
        targetCr.updated_at = new Date().toISOString();
        await crService.save(targetCr);
      }
    } else if (record.renewalType === 'FLEET_VEHICLE') {
      const vehicleId = record.metadata?.vehicleId || record.entityId;
      if (vehicleId) {
        await expenseService.vehicles.update(vehicleId, {
          registrationExpiryDate: newExpiryDate,
          ...(newDocumentNumber ? { plateNumber: newDocumentNumber } : {})
        });
      }
    }
  } catch (syncErr) {
    console.warn('syncRenewalToMasterEntity error:', syncErr);
  }
};

export const operationalRenewalService = {
  /**
   * Fetch configured alert thresholds and settings
   */
  getSettings: async (): Promise<OperationalRenewalSettings> => {
    try {
      const { data, error } = await supabaseClient
        .from('operational_renewal_settings')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();

      if (!error && data) {
        const settings: OperationalRenewalSettings = {
          criticalDays: Number(data.critical_days ?? 7),
          urgentDays: Number(data.urgent_days ?? 30),
          warningDays: Number(data.warning_days ?? 60),
          upcomingDays: Number(data.upcoming_days ?? 90),
          reminderIntervals: Array.isArray(data.reminder_intervals) ? data.reminder_intervals : DEFAULT_SETTINGS.reminderIntervals,
          enabledTypes: Array.isArray(data.enabled_types) ? data.enabled_types : DEFAULT_SETTINGS.enabledTypes,
          defaultResponsibleUserId: data.default_responsible_user_id || undefined,
          defaultResponsibleUserName: data.default_responsible_user_name || undefined
        };
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(settings));
          } catch {}
        }
        return settings;
      }
    } catch (e) {
      console.warn('Could not load operational renewal settings from Supabase:', e);
    }

    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
        if (saved) return JSON.parse(saved);
      } catch {}
    }

    return DEFAULT_SETTINGS;
  },

  /**
   * Update settings
   */
  updateSettings: async (
    newSettings: Partial<OperationalRenewalSettings>,
    user?: { id?: string; name?: string }
  ): Promise<OperationalRenewalSettings> => {
    const current = await operationalRenewalService.getSettings();
    const merged: OperationalRenewalSettings = { ...current, ...newSettings };

    const payload = {
      id: 'default',
      critical_days: merged.criticalDays,
      urgent_days: merged.urgentDays,
      warning_days: merged.warningDays,
      upcoming_days: merged.upcomingDays,
      reminder_intervals: merged.reminderIntervals,
      enabled_types: merged.enabledTypes,
      default_responsible_user_id: merged.defaultResponsibleUserId || null,
      default_responsible_user_name: merged.defaultResponsibleUserName || null,
      updated_by: user?.name || 'Admin',
      updated_at: new Date().toISOString()
    };

    try {
      await supabaseClient
        .from('operational_renewal_settings')
        .upsert(payload, { onConflict: 'id' });
    } catch (e) {
      console.warn('Could not save operational_renewal_settings to cloud:', e);
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(merged));
      } catch {}
    }

    return merged;
  },

  /**
   * Master Data Auto-Sync:
   * Aggregates live data from Commercial Registrations (crService), Branches (branchService),
   * and Employees (workforceService) so existing records are monitored immediately.
   */
  syncMasterData: async (): Promise<OperationalRenewalRecord[]> => {
    const [crs, branches, employees, vehicles, settings] = await Promise.all([
      crService.list(),
      branchService.list(),
      workforceService.getAllEmployees(),
      expenseService.vehicles.list(true).catch(() => []),
      operationalRenewalService.getSettings()
    ]);

    const generated: OperationalRenewalInput[] = [];

    // 1. Synchronize Commercial Registrations (CRs)
    crs.forEach(cr => {
      if (!cr.cr_number || !cr.expiry_date) return;
      const branchMatch = branches.find(b => b.id === cr.linked_branch_id || b.crNumber === cr.cr_number);

      // Determine Operational Name
      let operationalBranchName: string | undefined;
      if (cr.linked_branch_name) {
        operationalBranchName = cr.linked_branch_name;
      } else if (branchMatch) {
        operationalBranchName = branchMatch.code && !branchMatch.name.includes(branchMatch.code)
          ? `${branchMatch.name} (${branchMatch.code})`
          : branchMatch.name;
      }

      // If it is a branch CR or linked to a branch, write with operational code name
      const displayEntityName = operationalBranchName || cr.cr_name || cr.cr_name_ar || `CR ${cr.cr_number}`;

      generated.push({
        renewalType: 'CR',
        entityType: operationalBranchName || !cr.is_master ? 'BRANCH' : 'COMPANY',
        entityId: cr.id || cr.cr_number,
        entityName: displayEntityName,
        documentType: 'Commercial Registration',
        documentNumber: cr.cr_number,
        branchId: cr.linked_branch_id || branchMatch?.id,
        branchName: operationalBranchName || cr.linked_branch_name || branchMatch?.name,
        expiryDate: cr.expiry_date,
        renewalStatus: 'NOT_STARTED',
        responsibleUserName: 'Executive Management',
        notes: `Master CR: ${cr.is_master ? 'Yes (Group Master)' : 'Branch CR'}. Parent CR: ${cr.parent_cr_number || 'N/A'}. Tax: ${cr.tax_number || 'N/A'}. Legal CR: ${cr.cr_name || 'N/A'}.`,
        metadata: {
          crName: cr.cr_name,
          crNameAr: cr.cr_name_ar,
          operationalBranchName,
          isMaster: cr.is_master,
          parentCrNumber: cr.parent_cr_number,
          taxNumber: cr.tax_number,
          phone: cr.phone,
          email: cr.email
        }
      });

      // If CR has distinct NHRA license
      if (cr.nhra_license_no && cr.nhra_expiry_date) {
        generated.push({
          renewalType: 'NHRA_PHARMACY',
          entityType: 'BRANCH',
          entityId: cr.id || cr.cr_number,
          entityName: operationalBranchName || `${cr.cr_name} — NHRA Pharmacy`,
          documentType: 'NHRA Pharmacy License',
          documentNumber: cr.nhra_license_no,
          branchId: cr.linked_branch_id || branchMatch?.id,
          branchName: operationalBranchName || cr.linked_branch_name || branchMatch?.name,
          expiryDate: cr.nhra_expiry_date,
          renewalStatus: 'NOT_STARTED',
          responsibleUserName: 'Quality & Regulatory',
          notes: `NHRA regulatory license for ${operationalBranchName || cr.cr_name}`,
          metadata: {
            licenseType: 'Pharmacy License',
            holder: operationalBranchName || cr.cr_name,
            legalCrName: cr.cr_name,
            operationalBranchName
          }
        });
      }
    });

    // 2. Synchronize Employee Work Permits & Pharmacist Licenses
    employees.forEach(emp => {
      if (emp.status === 'Inactive') return;

      const wpDate = emp.wp_expiry_date || emp.salary_matrix?.wpExpiryDate || emp.salary_matrix?.visaExpiryDate;
      const primaryAssignment = emp.assignments?.find(a => a.is_primary) || emp.assignments?.[0];

      if (wpDate) {
        const wpNo = emp.cpr_number ? `WP-${emp.cpr_number}` : `WP-${emp.code}`;
        generated.push({
          renewalType: 'WORK_PERMIT',
          entityType: 'EMPLOYEE',
          entityId: emp.id || emp.code,
          entityName: emp.full_name,
          documentType: 'Employee Work Permit',
          documentNumber: wpNo,
          branchId: primaryAssignment?.branch_id,
          branchName: primaryAssignment?.branch_name,
          expiryDate: wpDate,
          renewalStatus: 'NOT_STARTED',
          responsibleUserName: 'HR Department',
          notes: `Staff Category: ${emp.category}. Staff Code: ${emp.code}. Nationality: ${emp.nationality || 'N/A'}. Visa Type: ${emp.visa_type || 'Internal'}.`,
          metadata: {
            employeeId: emp.id,
            employeeCode: emp.code,
            category: emp.category,
            cprNumber: emp.cpr_number,
            passportNumber: emp.passport_number || emp.salary_matrix?.expatPp,
            passportExpiryDate: emp.passport_expiry_date || emp.salary_matrix?.expatPpExpiryDate,
            nationality: emp.nationality,
            visaType: emp.visa_type
          }
        });
      }

      // Pharmacist NHRA License (Nhra of Employee)
      const nhraNo = emp.salary_matrix?.nhraLicenseNo || (emp as any).nhra_license_no || (emp as any).license;
      const nhraExp = emp.salary_matrix?.nhraExpiryDate || (emp as any).nhra_expiry_date || (emp.category === 'Pharmacist' ? '2026-11-30' : undefined);
      if (nhraNo || (emp.category === 'Pharmacist' && nhraExp)) {
        generated.push({
          renewalType: 'NHRA_PHARMACIST',
          entityType: 'EMPLOYEE',
          entityId: emp.id || emp.code,
          entityName: `${emp.full_name} — NHRA Pharmacist`,
          documentType: 'NHRA Pharmacist License',
          documentNumber: nhraNo,
          branchId: primaryAssignment?.branch_id,
          branchName: primaryAssignment?.branch_name,
          expiryDate: nhraExp,
          renewalStatus: 'NOT_STARTED',
          responsibleUserName: 'HR & Quality',
          notes: `Licensed Pharmacist: ${emp.full_name} (${emp.code}). CPR: ${emp.cpr_number || 'N/A'}.`,
          metadata: {
            employeeId: emp.id,
            employeeCode: emp.code,
            licenseType: 'Pharmacist License'
          }
        });
      }

      // 3.3 Expat Passport Expiry
      const ppDate = emp.passport_expiry_date || emp.salary_matrix?.expatPpExpiryDate || emp.salary_matrix?.ppExpiryDate;
      const ppNo = emp.passport_number || emp.salary_matrix?.expatPp;
      if (ppDate && ppNo) {
        generated.push({
          renewalType: 'OTHER',
          entityType: 'EMPLOYEE',
          entityId: emp.id || emp.code,
          entityName: `${emp.full_name} — Passport`,
          documentType: 'Expat Passport',
          documentNumber: ppNo,
          branchId: primaryAssignment?.branch_id,
          branchName: primaryAssignment?.branch_name,
          expiryDate: ppDate,
          renewalStatus: 'NOT_STARTED',
          responsibleUserName: 'HR Department',
          notes: `Expat Passport for ${emp.full_name} (${emp.code}). Nationality: ${emp.nationality || 'N/A'}. Staff Category: ${emp.category}.`,
          metadata: {
            employeeId: emp.id,
            employeeCode: emp.code,
            passportNumber: ppNo,
            nationality: emp.nationality
          }
        });
      }
    });

    // 4. Synchronize Fleet Vehicles (from vehicles table)
    vehicles.forEach(veh => {
      if (!veh.registrationExpiryDate) return;

      generated.push({
        renewalType: 'FLEET_VEHICLE',
        entityType: 'VEHICLE',
        entityId: veh.id,
        entityName: `${veh.vehicleCode} (${veh.plateNumber || 'No Plate'}) — ${veh.vehicleType || 'Vehicle'}`,
        documentType: 'Vehicle Registration & Insurance',
        documentNumber: veh.plateNumber || `VEH-${veh.vehicleCode}`,
        expiryDate: veh.registrationExpiryDate,
        renewalStatus: 'NOT_STARTED',
        responsibleUserName: 'Fleet & Logistics',
        notes: `Vehicle Type: ${veh.vehicleType}. Ownership: ${veh.ownershipType || 'Internal'}. Plate: ${veh.plateNumber || 'N/A'}. CR: ${veh.crNumber || 'N/A'}.`,
        metadata: {
          vehicleId: veh.id,
          vehicleCode: veh.vehicleCode,
          plateNumber: veh.plateNumber,
          vehicleType: veh.vehicleType,
          ownershipType: veh.ownershipType,
          crNumber: veh.crNumber
        }
      });
    });

    // Collect all valid CR NHRA licenses entered in Registered Commercial Registrations
    const validCrNhraLicenseNumbers = new Set(
      crs
        .map(c => (c.nhra_license_no || '').trim().toLowerCase())
        .filter(Boolean)
    );

    // Clean up any corrupted records or obsolete branch-derived NHRA records from cache
    let existingList: any[] = [];
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_RENEWALS_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            existingList = parsed.filter((r: any) => {
              const name = r.entity_name || r.entityName;
              const doc = (r.document_number || r.documentNumber || '').trim().toLowerCase();
              const type = r.renewal_type || r.renewalType;

              // Filter out corrupted/blank
              if (name === 'Unnamed Entity' && (doc === '—' || !doc)) return false;

              // Explicitly purge the phantom 32000185 record
              if (doc === '32000185') return false;

              // Purge any NHRA_PHARMACY record that was generated from branches and not in Registered CRs
              if ((type === 'NHRA_PHARMACY' || type === 'NHRA') && (r.entity_type === 'BRANCH' || r.entityType === 'BRANCH') && !validCrNhraLicenseNumbers.has(doc)) {
                return false;
              }

              return true;
            });
          }
        }
      } catch {}
    }

    const now = new Date().toISOString();
    const systemUser = 'System Auto-Sync';

    // Purge phantom records from cloud database as well
    try {
      await supabaseClient
        .from('operational_renewals')
        .delete()
        .eq('document_number', '32000185');
    } catch (e) {}

    const matchIndex = (incoming: OperationalRenewalInput): number => {
      const incDoc = (incoming.documentNumber || '').trim().toLowerCase();
      return existingList.findIndex((ex: any) => {
        const exType = ex.renewal_type || ex.renewalType;
        const isCompatibleType =
          exType === incoming.renewalType ||
          (exType === 'NHRA' && (incoming.renewalType === 'NHRA_PHARMACY' || incoming.renewalType === 'NHRA_PHARMACIST'));
        if (!isCompatibleType) return false;
        const exDoc = (ex.document_number || ex.documentNumber || '').trim().toLowerCase();
        if (incDoc && exDoc === incDoc) return true;
        const exEntId = ex.entity_id || ex.entityId;
        if (incoming.entityId && exEntId && exEntId === incoming.entityId) return true;
        return false;
      });
    };

    const syncedResults: OperationalRenewalRecord[] = [];

    for (const item of generated) {
      const foundIdx = matchIndex(item);
      let recordId: string;
      let existingNotes: string | undefined;
      let existingStatus: RenewalWorkflowStatus = 'NOT_STARTED';

      let existingCostCenterCode: string | undefined;
      let existingCostCenterName: string | undefined;
      let existingEstimatedCost: number | undefined;
      let existingActualCost: number | undefined;
      let existingPaymentStatus: any = undefined;
      let existingPlannedDate: string | undefined;
      let existingPaidAt: string | undefined;
      let existingPaymentMethod: any = undefined;
      let existingPaymentRef: string | undefined;

      let existingExpiryDate: string | undefined;
      let existingIssueDate: string | undefined;
      let existingDocNumber: string | undefined;
      let existingDurationMonths: number | undefined;

      if (foundIdx !== -1) {
        const old = existingList[foundIdx];
        recordId = old.id;
        existingNotes = old.notes;
        existingStatus = old.renewal_status || old.renewalStatus || 'NOT_STARTED';
        existingCostCenterCode = old.cost_center_code || old.costCenterCode;
        existingCostCenterName = old.cost_center_name || old.costCenterName;
        existingExpiryDate = old.expiry_date || old.expiryDate;
        existingIssueDate = old.issue_date || old.issueDate;
        existingDocNumber = old.document_number || old.documentNumber;
        existingDurationMonths = old.renewal_duration_months || old.renewalDurationMonths;
        const isManuallyOverridden = Boolean(old?.metadata?.manualCostOverride);
        if (isManuallyOverridden && (old.estimated_cost !== undefined || old.estimatedCost !== undefined)) {
          existingEstimatedCost = Number(old.estimated_cost ?? old.estimatedCost);
        } else {
          const wpDuration = item.renewalType === 'WORK_PERMIT'
            ? (old.renewal_duration_months || old.renewalDurationMonths)
            : (old.renewal_duration_months || old.renewalDurationMonths);
          const currentTariff = lookupTariff({
            renewalType: item.renewalType,
            durationMonths: wpDuration,
            entityName: item.entityName,
            documentNumber: item.documentNumber,
            branchCode: item.branchId || item.costCenterCode,
            branchName: item.branchName,
            documentType: item.documentType
          });
          existingEstimatedCost = currentTariff.cost;
        }
        const isDateManuallyOverridden = Boolean(old?.metadata?.manualDateOverride);
        if (isDateManuallyOverridden && (old.planned_payment_date || old.plannedPaymentDate)) {
          existingPlannedDate = old.planned_payment_date || old.plannedPaymentDate;
        } else {
          const wpDuration = item.renewalType === 'WORK_PERMIT'
            ? (old.renewal_duration_months || old.renewalDurationMonths)
            : (old.renewal_duration_months || old.renewalDurationMonths);
          const currentTariff = lookupTariff({
            renewalType: item.renewalType,
            durationMonths: wpDuration,
            entityName: item.entityName,
            documentNumber: item.documentNumber,
            branchCode: item.branchId || item.costCenterCode,
            branchName: item.branchName,
            documentType: item.documentType
          });
          if (currentTariff.targetPaymentDate) {
            existingPlannedDate = currentTariff.targetPaymentDate;
          } else {
            const lead = currentTariff.paymentLeadDays ?? 15;
            existingPlannedDate = calculateDefaultPaymentDate(item.expiryDate, lead);
          }
        }
        existingActualCost = old.actual_cost ?? old.actualCost;
        existingPaymentStatus = old.payment_status || old.paymentStatus;
        existingPaidAt = old.paid_at || old.paidAt;
        existingPaymentMethod = old.payment_method || old.paymentMethod;
        existingPaymentRef = old.payment_reference || old.paymentReference;
      } else {
        recordId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `rnw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const currentTariff = lookupTariff({
          renewalType: item.renewalType,
          durationMonths: item.metadata?.durationMonths,
          entityName: item.entityName,
          documentNumber: item.documentNumber,
          branchCode: item.branchId,
          branchName: item.branchName,
          documentType: item.documentType
        });
        existingEstimatedCost = currentTariff.cost;
        if (currentTariff.targetPaymentDate) {
          existingPlannedDate = currentTariff.targetPaymentDate;
        } else {
          const lead = currentTariff.paymentLeadDays ?? 15;
          existingPlannedDate = calculateDefaultPaymentDate(item.expiryDate, lead);
        }
      }

      // Master entity data (Employee, CR, Vehicle) is the authoritative source of truth
      const resolvedExpiryDate = item.expiryDate || existingExpiryDate;

      const payload = {
        id: recordId,
        renewal_type: item.renewalType,
        entity_type: item.entityType,
        entity_id: item.entityId || null,
        entity_name: item.entityName,
        document_type: item.documentType,
        document_number: existingDocNumber || item.documentNumber,
        branch_id: item.branchId || null,
        branch_name: item.branchName || null,
        issue_date: existingIssueDate || item.issueDate || null,
        expiry_date: resolvedExpiryDate,
        renewal_status: existingStatus,
        priority: item.priority || null,
        responsible_user_id: item.responsibleUserId || null,
        responsible_user_name: item.responsibleUserName || null,
        notes: existingNotes || item.notes || null,
        is_active: item.isActive !== false,
        metadata: {
          ...(item.metadata || {}),
          ...((foundIdx !== -1 && existingList[foundIdx]?.metadata) || {}),
          durationMonths: existingDurationMonths || item.metadata?.durationMonths || undefined
        },
        cost_center_code: existingCostCenterCode || item.costCenterCode || null,
        cost_center_name: existingCostCenterName || item.costCenterName || null,
        renewal_duration_months: existingDurationMonths || undefined,
        estimated_cost: existingEstimatedCost !== undefined
          ? existingEstimatedCost
          : (item.estimatedCost ?? (existingDurationMonths ? lookupTariff({
              renewalType: item.renewalType,
              durationMonths: existingDurationMonths,
              entityName: item.entityName,
              documentNumber: item.documentNumber,
              branchName: item.branchName || undefined,
              documentType: item.documentType
            }).cost : 0)),
        actual_cost: existingActualCost !== undefined ? existingActualCost : (item.actualCost ?? null),
        currency: item.currency || 'BHD',
        payment_status: existingPaymentStatus || item.paymentStatus || 'UNPAID',
        planned_payment_date: existingPlannedDate || calculateDefaultPaymentDate(resolvedExpiryDate, 15) || null,
        paid_at: existingPaidAt || item.paidAt || null,
        payment_method: existingPaymentMethod || item.paymentMethod || null,
        payment_reference: existingPaymentRef || item.paymentReference || null,
        created_by: systemUser,
        created_at: now,
        updated_by: systemUser,
        updated_at: now
      };

      try {
        await supabaseClient.from('operational_renewals').upsert(payload, { onConflict: 'id' });
      } catch (e) {
        // Supabase upsert fallback
      }

      const mapped = toRenewalRecord(payload, settings);
      syncedResults.push(mapped);
    }

    // Retain only valid manual custom entries that aren't system-generated and aren't phantom
    const manualRecords = existingList.filter((r: any) => {
      const isSystemSync = (r.created_by === systemUser || r.createdBy === systemUser);
      const doc = (r.document_number || r.documentNumber || '').trim().toLowerCase();
      if (doc === '32000185') return false;
      const type = r.renewal_type || r.renewalType;
      if ((type === 'NHRA_PHARMACY' || type === 'NHRA') && (r.entity_type === 'BRANCH' || r.entityType === 'BRANCH') && !validCrNhraLicenseNumbers.has(doc)) {
        return false;
      }
      return !isSystemSync && !syncedResults.some(s => s.id === r.id);
    });

    const finalRecords = [...syncedResults, ...manualRecords.map(r => toRenewalRecord(r, settings, getBahrainTodayStr()))];

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_RENEWALS_KEY, JSON.stringify(finalRecords));
        window.dispatchEvent(new CustomEvent(RENEWALS_UPDATED_EVENT));
      } catch {}
    }

    return finalRecords;
  },

  /**
   * List renewal records with dynamic days remaining, severity calculations, and filters
   */
  list: async (filters?: OperationalRenewalFilters): Promise<OperationalRenewalRecord[]> => {
    const settings = await operationalRenewalService.getSettings();
    const today = getBahrainTodayStr();
    let records: OperationalRenewalRecord[] = [];

    // 1. Fully automated live system sync:
    // Always aggregates live data directly from CRs, Branches, Workforce, and Fleet on every list call
    // so compliance is 100% automated without requiring manual "Add renewal" entries.
    try {
      records = await operationalRenewalService.syncMasterData();
    } catch (e) {
      console.warn('Live master data sync failed, falling back to database/cache:', e);
      try {
        const { data, error } = await supabaseClient
          .from('operational_renewals')
          .select(`*, branch:branches(code, name)`)
          .order('expiry_date', { ascending: true });
        if (!error && Array.isArray(data) && data.length > 0) {
          records = data.map(r => toRenewalRecord(r, settings, today));
        }
      } catch {}

      if (records.length === 0 && typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem(LOCAL_STORAGE_RENEWALS_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const validOnly = parsed.filter((r: any) => {
                const name = r.entity_name || r.entityName;
                const doc = r.document_number || r.documentNumber;
                const exp = r.expiry_date || r.expiryDate;
                return !((name === 'Unnamed Entity' || !name) && (doc === '—' || !doc || !exp));
              });
              if (validOnly.length > 0) {
                records = validOnly.map(r => toRenewalRecord(r, settings, today));
              }
            }
          }
        } catch {}
      }
    }

    // Memory-level filtering for complex criteria (severity, date range, search)
    let filtered = records;

    if (!filters?.includeArchived) {
      filtered = filtered.filter(r => r.isActive);
    }

    if (filters?.renewalType && filters.renewalType !== 'ALL') {
      filtered = filtered.filter(r => r.renewalType === filters.renewalType);
    }

    if (filters?.renewalStatus && filters.renewalStatus !== 'ALL') {
      filtered = filtered.filter(r => r.renewalStatus === filters.renewalStatus);
    }

    if (filters?.branchId) {
      filtered = filtered.filter(r => r.branchId === filters.branchId);
    }

    if (filters?.responsibleUserId) {
      filtered = filtered.filter(r => r.responsibleUserId === filters.responsibleUserId || r.responsibleUserName === filters.responsibleUserId);
    }

    if (filters?.severity && filters.severity !== 'ALL') {
      filtered = filtered.filter(r => r.severity === filters.severity);
    }

    // Expiry Period Quick Filters
    if (filters?.expiryPeriod && filters.expiryPeriod !== 'ALL') {
      switch (filters.expiryPeriod) {
        case 'EXPIRED':
          filtered = filtered.filter(r => r.daysRemaining < 0);
          break;
        case 'TODAY':
          filtered = filtered.filter(r => r.daysRemaining === 0);
          break;
        case 'NEXT_7_DAYS':
          filtered = filtered.filter(r => r.daysRemaining >= 0 && r.daysRemaining <= 7);
          break;
        case 'NEXT_30_DAYS':
          filtered = filtered.filter(r => r.daysRemaining >= 0 && r.daysRemaining <= 30);
          break;
        case 'NEXT_60_DAYS':
          filtered = filtered.filter(r => r.daysRemaining >= 0 && r.daysRemaining <= 60);
          break;
        case 'NEXT_90_DAYS':
          filtered = filtered.filter(r => r.daysRemaining >= 0 && r.daysRemaining <= 90);
          break;
        case 'CUSTOM':
          if (filters.startDate) filtered = filtered.filter(r => r.expiryDate >= filters.startDate!);
          if (filters.endDate) filtered = filtered.filter(r => r.expiryDate <= filters.endDate!);
          break;
      }
    }

    // Global Search
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      filtered = filtered.filter(r =>
        r.entityName.toLowerCase().includes(q) ||
        r.documentNumber.toLowerCase().includes(q) ||
        r.documentType.toLowerCase().includes(q) ||
        (r.branchName && r.branchName.toLowerCase().includes(q)) ||
        (r.responsibleUserName && r.responsibleUserName.toLowerCase().includes(q)) ||
        (r.notes && r.notes.toLowerCase().includes(q))
      );
    }

    // Default sort: most urgent first
    const sorted = sortRenewalsByUrgency(filtered);

    // Sync to localStorage (only persist if records are valid)
    if (typeof window !== 'undefined' && records.length > 0) {
      try {
        const hasValid = records.some(r => r.entityName !== 'Unnamed Entity' && r.documentNumber !== '—');
        if (hasValid) {
          localStorage.setItem(LOCAL_STORAGE_RENEWALS_KEY, JSON.stringify(records));
        }
      } catch {}
    }

    return sorted;
  },

  /**
   * Get single record by ID
   */
  getById: async (id: string): Promise<OperationalRenewalRecord | null> => {
    const settings = await operationalRenewalService.getSettings();
    const today = getBahrainTodayStr();

    try {
      const { data, error } = await supabaseClient
        .from('operational_renewals')
        .select(`*, branch:branches(code, name)`)
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        return toRenewalRecord(data, settings, today);
      }
    } catch (e) {
      console.warn('Could not fetch renewal record from Supabase:', e);
    }

    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_RENEWALS_KEY);
        if (saved) {
          const list = JSON.parse(saved);
          const found = list.find((r: any) => r.id === id);
          if (found) return toRenewalRecord(found, settings, today);
        }
      } catch {}
    }

    return null;
  },

  /**
   * Check for possible duplicates before creation
   */
  checkDuplicate: async (
    renewalType: OperationalRenewalType,
    documentNumber: string,
    entityId?: string,
    currentId?: string
  ): Promise<OperationalRenewalRecord | null> => {
    const list = await operationalRenewalService.list({ includeArchived: false });
    const cleanDoc = documentNumber.trim().toLowerCase();

    return list.find(r => {
      if (currentId && r.id === currentId) return false;
      if (r.renewalType !== renewalType) return false;
      if (r.documentNumber.trim().toLowerCase() === cleanDoc) return true;
      if (entityId && r.entityId === entityId && cleanDoc && r.documentNumber.toLowerCase().includes(cleanDoc)) return true;
      return false;
    }) || null;
  },

  /**
   * Create a new renewal record
   */
  create: async (
    input: OperationalRenewalInput,
    user?: { id?: string; name?: string; code?: string },
    skipDuplicateCheck = false
  ): Promise<OperationalRenewalRecord> => {
    if (!skipDuplicateCheck) {
      const dup = await operationalRenewalService.checkDuplicate(input.renewalType, input.documentNumber, input.entityId);
      if (dup) {
        throw new Error(`A similar active renewal already exists: ${dup.entityName} (${dup.documentNumber}).`);
      }
    }

    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `rnw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const userName = user?.name || user?.code || 'User';

    const payload = {
      id,
      renewal_type: input.renewalType,
      entity_type: input.entityType,
      entity_id: input.entityId || null,
      entity_name: input.entityName,
      document_type: input.documentType,
      document_number: input.documentNumber,
      branch_id: input.branchId || null,
      branch_name: input.branchName || null,
      issue_date: input.issueDate || null,
      expiry_date: input.expiryDate,
      renewal_status: input.renewalStatus || 'NOT_STARTED',
      priority: input.priority || null,
      responsible_user_id: input.responsibleUserId || null,
      responsible_user_name: input.responsibleUserName || null,
      notes: input.notes || null,
      is_active: input.isActive !== false,
      metadata: input.metadata || {},
      cost_center_code: input.costCenterCode || null,
      cost_center_name: input.costCenterName || null,
      estimated_cost: input.estimatedCost !== undefined
        ? input.estimatedCost
        : lookupTariff({
            renewalType: input.renewalType,
            durationMonths: input.renewalDurationMonths || (input.renewalType === 'WORK_PERMIT' ? 24 : undefined),
            entityName: input.entityName,
            documentNumber: input.documentNumber,
            branchName: input.branchName,
            documentType: input.documentType
          }).cost,
      actual_cost: input.actualCost ?? null,
      currency: input.currency || 'BHD',
      payment_status: input.paymentStatus || 'UNPAID',
      planned_payment_date: input.plannedPaymentDate || calculateDefaultPaymentDate(input.expiryDate) || null,
      paid_at: input.paidAt || null,
      payment_method: input.paymentMethod || null,
      payment_reference: input.paymentReference || null,
      created_by: userName,
      created_at: now,
      updated_by: userName,
      updated_at: now
    };

    try {
      const { error } = await supabaseClient.from('operational_renewals').insert(payload);
      if (error) console.warn('Supabase insert warning for operational_renewals:', error);
    } catch (e) {
      console.warn('Failed cloud insert for operational_renewals:', e);
    }

    const settings = await operationalRenewalService.getSettings();
    const createdRecord = toRenewalRecord(payload, settings);

    // Update LocalStorage cache
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_RENEWALS_KEY);
        const currentList: any[] = saved ? JSON.parse(saved) : [];
        const existingIdx = currentList.findIndex(r => r.id === id);
        if (existingIdx !== -1) currentList[existingIdx] = createdRecord;
        else currentList.unshift(createdRecord);
        localStorage.setItem(LOCAL_STORAGE_RENEWALS_KEY, JSON.stringify(currentList));
        window.dispatchEvent(new CustomEvent(RENEWALS_UPDATED_EVENT));
      } catch {}
    }

    // Log Activity Audit
    await operationalRenewalService.addActivity(
      id,
      'CREATED',
      `Record created: ${input.documentType} for ${input.entityName}`,
      undefined,
      undefined,
      input.renewalStatus || 'NOT_STARTED',
      user
    );

    return createdRecord;
  },

  /**
   * Update an existing renewal record
   */
  update: async (
    id: string,
    input: Partial<OperationalRenewalInput>,
    user?: { id?: string; name?: string }
  ): Promise<OperationalRenewalRecord> => {
    const existing = await operationalRenewalService.getById(id);
    if (!existing) throw new Error('Record not found');

    const now = new Date().toISOString();
    const userName = user?.name || 'User';

    const payload: any = {
      updated_by: userName,
      updated_at: now
    };

    if (input.renewalType !== undefined) payload.renewal_type = input.renewalType;
    if (input.entityType !== undefined) payload.entity_type = input.entityType;
    if (input.entityId !== undefined) payload.entity_id = input.entityId;
    if (input.entityName !== undefined) payload.entity_name = input.entityName;
    if (input.documentType !== undefined) payload.document_type = input.documentType;
    if (input.documentNumber !== undefined) payload.document_number = input.documentNumber;
    if (input.branchId !== undefined) payload.branch_id = input.branchId;
    if (input.branchName !== undefined) payload.branch_name = input.branchName;
    if (input.issueDate !== undefined) payload.issue_date = input.issueDate;
    if (input.expiryDate !== undefined) payload.expiry_date = input.expiryDate;
    if (input.renewalStatus !== undefined) payload.renewal_status = input.renewalStatus;
    if (input.priority !== undefined) payload.priority = input.priority;
    if (input.responsibleUserId !== undefined) payload.responsible_user_id = input.responsibleUserId;
    if (input.responsibleUserName !== undefined) payload.responsible_user_name = input.responsibleUserName;
    if (input.notes !== undefined) payload.notes = input.notes;
    if (input.isActive !== undefined) payload.is_active = input.isActive;
    if (input.metadata !== undefined) payload.metadata = { ...existing.metadata, ...input.metadata };

    // Financial & Cost Center update
    if (input.costCenterCode !== undefined) payload.cost_center_code = input.costCenterCode;
    if (input.costCenterName !== undefined) payload.cost_center_name = input.costCenterName;
    if (input.estimatedCost !== undefined) payload.estimated_cost = input.estimatedCost;
    if (input.actualCost !== undefined) payload.actual_cost = input.actualCost;
    if (input.currency !== undefined) payload.currency = input.currency;
    if (input.paymentStatus !== undefined) payload.payment_status = input.paymentStatus;
    if (input.plannedPaymentDate !== undefined) payload.planned_payment_date = input.plannedPaymentDate;
    if (input.paidAt !== undefined) payload.paid_at = input.paidAt;
    if (input.paymentMethod !== undefined) payload.payment_method = input.paymentMethod;
    if (input.paymentReference !== undefined) payload.payment_reference = input.paymentReference;
    if (input.renewalDurationMonths !== undefined) payload.renewal_duration_months = input.renewalDurationMonths;

    // If expiryDate was changed, synchronize upstream to master entity
    if (input.expiryDate && input.expiryDate !== existing.expiryDate) {
      await syncRenewalToMasterEntity(
        existing,
        input.expiryDate,
        input.documentNumber,
        input.notes
      );
    }

    try {
      await supabaseClient.from('operational_renewals').update(payload).eq('id', id);
    } catch (e) {
      console.warn('Failed cloud update for operational_renewals:', e);
    }

    const settings = await operationalRenewalService.getSettings();
    const mergedRecord = toRenewalRecord({ ...existing, ...payload }, settings);

    // Update LocalStorage cache
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_RENEWALS_KEY);
        if (saved) {
          const currentList: any[] = JSON.parse(saved);
          const idx = currentList.findIndex(r => r.id === id);
          if (idx !== -1) {
            currentList[idx] = mergedRecord;
            localStorage.setItem(LOCAL_STORAGE_RENEWALS_KEY, JSON.stringify(currentList));
            window.dispatchEvent(new CustomEvent(RENEWALS_UPDATED_EVENT));
          }
        }
      } catch {}
    }

    // Log Activity Audit
    await operationalRenewalService.addActivity(
      id,
      'UPDATED',
      `Record updated by ${userName}`,
      undefined,
      undefined,
      undefined,
      user
    );

    return mergedRecord;
  },

  /**
   * Start Renewal action: sets renewal_status = 'IN_PROGRESS'
   */
  startRenewal: async (
    id: string,
    user?: { id?: string; name?: string },
    notes?: string
  ): Promise<OperationalRenewalRecord> => {
    const existing = await operationalRenewalService.getById(id);
    if (!existing) throw new Error('Record not found');

    const userName = user?.name || 'User';
    const updated = await operationalRenewalService.update(
      id,
      {
        renewalStatus: 'IN_PROGRESS',
        notes: notes ? `${existing.notes ? existing.notes + '\n' : ''}[${getBahrainTodayStr()}] ${notes}` : existing.notes
      },
      user
    );

    await operationalRenewalService.addActivity(
      id,
      'RENEWAL_STARTED',
      `${userName} started renewal on ${getBahrainTodayStr()}${notes ? `: ${notes}` : ''}`,
      'renewal_status',
      existing.renewalStatus,
      'IN_PROGRESS',
      user
    );

    return updated;
  },

  /**
   * Change workflow status
   */
  updateWorkflowStatus: async (
    id: string,
    newStatus: RenewalWorkflowStatus,
    user?: { id?: string; name?: string },
    notes?: string
  ): Promise<OperationalRenewalRecord> => {
    const existing = await operationalRenewalService.getById(id);
    if (!existing) throw new Error('Record not found');

    const updated = await operationalRenewalService.update(
      id,
      { renewalStatus: newStatus },
      user
    );

    await operationalRenewalService.addActivity(
      id,
      'STATUS_CHANGED',
      `Renewal status changed to ${newStatus}${notes ? ` (${notes})` : ''}`,
      'renewal_status',
      existing.renewalStatus,
      newStatus,
      user
    );

    return updated;
  },

  /**
   * Mark as Renewed (Complete Renewal):
   * 1. Preserves old expiry date and details into operational_renewal_history table
   * 2. Updates active record with new expiry date, issue date, and document number
   * 3. Sets renewal status to 'RENEWED'
   * 4. Logs activity
   */
  completeRenewal: async (
    id: string,
    payload: {
      newExpiryDate: string;
      newIssueDate?: string;
      newDocumentNumber?: string;
      notes?: string;
      attachmentUrl?: string;
      settlePayment?: boolean;
      actualCost?: number;
      paidAt?: string;
      paymentMethod?: string;
      paymentReference?: string;
      renewalDurationMonths?: number;
    },
    user?: { id?: string; name?: string }
  ): Promise<OperationalRenewalRecord> => {
    const existing = await operationalRenewalService.getById(id);
    if (!existing) throw new Error('Record not found');

    const userName = user?.name || 'User';
    const now = new Date().toISOString();
    const historyId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `hist-${Date.now()}`;

    const isPaymentSettled = payload.settlePayment || payload.actualCost !== undefined;
    const paymentAmount = payload.actualCost !== undefined ? payload.actualCost : (existing.estimatedCost || 0);
    const paymentDate = payload.paidAt || getBahrainTodayStr();

    // Construct enriched notes if payment is recorded
    let finalNotes = payload.notes || '';
    if (isPaymentSettled) {
      const paymentSummary = `[PAID: ${paymentAmount.toFixed(3)} BHD on ${paymentDate}${payload.paymentMethod ? ` via ${payload.paymentMethod}` : ''}${payload.paymentReference ? ` (Ref: ${payload.paymentReference})` : ''}]`;
      finalNotes = finalNotes ? `${paymentSummary} ${finalNotes}` : paymentSummary;
    }

    // 1. Insert History Entry
    const historyEntry: OperationalRenewalHistory = {
      id: historyId,
      renewalId: id,
      entityName: existing.entityName,
      renewalType: existing.renewalType,
      previousExpiryDate: existing.expiryDate,
      newExpiryDate: payload.newExpiryDate,
      previousDocumentNumber: existing.documentNumber,
      newDocumentNumber: payload.newDocumentNumber || existing.documentNumber,
      action: 'RENEWED',
      performedBy: userName,
      performedAt: now,
      cost: isPaymentSettled ? paymentAmount : undefined,
      paidAt: isPaymentSettled ? paymentDate : undefined,
      paymentMethod: payload.paymentMethod,
      paymentReference: payload.paymentReference,
      notes: finalNotes || 'Renewal completed successfully',
      attachmentUrl: payload.attachmentUrl
    };

    try {
      await supabaseClient.from('operational_renewal_history').insert({
        id: historyEntry.id,
        renewal_id: id,
        previous_expiry_date: historyEntry.previousExpiryDate,
        new_expiry_date: historyEntry.newExpiryDate,
        previous_document_number: historyEntry.previousDocumentNumber,
        new_document_number: historyEntry.newDocumentNumber,
        action: historyEntry.action,
        performed_by: historyEntry.performedBy,
        performed_at: historyEntry.performedAt,
        notes: historyEntry.notes,
        attachment_url: historyEntry.attachmentUrl
      });
    } catch (e) {
      console.warn('Could not save history to Supabase:', e);
    }

    if (typeof window !== 'undefined') {
      try {
        const savedHist = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
        const list: any[] = savedHist ? JSON.parse(savedHist) : [];
        list.unshift(historyEntry);
        localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(list));
      } catch {}
    }

    // 2. Synchronize to Upstream Master Entity (HR Employee, CR, or Vehicle)
    await syncRenewalToMasterEntity(
      existing,
      payload.newExpiryDate,
      payload.newDocumentNumber,
      payload.notes
    );

    // 3. Update active record with new expiry date and payment settlement if applicable
    const updateInput: Partial<OperationalRenewalInput> = {
      expiryDate: payload.newExpiryDate,
      issueDate: payload.newIssueDate || existing.issueDate,
      documentNumber: payload.newDocumentNumber || existing.documentNumber,
      renewalStatus: 'RENEWED',
      notes: payload.notes ? `[Renewed ${getBahrainTodayStr()}] ${payload.notes}\n${existing.notes || ''}` : existing.notes,
      metadata: {
        ...(existing.metadata || {}),
        durationMonths: payload.renewalDurationMonths,
        renewalDurationMonths: payload.renewalDurationMonths
      }
    };

    if (payload.renewalDurationMonths !== undefined) {
      updateInput.renewalDurationMonths = payload.renewalDurationMonths;
      // If estimatedCost wasn't manually overridden, recalculate with the new duration tariff
      if (!existing.metadata?.manualCostOverride) {
        const durTariff = lookupTariff({
          renewalType: existing.renewalType,
          durationMonths: payload.renewalDurationMonths,
          entityName: existing.entityName,
          documentNumber: existing.documentNumber
        });
        updateInput.estimatedCost = durTariff.cost;
      }
    }

    if (isPaymentSettled) {
      updateInput.paymentStatus = 'PAID';
      updateInput.actualCost = paymentAmount;
      updateInput.paidAt = paymentDate;
      if (payload.paymentMethod) updateInput.paymentMethod = payload.paymentMethod as OperationalRenewalInput['paymentMethod'];
      if (payload.paymentReference) updateInput.paymentReference = payload.paymentReference;
    }

    const updated = await operationalRenewalService.update(
      id,
      updateInput as OperationalRenewalInput,
      user
    );

    // 3. Log Activity
    await operationalRenewalService.addActivity(
      id,
      'RENEWED',
      `Renewal marked completed by ${userName}. Expiry extended from ${existing.expiryDate} to ${payload.newExpiryDate}${isPaymentSettled ? ` with payment of ${paymentAmount.toFixed(3)} BHD settled` : ''}`,
      'expiry_date',
      existing.expiryDate,
      payload.newExpiryDate,
      user
    );

    return updated;
  },

  /**
   * Soft delete / archive
   */
  archive: async (id: string, user?: { id?: string; name?: string }): Promise<boolean> => {
    await operationalRenewalService.update(id, { isActive: false }, user);
    await operationalRenewalService.addActivity(id, 'ARCHIVED', `Record archived by ${user?.name || 'User'}`, undefined, undefined, undefined, user);
    return true;
  },

  /**
   * Restore archived record
   */
  restore: async (id: string, user?: { id?: string; name?: string }): Promise<boolean> => {
    await operationalRenewalService.update(id, { isActive: true }, user);
    await operationalRenewalService.addActivity(id, 'RESTORED', `Record restored by ${user?.name || 'User'}`, undefined, undefined, undefined, user);
    return true;
  },

  /**
   * Renewal History for single record
   */
  listHistory: async (renewalId: string): Promise<OperationalRenewalHistory[]> => {
    try {
      const { data, error } = await supabaseClient
        .from('operational_renewal_history')
        .select('*')
        .eq('renewal_id', renewalId)
        .order('performed_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        return data.map((r: any) => ({
          id: r.id,
          renewalId: r.renewal_id,
          previousExpiryDate: r.previous_expiry_date,
          newExpiryDate: r.new_expiry_date,
          previousDocumentNumber: r.previous_document_number,
          newDocumentNumber: r.new_document_number,
          action: r.action,
          performedBy: r.performed_by,
          performedAt: r.performed_at,
          notes: r.notes,
          attachmentUrl: r.attachment_url
        }));
      }
    } catch (e) {
      console.warn('Could not fetch history from cloud:', e);
    }

    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
        if (saved) {
          const list = JSON.parse(saved);
          return list.filter((h: any) => h.renewalId === renewalId);
        }
      } catch {}
    }

    return [];
  },

  /**
   * Global Renewal & Payment History Ledger
   */
  listAllHistory: async (): Promise<OperationalRenewalHistory[]> => {
    let cloudHistory: OperationalRenewalHistory[] = [];
    try {
      const { data, error } = await supabaseClient
        .from('operational_renewal_history')
        .select('*')
        .order('performed_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        cloudHistory = data.map((r: any) => ({
          id: r.id,
          renewalId: r.renewal_id,
          previousExpiryDate: r.previous_expiry_date,
          newExpiryDate: r.new_expiry_date,
          previousDocumentNumber: r.previous_document_number,
          newDocumentNumber: r.new_document_number,
          action: r.action,
          performedBy: r.performed_by,
          performedAt: r.performed_at,
          notes: r.notes,
          attachmentUrl: r.attachment_url
        }));
      }
    } catch (e) {
      console.warn('Could not fetch global history from cloud:', e);
    }

    let localHistory: OperationalRenewalHistory[] = [];
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
        if (saved) {
          localHistory = JSON.parse(saved);
        }
      } catch {}
    }

    const map = new Map<string, OperationalRenewalHistory>();
    // Put local first
    localHistory.forEach(h => map.set(h.id, h));
    // Merge cloud entries
    cloudHistory.forEach(h => {
      const existing = map.get(h.id);
      map.set(h.id, { ...existing, ...h });
    });

    const combined = Array.from(map.values()).sort(
      (a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime()
    );

    // Extract payment details from notes if [PAID: ...] exists
    return combined.map(h => {
      if (h.cost === undefined && h.notes && h.notes.includes('[PAID:')) {
        const match = h.notes.match(/\[PAID:\s*([\d.]+)\s*BHD\s*(?:on\s*([\d-]+))?(?:\s*via\s*([^(\]]+))?(?:\s*\(Ref:\s*([^)]+)\))?\]/i);
        if (match) {
          return {
            ...h,
            cost: parseFloat(match[1]) || 0,
            paidAt: match[2] || h.performedAt?.split('T')[0],
            paymentMethod: match[3]?.trim(),
            paymentReference: match[4]?.trim()
          };
        }
      }
      return h;
    });
  },

  /**
   * List Archived Records (Soft-deleted)
   */
  listArchived: async (): Promise<OperationalRenewalRecord[]> => {
    const all = await operationalRenewalService.list({ includeArchived: true });
    return all.filter(r => !r.isActive);
  },

  /**
   * Attachments
   */
  listAttachments: async (renewalId: string): Promise<OperationalRenewalAttachment[]> => {
    try {
      const { data, error } = await supabaseClient
        .from('operational_renewal_attachments')
        .select('*')
        .eq('renewal_id', renewalId)
        .order('uploaded_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        return data.map((a: any) => ({
          id: a.id,
          renewalId: a.renewal_id,
          fileName: a.file_name,
          fileType: a.file_type,
          fileSize: Number(a.file_size || 0),
          fileUrl: a.file_url,
          uploadedBy: a.uploaded_by,
          uploadedAt: a.uploaded_at,
          notes: a.notes
        }));
      }
    } catch (e) {
      console.warn('Could not fetch attachments from cloud:', e);
    }

    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_ATTACHMENTS_KEY);
        if (saved) {
          const list = JSON.parse(saved);
          return list.filter((a: any) => a.renewalId === renewalId);
        }
      } catch {}
    }

    return [];
  },

  uploadAttachment: async (
    renewalId: string,
    file: File,
    user?: { id?: string; name?: string },
    notes?: string
  ): Promise<OperationalRenewalAttachment> => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `att-${Date.now()}`;
    const now = new Date().toISOString();
    const userName = user?.name || 'User';
    let fileUrl = '';

    // Attempt Supabase storage upload
    try {
      const ext = file.name.split('.').pop() || 'pdf';
      const path = `renewals/${renewalId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { error: uploadErr } = await supabaseClient.storage
        .from('expense-receipts')
        .upload(path, file, { upsert: true });

      if (!uploadErr) {
        const { data: urlData } = supabaseClient.storage
          .from('expense-receipts')
          .getPublicUrl(path);
        fileUrl = urlData.publicUrl;
      }
    } catch (e) {
      console.warn('Could not upload file to storage, using base64 fallback:', e);
    }

    // Fallback to data URL
    if (!fileUrl) {
      fileUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
    }

    const attachment: OperationalRenewalAttachment = {
      id,
      renewalId,
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size,
      fileUrl,
      uploadedBy: userName,
      uploadedAt: now,
      notes
    };

    try {
      await supabaseClient.from('operational_renewal_attachments').insert({
        id,
        renewal_id: renewalId,
        file_name: attachment.fileName,
        file_type: attachment.fileType,
        file_size: attachment.fileSize,
        file_url: attachment.fileUrl,
        uploaded_by: attachment.uploadedBy,
        uploaded_at: attachment.uploadedAt,
        notes: attachment.notes
      });
    } catch (e) {
      console.warn('Failed cloud attachment insert:', e);
    }

    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_ATTACHMENTS_KEY);
        const list: any[] = saved ? JSON.parse(saved) : [];
        list.unshift(attachment);
        localStorage.setItem(LOCAL_STORAGE_ATTACHMENTS_KEY, JSON.stringify(list));
      } catch {}
    }

    await operationalRenewalService.addActivity(
      renewalId,
      'DOCUMENT_UPLOADED',
      `Document uploaded: ${file.name}`,
      undefined,
      undefined,
      undefined,
      user
    );

    return attachment;
  },

  /**
   * Activities / Audit Trail
   */
  listActivities: async (renewalId: string): Promise<OperationalRenewalActivity[]> => {
    try {
      const { data, error } = await supabaseClient
        .from('operational_renewal_activities')
        .select('*')
        .eq('renewal_id', renewalId)
        .order('performed_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        return data.map((a: any) => ({
          id: a.id,
          renewalId: a.renewal_id,
          action: a.action,
          fieldName: a.field_name,
          previousValue: a.previous_value,
          newValue: a.new_value,
          performedBy: a.performed_by,
          performedAt: a.performed_at,
          notes: a.notes
        }));
      }
    } catch (e) {
      console.warn('Could not fetch activities from cloud:', e);
    }

    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_ACTIVITIES_KEY);
        if (saved) {
          const list = JSON.parse(saved);
          return list.filter((a: any) => a.renewalId === renewalId);
        }
      } catch {}
    }

    return [];
  },

  addActivity: async (
    renewalId: string,
    action: string,
    notes?: string,
    fieldName?: string,
    previousValue?: string,
    newValue?: string,
    user?: { id?: string; name?: string }
  ): Promise<OperationalRenewalActivity> => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `act-${Date.now()}`;
    const now = new Date().toISOString();
    const userName = user?.name || 'User';

    const activity: OperationalRenewalActivity = {
      id,
      renewalId,
      action,
      fieldName,
      previousValue,
      newValue,
      performedBy: userName,
      performedAt: now,
      notes
    };

    try {
      await supabaseClient.from('operational_renewal_activities').insert({
        id,
        renewal_id: renewalId,
        action,
        field_name: fieldName || null,
        previous_value: previousValue || null,
        new_value: newValue || null,
        performed_by: userName,
        performed_at: now,
        notes: notes || null
      });
    } catch (e) {
      console.warn('Failed cloud activity insert:', e);
    }

    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_ACTIVITIES_KEY);
        const list: any[] = saved ? JSON.parse(saved) : [];
        list.unshift(activity);
        localStorage.setItem(LOCAL_STORAGE_ACTIVITIES_KEY, JSON.stringify(list));
      } catch {}
    }

    return activity;
  },

  /**
   * Directly synchronize compliance dates updated from Employee Card (Workforce Directory)
   * to Expiries & Compliance Control (operational_renewals), ensuring 100% bidirectional sync.
   */
  syncEmployeeCompliance: async (
    emp: Employee,
    options?: {
      wpDurationMonths?: number;
      notes?: string;
      user?: { id?: string; name?: string };
    }
  ): Promise<void> => {
    const today = getBahrainTodayStr();
    const wpDate = emp.wp_expiry_date || emp.salary_matrix?.wpExpiryDate || emp.salary_matrix?.visaExpiryDate;
    const ppDate = emp.passport_expiry_date || emp.salary_matrix?.expatPpExpiryDate || emp.salary_matrix?.ppExpiryDate;
    const ppNo = emp.passport_number || emp.salary_matrix?.expatPp;
    const nhraExp = emp.salary_matrix?.nhraExpiryDate;
    const nhraNo = emp.salary_matrix?.nhraLicenseNo;
    const userName = options?.user?.name || 'HR Compliance Admin';

    // 1. Fetch current renewals list from local cache
    let existingList: any[] = [];
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_RENEWALS_KEY);
        if (saved) {
          existingList = JSON.parse(saved);
        }
      } catch {}
    }

    const wpNo = emp.cpr_number ? `WP-${emp.cpr_number}` : `WP-${emp.code}`;
    const now = new Date().toISOString();

    // Match WORK_PERMIT record
    const wpRecord = existingList.find((r: any) => {
      const rType = r.renewal_type || r.renewalType;
      if (rType !== 'WORK_PERMIT') return false;
      const rEntId = r.entity_id || r.entityId;
      const rDoc = (r.document_number || r.documentNumber || '').trim().toLowerCase();
      const rMetaEmpId = r.metadata?.employeeId;
      return (
        rEntId === emp.id ||
        rEntId === emp.code ||
        rMetaEmpId === emp.id ||
        rDoc === wpNo.toLowerCase() ||
        (emp.cpr_number && rDoc.includes(emp.cpr_number.toLowerCase()))
      );
    });

    if (wpRecord && wpDate) {
      const prevExp = wpRecord.expiry_date || wpRecord.expiryDate;
      const duration = options?.wpDurationMonths || wpRecord.renewal_duration_months || wpRecord.renewalDurationMonths || 12;
      const tariff = lookupTariff({
        renewalType: 'WORK_PERMIT',
        durationMonths: duration,
        entityName: emp.full_name,
        documentNumber: wpRecord.document_number || wpNo
      });

      wpRecord.expiry_date = wpDate;
      wpRecord.expiryDate = wpDate;
      wpRecord.renewal_duration_months = duration;
      wpRecord.renewalDurationMonths = duration;
      wpRecord.estimated_cost = tariff.cost;
      wpRecord.estimatedCost = tariff.cost;
      wpRecord.renewal_status = 'RENEWED';
      wpRecord.renewalStatus = 'RENEWED';
      wpRecord.updated_at = now;
      wpRecord.updatedAt = now;
      wpRecord.notes = `[Updated via Quick Compliance Editor: ${today}] WP Expiry: ${wpDate} (${duration}M tier).\n${wpRecord.notes || ''}`;

      // Insert history if date changed
      if (prevExp && prevExp !== wpDate) {
        const historyId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `hist-${Date.now()}`;
        const historyEntry: OperationalRenewalHistory = {
          id: historyId,
          renewalId: wpRecord.id,
          previousExpiryDate: prevExp,
          newExpiryDate: wpDate,
          previousDocumentNumber: wpRecord.document_number || wpNo,
          newDocumentNumber: wpRecord.document_number || wpNo,
          action: 'RENEWED',
          performedBy: userName,
          performedAt: now,
          notes: options?.notes || `Quick compliance update: Work permit extended to ${wpDate}`
        };
        try {
          await supabaseClient.from('operational_renewal_history').insert({
            id: historyEntry.id,
            renewal_id: wpRecord.id,
            previous_expiry_date: prevExp,
            new_expiry_date: wpDate,
            previous_document_number: wpRecord.document_number || wpNo,
            new_document_number: wpRecord.document_number || wpNo,
            action: 'RENEWED',
            performed_by: userName,
            performed_at: now,
            notes: historyEntry.notes
          });
        } catch {}

        if (typeof window !== 'undefined') {
          try {
            const savedHist = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
            const histList: any[] = savedHist ? JSON.parse(savedHist) : [];
            histList.unshift(historyEntry);
            localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(histList));
          } catch {}
        }
      }

      try {
        await supabaseClient.from('operational_renewals').update({
          expiry_date: wpDate,
          renewal_duration_months: duration,
          estimated_cost: tariff.cost,
          renewal_status: 'RENEWED',
          notes: wpRecord.notes,
          updated_at: now,
          updated_by: userName
        }).eq('id', wpRecord.id);
      } catch {}
    }

    // Match OTHER (Passport) record
    if (ppDate) {
      const ppRecord = existingList.find((r: any) => {
        const rType = r.renewal_type || r.renewalType;
        if (rType !== 'OTHER') return false;
        const rEntId = r.entity_id || r.entityId;
        const rMetaEmpId = r.metadata?.employeeId;
        const rDocType = (r.document_type || r.documentType || '').toLowerCase();
        return (rEntId === emp.id || rEntId === emp.code || rMetaEmpId === emp.id) && rDocType.includes('passport');
      });

      if (ppRecord) {
        ppRecord.expiry_date = ppDate;
        ppRecord.expiryDate = ppDate;
        if (ppNo) {
          ppRecord.document_number = ppNo;
          ppRecord.documentNumber = ppNo;
        }
        ppRecord.updated_at = now;
        try {
          await supabaseClient.from('operational_renewals').update({
            expiry_date: ppDate,
            ...(ppNo ? { document_number: ppNo } : {}),
            updated_at: now
          }).eq('id', ppRecord.id);
        } catch {}
      }
    }

    // Match NHRA_PHARMACIST record
    if (nhraExp) {
      const nhraRecord = existingList.find((r: any) => {
        const rType = r.renewal_type || r.renewalType;
        if (rType !== 'NHRA_PHARMACIST' && rType !== 'NHRA') return false;
        const rEntId = r.entity_id || r.entityId;
        const rMetaEmpId = r.metadata?.employeeId;
        return (rEntId === emp.id || rEntId === emp.code || rMetaEmpId === emp.id);
      });

      if (nhraRecord) {
        nhraRecord.expiry_date = nhraExp;
        nhraRecord.expiryDate = nhraExp;
        if (nhraNo) {
          nhraRecord.document_number = nhraNo;
          nhraRecord.documentNumber = nhraNo;
        }
        nhraRecord.updated_at = now;
        try {
          await supabaseClient.from('operational_renewals').update({
            expiry_date: nhraExp,
            ...(nhraNo ? { document_number: nhraNo } : {}),
            updated_at: now
          }).eq('id', nhraRecord.id);
        } catch {}
      }
    }

    // Save cache and run full master data sync to recalculate KPI counters & feed stats
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_RENEWALS_KEY, JSON.stringify(existingList));
      } catch {}
    }

    await operationalRenewalService.syncMasterData();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(RENEWALS_UPDATED_EVENT));
      window.dispatchEvent(new CustomEvent('tabarak_workforce_updated'));
    }
  },

  /**
   * Calculate KPIs and Distribution summary
   */
  getDashboardKpis: async (): Promise<OperationalRenewalKpis> => {
    const all = await operationalRenewalService.list({ includeArchived: false });

    const totalActive = all.length;
    const criticalCount = all.filter(r => r.severity === 'CRITICAL').length;
    const expiredCount = all.filter(r => r.severity === 'EXPIRED').length;
    const expiringSoonCount = all.filter(r => r.daysRemaining >= 0 && r.daysRemaining <= 30).length;
    const renewalInProgressCount = all.filter(r => r.renewalStatus === 'IN_PROGRESS' || r.renewalStatus === 'PLANNED' || r.renewalStatus === 'SUBMITTED' || r.renewalStatus === 'AWAITING_APPROVAL').length;
    const renewedCount = all.filter(r => r.renewalStatus === 'RENEWED').length;

    const distribution: Record<AlertSeverity, number> = {
      EXPIRED: expiredCount,
      CRITICAL: criticalCount,
      URGENT: all.filter(r => r.severity === 'URGENT').length,
      WARNING: all.filter(r => r.severity === 'WARNING').length,
      UPCOMING: all.filter(r => r.severity === 'UPCOMING').length,
      NORMAL: all.filter(r => r.severity === 'NORMAL').length
    };

    return {
      totalActive,
      criticalCount,
      expiredCount,
      expiringSoonCount,
      renewalInProgressCount,
      renewedCount,
      distribution
    };
  },

  /**
   * Calculate Payment Plan & Budget Summary
   */
  getBudgetSummary: (records: OperationalRenewalRecord[], targetYear?: number): RenewalBudgetSummary => {
    let totalEstimatedCost = 0;
    let totalPaidAmount = 0;
    let totalPendingAmount = 0;
    let dueIn30Days = 0;
    let dueIn60Days = 0;
    let dueIn90Days = 0;

    const monthlyMap = new Map<string, { monthKey: string; monthLabel: string; year: number; month: number; renewalCount: number; estimatedTotal: number; paidTotal: number; pendingTotal: number }>();

    const costCenterMap = new Map<string, { costCenterCode: string; costCenterName: string; type: RenewalCostCenterType; renewalCount: number; estimatedTotal: number; paidTotal: number; pendingTotal: number }>();

    for (const r of records) {
      if (!r.isActive) continue;

      const est = Number(r.estimatedCost || 0);
      const paid = Number(r.actualCost !== undefined && r.actualCost !== null ? r.actualCost : (r.paymentStatus === 'PAID' ? est : 0));
      const isPaid = r.paymentStatus === 'PAID';
      const isWaived = r.paymentStatus === 'WAIVED';
      const pending = isPaid || isWaived ? 0 : est;

      totalEstimatedCost += est;
      totalPaidAmount += paid;
      totalPendingAmount += pending;

      // Calculate cash required in 30 / 60 / 90 days for unpaid items
      if (!isPaid && !isWaived) {
        if (r.daysRemaining >= 0 && r.daysRemaining <= 30) {
          dueIn30Days += est;
        }
        if (r.daysRemaining >= 0 && r.daysRemaining <= 60) {
          dueIn60Days += est;
        }
        if (r.daysRemaining >= 0 && r.daysRemaining <= 90) {
          dueIn90Days += est;
        }
      }

      // Group by planned payment date or expiry date
      const dateForTimeline = r.plannedPaymentDate || r.expiryDate;
      if (dateForTimeline) {
        const parts = dateForTimeline.split('-');
        if (parts.length >= 2) {
          const yr = parseInt(parts[0], 10);
          const mo = parseInt(parts[1], 10);
          const mKey = `${yr}-${String(mo).padStart(2, '0')}`;

          if (!monthlyMap.has(mKey)) {
            const dateObj = new Date(yr, mo - 1, 1);
            const mLabel = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            monthlyMap.set(mKey, {
              monthKey: mKey,
              monthLabel: mLabel,
              year: yr,
              month: mo,
              renewalCount: 0,
              estimatedTotal: 0,
              paidTotal: 0,
              pendingTotal: 0
            });
          }

          const mGroup = monthlyMap.get(mKey)!;
          mGroup.renewalCount += 1;
          mGroup.estimatedTotal += est;
          mGroup.paidTotal += paid;
          mGroup.pendingTotal += pending;
        }
      }

      // Group by Cost Center
      const ccCode = r.costCenterCode || 'CC-GEN-OPS';
      const ccName = r.costCenterName || 'General Operations';
      const ccType: RenewalCostCenterType = ccCode.startsWith('CC-T') || ccCode.startsWith('CC-H') || ccCode.startsWith('CC-S') || ccCode.startsWith('CC-D')
        ? 'BRANCH'
        : ccCode.includes('HQ')
        ? 'HOLDING'
        : ccCode.includes('NHRA') || ccCode.includes('CR') || ccCode.includes('LMRA')
        ? 'REGULATORY'
        : 'DEPARTMENT';

      if (!costCenterMap.has(ccCode)) {
        costCenterMap.set(ccCode, {
          costCenterCode: ccCode,
          costCenterName: ccName,
          type: ccType,
          renewalCount: 0,
          estimatedTotal: 0,
          paidTotal: 0,
          pendingTotal: 0
        });
      }

      const ccGroup = costCenterMap.get(ccCode)!;
      ccGroup.renewalCount += 1;
      ccGroup.estimatedTotal += est;
      ccGroup.paidTotal += paid;
      ccGroup.pendingTotal += pending;
    }

    const monthlyBreakdown: RenewalMonthlyBudget[] = Array.from(monthlyMap.values())
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    const costCenterBreakdown: RenewalCostCenterBudget[] = Array.from(costCenterMap.values())
      .map(c => ({
        ...c,
        paymentCompletionPercentage: c.estimatedTotal > 0 ? Math.round((c.paidTotal / c.estimatedTotal) * 100) : 0
      }))
      .sort((a, b) => b.estimatedTotal - a.estimatedTotal);

    return {
      totalRenewals: records.filter(r => r.isActive).length,
      totalEstimatedCost: Math.round(totalEstimatedCost * 1000) / 1000,
      totalPaidAmount: Math.round(totalPaidAmount * 1000) / 1000,
      totalPendingAmount: Math.round(totalPendingAmount * 1000) / 1000,
      dueIn30Days: Math.round(dueIn30Days * 1000) / 1000,
      dueIn60Days: Math.round(dueIn60Days * 1000) / 1000,
      dueIn90Days: Math.round(dueIn90Days * 1000) / 1000,
      monthlyBreakdown,
      costCenterBreakdown
    };
  },


  /**
   * List all available Cost Centers (Branches, Holding, and Functional Departments)
   */
  listCostCenters: async (): Promise<RenewalCostCenter[]> => {
    const branches = await branchService.list().catch(() => []);
    const costCenters: RenewalCostCenter[] = [];

    // 1. Group Master Holding
    costCenters.push({
      id: 'cc-hq-grp',
      code: 'CC-HQ-GRP',
      name: 'Tabarak Group Holding (HQ)',
      type: 'HOLDING',
      isActive: true
    });

    // 2. Regulatory & Functional Cost Centers
    costCenters.push(
      {
        id: 'cc-cr-moic',
        code: 'CC-CR-MOIC',
        name: 'Commercial Registrations (MOIC)',
        type: 'REGULATORY',
        isActive: true
      },
      {
        id: 'cc-nhra-facility',
        code: 'CC-NHRA-FACILITY',
        name: 'NHRA Pharmacy Facilities',
        type: 'REGULATORY',
        isActive: true
      },
      {
        id: 'cc-nhra-stf',
        code: 'CC-NHRA-STF',
        name: 'NHRA Healthcare Staff Licenses',
        type: 'REGULATORY',
        isActive: true
      },
      {
        id: 'cc-lmra-wp',
        code: 'CC-LMRA-WP',
        name: 'LMRA Work Permits & Expat Visas',
        type: 'REGULATORY',
        isActive: true
      },
      {
        id: 'cc-fleet-log',
        code: 'CC-FLEET-LOG',
        name: 'Fleet Vehicles & Logistics',
        type: 'DEPARTMENT',
        isActive: true
      },
      {
        id: 'cc-gen-ops',
        code: 'CC-GEN-OPS',
        name: 'General Operations & Compliance',
        type: 'DEPARTMENT',
        isActive: true
      }
    );

    // 3. Branch Cost Centers
    branches.forEach(b => {
      const code = b.code || b.name.match(/\(([A-Z]\d{3})\)/i)?.[1] || b.id.slice(0, 4);
      costCenters.push({
        id: `cc-${b.id}`,
        code: `CC-${code.toUpperCase()}`,
        name: b.name,
        type: 'BRANCH',
        branchId: b.id,
        branchCode: b.code,
        isActive: (b as any).isActive !== false
      });
    });

    return costCenters;
  },

  /**
   * Tariff & Cost Configuration Methods
   */
  getTariffsSync,
  lookupTariff,

  listTariffs: async (): Promise<RenewalTariffRule[]> => {
    return getTariffsSync();
  },

  saveTariff: async (
    rule: RenewalTariffRule,
    user?: { id?: string; name?: string }
  ): Promise<RenewalTariffRule> => {
    const list = getTariffsSync();
    const now = new Date().toISOString();
    const updatedRule: RenewalTariffRule = {
      ...rule,
      id: rule.id || `tariff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      updatedAt: now,
      createdAt: rule.createdAt || now
    };

    const idx = list.findIndex(t => t.id === updatedRule.id);
    let nextList: RenewalTariffRule[];
    if (idx !== -1) {
      nextList = [...list];
      nextList[idx] = updatedRule;
    } else {
      nextList = [updatedRule, ...list];
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_TARIFFS_KEY, JSON.stringify(nextList));

        // Immediately update all cached unpaid records to match new user tariff
        const rawRenewals = localStorage.getItem(LOCAL_STORAGE_RENEWALS_KEY);
        if (rawRenewals) {
          const renewalsList = JSON.parse(rawRenewals);
          if (Array.isArray(renewalsList)) {
            const updatedRenewals = renewalsList.map((r: any) => {
              if (r.payment_status === 'PAID' || r.paymentStatus === 'PAID') return r;

              const res = lookupTariff({
                renewalType: r.renewal_type || r.renewalType,
                durationMonths: r.renewal_duration_months || r.renewalDurationMonths,
                entityName: r.entity_name || r.entityName,
                documentNumber: r.document_number || r.documentNumber,
                branchCode: r.branch_id || r.branchId || r.cost_center_code || r.costCenterCode,
                branchName: r.branch_name || r.branchName,
                documentType: r.document_type || r.documentType
              });

              const isCostOverridden = Boolean(r.metadata?.manualCostOverride);
              const isDateOverridden = Boolean(r.metadata?.manualDateOverride);
              const expDate = r.expiry_date || r.expiryDate;

              let nextPlannedDate = r.planned_payment_date || r.plannedPaymentDate;
              if (!isDateOverridden && expDate) {
                if (res.targetPaymentDate) {
                  nextPlannedDate = res.targetPaymentDate;
                } else {
                  const lead = res.paymentLeadDays ?? 15;
                  nextPlannedDate = calculateDefaultPaymentDate(expDate, lead);
                }
              }

              return {
                ...r,
                estimated_cost: isCostOverridden ? (r.estimated_cost ?? r.estimatedCost) : res.cost,
                estimatedCost: isCostOverridden ? (r.estimatedCost ?? r.estimated_cost) : res.cost,
                planned_payment_date: nextPlannedDate || r.planned_payment_date,
                plannedPaymentDate: nextPlannedDate || r.plannedPaymentDate
              };
            });
            localStorage.setItem(LOCAL_STORAGE_RENEWALS_KEY, JSON.stringify(updatedRenewals));
          }
        }

        window.dispatchEvent(new Event(RENEWALS_UPDATED_EVENT));
      } catch (err) {
        console.warn('Could not save tariff to localStorage:', err);
      }
    }

    return updatedRule;
  },

  deleteTariff: async (
    id: string,
    user?: { id?: string; name?: string }
  ): Promise<void> => {
    const list = getTariffsSync();
    const nextList = list.filter(t => t.id !== id);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_TARIFFS_KEY, JSON.stringify(nextList));
        window.dispatchEvent(new Event(RENEWALS_UPDATED_EVENT));
      } catch (err) {
        console.warn('Could not delete tariff from localStorage:', err);
      }
    }
  },

  resetTariffsToDefaults: async (
    user?: { id?: string; name?: string }
  ): Promise<RenewalTariffRule[]> => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_TARIFFS_KEY, JSON.stringify(DEFAULT_TARIFF_RULES));
        window.dispatchEvent(new Event(RENEWALS_UPDATED_EVENT));
      } catch (err) {
        console.warn('Could not reset tariffs:', err);
      }
    }
    return DEFAULT_TARIFF_RULES;
  }
};
