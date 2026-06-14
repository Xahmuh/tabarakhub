import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCorsPreflight, rejectDisallowedOrigin } from '../_shared/cors.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const AI_INSIGHTS_ENABLED = ['1', 'true', 'yes', 'on'].includes((Deno.env.get('AI_INSIGHTS_ENABLED') || '').toLowerCase())

serve(async (req) => {
  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })

  // Handle CORS
  if (req.method === 'OPTIONS') {
    return handleCorsPreflight(req)
  }

  const corsError = rejectDisallowedOrigin(req)
  if (corsError) return corsError

  try {
    if (!AI_INSIGHTS_ENABLED) {
      return json({ error: 'AI insights are disabled for this deployment.' }, 403)
    }

    if (!ANTHROPIC_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("AI insights function is missing required server-side environment variables")
      return json({ error: 'AI insights are not configured for this deployment.' }, 503)
    }

    // Initialize Supabase client with Service Role to bypass RLS for batch updates
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Verify the user making the request (Admin check)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401)
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const { data: profile, error: profileError } = await supabase
      .from('app_user_profiles')
      .select('role, is_active')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile?.is_active || !['admin', 'manager'].includes(profile.role)) {
      return json({ error: 'Forbidden' }, 403)
    }

    // 1. Fetch unanalyzed responses. Limit to 20 to avoid Edge Function timeouts.
    const { data: responses, error: fetchError } = await supabase
      .from('feedback_responses')
      .select('id, biggest_issue, improvement_suggestion')
      .eq('is_analyzed', false)
      .limit(20)

    if (fetchError) throw fetchError

    if (!responses || responses.length === 0) {
      return json({ message: "No unanalyzed responses found.", processedCount: 0 })
    }

    const processedIds = []
    let successCount = 0

    // 2. Process each response through Claude API
    for (const row of responses) {
      const textToAnalyze = `
        Biggest Issue: ${row.biggest_issue || 'None'}
        Improvement Suggestion: ${row.improvement_suggestion || 'None'}
      `.trim()

      if (textToAnalyze === 'Biggest Issue: None\n        Improvement Suggestion: None') {
        // Nothing to analyze, mark as neutral
        await supabase
          .from('feedback_responses')
          .update({ sentiment_label: 'neutral', key_topics: ['No comments'], is_analyzed: true })
          .eq('id', row.id)
        continue
      }

      const prompt = `
      Analyze the following employee feedback text and provide the sentiment and a list of key topics.
      Respond strictly in JSON format matching this structure:
      {
        "sentiment": "positive" | "neutral" | "negative",
        "topics": ["topic1", "topic2"]
      }
      Do not output any markdown formatting or extra text, only the raw JSON.
      
      Feedback Text:
      "${textToAnalyze}"
      `

      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 300,
            temperature: 0,
            messages: [{ role: 'user', content: prompt }]
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error("Claude API error:", errorText)
          continue
        }

        const aiData = await response.json()
        const aiText = aiData.content[0].text
        
        let parsedResult
        try {
          parsedResult = JSON.parse(aiText)
        } catch (e) {
          // Fallback if Claude returns markdown block
          const jsonMatch = aiText.match(/\{[\s\S]*\}/)
          parsedResult = jsonMatch ? JSON.parse(jsonMatch[0]) : null
        }

        if (parsedResult && parsedResult.sentiment) {
          // Ensure lowercase for DB constraint and dashboard logic
          const sentiment = parsedResult.sentiment.toLowerCase()
          
          // 3. Update the database
          const { error: updateError } = await supabase
            .from('feedback_responses')
            .update({
              sentiment_label: sentiment,
              key_topics: parsedResult.topics || [],
              is_analyzed: true
            })
            .eq('id', row.id)

          if (!updateError) {
            successCount++
            processedIds.push(row.id)
          } else {
            console.error("Supabase update error:", updateError)
          }
        }
      } catch (err) {
        console.error("Failed processing row", row.id, err)
      }
    }

    return json({
      message: `Successfully processed ${successCount} out of ${responses.length} responses.`,
      processedCount: successCount,
      processedIds
    })

  } catch (error: any) {
    return json({ error: error.message }, 400)
  }
})
