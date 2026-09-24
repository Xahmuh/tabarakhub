import { useCallback, useEffect, useMemo, useState } from 'react';
import { Attachment, NHRA_Audit, NHRASection } from '../types';
import { getFreshChecklistTemplate } from '../data/mockAudits';
import { calculateComplianceScore } from '../services/scoringService';

const DRAFT_STORAGE_KEY = 'tqph_audit_draft_v1';

export interface AuditDraftState {
  id: string;
  branchId: string | null;
  supervisorId: string;
  date: string;
  sections: NHRASection[];
  attachments: Attachment[];
  lastSavedAt: string;
}

function getInitialDraft(supervisorId: string = 'usr-sup-1'): AuditDraftState {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.sections)) {
        return parsed;
      }
    }
  } catch {
    // ignore parse error
  }

  return {
    id: `audit-${Date.now().toString(36)}`,
    branchId: null,
    supervisorId,
    date: new Date().toISOString().slice(0, 10),
    sections: getFreshChecklistTemplate(),
    attachments: [],
    lastSavedAt: new Date().toISOString()
  };
}

export function useAuditDraft(supervisorId: string = 'usr-sup-1') {
  const [draft, setDraft] = useState<AuditDraftState>(() => getInitialDraft(supervisorId));

  // Auto-save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // quota fallback
    }
  }, [draft]);

  const setBranchId = useCallback((branchId: string | null) => {
    setDraft(prev => ({
      ...prev,
      branchId,
      lastSavedAt: new Date().toISOString()
    }));
  }, []);

  const setDate = useCallback((date: string) => {
    setDraft(prev => ({
      ...prev,
      date,
      lastSavedAt: new Date().toISOString()
    }));
  }, []);

  const updateSection = useCallback((updatedSection: NHRASection) => {
    setDraft(prev => {
      const nextSections = prev.sections.map(s =>
        s.section_code === updatedSection.section_code ? updatedSection : s
      );
      return {
        ...prev,
        sections: nextSections,
        lastSavedAt: new Date().toISOString()
      };
    });
  }, []);

  const addAttachment = useCallback((attachment: Attachment) => {
    setDraft(prev => ({
      ...prev,
      attachments: [...prev.attachments, attachment],
      lastSavedAt: new Date().toISOString()
    }));
  }, []);

  const removeAttachment = useCallback((attachmentId: string) => {
    setDraft(prev => ({
      ...prev,
      attachments: prev.attachments.filter(a => a.id !== attachmentId),
      lastSavedAt: new Date().toISOString()
    }));
  }, []);

  const resetDraft = useCallback(() => {
    const fresh: AuditDraftState = {
      id: `audit-${Date.now().toString(36)}`,
      branchId: null,
      supervisorId,
      date: new Date().toISOString().slice(0, 10),
      sections: getFreshChecklistTemplate(),
      attachments: [],
      lastSavedAt: new Date().toISOString()
    };
    setDraft(fresh);
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, [supervisorId]);

  // Live compliance score computation
  const scoreResult = useMemo(() => {
    return calculateComplianceScore(draft.sections);
  }, [draft.sections]);

  // Count of sections with at least one item evaluated
  const completedSectionsCount = useMemo(() => {
    return draft.sections.filter(s =>
      s.items.some(it => it.status !== 'fully_compliant' || it.notes)
    ).length;
  }, [draft.sections]);

  return {
    draft,
    setBranchId,
    setDate,
    updateSection,
    addAttachment,
    removeAttachment,
    resetDraft,
    scoreResult,
    completedSectionsCount
  };
}
