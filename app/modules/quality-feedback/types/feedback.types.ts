export type FeedbackSection = 'Operations' | 'Purchasing' | 'HR' | 'IT' | 'Overall';

export interface Question {
  id: string;
  section: FeedbackSection;
  field_key: string; // mapping to feedback_responses columns (e.g., op_1)
  text_en: string;
  text_ar: string;
  order_index: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type SubmissionPeriod = 'monthly' | 'quarterly';

export interface ModuleSettings {
  id: string;
  config_key: string;
  is_enabled: boolean;
  max_submissions_per_month: number;
  submission_period: SubmissionPeriod;
  updated_at?: string;
}

export interface FeedbackFormData {
  branch_cluster: string;
  role: string;
  experience_range: string;
  submission_month: string;
  
  // Dynamic fields mapped by field_key
  [key: string]: any;
  
  // Standard keys used in storage
  op_1?: number; op_2?: number; op_3?: number; op_4?: number;
  pur_1?: number; pur_2?: number; pur_3?: number; pur_4?: number;
  hr_1?: number; hr_2?: number; hr_3?: number; hr_4?: number;
  it_1?: number; it_2?: number; it_3?: number; it_4?: number;
  ov_1?: number; ov_2?: number; ov_3?: number;
  
  comments_ops?: string;
  comments_pur?: string;
  comments_hr?: string;
  comments_it?: string;
  comments_ov?: string;
  
  sentiment_score?: number;
  sentiment_label?: 'positive' | 'neutral' | 'negative';
  topics?: string[];
}

export interface DashboardFilters {
  dateFrom: string;
  dateTo: string;
  cluster: string;
  role: string;
  experience: string;
}

export interface MonthlyTrend {
  month: string;
  overall: number;
  operations: number;
  purchasing: number;
  hr: number;
  it: number;
}

export interface BranchSalesData {
  id: string;
  branch_name: string;
  month: string;
  sales_amount: number;
  target_amount: number;
}

export interface HRTurnoverData {
  id: string;
  branch_name: string;
  month: string;
  turnover_rate: number;
}
