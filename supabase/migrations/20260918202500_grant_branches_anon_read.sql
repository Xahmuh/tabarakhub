-- ============================================================================
-- Grant SELECT on public.branches to anon role for Data API access
-- ============================================================================

GRANT SELECT ON TABLE public.branches TO anon;
NOTIFY pgrst, 'reload schema';
