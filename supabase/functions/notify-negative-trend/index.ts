import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const CEO_EMAIL = Deno.env.get('CEO_EMAIL')
const NOTIFICATION_FROM_EMAIL = Deno.env.get('NOTIFICATION_FROM_EMAIL')
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
      !isValidEmail(CEO_EMAIL) ||
      !isValidEmail(NOTIFICATION_FROM_EMAIL) ||
      !isValidProductionUrl(CLIENT_DASHBOARD_URL)
    ) {
      console.error("Negative trend notification function is missing required production-safe server-side environment variables")
      throw new Error("Negative trend notification email is not configured")
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Fetch monthly stats using the RPC we built in Phase 1/2
    const { data: trend, error: trendError } = await supabase.rpc('get_monthly_trend')
    if (trendError) throw trendError

    if (!trend || trend.length < 3) {
      return new Response(JSON.stringify({ message: "Not enough historical data to detect a trend." }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Logic: If current month drops > 10% compared to the average of the previous 2 months
    const current = trend[0]
    const prev1 = trend[1]
    const prev2 = trend[2]

    const twoMonthsAgoAvg = (prev1.health_score + prev2.health_score) / 2
    const dropPercentage = (twoMonthsAgoAvg - current.health_score) / twoMonthsAgoAvg

    if (dropPercentage > 0.10) {
      // Trigger Email Alert
      const dropPercentFormatted = (dropPercentage * 100).toFixed(1)
      const htmlContent = `
        <h2 style="color: #d32f2f;">⚠️ Critical Alert: Negative Trend Detected</h2>
        <p>${CLIENT_PUBLIC_NAME} Management Health Score has dropped significantly.</p>
        <ul>
          <li><strong>Current Score (${current.month}):</strong> ${current.health_score} / 5.0</li>
          <li><strong>Previous 2 Months Average:</strong> ${twoMonthsAgoAvg.toFixed(2)} / 5.0</li>
          <li><strong>Drop:</strong> ${dropPercentFormatted}%</li>
        </ul>
        <p>Immediate review of the <a href="${CLIENT_DASHBOARD_URL}">Admin Dashboard</a> is recommended to identify the operational issues driving this trend.</p>
      `
      const safeHtmlContent = htmlContent.replace(
        /<h2[\s\S]*?<\/h2>/,
        '<h2 style="color: #d32f2f;">Critical Alert: Negative Trend Detected</h2>',
      )

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from: NOTIFICATION_FROM_EMAIL,
          to: [CEO_EMAIL],
          subject: `URGENT: ${CLIENT_PUBLIC_NAME} Management Health Score dropped by ${dropPercentFormatted}%`,
          html: safeHtmlContent
        })
      })

      if (!res.ok) {
        const errorText = await res.text()
        console.error("Resend API error:", errorText)
        throw new Error("Failed to send alert email")
      }

      return new Response(JSON.stringify({ message: "Negative trend alert sent successfully.", dropPercentage }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    return new Response(JSON.stringify({ message: "Trend is stable. No alert needed." }), {
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
