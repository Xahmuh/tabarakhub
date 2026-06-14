import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const REPORT_RECIPIENT = Deno.env.get('ADMIN_EMAIL')
const REPORT_FROM_EMAIL = Deno.env.get('REPORT_FROM_EMAIL')
const CLIENT_DASHBOARD_URL = Deno.env.get('CLIENT_DASHBOARD_URL')
const CLIENT_PUBLIC_NAME = Deno.env.get('CLIENT_PUBLIC_NAME') || 'Dedicated Client'
const FUNCTION_SECRET = Deno.env.get('FUNCTION_SECRET')

const placeholderTokens = [
  'client_frontend_url',
  'client-dashboard-url',
  'client-domain.example',
  'example.com',
  'admin@example.com',
  'onboarding@resend.dev',
  'localhost',
  '127.0.0.1',
];

const hasPlaceholderValue = (value?: string | null) => {
  const normalized = (value || '').trim().toLowerCase();
  return !normalized || placeholderTokens.some((token) => normalized.includes(token));
};

const isValidEmail = (value?: string | null) =>
  !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !hasPlaceholderValue(value);

const isValidProductionUrl = (value?: string | null) => {
  if (hasPlaceholderValue(value)) return false;

  try {
    const parsed = new URL(value || '');
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

serve(async (req) => {
  try {
    if (!FUNCTION_SECRET || req.headers.get('x-function-secret') !== FUNCTION_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    if (
      !RESEND_API_KEY ||
      !SUPABASE_URL ||
      !SUPABASE_SERVICE_ROLE_KEY ||
      !isValidEmail(REPORT_RECIPIENT) ||
      !isValidEmail(REPORT_FROM_EMAIL) ||
      !isValidProductionUrl(CLIENT_DASHBOARD_URL)
    ) {
      console.error("Monthly report function is missing required production-safe server-side environment variables")
      throw new Error("Monthly report email is not configured")
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Calculate last month's string 'YYYY-MM'
    const today = new Date()
    today.setMonth(today.getMonth() - 1)
    const lastMonthStr = today.toISOString().slice(0, 7) // 'YYYY-MM'

    // Fetch monthly stats using the RPC we built in Phase 1/2
    const { data: trendData, error: trendError } = await supabase.rpc('get_monthly_trend')
    if (trendError) throw trendError

    const lastMonthData = trendData?.find((t: any) => t.month === lastMonthStr)

    if (!lastMonthData) {
      return new Response(JSON.stringify({ message: "No data found for last month. Report skipped." }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const htmlContent = `
      <h2>${CLIENT_PUBLIC_NAME} Quality Feedback Monthly Report - ${lastMonthStr}</h2>
      <p>Here is the automated summary for the last month's anonymous feedback.</p>
      <ul>
        <li><strong>Management Health Score:</strong> ${lastMonthData.health_score} / 5.0</li>
        <li><strong>Total Responses:</strong> ${lastMonthData.response_count}</li>
      </ul>
      <p>Log in to the <a href="${CLIENT_DASHBOARD_URL}">Admin Dashboard</a> for deeper insights and cluster breakdowns.</p>
    `

    // Send via Resend API
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: REPORT_FROM_EMAIL,
        to: [REPORT_RECIPIENT],
        subject: `${CLIENT_PUBLIC_NAME} Monthly Quality Feedback Report - ${lastMonthStr}`,
        html: htmlContent
      })
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error("Resend API error:", errorText)
      throw new Error("Failed to send email")
    }

    return new Response(JSON.stringify({ message: "Monthly report sent successfully." }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
