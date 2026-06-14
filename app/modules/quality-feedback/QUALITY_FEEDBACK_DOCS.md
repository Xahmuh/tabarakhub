# Quality Feedback Module - Phase 4 Documentation

## 1. Migration Summary
The module has been successfully migrated from `src/modules/quality-feedback/` to `app/modules/quality-feedback/`. All internal references have been updated.

### Files Created in `/app`
- **Components**: `app/modules/quality-feedback/components/`
  - `admin/`: `QuestionManager.tsx`, `ModuleSettingsControl.tsx`
  - `dashboard/`: `AlertBanner.tsx`, `TrendChart.tsx`, `HeatmapGrid.tsx`, `BarComparison.tsx`, `ExperienceBreakdown.tsx`, `CommentsTable.tsx`, `AIInsightsPanel.tsx`, `CorrelationCharts.tsx`, `SettingsPanel.tsx`
  - `form/`: `CommentField.tsx`, `FormProgress.tsx`, `SectionRating.tsx`
  - `shared/`: `ProtectedRoute.tsx`, `ScoreBadge.tsx`
- **Hooks**: `app/modules/quality-feedback/hooks/`
  - `useAnonymityGuard.ts`, `useFeedbackSubmit.ts`, `useDashboardData.ts`
- **Pages**: `app/modules/quality-feedback/pages/`
  - `FeedbackForm.tsx`, `AdminDashboard.tsx`, `ThankYouPage.tsx`
- **Services**: `app/modules/quality-feedback/services/feedbackService.ts`
- **Types**: `app/modules/quality-feedback/types/feedback.types.ts`
- **Utils**: `app/modules/quality-feedback/utils/`
  - `analytics.ts`, `clusterBranches.ts`, `exportData.ts`
- **Migrations**: `app/modules/quality-feedback/migrations/full-migration.sql`

## 2. Supabase Infrastructure
A comprehensive migration file is available at: [full-migration.sql](file:///a:/ACTIONS/tabarakhub/app/modules/quality-feedback/migrations/full-migration.sql)

### Tables Created:
1. `feedback_responses`: Primary feedback storage with sentiment analysis support.
2. `quality_feedback_questions`: Dynamic questionnaire management.
3. `module_settings`: Global module accessibility control.
4. `branch_sales_data`: Correlation data (revenue).
5. `branch_hr_turnover`: Correlation data (staffing).

### Edge Functions:
1. `analyze-sentiment`: Batch processes feedback using Claude API.
2. `generate-monthly-report`: Aggregates monthly data for reporting.
3. `notify-negative-trend`: Sends alerts for low health scores.

## 3. Environment Variables Required
Ensure the following variables are set in your Supabase Project Settings (Edge Functions):
- `AI_INSIGHTS_ENABLED`: Set to `true` only when AI insights are accepted for this dedicated-client scope.
- `ANTHROPIC_API_KEY`: Server-only provider key for Claude AI sentiment analysis. Required only when AI insights are enabled.
- `RESEND_API_KEY`: For monthly reports and CEO notifications.
- `SUPABASE_URL`: Standard Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: For administrative batch updates.
- `FUNCTION_SECRET`: Required for protected report/notification functions.
- `ALLOWED_ORIGIN` or `CLIENT_APP_URL`: Required to restrict Edge Function CORS to the client frontend URL.

Frontend AI controls:
- `VITE_MODULE_AI_INSIGHTS=false` keeps the AI panel disabled/hidden for production validation.
- `VITE_MODULE_AI_INSIGHTS=true` should be used only when the server-side AI secrets above are configured.

Do not expose `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, or `FUNCTION_SECRET` in frontend `VITE_` variables.

## 4. Audit Result
The directory `src/modules/quality-feedback/` is **FULLY AUDITED** and confirmed to be **UNUSED** by the current application. All routes in `App.tsx` and exports in `app/index.ts` point exclusively to the new `app/modules/` location.
*(Note: Manual deletion of the /src folder is required as the automated command was blocked by environment security policies).*
