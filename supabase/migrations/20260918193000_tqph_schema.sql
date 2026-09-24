-- ============================================================================
-- Tabarak Quality & Performance Hub (TQPH) - Production Database Schema
-- Specification Reference: TQPH_Implementation_Spec.md (Section 6 & Section 9)
-- ============================================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. NHRA Simulated Audits ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tqph_audits (
    id VARCHAR(64) PRIMARY KEY,
    branch_id VARCHAR(64) NOT NULL,
    supervisor_id VARCHAR(64) NOT NULL,
    date DATE NOT NULL,
    status VARCHAR(32) NOT NULL CHECK (status IN ('draft', 'locked_submitted')),
    compliance_score NUMERIC(5, 2) NOT NULL CHECK (compliance_score >= 0 AND compliance_score <= 100),
    violations_list TEXT[] DEFAULT '{}',
    sections JSONB NOT NULL,
    amended BOOLEAN DEFAULT FALSE,
    submitted_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    locked_at TIMESTAMPTZ
);

-- Indexes for high-frequency dashboard aggregations and queries
CREATE INDEX IF NOT EXISTS idx_tqph_audits_branch_id ON public.tqph_audits(branch_id);
CREATE INDEX IF NOT EXISTS idx_tqph_audits_supervisor_id ON public.tqph_audits(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_tqph_audits_date ON public.tqph_audits(date);
CREATE INDEX IF NOT EXISTS idx_tqph_audits_status ON public.tqph_audits(status);
CREATE INDEX IF NOT EXISTS idx_tqph_audits_locked_at ON public.tqph_audits(locked_at);

-- ── 2. Pharmacist Appraisals ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tqph_appraisals (
    id VARCHAR(64) PRIMARY KEY,
    pharmacist_id VARCHAR(64) NOT NULL,
    branch_id VARCHAR(64) NOT NULL,
    supervisor_id VARCHAR(64) NOT NULL,
    month SMALLINT NOT NULL CHECK (month >= 1 AND month <= 12),
    year SMALLINT NOT NULL CHECK (year >= 2020 AND year <= 2100),
    status VARCHAR(32) NOT NULL CHECK (status IN ('draft', 'locked_submitted')),
    total_credit_score SMALLINT NOT NULL CHECK (total_credit_score >= 0 AND total_credit_score <= 150),
    passed BOOLEAN NOT NULL,
    comments_and_improvement TEXT,
    sections JSONB NOT NULL,
    amended BOOLEAN DEFAULT FALSE,
    submitted_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    locked_at TIMESTAMPTZ,
    UNIQUE(pharmacist_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_tqph_appraisals_pharmacist_id ON public.tqph_appraisals(pharmacist_id);
CREATE INDEX IF NOT EXISTS idx_tqph_appraisals_branch_id ON public.tqph_appraisals(branch_id);
CREATE INDEX IF NOT EXISTS idx_tqph_appraisals_month_year ON public.tqph_appraisals(month, year);
CREATE INDEX IF NOT EXISTS idx_tqph_appraisals_passed ON public.tqph_appraisals(passed);

-- ── 3. CAPA Tasks (48-Hour SLA) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tqph_capa_tasks (
    id VARCHAR(64) PRIMARY KEY,
    audit_id VARCHAR(64) NOT NULL REFERENCES public.tqph_audits(id) ON DELETE CASCADE,
    element_code VARCHAR(16) NOT NULL,
    violation TEXT NOT NULL,
    required_action TEXT NOT NULL,
    severity VARCHAR(16) NOT NULL CHECK (severity IN ('Critical', 'Major', 'Minor')),
    due_date TIMESTAMPTZ NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('open', 'resolved')),
    assigned_to VARCHAR(64) NOT NULL,
    resolved_by VARCHAR(64),
    resolved_at TIMESTAMPTZ,
    resolution_proof_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tqph_capa_audit_id ON public.tqph_capa_tasks(audit_id);
CREATE INDEX IF NOT EXISTS idx_tqph_capa_status ON public.tqph_capa_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tqph_capa_severity ON public.tqph_capa_tasks(severity);
CREATE INDEX IF NOT EXISTS idx_tqph_capa_due_date ON public.tqph_capa_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tqph_capa_assigned_to ON public.tqph_capa_tasks(assigned_to);

-- ── 4. Distribution Logs (Multi-Portal Audit Trail) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.tqph_distribution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type VARCHAR(32) NOT NULL CHECK (source_type IN ('audit_lock', 'appraisal_lock', 'capa_escalation')),
    source_id VARCHAR(64) NOT NULL,
    destination_portal VARCHAR(32) NOT NULL CHECK (destination_portal IN ('branch_portal', 'pharmacist_portal', 'executive_admin')),
    recipient_id VARCHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('sent', 'failed', 'acknowledged')),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    payload_snapshot JSONB
);

CREATE INDEX IF NOT EXISTS idx_tqph_distribution_source ON public.tqph_distribution_logs(source_id);
CREATE INDEX IF NOT EXISTS idx_tqph_distribution_dest ON public.tqph_distribution_logs(destination_portal);

-- ── 5. Attachments & Evidence Storage ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tqph_attachments (
    id VARCHAR(64) PRIMARY KEY,
    audit_id VARCHAR(64) REFERENCES public.tqph_audits(id) ON DELETE SET NULL,
    item_code VARCHAR(16),
    capa_task_id VARCHAR(64) REFERENCES public.tqph_capa_tasks(id) ON DELETE SET NULL,
    file_url TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(64) NOT NULL,
    uploaded_by VARCHAR(64) NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tqph_attachments_audit_id ON public.tqph_attachments(audit_id);
CREATE INDEX IF NOT EXISTS idx_tqph_attachments_capa_id ON public.tqph_attachments(capa_task_id);

-- ── 6. Row Level Security (RLS) Policies ───────────────────────────────────
ALTER TABLE public.tqph_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tqph_appraisals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tqph_capa_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tqph_distribution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tqph_attachments ENABLE ROW LEVEL SECURITY;

-- Grant permissions for PostgREST Data API (authenticated, anon, service_role)
GRANT ALL ON TABLE public.tqph_audits TO authenticated, anon, service_role;
GRANT ALL ON TABLE public.tqph_appraisals TO authenticated, anon, service_role;
GRANT ALL ON TABLE public.tqph_capa_tasks TO authenticated, anon, service_role;
GRANT ALL ON TABLE public.tqph_distribution_logs TO authenticated, anon, service_role;
GRANT ALL ON TABLE public.tqph_attachments TO authenticated, anon, service_role;

-- Allow access for authenticated staff (Admin, Supervisors, Managers)
CREATE POLICY "Allow authenticated read on tqph_audits"
    ON public.tqph_audits FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated insert/update on tqph_audits"
    ON public.tqph_audits FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow anon read/write on tqph_audits"
    ON public.tqph_audits FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated read on tqph_appraisals"
    ON public.tqph_appraisals FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated insert/update on tqph_appraisals"
    ON public.tqph_appraisals FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow anon read/write on tqph_appraisals"
    ON public.tqph_appraisals FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated read on tqph_capa_tasks"
    ON public.tqph_capa_tasks FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated update on tqph_capa_tasks"
    ON public.tqph_capa_tasks FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow anon read/write on tqph_capa_tasks"
    ON public.tqph_capa_tasks FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated read on tqph_distribution_logs"
    ON public.tqph_distribution_logs FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated insert on tqph_distribution_logs"
    ON public.tqph_distribution_logs FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow anon read/write on tqph_distribution_logs"
    ON public.tqph_distribution_logs FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated read/write on tqph_attachments"
    ON public.tqph_attachments FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow anon read/write on tqph_attachments"
    ON public.tqph_attachments FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

-- ── 7. Supabase Storage Bucket for CAPA Proof & Checklist Photos ────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('tqph-evidence', 'tqph-evidence', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Read on tqph-evidence"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'tqph-evidence');

CREATE POLICY "Upload on tqph-evidence"
    ON storage.objects FOR INSERT
    TO authenticated, anon
    WITH CHECK (bucket_id = 'tqph-evidence');

CREATE POLICY "Update on tqph-evidence"
    ON storage.objects FOR UPDATE
    TO authenticated, anon
    USING (bucket_id = 'tqph-evidence')
    WITH CHECK (bucket_id = 'tqph-evidence');

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
