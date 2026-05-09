CREATE TABLE IF NOT EXISTS public.hr_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ref_num TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    cpr TEXT NOT NULL,
    type TEXT, -- 'Document' or 'Vacation Request'
    doc_types TEXT[], -- Array of document types
    doc_reason TEXT,
    req_date DATE,
    delivery_method TEXT,
    status TEXT NOT NULL DEFAULT 'Pending',
    timestamp TIMESTAMPTZ DEFAULT now(),
    email TEXT,
    passport TEXT,
    passport_name TEXT,
    license TEXT,
    sponsor TEXT,
    join_date DATE,
    salary TEXT,
    other_doc_type TEXT,
    
    -- Vacation Fields
    leave_type TEXT,
    holiday_from DATE,
    holiday_to DATE,
    days_count INTEGER,
    flight_out TEXT,
    flight_return TEXT,
    job_title TEXT,
    department TEXT,
    location TEXT,
    mobile TEXT,
    notes TEXT,
    last_vacation_date DATE,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hr_requests ENABLE ROW LEVEL SECURITY;

-- Create policies (Allow all for now, or match existing role-based access if needed)
-- For this project, usually we allow all if we aren't using Supabase Auth strictly
DROP POLICY IF EXISTS "Allow all access to hr_requests" ON public.hr_requests;
CREATE POLICY "Allow all access to hr_requests" ON public.hr_requests
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.hr_requests TO anon, authenticated, service_role;
