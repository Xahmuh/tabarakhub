-- =============================================================================
-- OPERATIONAL ALERT & RENEWALS MODULE
-- =============================================================================
-- Centralized compliance and operational renewal tracking system for
-- Commercial Registrations (CR), NHRA licenses, Employee Work Permits, and future documents.

-- 1. Operational Renewals Master Table
CREATE TABLE IF NOT EXISTS public.operational_renewals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  renewal_type TEXT NOT NULL, -- 'CR', 'NHRA', 'WORK_PERMIT', 'OTHER'
  entity_type TEXT NOT NULL,  -- 'COMPANY', 'BRANCH', 'EMPLOYEE', 'VEHICLE', 'OTHER'
  entity_id TEXT,             -- linked master id (e.g. employee uuid/code, branch uuid, cr number)
  entity_name TEXT NOT NULL,  -- display name e.g. "Tabarak Pharmacy CO W.L.L", "Dr. Ali Hassan"
  document_type TEXT NOT NULL,-- e.g. "Commercial Registration", "Pharmacy License", "Work Permit"
  document_number TEXT NOT NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  branch_name TEXT,
  issue_date DATE,
  expiry_date DATE NOT NULL,
  renewal_status TEXT NOT NULL DEFAULT 'NOT_STARTED', -- 'NOT_STARTED', 'PLANNED', 'IN_PROGRESS', 'SUBMITTED', 'AWAITING_APPROVAL', 'RENEWED', 'CANCELLED'
  priority TEXT,              -- optional priority override
  responsible_user_id TEXT,
  responsible_user_name TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for high-performance dashboard, filters, and searches
CREATE INDEX IF NOT EXISTS idx_operational_renewals_type
  ON public.operational_renewals (renewal_type);
CREATE INDEX IF NOT EXISTS idx_operational_renewals_status
  ON public.operational_renewals (renewal_status);
CREATE INDEX IF NOT EXISTS idx_operational_renewals_expiry
  ON public.operational_renewals (expiry_date);
CREATE INDEX IF NOT EXISTS idx_operational_renewals_active
  ON public.operational_renewals (is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_operational_renewals_branch
  ON public.operational_renewals (branch_id);
CREATE INDEX IF NOT EXISTS idx_operational_renewals_doc_no
  ON public.operational_renewals (document_number);

-- 2. Operational Renewal History (Audit & previous expiry retention)
CREATE TABLE IF NOT EXISTS public.operational_renewal_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  renewal_id UUID NOT NULL REFERENCES public.operational_renewals(id) ON DELETE CASCADE,
  previous_expiry_date DATE,
  new_expiry_date DATE,
  previous_document_number TEXT,
  new_document_number TEXT,
  action TEXT NOT NULL DEFAULT 'RENEWED', -- 'RENEWED', 'STATUS_CHANGE', 'PLANNED', etc.
  performed_by TEXT,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  attachment_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_operational_renewal_history_renewal
  ON public.operational_renewal_history (renewal_id, performed_at DESC);

-- 3. Operational Renewal Attachments
CREATE TABLE IF NOT EXISTS public.operational_renewal_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  renewal_id UUID NOT NULL REFERENCES public.operational_renewals(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  file_url TEXT NOT NULL,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_operational_renewal_attachments_renewal
  ON public.operational_renewal_attachments (renewal_id);

-- 4. Operational Renewal Activities (Activity log & field audit trail)
CREATE TABLE IF NOT EXISTS public.operational_renewal_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  renewal_id UUID NOT NULL REFERENCES public.operational_renewals(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'CREATED', 'UPDATED', 'STATUS_CHANGED', 'RENEWAL_STARTED', 'DOCUMENT_UPLOADED', 'RENEWED', 'RESPONSIBLE_CHANGED', 'ARCHIVED'
  field_name TEXT,
  previous_value TEXT,
  new_value TEXT,
  performed_by TEXT,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_operational_renewal_activities_renewal
  ON public.operational_renewal_activities (renewal_id, performed_at DESC);

-- 5. Operational Renewal Settings
CREATE TABLE IF NOT EXISTS public.operational_renewal_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  critical_days INT NOT NULL DEFAULT 7,
  urgent_days INT NOT NULL DEFAULT 30,
  warning_days INT NOT NULL DEFAULT 60,
  upcoming_days INT NOT NULL DEFAULT 90,
  reminder_intervals JSONB NOT NULL DEFAULT '[90, 60, 30, 14, 7, 1]'::jsonb,
  enabled_types JSONB NOT NULL DEFAULT '["CR", "NHRA", "WORK_PERMIT", "OTHER"]'::jsonb,
  default_responsible_user_id TEXT,
  default_responsible_user_name TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default settings row if not exists
INSERT INTO public.operational_renewal_settings (id, critical_days, urgent_days, warning_days, upcoming_days)
VALUES ('default', 7, 30, 60, 90)
ON CONFLICT (id) DO NOTHING;

-- RLS Enablement
ALTER TABLE public.operational_renewals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_renewal_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_renewal_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_renewal_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_renewal_settings ENABLE ROW LEVEL SECURITY;

-- Revoke anon access
REVOKE ALL ON public.operational_renewals FROM public, anon;
REVOKE ALL ON public.operational_renewal_history FROM public, anon;
REVOKE ALL ON public.operational_renewal_attachments FROM public, anon;
REVOKE ALL ON public.operational_renewal_activities FROM public, anon;
REVOKE ALL ON public.operational_renewal_settings FROM public, anon;

-- Grant authenticated & service_role access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_renewals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_renewal_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_renewal_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_renewal_activities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_renewal_settings TO authenticated;

GRANT ALL ON public.operational_renewals TO service_role;
GRANT ALL ON public.operational_renewal_history TO service_role;
GRANT ALL ON public.operational_renewal_attachments TO service_role;
GRANT ALL ON public.operational_renewal_activities TO service_role;
GRANT ALL ON public.operational_renewal_settings TO service_role;

-- RLS Policies
DROP POLICY IF EXISTS "operational_renewals select authenticated" ON public.operational_renewals;
CREATE POLICY "operational_renewals select authenticated" ON public.operational_renewals FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "operational_renewals manage authenticated" ON public.operational_renewals;
CREATE POLICY "operational_renewals manage authenticated" ON public.operational_renewals FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "operational_renewal_history select authenticated" ON public.operational_renewal_history;
CREATE POLICY "operational_renewal_history select authenticated" ON public.operational_renewal_history FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "operational_renewal_history manage authenticated" ON public.operational_renewal_history;
CREATE POLICY "operational_renewal_history manage authenticated" ON public.operational_renewal_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "operational_renewal_attachments select authenticated" ON public.operational_renewal_attachments;
CREATE POLICY "operational_renewal_attachments select authenticated" ON public.operational_renewal_attachments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "operational_renewal_attachments manage authenticated" ON public.operational_renewal_attachments;
CREATE POLICY "operational_renewal_attachments manage authenticated" ON public.operational_renewal_attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "operational_renewal_activities select authenticated" ON public.operational_renewal_activities;
CREATE POLICY "operational_renewal_activities select authenticated" ON public.operational_renewal_activities FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "operational_renewal_activities manage authenticated" ON public.operational_renewal_activities;
CREATE POLICY "operational_renewal_activities manage authenticated" ON public.operational_renewal_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "operational_renewal_settings select authenticated" ON public.operational_renewal_settings;
CREATE POLICY "operational_renewal_settings select authenticated" ON public.operational_renewal_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "operational_renewal_settings manage authenticated" ON public.operational_renewal_settings;
CREATE POLICY "operational_renewal_settings manage authenticated" ON public.operational_renewal_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
