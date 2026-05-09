-- ==========================================
-- Anonymous Quality Feedback System - Full Migration
-- ==========================================
-- This file contains all schema changes, tables, policies, 
-- and mock data for the Quality Feedback module.
-- Run this in the Supabase SQL Editor.

-- 1. BASE TABLES
---------------------------------------------

-- Main Feedback Table
CREATE TABLE IF NOT EXISTS feedback_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Demographic (non-identifying)
  branch_cluster TEXT NOT NULL,
  role TEXT NOT NULL,
  experience_range TEXT NOT NULL,

  -- Dynamic Rating Storage (JSONB for flexibility with dynamic questions)
  ratings JSONB DEFAULT '{}'::jsonb,

  -- Standard Rating Columns (Legacy Support)
  ops_1 INTEGER, ops_2 INTEGER, ops_3 INTEGER,
  pur_1 INTEGER, pur_2 INTEGER, pur_3 INTEGER,
  hr_1 INTEGER, hr_2 INTEGER, hr_3 INTEGER,
  it_1 INTEGER, it_2 INTEGER, it_3 INTEGER,
  overall_score INTEGER,

  -- Open Comments
  biggest_issue TEXT,
  best_thing TEXT,
  improvement_suggestion TEXT,

  -- AI Sentiment Columns (Phase 3)
  sentiment_label TEXT CHECK (sentiment_label IN ('positive', 'neutral', 'negative')),
  key_topics JSONB DEFAULT '[]'::jsonb,
  is_analyzed BOOLEAN DEFAULT false,

  -- Metadata
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  submission_month TEXT
);

-- Dynamic Questions Table (Phase 4)
CREATE TABLE IF NOT EXISTS quality_feedback_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section TEXT NOT NULL,
  text_en TEXT NOT NULL,
  text_ar TEXT NOT NULL,
  field_key TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT qf_questions_field_key_unique UNIQUE (field_key)
);

-- Module Settings Table (Phase 4)
CREATE TABLE IF NOT EXISTS quality_feedback_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT NOT NULL, -- 'main_config'
  is_enabled BOOLEAN DEFAULT true,
  submission_period TEXT DEFAULT 'monthly', -- 'monthly' or 'quarterly'
  max_submissions_per_month INTEGER DEFAULT 4,
  closed_message_en TEXT,
  closed_message_ar TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT qf_settings_key_unique UNIQUE (config_key)
);


-- 2. CORRELATION TABLES (MOCK DATA)
---------------------------------------------

-- Branch Sales Data
CREATE TABLE IF NOT EXISTS branch_sales_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_cluster TEXT NOT NULL,
  month TEXT NOT NULL,
  sales_amount NUMERIC DEFAULT 0,
  target_amount NUMERIC DEFAULT 0,
  CONSTRAINT branch_sales_data_cluster_month_unique UNIQUE(branch_cluster, month)
);

-- HR Turnover Data
CREATE TABLE IF NOT EXISTS branch_hr_turnover (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_cluster TEXT NOT NULL,
  month TEXT NOT NULL,
  turnover_rate NUMERIC DEFAULT 0,
  staff_count INTEGER DEFAULT 0,
  CONSTRAINT branch_hr_turnover_cluster_month_unique UNIQUE(branch_cluster, month)
);

-- Ensure constraints exist for existing tables (Incremental safety)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qf_questions_field_key_unique') THEN
        -- If table exists but constraint doesn't, try to add it. 
        -- If table doesn't exist, CREATE TABLE above already handled it.
        PERFORM 1 FROM information_schema.tables WHERE table_name = 'quality_feedback_questions';
        IF FOUND THEN
            ALTER TABLE quality_feedback_questions ADD CONSTRAINT qf_questions_field_key_unique UNIQUE (field_key);
        END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qf_settings_key_unique') THEN
        PERFORM 1 FROM information_schema.tables WHERE table_name = 'quality_feedback_settings';
        IF FOUND THEN
            ALTER TABLE quality_feedback_settings ADD CONSTRAINT qf_settings_key_unique UNIQUE (config_key);
        END IF;
    END IF;
END $$;


-- 3. INDEXES
---------------------------------------------
CREATE INDEX IF NOT EXISTS idx_feedback_month ON feedback_responses(submission_month);
CREATE INDEX IF NOT EXISTS idx_feedback_cluster ON feedback_responses(branch_cluster);
CREATE INDEX IF NOT EXISTS idx_feedback_unanalyzed ON feedback_responses(is_analyzed) WHERE is_analyzed = false;

-- 4. AUTOMATION (TRIGGERS)
---------------------------------------------
CREATE OR REPLACE FUNCTION set_submission_month()
RETURNS TRIGGER AS $$
BEGIN
  NEW.submission_month := TO_CHAR(NEW.submitted_at, 'YYYY-MM');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_submission_month ON feedback_responses;
CREATE TRIGGER trg_set_submission_month
BEFORE INSERT OR UPDATE OF submitted_at ON feedback_responses
FOR EACH ROW EXECUTE FUNCTION set_submission_month();

-- 5. RLS POLICIES
---------------------------------------------
ALTER TABLE feedback_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_feedback_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_feedback_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_sales_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_hr_turnover ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public insert responses" ON feedback_responses;
    CREATE POLICY "Public insert responses" ON feedback_responses FOR INSERT WITH CHECK (true);
    
    DROP POLICY IF EXISTS "Public read questions" ON quality_feedback_questions;
    CREATE POLICY "Public read questions" ON quality_feedback_questions FOR SELECT USING (is_active = true);
    
    DROP POLICY IF EXISTS "Public read settings" ON quality_feedback_settings;
    CREATE POLICY "Public read settings" ON quality_feedback_settings FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Admin update settings" ON quality_feedback_settings;
    CREATE POLICY "Admin update settings" ON quality_feedback_settings FOR UPDATE USING (true) WITH CHECK (true);
END $$;


-- 6. RPC FUNCTIONS
---------------------------------------------
CREATE OR REPLACE FUNCTION get_monthly_trend()
RETURNS TABLE (month TEXT, score NUMERIC, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT submission_month as month, ROUND(AVG(overall_score)::numeric, 2) as score, COUNT(*) as count
  FROM feedback_responses
  GROUP BY submission_month
  ORDER BY submission_month DESC LIMIT 12;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. SEED DATA
---------------------------------------------
INSERT INTO quality_feedback_questions (section, text_en, text_ar, field_key, order_index) VALUES
('Operations', 'Response speed to requests', 'سرعة الاستجابة للطلبات', 'ops_1', 1),
('Operations', 'Clarity of instructions', 'وضوح التعليمات', 'ops_2', 2),
('Purchasing', 'Item availability', 'توفر الأصناف', 'pur_1', 1),
('HR', 'Fairness of shift distribution', 'عدالة توزيع الورديات', 'hr_1', 1),
('IT', 'System stability', 'استقرار الأنظمة', 'it_1', 1),
('Overall', 'Overall satisfaction', 'الرضا العام', 'overall_score', 1)
ON CONFLICT ON CONSTRAINT qf_questions_field_key_unique DO NOTHING;

INSERT INTO quality_feedback_settings (config_key, is_enabled, closed_message_en, closed_message_ar)
VALUES ('main_config', true, 'The feedback form is currently closed. Please check back later.', 'نموذج التقييم مغلق حالياً. يرجى المحاولة لاحقاً.')
ON CONFLICT ON CONSTRAINT qf_settings_key_unique DO NOTHING;


INSERT INTO branch_sales_data (branch_cluster, month, sales_amount, target_amount)
SELECT cluster, m, (RANDOM() * 50000 + 50000), 75000
FROM (SELECT unnest(ARRAY['North Cluster', 'Central Cluster', 'South Cluster', 'East Cluster']) as cluster) c,
     (SELECT unnest(ARRAY['2026-03', '2026-04', '2026-05']) as m) months
ON CONFLICT ON CONSTRAINT branch_sales_data_cluster_month_unique DO NOTHING;

INSERT INTO branch_hr_turnover (branch_cluster, month, turnover_rate, staff_count)
SELECT cluster, m, (RANDOM() * 5 + 1), 45
FROM (SELECT unnest(ARRAY['North Cluster', 'Central Cluster', 'South Cluster', 'East Cluster']) as cluster) c,
     (SELECT unnest(ARRAY['2026-03', '2026-04', '2026-05']) as m) months
ON CONFLICT ON CONSTRAINT branch_hr_turnover_cluster_month_unique DO NOTHING;
