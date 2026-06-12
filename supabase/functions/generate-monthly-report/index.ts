import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const REPORT_RECIPIENT = Deno.env.get('ADMIN_EMAIL') || 'admin@example.com'
const FUNCTION_SECRET = Deno.env.get('FUNCTION_SECRET')

serve(async (req) => {
  try {
    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing environment variables")
    }
    if (!FUNCTION_SECRET || req.headers.get('x-function-secret') !== FUNCTION_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 401,
      })
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
      <h2>Quality Feedback Monthly Report - ${lastMonthStr}</h2>
      <p>Here is the automated summary for the last month's anonymous feedback.</p>
      <ul>
        <li><strong>Management Health Score:</strong> ${lastMonthData.health_score} / 5.0</li>
        <li><strong>Total Responses:</strong> ${lastMonthData.response_count}</li>
      </ul>
      <p>Log in to the Admin Dashboard for deeper insights, cluster breakdowns, and AI sentiment analysis.</p>
    `

    // Send via Resend API
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'Quality Feedback System <onboarding@resend.dev>', // Replace with your verified domain
        to: [REPORT_RECIPIENT],
        subject: `Monthly Quality Feedback Report - ${lastMonthStr}`,
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
