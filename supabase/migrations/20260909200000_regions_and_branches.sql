-- Phase 0: Prerequisites (Schema Foundations)
-- Regions and Branches Extension

CREATE TABLE IF NOT EXISTS regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Regions are viewable by everyone" ON regions;
CREATE POLICY "Regions are viewable by everyone" ON regions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Regions are insertable by admins" ON regions;
CREATE POLICY "Regions are insertable by admins" ON regions FOR INSERT WITH CHECK (
  public.current_app_role() IN ('admin', 'manager', 'owner')
);

DROP POLICY IF EXISTS "Regions are updatable by admins" ON regions;
CREATE POLICY "Regions are updatable by admins" ON regions FOR UPDATE USING (
  public.current_app_role() IN ('admin', 'manager', 'owner')
) WITH CHECK (
  public.current_app_role() IN ('admin', 'manager', 'owner')
);

-- Extend branches
ALTER TABLE branches ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS is_24_hour BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Branch Shift Types (instead of JSON column)
CREATE TABLE IF NOT EXISTS branch_shift_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    staff_required INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(branch_id, code)
);

-- RLS for branch_shift_types
ALTER TABLE branch_shift_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Branch shift types are viewable by everyone" ON branch_shift_types;
CREATE POLICY "Branch shift types are viewable by everyone" ON branch_shift_types FOR SELECT USING (true);

DROP POLICY IF EXISTS "Branch shift types are editable by admins" ON branch_shift_types;
CREATE POLICY "Branch shift types are editable by admins" ON branch_shift_types FOR ALL USING (
  public.current_app_role() IN ('admin', 'manager', 'owner')
) WITH CHECK (
  public.current_app_role() IN ('admin', 'manager', 'owner')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.regions TO authenticated, anon;
GRANT ALL ON public.regions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branch_shift_types TO authenticated, anon;
GRANT ALL ON public.branch_shift_types TO service_role;
