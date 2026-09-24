import {
  CAPA_Task,
  CAPASeverity,
  NHRASection
} from '../types';
import {
  CapaAutoConfig,
  DEFAULT_CAPA_AUTO_CONFIG
} from '../config/tqphConfig';

/**
 * Tabarak Quality & Performance Hub (TQPH)
 * CAPA Service & Auto-Generation Engine (Section 5.4 & Section 8, #2, #3, #4)
 */

/**
 * Derives CAPA severity from section code based on Section 5.4:
 * Critical -> License & Approvals (1.0), Controlled Registers (7.0, 8.0)
 * Major    -> Records & Documentation (5.0), Storage (6.0)
 * Minor    -> Workplace Standards (2.0), Policies (3.0), Pricing (4.0)
 */
export function deriveCapaSeverity(
  sectionCode: string,
  config: CapaAutoConfig = DEFAULT_CAPA_AUTO_CONFIG
): CAPASeverity {
  return config.sectionSeverityMap[sectionCode] || 'Minor';
}

/**
 * Calculate CAPA due date (ISO string):
 * Defaults to locked_at + 48 hours (Section 5.4 & Section 8, #4)
 */
export function calculateCapaDueDate(
  lockedAtIso: string,
  hoursOffset: number = DEFAULT_CAPA_AUTO_CONFIG.defaultDueHours
): string {
  const baseDate = new Date(lockedAtIso);
  const dueTimestamp = baseDate.getTime() + (hoursOffset * 60 * 60 * 1000);
  return new Date(dueTimestamp).toISOString();
}

/**
 * Auto-generate CAPA tasks from an audit's checklist sections.
 * - Non-compliant items automatically generate a CAPA.
 * - Partially compliant items generate a CAPA only if requires_corrective_action is true.
 */
export function generateCapaTasksFromAudit(
  auditId: string,
  sections: NHRASection[],
  assignedToUserId: string,
  lockedAtIso: string = new Date().toISOString(),
  config: CapaAutoConfig = DEFAULT_CAPA_AUTO_CONFIG
): CAPA_Task[] {
  const tasks: CAPA_Task[] = [];
  const dueDate = calculateCapaDueDate(lockedAtIso, config.defaultDueHours);

  for (const section of sections) {
    for (const item of section.items) {
      const isNonCompliant = item.status === 'non_compliant';
      const isPartialWithAction =
        item.status === 'partially_compliant' &&
        item.requires_corrective_action === true;

      const shouldCreate =
        (isNonCompliant && config.autoGenerateOnNonCompliant) ||
        (isPartialWithAction && config.autoGenerateOnPartialRequiresAction);

      if (shouldCreate) {
        const severity = deriveCapaSeverity(section.section_code, config);
        const taskId = `capa-${auditId}-${item.code.replace('.', '-')}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

        const violationText = item.notes?.trim() || `${item.label} failed compliance standards (${item.code})`;
        const actionText = `Address and correct non-compliance for [${item.code}] ${item.label}. Provide photographic or documentary evidence.`;

        tasks.push({
          id: taskId,
          audit_id: auditId,
          element_code: item.code,
          violation: violationText,
          required_action: actionText,
          severity,
          due_date: dueDate,
          status: 'open',
          assigned_to: assignedToUserId
        });
      }
    }
  }

  return tasks;
}
