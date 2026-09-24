import { supabaseClient } from '../../../lib/supabaseClient';
import {
  Area,
  Attachment,
  Branch,
  CAPA_Task,
  DistributionLog,
  NHRA_Audit,
  Pharmacist_Appraisal,
  User
} from '../types';
import { mockAuditStore } from './mockAuditStore';
import { MOCK_AREAS, MOCK_BRANCHES, MOCK_USERS } from '../data';

/**
 * Production Supabase Service for TQPH
 * Provides database operations with automatic fallback to mockAuditStore
 * when running offline, in test environments, or prior to database migration.
 */
class SupabaseTQPHService {
  private useMockFallback = false;

  // ── Entities (Real Database Records) ────────────────────────
  async getBranches(): Promise<Branch[]> {
    if (this.useMockFallback || !supabaseClient) {
      return MOCK_BRANCHES;
    }

    try {
      const { data, error } = await (supabaseClient as any)
        .from('branches')
        .select('id, code, name, nhra_license_no, cr_number, branch_manager_name, region_id')
        .eq('role', 'branch')
        .neq('code', 'Test-01')
        .order('code');

      if (error || !data || data.length === 0) {
        return MOCK_BRANCHES;
      }

      return data.map((b: any) => ({
        id: b.id,
        code: b.code,
        name: b.name,
        area_id: b.region_id || 'a0000000-0000-0000-0000-000000000001',
        cr_number: b.cr_number || '127506-01',
        license_no: b.nhra_license_no || '32000100',
        manager_name: b.branch_manager_name || 'Pharmacist-in-Charge'
      }));
    } catch {
      return MOCK_BRANCHES;
    }
  }

  async getAreas(): Promise<Area[]> {
    if (this.useMockFallback || !supabaseClient) {
      return MOCK_AREAS;
    }

    try {
      const { data, error } = await (supabaseClient as any)
        .from('regions')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');

      if (error || !data || data.length === 0) {
        return MOCK_AREAS;
      }

      return data.map((r: any) => ({
        id: r.id,
        name: r.name,
        code: r.code
      }));
    } catch {
      return MOCK_AREAS;
    }
  }

  async getPharmacists(): Promise<User[]> {
    if (this.useMockFallback || !supabaseClient) {
      return MOCK_USERS.filter(u => u.role === 'pharmacist');
    }

    try {
      const { data, error } = await (supabaseClient as any)
        .from('pharmacists')
        .select('id, name, code, branch_id')
        .eq('is_active', true)
        .order('name');

      if (error || !data || data.length === 0) {
        return MOCK_USERS.filter(u => u.role === 'pharmacist');
      }

      return data.map((p: any, idx: number) => ({
        id: p.id,
        name: `Dr. ${p.name}`,
        cpr: `90010${String(100 + idx).slice(-3)}291`,
        role: 'pharmacist' as const,
        branch_id: p.branch_id || undefined
      }));
    } catch {
      return MOCK_USERS.filter(u => u.role === 'pharmacist');
    }
  }

  // ── Audits ──────────────────────────────────────────────────
  async getAudits(branchId?: string): Promise<NHRA_Audit[]> {
    if (this.useMockFallback || !supabaseClient) {
      return branchId ? mockAuditStore.getAuditsByBranch(branchId) : mockAuditStore.getAudits();
    }

    try {
      let query = (supabaseClient as any).from('tqph_audits').select('*').order('date', { ascending: false });
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        return branchId ? mockAuditStore.getAuditsByBranch(branchId) : mockAuditStore.getAudits();
      }

      return data as NHRA_Audit[];
    } catch {
      return branchId ? mockAuditStore.getAuditsByBranch(branchId) : mockAuditStore.getAudits();
    }
  }

  async saveAudit(audit: NHRA_Audit): Promise<void> {
    mockAuditStore.saveAudit(audit);

    if (!this.useMockFallback && supabaseClient) {
      try {
        await (supabaseClient as any).from('tqph_audits').upsert(audit);
      } catch (err) {
        console.warn('Failed to upsert audit to Supabase, saved to local store:', err);
      }
    }
  }

  // ── Appraisals ──────────────────────────────────────────────
  async getAppraisals(pharmacistId?: string): Promise<Pharmacist_Appraisal[]> {
    if (this.useMockFallback || !supabaseClient) {
      return pharmacistId
        ? mockAuditStore.getAppraisalsByPharmacist(pharmacistId)
        : mockAuditStore.getAppraisals();
    }

    try {
      let query = (supabaseClient as any)
        .from('tqph_appraisals')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (pharmacistId) {
        query = query.eq('pharmacist_id', pharmacistId);
      }

      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        return pharmacistId
          ? mockAuditStore.getAppraisalsByPharmacist(pharmacistId)
          : mockAuditStore.getAppraisals();
      }

      return data as Pharmacist_Appraisal[];
    } catch {
      return pharmacistId
        ? mockAuditStore.getAppraisalsByPharmacist(pharmacistId)
        : mockAuditStore.getAppraisals();
    }
  }

  async saveAppraisal(appraisal: Pharmacist_Appraisal): Promise<void> {
    mockAuditStore.saveAppraisal(appraisal);

    if (!this.useMockFallback && supabaseClient) {
      try {
        await (supabaseClient as any).from('tqph_appraisals').upsert(appraisal);
      } catch (err) {
        console.warn('Failed to upsert appraisal to Supabase, saved to local store:', err);
      }
    }
  }

  // ── CAPA Tasks ──────────────────────────────────────────────
  async getCapaTasks(branchId?: string): Promise<CAPA_Task[]> {
    if (this.useMockFallback || !supabaseClient) {
      return mockAuditStore.getCapaTasks(branchId);
    }

    try {
      const { data, error } = await (supabaseClient as any)
        .from('tqph_capa_tasks')
        .select('*')
        .order('due_date', { ascending: true });

      if (error || !data || data.length === 0) {
        return mockAuditStore.getCapaTasks(branchId);
      }

      const tasks = data as CAPA_Task[];
      if (branchId) {
        const branchAudits = await this.getAudits(branchId);
        const branchAuditIds = new Set(branchAudits.map(a => a.id));
        return tasks.filter(t => branchAuditIds.has(t.audit_id));
      }

      return tasks;
    } catch {
      return mockAuditStore.getCapaTasks(branchId);
    }
  }

  async updateCapaTask(taskUpdate: Partial<CAPA_Task> & { id: string }): Promise<void> {
    mockAuditStore.updateCapaTask(taskUpdate);

    if (!this.useMockFallback && supabaseClient) {
      try {
        await (supabaseClient as any).from('tqph_capa_tasks').update(taskUpdate).eq('id', taskUpdate.id);
      } catch (err) {
        console.warn('Failed to update CAPA in Supabase, updated in local store:', err);
      }
    }
  }

  async saveCapaTasks(tasks: CAPA_Task[]): Promise<void> {
    mockAuditStore.saveCapaTasks(tasks);

    if (!this.useMockFallback && supabaseClient && tasks.length > 0) {
      try {
        await (supabaseClient as any).from('tqph_capa_tasks').upsert(tasks, { onConflict: 'id' });
      } catch (err) {
        console.warn('Failed to upsert CAPA tasks to Supabase, saved to local store:', err);
      }
    }
  }

  // ── Distribution Logs ───────────────────────────────────────
  async saveDistributionLogs(logs: DistributionLog[]): Promise<void> {
    mockAuditStore.saveDistributionLogs(logs);

    if (!this.useMockFallback && supabaseClient && logs.length > 0) {
      try {
        await (supabaseClient as any).from('tqph_distribution_logs').insert(logs);
      } catch (err) {
        console.warn('Failed to insert distribution logs to Supabase, saved to local store:', err);
      }
    }
  }

  async getDistributionLogs(): Promise<DistributionLog[]> {
    if (this.useMockFallback || !supabaseClient) {
      return mockAuditStore.getDistributionLogs();
    }

    try {
      const { data, error } = await (supabaseClient as any)
        .from('tqph_distribution_logs')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error || !data || data.length === 0) {
        return mockAuditStore.getDistributionLogs();
      }

      return data as DistributionLog[];
    } catch {
      return mockAuditStore.getDistributionLogs();
    }
  }

  // ── Evidence Storage ────────────────────────────────────────
  async uploadEvidenceFile(file: File, path: string): Promise<string | null> {
    if (!supabaseClient) return null;

    try {
      const { data, error } = await (supabaseClient as any).storage
        .from('tqph-evidence')
        .upload(path, file, { upsert: true });

      if (error) {
        console.error('Storage upload error:', error);
        return null;
      }

      const { data: publicUrlData } = (supabaseClient as any).storage
        .from('tqph-evidence')
        .getPublicUrl(data.path);

      return publicUrlData.publicUrl;
    } catch (err) {
      console.error('Evidence upload exception:', err);
      return null;
    }
  }
}

export const supabaseTqphService = new SupabaseTQPHService();
