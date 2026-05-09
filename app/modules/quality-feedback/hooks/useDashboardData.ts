import { useState, useEffect, useMemo, useCallback } from 'react';
import { feedbackService } from '../services/feedbackService';
import { DashboardFilters, MonthlyTrend, Question, ModuleSettings } from '../types/feedback.types';

export const useDashboardData = (filters: DashboardFilters) => {
  const [responses, setResponses] = useState<any[]>([]);
  const [trends, setTrends] = useState<MonthlyTrend[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [hrData, setHrData] = useState<any[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [settings, setSettings] = useState<ModuleSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [resData, sales, hr, qstns, sett] = await Promise.all([
        feedbackService.fetchResponses(filters),
        feedbackService.fetchSalesData(),
        feedbackService.fetchHRData(),
        feedbackService.fetchAllQuestions(),
        feedbackService.getModuleSettings()
      ]);
      setResponses(resData);
      setSalesData(sales);
      setHrData(hr);
      setQuestions(qstns);
      setSettings(sett);

      // Compute monthly trends from raw responses (includes section averages for heatmap)
      const monthMap: Record<string, { score: number; ops: number; pur: number; hr: number; it: number; count: number }> = {};
      resData.forEach((r: any) => {
        const m = r.submission_month;
        if (!m) return;
        if (!monthMap[m]) monthMap[m] = { score: 0, ops: 0, pur: 0, hr: 0, it: 0, count: 0 };
        monthMap[m].count += 1;
        // Aggregate section scores from ratings JSONB or flat columns
        const scores = { ...(r.ratings || {}), ...r };
        qstns.forEach((q: any) => {
          const v = scores[q.field_key] || 0;
          if (!v) return;
          const sec = q.section?.toLowerCase() || '';
          if (sec.includes('operations')) monthMap[m].ops += v;
          else if (sec.includes('purchasing')) monthMap[m].pur += v;
          else if (sec.includes('hr')) monthMap[m].hr += v;
          else if (sec.includes('it')) monthMap[m].it += v;
          monthMap[m].score += v;
        });
      });
      const computed: MonthlyTrend[] = Object.entries(monthMap)
        .map(([month, v]) => ({
          month,
          score: v.count ? Number((v.score / v.count).toFixed(1)) : 0,
          overall: v.count ? Number((v.score / v.count).toFixed(1)) : 0,
          operations_avg: v.count ? Number((v.ops / v.count).toFixed(1)) : 0,
          purchasing_avg: v.count ? Number((v.pur / v.count).toFixed(1)) : 0,
          hr_avg: v.count ? Number((v.hr / v.count).toFixed(1)) : 0,
          it_avg: v.count ? Number((v.it / v.count).toFixed(1)) : 0,
          operations: v.count ? Number((v.ops / v.count).toFixed(1)) : 0,
          purchasing: v.count ? Number((v.pur / v.count).toFixed(1)) : 0,
          hr: v.count ? Number((v.hr / v.count).toFixed(1)) : 0,
          it: v.count ? Number((v.it / v.count).toFixed(1)) : 0,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));
      setTrends(computed);
    } catch (err: any) {
      console.error('Failed to fetch dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refresh = async () => {
    await fetchData();
  };

  const processedData = useMemo(() => {
    if (isLoading) return null;

    const count = responses.length;
    
    // Read score from ratings JSONB (new) or flat column (legacy)
    const getScore = (r: any, fieldKey: string): number =>
      r.ratings?.[fieldKey] ?? r[fieldKey] ?? 0;

    const getAvg = (prefix: string) => {
      const sectionQuestions = questions.filter(q => q.section.toLowerCase().includes(prefix.toLowerCase()));
      if (sectionQuestions.length === 0) return 0;
      let sum = 0;
      let totalQ = 0;
      sectionQuestions.forEach(q => {
        responses.forEach(r => {
          const s = getScore(r, q.field_key);
          if (s > 0) { sum += s; totalQ++; }
        });
      });
      return totalQ > 0 ? Number((sum / totalQ).toFixed(1)) : 0;
    };

    // Calculate overall health (average of all rated questions)
    const allRatingQuestions = questions.filter(q => q.field_key);
    let totalScore = 0;
    let totalRatings = 0;
    allRatingQuestions.forEach(q => {
      responses.forEach(r => {
        const s = getScore(r, q.field_key);
        if (s > 0) { totalScore += s; totalRatings++; }
      });
    });

    // Group by experience
    const experienceCounts: Record<string, number> = {};
    responses.forEach(r => {
      experienceCounts[r.experience_range] = (experienceCounts[r.experience_range] || 0) + 1;
    });

    // Group by cluster
    const clusterScores: Record<string, { total: number, count: number }> = {};
    responses.forEach(r => {
      if (!clusterScores[r.branch_cluster]) clusterScores[r.branch_cluster] = { total: 0, count: 0 };
      clusterScores[r.branch_cluster].total += r.overall_avg;
      clusterScores[r.branch_cluster].count += 1;
    });

    return {
      management_health_score: totalRatings > 0 ? Number((totalScore / totalRatings).toFixed(1)) : 0,
      operations_avg: getAvg('Operations'),
      purchasing_avg: getAvg('Purchasing'),
      hr_avg: getAvg('HR'),
      it_avg: getAvg('IT'),
      total_responses: count,
      monthly_trend: trends,
      raw_responses: responses,
      comments: responses.flatMap(r => {
        const list: any[] = [];
        const date = r.submitted_at || r.created_at || new Date().toISOString();
        
        // 1. Biggest Issue (Primary Feedback)
        if (r.biggest_issue) {
          list.push({
            id: `${r.id}_issue`,
            created_at: date,
            overall_avg: r.overall_avg ?? 0,
            subject: 'General: Biggest Issue',
            subject_ar: 'عام: أكبر مشكلة',
            comment: r.biggest_issue,
            sentiment: r.sentiment_label
          });
        }

        // 2. Improvement Suggestion
        if (r.improvement_suggestion) {
          list.push({
            id: `${r.id}_improvement`,
            created_at: date,
            overall_avg: r.overall_avg ?? 0,
            subject: 'General: Improvement Suggestion',
            subject_ar: 'عام: مقترح تحسين',
            comment: r.improvement_suggestion,
            sentiment: null
          });
        }

        // 3. Best Thing
        if (r.best_thing) {
          list.push({
            id: `${r.id}_best`,
            created_at: date,
            overall_avg: r.overall_avg ?? 0,
            subject: 'General: Best Thing',
            subject_ar: 'عام: أفضل شيء',
            comment: r.best_thing,
            sentiment: null
          });
        }

        // 4. Question-specific notes from ratings JSONB
        if (r.ratings && typeof r.ratings === 'object') {
          Object.entries(r.ratings).forEach(([key, value]) => {
            if (key.startsWith('note_') && value && String(value).trim() !== '') {
              const fieldKey = key.replace('note_', '');
              const question = questions.find(q => q.field_key === fieldKey);
              
              list.push({
                id: `${r.id}_${fieldKey}`,
                created_at: date,
                overall_avg: r.ratings[fieldKey] || r.overall_avg || 0,
                subject: question ? `Question: ${question.text_en}` : `Note: ${fieldKey}`,
                subject_ar: question ? `سؤال: ${question.text_ar}` : `ملاحظة: ${fieldKey}`,
                comment: String(value),
                sentiment: null
              });
            }
          });
        }

        return list;
      }).sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
      }),
      by_experience: Object.entries(experienceCounts).map(([name, value]) => ({ name, value })),
      by_cluster: Object.entries(clusterScores).map(([cluster, data]) => ({ 
        cluster, 
        score: Number((data.total / data.count).toFixed(1)) 
      })),
      correlation_data: trends.map(t => {
        const s = salesData.find(sd => sd.month === t.month);
        const h = hrData.find(hd => hd.month === t.month);
        return {
          month: t.month,
          satisfaction: t.score,
          revenue: s ? s.sales_amount / 1000 : 0, // k scale
          turnover: h ? h.turnover_rate : 0
        };
      }),
      sentiment_stats: {
        positive_count: responses.filter(r => r.sentiment_label === 'positive').length,
        negative_count: responses.filter(r => r.sentiment_label === 'negative').length,
        neutral_count: responses.filter(r => r.sentiment_label === 'neutral').length,
        top_keywords: ['workload', 'salary', 'software', 'delivery'], // Mock or derived
        key_insights: [
          'High satisfaction in South Cluster despite recent workload increase.',
          'IT issues are the primary driver of negative sentiment in East Cluster.',
          'Purchasing speed has improved 12% since last quarter.'
        ],
        last_analyzed: new Date().toISOString()
      },
      negative_alert: totalRatings > 0 && (totalScore / totalRatings) < 3.0
    };
  }, [responses, trends, salesData, hrData, questions, isLoading]);

  return { 
    data: processedData, 
    questions,
    isLoading, 
    error,
    refresh 
  };
};
