import {
  Attachment,
  CAPA_Task,
  DistributionLog,
  NHRA_Audit,
  Pharmacist_Appraisal
} from '../types';
import {
  MOCK_AUDITS,
  MOCK_APPRAISALS,
  MOCK_CAPA_TASKS,
  MOCK_BRANCHES,
  MOCK_USERS
} from '../data';

/**
 * Mock Storage Adapter (Section 1 & Section 7.6)
 * In-memory dataset backed by localStorage for state persistence.
 */

const STORAGE_KEYS = {
  AUDITS: 'tqph_mock_audits',
  APPRAISALS: 'tqph_mock_appraisals',
  CAPA_TASKS: 'tqph_mock_capa_tasks',
  DISTRIBUTION_LOGS: 'tqph_mock_distribution_logs',
  ATTACHMENTS: 'tqph_mock_attachments'
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && Array.isArray(fallback)) {
      const existingIds = new Set(parsed.map((item: any) => item?.id));
      const missingFromFallback = fallback.filter((item: any) => item?.id && !existingIds.has(item.id));
      if (missingFromFallback.length > 0) {
        const merged = [...parsed, ...missingFromFallback];
        saveToStorage(key, merged);
        return merged as unknown as T;
      }
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Storage quota or browser restriction fallback
  }
}

class MockAuditStore {
  private audits: NHRA_Audit[];
  private appraisals: Pharmacist_Appraisal[];
  private capas: CAPA_Task[];
  private distributionLogs: DistributionLog[];
  private attachments: Attachment[];

  constructor() {
    this.audits = loadFromStorage<NHRA_Audit[]>(STORAGE_KEYS.AUDITS, [...MOCK_AUDITS]);
    this.appraisals = loadFromStorage<Pharmacist_Appraisal[]>(STORAGE_KEYS.APPRAISALS, [...MOCK_APPRAISALS]);
    this.capas = loadFromStorage<CAPA_Task[]>(STORAGE_KEYS.CAPA_TASKS, [...MOCK_CAPA_TASKS]);
    this.distributionLogs = loadFromStorage<DistributionLog[]>(STORAGE_KEYS.DISTRIBUTION_LOGS, []);
    this.attachments = loadFromStorage<Attachment[]>(STORAGE_KEYS.ATTACHMENTS, []);
  }

  // ── Audits ──────────────────────────────────────────────

  public getAudits(): NHRA_Audit[] {
    return [...this.audits];
  }

  public getAuditById(id: string): NHRA_Audit | undefined {
    return this.audits.find(a => a.id === id);
  }

  public getAuditsByBranch(branchId: string): NHRA_Audit[] {
    let targetId = branchId;
    if (branchId.startsWith('branch-')) {
      const idx = parseInt(branchId.replace('branch-', ''), 10) - 1;
      if (idx >= 0 && MOCK_BRANCHES[idx]) {
        targetId = MOCK_BRANCHES[idx].id;
      }
    }
    return this.audits.filter(a => a.branch_id === branchId || a.branch_id === targetId);
  }

  public saveAudit(audit: NHRA_Audit): void {
    const existingIndex = this.audits.findIndex(a => a.id === audit.id);
    if (existingIndex >= 0) {
      this.audits[existingIndex] = audit;
    } else {
      this.audits.unshift(audit);
    }
    saveToStorage(STORAGE_KEYS.AUDITS, this.audits);
  }

  // ── Appraisals ──────────────────────────────────────────

  public getAppraisals(): Pharmacist_Appraisal[] {
    return [...this.appraisals];
  }

  public getAppraisalById(id: string): Pharmacist_Appraisal | undefined {
    return this.appraisals.find(a => a.id === id);
  }

  public getAppraisalsByPharmacist(pharmacistId: string): Pharmacist_Appraisal[] {
    let targetId = pharmacistId;
    if (pharmacistId.startsWith('usr-ph-')) {
      const phs = MOCK_USERS.filter(u => u.role === 'pharmacist');
      const idx = parseInt(pharmacistId.replace('usr-ph-', ''), 10) - 1;
      if (idx >= 0 && phs[idx]) {
        targetId = phs[idx].id;
      }
    }
    return this.appraisals.filter(a => a.pharmacist_id === pharmacistId || a.pharmacist_id === targetId);
  }

  public saveAppraisal(appraisal: Pharmacist_Appraisal): void {
    const existingIndex = this.appraisals.findIndex(a => a.id === appraisal.id);
    if (existingIndex >= 0) {
      this.appraisals[existingIndex] = appraisal;
    } else {
      this.appraisals.unshift(appraisal);
    }
    saveToStorage(STORAGE_KEYS.APPRAISALS, this.appraisals);
  }

  // ── CAPA Tasks ──────────────────────────────────────────

  public getCapaTasks(branchId?: string): CAPA_Task[] {
    if (!branchId) return [...this.capas];
    let targetId = branchId;
    if (branchId.startsWith('branch-')) {
      const idx = parseInt(branchId.replace('branch-', ''), 10) - 1;
      if (idx >= 0 && MOCK_BRANCHES[idx]) {
        targetId = MOCK_BRANCHES[idx].id;
      }
    }
    // Find audits for this branch to filter tasks
    const branchAuditIds = new Set(
      this.audits
        .filter(a => a.branch_id === branchId || a.branch_id === targetId)
        .map(a => a.id)
    );
    return this.capas.filter(c => branchAuditIds.has(c.audit_id));
  }

  public saveCapaTasks(newTasks: CAPA_Task[]): void {
    for (const task of newTasks) {
      const idx = this.capas.findIndex(c => c.id === task.id);
      if (idx >= 0) {
        this.capas[idx] = task;
      } else {
        this.capas.unshift(task);
      }
    }
    saveToStorage(STORAGE_KEYS.CAPA_TASKS, this.capas);
  }

  public updateCapaTask(taskUpdate: Partial<CAPA_Task> & { id: string }): void {
    const idx = this.capas.findIndex(c => c.id === taskUpdate.id);
    if (idx >= 0) {
      this.capas[idx] = { ...this.capas[idx], ...taskUpdate };
      saveToStorage(STORAGE_KEYS.CAPA_TASKS, this.capas);
    }
  }

  // ── Distribution Logs ───────────────────────────────────

  public getDistributionLogs(sourceId?: string): DistributionLog[] {
    if (!sourceId) return [...this.distributionLogs];
    return this.distributionLogs.filter(d => d.source_id === sourceId);
  }

  public saveDistributionLogs(logs: DistributionLog[]): void {
    this.distributionLogs.push(...logs);
    saveToStorage(STORAGE_KEYS.DISTRIBUTION_LOGS, this.distributionLogs);
  }

  // ── Attachments ─────────────────────────────────────────

  public getAttachments(): Attachment[] {
    return [...this.attachments];
  }

  public saveAttachment(attachment: Attachment): void {
    this.attachments.push(attachment);
    saveToStorage(STORAGE_KEYS.ATTACHMENTS, this.attachments);
  }

  // ── Reset ───────────────────────────────────────────────

  public resetToDefaults(): void {
    this.audits = [...MOCK_AUDITS];
    this.appraisals = [...MOCK_APPRAISALS];
    this.capas = [...MOCK_CAPA_TASKS];
    this.distributionLogs = [];
    this.attachments = [];

    saveToStorage(STORAGE_KEYS.AUDITS, this.audits);
    saveToStorage(STORAGE_KEYS.APPRAISALS, this.appraisals);
    saveToStorage(STORAGE_KEYS.CAPA_TASKS, this.capas);
    saveToStorage(STORAGE_KEYS.DISTRIBUTION_LOGS, this.distributionLogs);
    saveToStorage(STORAGE_KEYS.ATTACHMENTS, this.attachments);
  }
}

export const mockAuditStore = new MockAuditStore();
