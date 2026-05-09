export const calculateHealthScore = (responses: any[]) => {
  if (!responses.length) return 0;
  
  const total = responses.reduce((acc, curr) => acc + curr.overall_avg, 0);
  return total / responses.length;
};

export const groupMonthlyTrend = (responses: any[]) => {
  const months: Record<string, any> = {};
  
  responses.forEach(r => {
    const month = r.submission_month;
    if (!months[month]) {
      months[month] = { 
        month, 
        score: 0, 
        count: 0,
        operations_avg: 0,
        purchasing_avg: 0,
        hr_avg: 0,
        it_avg: 0
      };
    }
    months[month].score += r.overall_avg;
    months[month].operations_avg += r.operations_avg;
    months[month].purchasing_avg += r.purchasing_avg;
    months[month].hr_avg += r.hr_avg;
    months[month].it_avg += r.it_avg;
    months[month].count += 1;
  });

  return Object.values(months).map(m => ({
    ...m,
    score: Number((m.score / m.count).toFixed(1)),
    operations_avg: Number((m.operations_avg / m.count).toFixed(1)),
    purchasing_avg: Number((m.purchasing_avg / m.count).toFixed(1)),
    hr_avg: Number((m.hr_avg / m.count).toFixed(1)),
    it_avg: Number((m.it_avg / m.count).toFixed(1))
  })).sort((a, b) => a.month.localeCompare(b.month));
};
