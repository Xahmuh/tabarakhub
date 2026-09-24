# Anonymous Quality Feedback Module — Full Implementation Spec

> **Target**: Production-ready module for a pharmacy chain management system  
> **Stack**: React + TypeScript + Vite + Tailwind + Supabase/PostgreSQL  
> **Goal**: Anonymous employee feedback system with Admin Analytics Dashboard  
> **Privacy**: Zero PII storage — no name, employee ID, email, IP, or device fingerprint

---

## 1. Project Context

You are adding a new module called `quality-feedback` to an existing pharmacy chain management system. The system currently has:

- React + TypeScript frontend (Vite)
- Tailwind CSS for styling
- Supabase as backend (PostgreSQL)
- Existing admin auth/role system
- Multi-branch pharmacy structure (some branches have 2–3 employees only)

This module serves two audiences:
1. **Employees (Pharmacists + Staff)** → Submit anonymous feedback
2. **Admins (Management/CEO)** → View aggregated analytics dashboard

---

## 2. Folder Structure

Create the following structure inside `src/modules/quality-feedback/`:

```
src/
└── modules/
    └── quality-feedback/
        ├── pages/
        │   ├── FeedbackForm.tsx          # Employee-facing form
        │   ├── AdminDashboard.tsx        # Admin analytics overview
        │   ├── ResultsPage.tsx           # Full results table
        │   └── ThankYouPage.tsx          # Post-submission confirmation
        │
        ├── components/
        │   ├── form/
        │   │   ├── SectionRating.tsx     # Reusable 1–5 star/number rating section
        │   │   ├── CommentField.tsx      # Textarea with character count
        │   │   └── FormProgress.tsx      # Step progress indicator
        │   │
        │   ├── dashboard/
        │   │   ├── KPICard.tsx           # Score summary cards
        │   │   ├── TrendChart.tsx        # Monthly trend line (Recharts)
        │   │   ├── HeatmapGrid.tsx       # Department × Score heatmap
        │   │   ├── BarComparison.tsx     # Branch cluster comparison
        │   │   ├── ExperienceBreakdown.tsx
        │   │   ├── CommentsTable.tsx     # Anonymous comments log
        │   │   └── AlertBanner.tsx       # Negative trend alert
        │   │
        │   └── shared/
        │       ├── ProtectedRoute.tsx    # Admin-only guard
        │       └── ScoreBadge.tsx        # Color-coded score pill
        │
        ├── hooks/
        │   ├── useFeedbackSubmit.ts
        │   ├── useDashboardData.ts
        │   └── useAnonymityGuard.ts      # localStorage cooldown logic
        │
        ├── services/
        │   └── feedbackService.ts        # Supabase API calls
        │
        ├── types/
        │   └── feedback.types.ts
        │
        └── utils/
            ├── analytics.ts              # Score calculations
            ├── clusterBranches.ts        # Branch clustering logic
            └── exportData.ts             # Excel/PDF export helpers
```

---

## 3. Database Schema

### ⚠️ CRITICAL PRIVACY RULES
**Never store**: name, employee_id, email, user_id, IP address, device fingerprint, or any identifying information.

```sql
-- Run this in Supabase SQL Editor

CREATE TABLE feedback_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Demographic (non-identifying ranges only)
  branch_cluster TEXT NOT NULL,         -- e.g., 'North Cluster', 'Central Cluster'
  role TEXT NOT NULL,                   -- e.g., 'Pharmacist', 'Cashier', 'Warehouse'
  experience_range TEXT NOT NULL,       -- e.g., '0-1 Years', '1-3 Years'

  -- Operations Section (1–5)
  ops_response_speed INTEGER CHECK (ops_response_speed BETWEEN 1 AND 5),
  ops_instruction_clarity INTEGER CHECK (ops_instruction_clarity BETWEEN 1 AND 5),
  ops_problem_resolution INTEGER CHECK (ops_problem_resolution BETWEEN 1 AND 5),

  -- Purchasing Section (1–5)
  pur_item_availability INTEGER CHECK (pur_item_availability BETWEEN 1 AND 5),
  pur_supply_speed INTEGER CHECK (pur_supply_speed BETWEEN 1 AND 5),
  pur_shortage_handling INTEGER CHECK (pur_shortage_handling BETWEEN 1 AND 5),

  -- HR Section (1–5)
  hr_shift_fairness INTEGER CHECK (hr_shift_fairness BETWEEN 1 AND 5),
  hr_policy_clarity INTEGER CHECK (hr_policy_clarity BETWEEN 1 AND 5),
  hr_issue_resolution INTEGER CHECK (hr_issue_resolution BETWEEN 1 AND 5),

  -- IT Section (1–5)
  it_system_stability INTEGER CHECK (it_system_stability BETWEEN 1 AND 5),
  it_support_speed INTEGER CHECK (it_support_speed BETWEEN 1 AND 5),
  it_ease_of_use INTEGER CHECK (it_ease_of_use BETWEEN 1 AND 5),

  -- Overall (1–5)
  overall_score INTEGER CHECK (overall_score BETWEEN 1 AND 5),

  -- Open Comments (no names allowed in content — enforced on frontend)
  biggest_issue TEXT,
  best_thing TEXT,
  improvement_suggestion TEXT,

  -- Metadata (no PII)
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  submission_month TEXT GENERATED ALWAYS AS (TO_CHAR(submitted_at, 'YYYY-MM')) STORED
);

-- Indexes for dashboard queries
CREATE INDEX idx_feedback_month ON feedback_responses(submission_month);
CREATE INDEX idx_feedback_cluster ON feedback_responses(branch_cluster);
CREATE INDEX idx_feedback_role ON feedback_responses(role);

-- Row Level Security: only service_role can read (admin only via backend)
ALTER TABLE feedback_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read only" ON feedback_responses
  FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "Anyone can insert anonymously" ON feedback_responses
  FOR INSERT WITH CHECK (true);
```

---

## 4. TypeScript Types

```typescript
// types/feedback.types.ts

export type ExperienceRange = '0-1 Years' | '1-3 Years' | '3-5 Years' | '5+ Years';

export type BranchCluster = 'North Cluster' | 'Central Cluster' | 'South Cluster' | 'East Cluster';

export type Role = 'Pharmacist' | 'Cashier' | 'Warehouse Staff' | 'Delivery' | 'Supervisor';

export interface FeedbackFormData {
  // Demographic
  branch_cluster: BranchCluster;
  role: Role;
  experience_range: ExperienceRange;

  // Operations
  ops_response_speed: number;
  ops_instruction_clarity: number;
  ops_problem_resolution: number;

  // Purchasing
  pur_item_availability: number;
  pur_supply_speed: number;
  pur_shortage_handling: number;

  // HR
  hr_shift_fairness: number;
  hr_policy_clarity: number;
  hr_issue_resolution: number;

  // IT
  it_system_stability: number;
  it_support_speed: number;
  it_ease_of_use: number;

  // Overall
  overall_score: number;

  // Open Comments
  biggest_issue: string;
  best_thing: string;
  improvement_suggestion: string;
}

export interface DashboardMetrics {
  management_health_score: number;  // avg of all dept scores
  operations_avg: number;
  purchasing_avg: number;
  hr_avg: number;
  it_avg: number;
  overall_avg: number;
  total_responses: number;
  monthly_trend: MonthlyTrend[];
  by_cluster: ClusterScore[];
  by_role: RoleScore[];
  by_experience: ExperienceScore[];
  comments: AnonymousComment[];
  negative_alert: boolean;           // true if score dropped >10% over 2 months
}

export interface MonthlyTrend {
  month: string;        // 'YYYY-MM'
  health_score: number;
  response_count: number;
}

export interface ClusterScore {
  cluster: BranchCluster;
  avg_score: number;
  response_count: number;
}

export interface RoleScore {
  role: Role;
  avg_score: number;
}

export interface ExperienceScore {
  experience_range: ExperienceRange;
  avg_score: number;
  dissatisfaction_rate: number; // % of scores <= 2
}

export interface AnonymousComment {
  id: string;
  submitted_at: string;
  branch_cluster: BranchCluster;
  role: Role;
  biggest_issue: string | null;
  best_thing: string | null;
  improvement_suggestion: string | null;
}
```

---

## 5. Full Questionnaire — Bilingual (English / Arabic)

### Section 0: Basic Information

| Field | English Label | Arabic Label | Options |
|-------|--------------|--------------|---------|
| branch_cluster | Branch Area | منطقة الفرع | North Cluster / Central Cluster / South Cluster / East Cluster |
| role | Your Role | وظيفتك | Pharmacist / Cashier / Warehouse Staff / Delivery / Supervisor |
| experience_range | Years of Experience | سنوات الخبرة | 0-1 Years / 1-3 Years / 3-5 Years / 5+ Years |

---

### Section 1: Operations Department — قسم العمليات

**Rating Scale: 1 (Very Poor) → 5 (Excellent)**  
**مقياس التقييم: 1 (ضعيف جداً) → 5 (ممتاز)**

| Field | English Question | Arabic Question |
|-------|-----------------|-----------------|
| ops_response_speed | How quickly does management respond to operational issues? | ما مدى سرعة استجابة الإدارة للمشاكل التشغيلية؟ |
| ops_instruction_clarity | Are management instructions clear and easy to follow? | هل تعليمات الإدارة واضحة وسهلة التطبيق؟ |
| ops_problem_resolution | How effectively does management resolve day-to-day problems? | ما مدى فاعلية الإدارة في حل مشاكل العمل اليومية؟ |

---

### Section 2: Purchasing Department — قسم المشتريات

| Field | English Question | Arabic Question |
|-------|-----------------|-----------------|
| pur_item_availability | Are the required products and items consistently available? | هل الأصناف والمنتجات المطلوبة متوفرة باستمرار؟ |
| pur_supply_speed | How fast does the purchasing team fulfill supply requests? | ما مدى سرعة فريق المشتريات في تلبية طلبات التوريد؟ |
| pur_shortage_handling | How well does management handle shortage situations? | كيف تتعامل الإدارة مع حالات النقص في المخزون؟ |

---

### Section 3: HR Department — قسم الموارد البشرية

| Field | English Question | Arabic Question |
|-------|-----------------|-----------------|
| hr_shift_fairness | Are shifts and schedules distributed fairly among staff? | هل يتم توزيع الشفتات والجداول بشكل عادل بين الموظفين؟ |
| hr_policy_clarity | Are HR policies and procedures clearly communicated? | هل يتم توضيح سياسات وإجراءات الموارد البشرية بشكل واضح؟ |
| hr_issue_resolution | How well does HR address and resolve employee concerns? | ما مدى فاعلية قسم الموارد البشرية في معالجة مشاكل الموظفين؟ |

---

### Section 4: IT Department — قسم تقنية المعلومات

| Field | English Question | Arabic Question |
|-------|-----------------|-----------------|
| it_system_stability | How stable and reliable are the systems you use daily? | ما مدى استقرار وموثوقية الأنظمة التي تستخدمها يومياً؟ |
| it_support_speed | How quickly does IT resolve technical issues? | ما مدى سرعة فريق IT في حل المشاكل التقنية؟ |
| it_ease_of_use | How easy are the systems to use in your daily work? | ما مدى سهولة استخدام الأنظمة في عملك اليومي؟ |

---

### Section 5: Overall Evaluation — التقييم العام

| Field | English Question | Arabic Question |
|-------|-----------------|-----------------|
| overall_score | Overall, does management support you in doing your job effectively? | بشكل عام، هل تدعمك الإدارة في أداء عملك بكفاءة؟ |

---

### Section 6: Open Comments — التعليقات المفتوحة

| Field | English Label | Arabic Label | Required When |
|-------|--------------|--------------|---------------|
| biggest_issue | What is the biggest operational challenge you face? | ما أكبر تحدٍّ تشغيلي تواجهه في عملك؟ | Required if any score ≤ 2 |
| best_thing | What does management do best? | ما أفضل شيء تقدمه الإدارة؟ | Optional |
| improvement_suggestion | What is one thing management should improve immediately? | ما الشيء الواحد الذي يجب على الإدارة تحسينه فوراً؟ | Optional |

**⚠️ Frontend validation rule**: If `biggest_issue` is shown, display a warning:  
> "Please do not include your name or any personal information."  
> "يرجى عدم ذكر اسمك أو أي معلومات شخصية."

---

## 6. Anti-Abuse & Anonymity Logic

### 6.1 Submission Cooldown (30 days)

```typescript
// hooks/useAnonymityGuard.ts

const COOLDOWN_KEY = 'qf_last_submission';
const COOLDOWN_DAYS = 30;

export function useAnonymityGuard() {
  const hasSubmittedRecently = (): boolean => {
    const lastSubmission = localStorage.getItem(COOLDOWN_KEY);
    if (!lastSubmission) return false;
    const daysSince = (Date.now() - parseInt(lastSubmission)) / (1000 * 60 * 60 * 24);
    return daysSince < COOLDOWN_DAYS;
  };

  const markSubmitted = () => {
    localStorage.setItem(COOLDOWN_KEY, Date.now().toString());
  };

  const daysUntilNextSubmission = (): number => {
    const lastSubmission = localStorage.getItem(COOLDOWN_KEY);
    if (!lastSubmission) return 0;
    const daysSince = (Date.now() - parseInt(lastSubmission)) / (1000 * 60 * 60 * 24);
    return Math.ceil(COOLDOWN_DAYS - daysSince);
  };

  return { hasSubmittedRecently, markSubmitted, daysUntilNextSubmission };
}
```

### 6.2 Comment Required Rule

```typescript
// In FeedbackForm.tsx validation logic

const allScores = [
  formData.ops_response_speed,
  formData.ops_instruction_clarity,
  formData.ops_problem_resolution,
  formData.pur_item_availability,
  formData.pur_supply_speed,
  formData.pur_shortage_handling,
  formData.hr_shift_fairness,
  formData.hr_policy_clarity,
  formData.hr_issue_resolution,
  formData.it_system_stability,
  formData.it_support_speed,
  formData.it_ease_of_use,
  formData.overall_score,
];

const hasLowScore = allScores.some(score => score <= 2);
const commentRequired = hasLowScore && !formData.biggest_issue.trim();
```

---

## 7. Form UX Flow (Multi-Step)

Build as a **multi-step wizard** with progress indicator:

```
Step 1: Welcome Screen (anonymity promise + instructions)
Step 2: Basic Information (cluster, role, experience)
Step 3: Operations Rating (3 questions)
Step 4: Purchasing Rating (3 questions)
Step 5: HR Rating (3 questions)
Step 6: IT Rating (3 questions)
Step 7: Overall + Open Comments
Step 8: Review & Submit
Step 9: Thank You Page
```

### Welcome Screen Copy (Bilingual)

**English:**
> This survey is completely anonymous. We do not collect your name, employee ID, or any personal information. Your honest feedback helps us improve operations for everyone.

**Arabic:**
> هذا الاستبيان مجهول الهوية تمامًا. لا نقوم بجمع اسمك أو رقمك الوظيفي أو أي بيانات شخصية. ملاحظاتك الصادقة تساعدنا في تحسين العمل للجميع.

---

## 8. Rating Component Spec

Build a `SectionRating` component that renders each question as:

- Question text (bilingual, toggle via `lang` prop)
- A **1–5 interactive rating** (use large clickable buttons or star icons)
- Color feedback: 1–2 = red, 3 = amber, 4–5 = green
- Tooltip on each number:

| Score | English | Arabic |
|-------|---------|--------|
| 1 | Very Poor | ضعيف جداً |
| 2 | Poor | ضعيف |
| 3 | Average | متوسط |
| 4 | Good | جيد |
| 5 | Excellent | ممتاز |

---

## 9. Admin Dashboard Spec

### 9.1 KPI Cards (Top Row)

Display 6 cards:

| Card | Formula | Color Threshold |
|------|---------|-----------------|
| Management Health Score | avg(ops + pur + hr + it) / 4 | <3 red / 3–4 amber / >4 green |
| Operations Score | avg(ops_*) | same |
| Purchasing Score | avg(pur_*) | same |
| HR Score | avg(hr_*) | same |
| IT Score | avg(it_*) | same |
| Total Responses | COUNT(*) | neutral |

### 9.2 Negative Trend Alert

Show red `AlertBanner` if:
- Health Score dropped > 10% compared to 2 months ago
- Formula: `(prev_month_score - current_score) / prev_month_score > 0.10`

Alert message:
> **EN**: "⚠️ Management Health Score has dropped by X% over the last 2 months. Immediate review recommended."  
> **AR**: "⚠️ انخفض مؤشر صحة الإدارة بنسبة X% خلال الشهرين الماضيين. يُنصح بالمراجعة الفورية."

### 9.3 Charts

#### Chart 1: Monthly Trend (Area Chart — Recharts)
- X-axis: Month (last 12 months)
- Y-axis: Score (1–5)
- Lines: Overall, Operations, HR, Purchasing, IT
- Show response count as secondary bar

#### Chart 2: Department Heatmap (Custom Grid)
- Rows: Operations / Purchasing / HR / IT
- Columns: Months (last 6)
- Cell color: Red → Amber → Green based on avg score

#### Chart 3: Branch Cluster Comparison (Horizontal Bar — Recharts)
- Bars per cluster
- Tooltip showing response count and avg score

#### Chart 4: Experience Breakdown (Recharts BarChart)
- X-axis: Experience ranges
- Y-axis: Avg score
- Secondary line: Dissatisfaction rate (% scores ≤ 2)

#### Chart 5: Comments Table
Columns:
- Date
- Branch Cluster
- Role
- Biggest Issue
- Improvement Suggestion

No name, no branch name, no employee ID. Filterable by month, cluster, role.

### 9.4 Dashboard Filters

```tsx
// Filter bar state
interface DashboardFilters {
  dateFrom: string;        // YYYY-MM
  dateTo: string;          // YYYY-MM
  cluster: BranchCluster | 'All';
  role: Role | 'All';
  experience: ExperienceRange | 'All';
}
```

---

## 10. Supabase Service Layer

```typescript
// services/feedbackService.ts

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Employee: Submit feedback
export async function submitFeedback(data: FeedbackFormData): Promise<void> {
  const { error } = await supabase
    .from('feedback_responses')
    .insert([data]);
  if (error) throw error;
}

// Admin: Fetch all responses with filters
export async function fetchResponses(filters: DashboardFilters) {
  let query = supabase
    .from('feedback_responses')
    .select('*')
    .gte('submission_month', filters.dateFrom)
    .lte('submission_month', filters.dateTo);

  if (filters.cluster !== 'All') query = query.eq('branch_cluster', filters.cluster);
  if (filters.role !== 'All') query = query.eq('role', filters.role);
  if (filters.experience !== 'All') query = query.eq('experience_range', filters.experience);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Admin: Monthly trend aggregation (use Supabase RPC or process client-side)
export async function fetchMonthlyTrend(): Promise<MonthlyTrend[]> {
  const { data, error } = await supabase.rpc('get_monthly_trend');
  if (error) throw error;
  return data;
}
```

### Supabase RPC for Monthly Trend

```sql
CREATE OR REPLACE FUNCTION get_monthly_trend()
RETURNS TABLE (
  month TEXT,
  health_score NUMERIC,
  response_count BIGINT
) AS $$
  SELECT
    submission_month AS month,
    ROUND(AVG((
      ops_response_speed + ops_instruction_clarity + ops_problem_resolution +
      pur_item_availability + pur_supply_speed + pur_shortage_handling +
      hr_shift_fairness + hr_policy_clarity + hr_issue_resolution +
      it_system_stability + it_support_speed + it_ease_of_use
    )::NUMERIC / 12), 2) AS health_score,
    COUNT(*) AS response_count
  FROM feedback_responses
  GROUP BY submission_month
  ORDER BY submission_month DESC
  LIMIT 12;
$$ LANGUAGE SQL SECURITY DEFINER;
```

---

## 11. Analytics Utility Functions

```typescript
// utils/analytics.ts

export function calcDeptAvg(responses: any[], fields: string[]): number {
  if (!responses.length) return 0;
  const total = responses.reduce((sum, r) => {
    const deptSum = fields.reduce((s, f) => s + (r[f] || 0), 0);
    return sum + deptSum / fields.length;
  }, 0);
  return Math.round((total / responses.length) * 10) / 10;
}

export function calcHealthScore(metrics: Pick<DashboardMetrics, 'operations_avg' | 'purchasing_avg' | 'hr_avg' | 'it_avg'>): number {
  return Math.round(
    ((metrics.operations_avg + metrics.purchasing_avg + metrics.hr_avg + metrics.it_avg) / 4) * 10
  ) / 10;
}

export function detectNegativeTrend(trend: MonthlyTrend[]): boolean {
  if (trend.length < 3) return false;
  const [current, prev1, prev2] = trend;
  const twoMonthsAgo = (prev1.health_score + prev2.health_score) / 2;
  return (twoMonthsAgo - current.health_score) / twoMonthsAgo > 0.10;
}

export function calcDissatisfactionRate(responses: any[], scoreFields: string[]): number {
  if (!responses.length) return 0;
  const lowScoreCount = responses.filter(r =>
    scoreFields.some(f => r[f] <= 2)
  ).length;
  return Math.round((lowScoreCount / responses.length) * 100);
}
```

---

## 12. Branch Clustering Logic

```typescript
// utils/clusterBranches.ts
// Map actual branch names to clusters (update with real branch list)

const BRANCH_CLUSTER_MAP: Record<string, string> = {
  'Branch A': 'North Cluster',
  'Branch B': 'North Cluster',
  'Branch C': 'Central Cluster',
  'Branch D': 'Central Cluster',
  'Branch E': 'South Cluster',
  // Add all branches here
};

export function getBranchCluster(branchName: string): string {
  return BRANCH_CLUSTER_MAP[branchName] ?? 'Other';
}

// In FeedbackForm: show branch cluster dropdown directly
// Do NOT show individual branch names in the form
```

---

## 13. Routing Setup

```tsx
// Add to your main router

import { ProtectedRoute } from '@/modules/quality-feedback/components/shared/ProtectedRoute';

const qualityFeedbackRoutes = [
  {
    path: '/feedback',
    element: <FeedbackForm />,
  },
  {
    path: '/feedback/thank-you',
    element: <ThankYouPage />,
  },
  {
    path: '/admin/quality-feedback',
    element: (
      <ProtectedRoute roles={['admin', 'ceo']}>
        <AdminDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/quality-feedback/results',
    element: (
      <ProtectedRoute roles={['admin', 'ceo']}>
        <ResultsPage />
      </ProtectedRoute>
    ),
  },
];
```

---

## 14. UI Design Directives

### Form Design
- Clean, calm, pharmacy-appropriate aesthetic
- RTL support with `dir="rtl"` toggle for Arabic mode
- Language toggle button (EN / AR) in top-right
- Progress bar showing step completion
- Each rating section has a subtle department icon
- Mobile-first responsive layout
- Smooth step transitions (slide left/right animation)

### Dashboard Design
- Dark sidebar + light content area
- KPI cards with trend arrow indicators (↑ green / ↓ red)
- Charts use a consistent color palette:
  - Operations: `#3B82F6` (blue)
  - Purchasing: `#10B981` (emerald)
  - HR: `#F59E0B` (amber)
  - IT: `#8B5CF6` (purple)
  - Overall: `#6B7280` (gray)
- Red alert banner at top if negative trend detected
- Export button (Excel) in top-right of dashboard

### Color Score System (used across all components)
```
score >= 4.0  → green  (#10B981)
score >= 3.0  → amber  (#F59E0B)
score < 3.0   → red    (#EF4444)
```

---

## 15. Export Feature (Phase 2)

```typescript
// utils/exportData.ts
// Use: npm install xlsx file-saver

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export function exportToExcel(responses: any[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(responses.map(r => ({
    'Month': r.submission_month,
    'Cluster': r.branch_cluster,
    'Role': r.role,
    'Experience': r.experience_range,
    'Operations Avg': calcDeptAvg([r], ['ops_response_speed', 'ops_instruction_clarity', 'ops_problem_resolution']),
    'Purchasing Avg': calcDeptAvg([r], ['pur_item_availability', 'pur_supply_speed', 'pur_shortage_handling']),
    'HR Avg': calcDeptAvg([r], ['hr_shift_fairness', 'hr_policy_clarity', 'hr_issue_resolution']),
    'IT Avg': calcDeptAvg([r], ['it_system_stability', 'it_support_speed', 'it_ease_of_use']),
    'Overall Score': r.overall_score,
    'Biggest Issue': r.biggest_issue || '',
    'Best Thing': r.best_thing || '',
    'Improvement': r.improvement_suggestion || '',
  })));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Feedback Data');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf]), `${filename}.xlsx`);
}
```

---

## 16. Package Dependencies

```bash
# Required
npm install recharts
npm install @supabase/supabase-js

# Phase 2 (export)
npm install xlsx file-saver
npm install @types/file-saver -D
```

---

## 17. Environment Variables

```env
# .env.local
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## 18. Implementation Phases

### Phase 1 — MVP (Week 1–2)
- [ ] Database table + RLS policies
- [ ] FeedbackForm (multi-step, bilingual)
- [ ] ThankYouPage
- [ ] Supabase insert (anonymous)
- [ ] LocalStorage cooldown (30 days)
- [ ] AdminDashboard (KPI cards + basic table)
- [ ] ProtectedRoute guard

### Phase 2 — Analytics (Week 3–4)
- [ ] TrendChart (monthly line)
- [ ] HeatmapGrid (dept × month)
- [ ] BarComparison (clusters)
- [ ] ExperienceBreakdown chart
- [ ] CommentsTable with filters
- [ ] Negative trend alert banner
- [ ] Excel export

### Phase 3 — Intelligence (Month 2+)
- [ ] AI sentiment analysis on open comments
- [ ] Correlation with branch sales data
- [ ] HR turnover correlation
- [ ] Automated monthly report generation
- [ ] Push notification to CEO on negative trend

---

## 19. Important CEO Policy Note

This system is designed exclusively for:
- ✅ Identifying operational problems
- ✅ Measuring management effectiveness
- ✅ Improving employee experience
- ✅ Data-driven decision making

It must never be used for:
- ❌ Identifying who submitted feedback
- ❌ Disciplining employees based on feedback content
- ❌ Tracing responses to specific individuals

**Enforce this at the database level (no PII columns) and organizational policy level.**

---

*Spec Version: 1.0 | Last Updated: May 2026*  
*Prepared for: Pharmacy Chain Management System — Quality Feedback Module*
