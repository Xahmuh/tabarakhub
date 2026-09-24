import {
  DistributionLog,
  DistributionRecipient,
  NHRA_Audit,
  Pharmacist_Appraisal
} from '../types';

/**
 * Tabarak Quality & Performance Hub (TQPH)
 * Distribution Service (Section 5.6)
 *
 * Simulates multi-portal automated document dispatch on lock:
 * 1. NHRA_Audit -> Branch Account portal
 * 2. Pharmacist_Appraisal -> Pharmacist Personal Portal
 * 3. Both records -> Executive Admin
 */

export interface DistributionResult {
  success: boolean;
  logs: DistributionLog[];
  error?: string;
}

/**
 * Executes multi-portal routing for a locked evaluation.
 * Creates auditable DistributionLog rows for all 3 portals.
 */
export async function distributeLockedEvaluation(
  audit: NHRA_Audit,
  appraisal: Pharmacist_Appraisal
): Promise<DistributionResult> {
  // Simulate network dispatch with short realistic latency
  await new Promise(resolve => setTimeout(resolve, 600));

  const timestamp = new Date().toISOString();
  const logs: DistributionLog[] = [
    // 1. Branch Account Portal
    {
      id: `dist-branch-${audit.id}-${Date.now().toString(36)}`,
      source_type: 'nhra_audit',
      source_id: audit.id,
      recipient_type: 'branch_portal',
      recipient_id: audit.branch_id,
      channel: 'in_app',
      status: 'sent',
      sent_at: timestamp
    },

    // 2. Pharmacist Personal Portal
    {
      id: `dist-ph-${appraisal.id}-${Date.now().toString(36)}`,
      source_type: 'appraisal',
      source_id: appraisal.id,
      recipient_type: 'pharmacist_portal',
      recipient_id: appraisal.pharmacist_id,
      channel: 'in_app',
      status: 'sent',
      sent_at: timestamp
    },

    // 3. Executive Admin Archive
    {
      id: `dist-admin-${audit.id}-${Date.now().toString(36)}`,
      source_type: 'nhra_audit',
      source_id: audit.id,
      recipient_type: 'executive_admin',
      recipient_id: 'usr-admin-1',
      channel: 'in_app',
      status: 'sent',
      sent_at: timestamp
    }
  ];

  return {
    success: true,
    logs
  };
}
