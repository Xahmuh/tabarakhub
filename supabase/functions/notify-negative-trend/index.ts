import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const CEO_EMAIL = Deno.env.get('CEO_EMAIL') || 'ceo@example.com'

serve(async (req) => {
  try {
    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing environment variables")
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
        <p>The Management Health Score has dropped significantly.</p>
        <ul>
          <li><strong>Current Score (${current.month}):</strong> ${current.health_score} / 5.0</li>
          <li><strong>Previous 2 Months Average:</strong> ${twoMonthsAgoAvg.toFixed(2)} / 5.0</li>
          <li><strong>Drop:</strong> ${dropPercentFormatted}%</li>
        </ul>
        <p>Immediate review of the <a href="https://your-app.com/admin/quality-feedback">Admin Dashboard</a> is recommended to identify the operational issues driving this trend.</p>
      `

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from: 'Quality Feedback Alerts <onboarding@resend.dev>', // Replace with your verified domain
          to: [CEO_EMAIL],
          subject: `URGENT: Management Health Score dropped by ${dropPercentFormatted}%`,
          html: htmlContent
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
