import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppraisalSection } from '../types';
import { getFreshAppraisalTemplate } from '../data/mockAppraisals';
import { calculateAppraisalScore } from '../services/scoringService';

const DRAFT_STORAGE_KEY = 'tqph_appraisal_draft_v1';

export interface AppraisalDraftState {
  id: string;
  pharmacistId: string | null;
  branchId: string | null;
  supervisorId: string;
  month: number;
  year: number;
  sections: AppraisalSection[];
  commentsAndImprovement: string;
  lastSavedAt: string;
}

function getInitialDraft(supervisorId: string = 'usr-sup-1'): AppraisalDraftState {
  const now = new Date();

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
    id: `appraisal-${Date.now().toString(36)}`,
    pharmacistId: null,
    branchId: null,
    supervisorId,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    sections: getFreshAppraisalTemplate(),
    commentsAndImprovement: '',
    lastSavedAt: now.toISOString()
  };
}

export function useAppraisalDraft(supervisorId: string = 'usr-sup-1') {
  const [draft, setDraft] = useState<AppraisalDraftState>(() => getInitialDraft(supervisorId));

  // Auto-save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // quota fallback
    }
  }, [draft]);

  const setPharmacistId = useCallback((pharmacistId: string | null) => {
    setDraft(prev => ({
      ...prev,
      pharmacistId,
      lastSavedAt: new Date().toISOString()
    }));
  }, []);

  const setBranchId = useCallback((branchId: string | null) => {
    setDraft(prev => ({
      ...prev,
      branchId,
      lastSavedAt: new Date().toISOString()
    }));
  }, []);

  const setMonthYear = useCallback((month: number, year: number) => {
    setDraft(prev => ({
      ...prev,
      month,
      year,
      lastSavedAt: new Date().toISOString()
    }));
  }, []);

  const updateSection = useCallback((updatedSection: AppraisalSection) => {
    setDraft(prev => {
      const nextSections = prev.sections.map(s =>
        s.section_id === updatedSection.section_id ? updatedSection : s
      );
      return {
        ...prev,
        sections: nextSections,
        lastSavedAt: new Date().toISOString()
      };
    });
  }, []);

  const setComments = useCallback((commentsAndImprovement: string) => {
    setDraft(prev => ({
      ...prev,
      commentsAndImprovement,
      lastSavedAt: new Date().toISOString()
    }));
  }, []);

  const resetDraft = useCallback(() => {
    const now = new Date();
    const fresh: AppraisalDraftState = {
      id: `appraisal-${Date.now().toString(36)}`,
      pharmacistId: null,
      branchId: null,
      supervisorId,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      sections: getFreshAppraisalTemplate(),
      commentsAndImprovement: '',
      lastSavedAt: now.toISOString()
    };
    setDraft(fresh);
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, [supervisorId]);

  // Live credit score computation
  const scoreResult = useMemo(() => {
    return calculateAppraisalScore(draft.sections);
  }, [draft.sections]);

  return {
    draft,
    setPharmacistId,
    setBranchId,
    setMonthYear,
    updateSection,
    setComments,
    resetDraft,
    scoreResult
  };
}
