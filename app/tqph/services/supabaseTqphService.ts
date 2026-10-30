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
/** Production TQPH reads and writes must never silently use demo data. */
export class SupabaseTQPHService {
  constructor(private readonly client: typeof supabaseClient = supabaseClient) {}

  /** UI list scope; the database RLS independently protects record reads. */
  private async getVisibleBranchIds(): Promise<string[] | null> {
    const { data: authData, error: authError } = await this.client.auth.getUser();
    if (authError) throw authError;
    const userId = authData.user?.id;
    if (!userId) throw new Error('Sign in to view TQPH records.');

    const { data: profile, error: profileError } = await (this.client as any)
      .from('app_user_profiles')
      .select('role, branch_id, is_active')
      .eq('user_id', userId)
      .single();
    if (profileError) throw profileError;
    if (!profile?.is_active) throw new Error('This account is not active.');

    if (['owner', 'manager', 'admin'].includes(profile.role)) return null;
    if (profile.role === 'branch') return profile.branch_id ? [profile.branch_id] : [];
    if (profile.role !== 'supervisor') return [];

    const { data: assignments, error: scopeError } = await (this.client as any)
      .from('supervisor_branches')
      .select('branch_id')
      .eq('supervisor_user_id', userId);
    if (scopeError) throw scopeError;
    return (assignments || []).map((assignment: { branch_id: string }) => assignment.branch_id);
  }

  // ── Entities (Real Database Records) ────────────────────────
  async getBranches(): Promise<Branch[]> {
      const visibleBranchIds = await this.getVisibleBranchIds();
      if (visibleBranchIds?.length === 0) return [];
      let query = (this.client as any)
        .from('branches')
        .select('id, code, name, nhra_license_no, cr_number, branch_manager_name, region_id')
        .or('role.eq.branch,role.is.null')
        .neq('code', 'Test-01');
      if (visibleBranchIds) query = query.in('id', visibleBranchIds);
      const { data, error } = await query.order('code');

      if (error) throw error;

      return (data || []).map((b: any) => ({
        id: b.id,
        code: b.code,
        name: b.name,
        area_id: b.region_id || '',
        cr_number: b.cr_number || '',
        license_no: b.nhra_license_no || '',
        manager_name: b.branch_manager_name || ''
      }));
  }

  async getAreas(): Promise<Area[]> {
      const { data, error } = await (this.client as any)
        .from('regions')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      return (data || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        code: r.code
      }));
  }

  async getPharmacists(): Promise<User[]> {
      const visibleBranchIds = await this.getVisibleBranchIds();
      if (visibleBranchIds?.length === 0) return [];
      let query = (this.client as any)
        .from('pharmacists')
        .select('id, name, code, branch_id')
        .eq('is_active', true);
      if (visibleBranchIds) query = query.in('branch_id', visibleBranchIds);
      const { data, error } = await query.order('name');

      if (error) throw error;

      return (data || []).map((p: any) => ({
        id: p.id,
        name: `Dr. ${p.name}`,
        cpr: '',
        role: 'pharmacist' as const,
        branch_id: p.branch_id || undefined
      }));
  }

  // ── Audits ──────────────────────────────────────────────────
  async getAudits(branchId?: string): Promise<NHRA_Audit[]> {
      let query = (this.client as any).from('tqph_audits').select('*').order('date', { ascending: false });
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []) as NHRA_Audit[];
  }

  async saveAudit(audit: NHRA_Audit): Promise<void> {
    const { error } = await (this.client as any).from('tqph_audits').insert(audit);
    if (error) throw error;
  }

  // ── Appraisals ──────────────────────────────────────────────
  async getAppraisals(pharmacistId?: string): Promise<Pharmacist_Appraisal[]> {
      let query = (this.client as any)
        .from('tqph_appraisals')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (pharmacistId) {
        query = query.eq('pharmacist_id', pharmacistId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []) as Pharmacist_Appraisal[];
  }

  async saveAppraisal(appraisal: Pharmacist_Appraisal): Promise<void> {
    const { error } = await (this.client as any).from('tqph_appraisals').insert(appraisal);
    if (error) throw error;
  }

  // ── CAPA Tasks ──────────────────────────────────────────────
  async getCapaTasks(branchId?: string): Promise<CAPA_Task[]> {
      const { data, error } = await (this.client as any)
        .from('tqph_capa_tasks')
        .select('*')
        .order('due_date', { ascending: true });

      if (error) throw error;

      const tasks = (data || []) as CAPA_Task[];
      if (branchId) {
        const branchAudits = await this.getAudits(branchId);
        const branchAuditIds = new Set(branchAudits.map(a => a.id));
        return tasks.filter(t => branchAuditIds.has(t.audit_id));
      }

      return tasks;
  }

  async updateCapaTask(taskUpdate: Partial<CAPA_Task> & { id: string }): Promise<void> {
    const { error } = await (this.client as any).from('tqph_capa_tasks').update(taskUpdate).eq('id', taskUpdate.id);
    if (error) throw error;
  }

  async saveCapaTasks(tasks: CAPA_Task[]): Promise<void> {
    if (tasks.length === 0) return;
    const { error } = await (this.client as any).from('tqph_capa_tasks').insert(tasks);
    if (error) throw error;
  }

  /** Submit all three records in one database transaction. */
  async submitEvaluation(audit: NHRA_Audit, appraisal: Pharmacist_Appraisal, tasks: CAPA_Task[]): Promise<void> {
    const { error } = await (this.client as any).rpc('submit_tqph_evaluation', {
      p_audit: audit,
      p_appraisal: appraisal,
      p_capas: tasks
    });
    if (error) throw error;
  }

  // ── Distribution Logs ───────────────────────────────────────
  async saveDistributionLogs(logs: DistributionLog[]): Promise<void> {
    if (logs.length === 0) return;
    const { error } = await (this.client as any).from('tqph_distribution_logs').insert(logs);
    if (error) throw error;
  }

  async getDistributionLogs(): Promise<DistributionLog[]> {
      const { data, error } = await (this.client as any)
        .from('tqph_distribution_logs')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) throw error;

      return (data || []) as DistributionLog[];
  }

  // ── Evidence Storage ────────────────────────────────────────
  async uploadEvidenceFile(file: File, path: string): Promise<string | null> {
    if (!this.client) return null;

    try {
      const { data, error } = await (this.client as any).storage
        .from('tqph-evidence')
        .upload(path, file, { upsert: true });

      if (error) {
        console.error('Storage upload error:', error);
        return null;
      }

      const { data: signedUrlData, error: signedUrlError } = await (this.client as any).storage
        .from('tqph-evidence')
        .createSignedUrl(data.path, 60 * 60);

      if (signedUrlError) {
        console.error('Storage signed URL error:', signedUrlError);
        return null;
      }

      return signedUrlData.signedUrl;
    } catch (err) {
      console.error('Evidence upload exception:', err);
      return null;
    }
  }
}

export const supabaseTqphService = new SupabaseTQPHService();
