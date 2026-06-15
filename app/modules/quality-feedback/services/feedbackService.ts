import { supabaseClient as supabase } from '@/lib/supabaseClient';
import { 
  FeedbackFormData, 
  DashboardFilters, 
  MonthlyTrend,
  Question,
  ModuleSettings
} from '../types/feedback.types';
import { isModuleEnabled } from '../../../../config/clientConfig';

const DEFAULT_BRANCH_AREAS = ['Capital', 'Muharraq', 'Northern', 'Southern'];
const BRANCH_AREA_ORDER = new Map(DEFAULT_BRANCH_AREAS.map((area, index) => [area, index]));

const normalizeBranchAreas = (values: Array<string | null | undefined>) => {
  const unique = new Set<string>();
  values.forEach(value => {
    const area = typeof value === 'string' ? value.trim() : '';
    if (area) unique.add(area);
  });

  return Array.from(unique).sort((a, b) => {
    const orderA = BRANCH_AREA_ORDER.get(a) ?? Number.MAX_SAFE_INTEGER;
    const orderB = BRANCH_AREA_ORDER.get(b) ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB || a.localeCompare(b);
  });
};

export const feedbackService = {
  // --- Public Form Methods ---

  // Branch Area options are backed by operational governorate data.
  fetchBranchAreaOptions: async (): Promise<string[]> => {
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('get_quality_feedback_branch_areas');

    if (!rpcError) {
      const rpcAreas = normalizeBranchAreas((rpcData || []).map((row: any) => row?.area || row?.governorate || row));
      if (rpcAreas.length > 0) return rpcAreas;
    }

    const sourceQueries = [
      supabase.from('delivery_areas').select('governorate').eq('is_active', true),
      supabase.from('branch_classifications').select('governorate'),
      supabase.from('delivery_blocks').select('governorate').eq('is_active', true)
    ];

    const results = await Promise.allSettled(sourceQueries);
    const tableAreas = normalizeBranchAreas(results.flatMap(result => {
      if (result.status !== 'fulfilled' || result.value.error) return [];
      return (result.value.data || []).map((row: any) => row.governorate);
    }));

    return tableAreas.length > 0 ? tableAreas : DEFAULT_BRANCH_AREAS;
  },
  
  // Submit feedback
  submitFeedback: async (data: FeedbackFormData): Promise<void> => {
    // Separate known fixed columns from dynamic question scores/notes
    const FIXED_COLUMNS = new Set([
      'branch_cluster', 'role', 'experience_range', 'submission_month',
      'biggest_issue', 'best_thing', 'improvement_suggestion',
      'sentiment_label', 'key_topics', 'is_analyzed'
    ]);

    const fixedData: Record<string, any> = {};
    const ratings: Record<string, any> = {};

    Object.entries(data).forEach(([key, value]) => {
      if (FIXED_COLUMNS.has(key)) {
        fixedData[key] = value;
      } else {
        ratings[key] = value;
      }
    });

    const { error } = await supabase
      .from('feedback_responses')
      .insert([{ ...fixedData, ratings }]);
    if (error) throw error;
  },

  // Fetch active questions
  fetchActiveQuestions: async (): Promise<Question[]> => {
      const { data, error } = await supabase
      .from('quality_feedback_questions')
      .select('*')
      .eq('is_active', true)
      .order('order_index', { ascending: true });
    if (error) throw error;
    return data;
  },

  // Get module settings
  getModuleSettings: async (): Promise<ModuleSettings> => {
    const { data, error } = await supabase
      .from('quality_feedback_settings')
      .select('*')
      .eq('config_key', 'main_config')
      .single();
    if (error) throw error;
    return data;
  },



  // --- Admin Methods ---

  // Fetch all responses with filters
  fetchResponses: async (filters: DashboardFilters) => {
    let query = supabase
      .from('feedback_responses')
      .select('*');

    if (filters.dateFrom) {
      query = query.gte('submission_month', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte('submission_month', filters.dateTo);
    }
    if (filters.cluster !== 'All') {
      query = query.eq('branch_cluster', filters.cluster);
    }
    if (filters.role !== 'All') {
      query = query.eq('role', filters.role);
    }
    if (filters.experience !== 'All') {
      query = query.eq('experience_range', filters.experience);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // Monthly trend aggregation (using Supabase RPC)
  fetchMonthlyTrend: async (): Promise<MonthlyTrend[]> => {
    const { data, error } = await supabase.rpc('get_monthly_trend');
    if (error) throw error;
    return data;
  },

  // Fetch all questions for management
  fetchAllQuestions: async (): Promise<Question[]> => {
    const { data, error } = await supabase
      .from('quality_feedback_questions')
      .select('*')
      .order('section', { ascending: true })
      .order('order_index', { ascending: true });
    if (error) throw new Error(`fetchAllQuestions: ${error.message} (code: ${error.code})`);
    return data ?? [];
  },

  // Question CRUD
  createQuestion: async (question: Omit<Question, 'id'>): Promise<Question> => {
    const { error } = await supabase
      .from('quality_feedback_questions')
      .insert([question]);
    if (error) throw error;
    const { data, error: fetchError } = await supabase
      .from('quality_feedback_questions')
      .select('*')
      .eq('field_key', question.field_key);
    if (fetchError) throw fetchError;
    if (!data || data.length === 0) throw new Error('Failed to create question');
    return data[0];
  },

  updateQuestion: async (id: string, updates: Partial<Question>): Promise<Question> => {
    // Strip id and timestamps — only send actual editable fields
    const { id: _id, created_at: _ca, updated_at: _ua, ...safeUpdates } = updates as any;
    const { error } = await supabase
      .from('quality_feedback_questions')
      .update(safeUpdates)
      .eq('id', id);
    if (error) throw error;
    const { data, error: fetchError } = await supabase
      .from('quality_feedback_questions')
      .select('*')
      .eq('id', id);
    if (fetchError) throw fetchError;
    if (!data || data.length === 0) throw new Error('Question not found');
    const row = data[0];
    // Detect silent RLS block: if a sent field didn't apply, the update was rejected
    if (safeUpdates.text_ar !== undefined && row.text_ar !== safeUpdates.text_ar) {
      throw new Error('UPDATE blocked by Supabase RLS — see fix instructions in console');
    }
    return row;
  },

  deleteQuestion: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('quality_feedback_questions')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // Update settings
  updateModuleSettings: async (settings: Partial<ModuleSettings>): Promise<ModuleSettings> => {
    const { error } = await supabase
      .from('quality_feedback_settings')
      .update(settings)
      .eq('config_key', 'main_config');
    if (error) throw error;
    const { data, error: fetchError } = await supabase
      .from('quality_feedback_settings')
      .select('*')
      .eq('config_key', 'main_config');
    if (fetchError) throw fetchError;
    if (!data || data.length === 0) throw new Error('Settings not found');
    return data[0];
  },



  // Correlation & Intelligence
  fetchSalesData: async () => {
    const { data, error } = await supabase.from('branch_sales_data').select('*');
    if (error) throw error;
    return data;
  },

  fetchHRData: async () => {
    const { data, error } = await supabase.from('branch_hr_turnover').select('*');
    if (error) throw error;
    return data;
  },

  triggerSentimentAnalysis: async () => {
    if (!isModuleEnabled('aiInsights')) {
      throw new Error('AI insights are disabled for this deployment.');
    }

    const { data, error } = await supabase.functions.invoke('analyze-sentiment', {
      method: 'POST'
    });
    if (error) throw error;
    return data;
  }
};
