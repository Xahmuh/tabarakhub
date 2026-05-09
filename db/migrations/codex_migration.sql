
-- Corporate Codex Table (Enhanced Version)
CREATE TABLE IF NOT EXISTS public.corporate_codex (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'circular', -- 'circular' or 'policy'
    priority TEXT NOT NULL DEFAULT 'normal', -- 'normal', 'urgent', 'critical'
    publish_date DATE DEFAULT CURRENT_DATE,
    pages TEXT[] DEFAULT '{}', -- Array of image URLs or content
    is_published BOOLEAN DEFAULT true,
    is_pinned BOOLEAN DEFAULT false,
    department TEXT DEFAULT 'all',
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- If table already exists, add new columns
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='corporate_codex' AND column_name='priority') THEN
        ALTER TABLE public.corporate_codex ADD COLUMN priority TEXT DEFAULT 'normal';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='corporate_codex' AND column_name='is_pinned') THEN
        ALTER TABLE public.corporate_codex ADD COLUMN is_pinned BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='corporate_codex' AND column_name='department') THEN
        ALTER TABLE public.corporate_codex ADD COLUMN department TEXT DEFAULT 'all';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='corporate_codex' AND column_name='tags') THEN
        ALTER TABLE public.corporate_codex ADD COLUMN tags TEXT[] DEFAULT '{}';
    END IF;
END $$;

-- Acknowledgment Table
CREATE TABLE IF NOT EXISTS public.corporate_codex_acknowledgments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID REFERENCES public.corporate_codex(id) ON DELETE CASCADE,
    user_id TEXT, -- Changed to TEXT to support branch codes/strings
    user_name TEXT,
    acknowledged_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(entry_id, user_id)
);

-- Enable RLS
ALTER TABLE public.corporate_codex ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_codex_acknowledgments ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Allow all access to corporate_codex') THEN
        CREATE POLICY "Allow all access to corporate_codex" ON public.corporate_codex
            FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Allow all access to corporate_codex_acknowledgments') THEN
        CREATE POLICY "Allow all access to corporate_codex_acknowledgments" ON public.corporate_codex_acknowledgments
            FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='update_corporate_codex_updated_at') THEN
        CREATE TRIGGER update_corporate_codex_updated_at
            BEFORE UPDATE ON corporate_codex
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
