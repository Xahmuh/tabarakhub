import * as XLSX from 'xlsx';

export const exportToExcel = (dashboardData: any, fileName: string, questions: any[] = []) => {
  const { raw_responses, monthly_trend } = dashboardData;

  if (!raw_responses || raw_responses.length === 0) return;

  // --- 1. Main Sheet: All Responses (Flattened) ---
  const mainData = raw_responses.map((r: any) => {
    const row: any = {
      'Submission ID': r.id,
      'Date': new Date(r.submitted_at || r.created_at).toLocaleDateString(),
      'User ID': r.user_id,
      'Branch': r.branch_name,
      'Department': r.department_name,
      'Cluster': r.branch_cluster,
      'Experience Range': r.experience_range,
      'Overall Average Score': r.overall_avg,
      'Sentiment Label': r.sentiment_label || 'Not Analyzed',
      'Biggest Issue': r.biggest_issue,
      'Improvement Suggestion': r.improvement_suggestion
    };

    // Add individual question scores and notes
    questions.forEach(q => {
      const score = r.ratings?.[q.field_key] || 0;
      const note = r.ratings?.[`note_${q.field_key}`] || '';
      row[`Score: ${q.text_en}`] = score > 0 ? score : 'N/A';
      row[`Note: ${q.text_en}`] = note;
    });

    return row;
  });

  // --- 2. Department & Branch Comparison ---
  const deptMap: Record<string, { total: number, count: number }> = {};
  const branchMap: Record<string, { total: number, count: number }> = {};
  
  raw_responses.forEach((r: any) => {
    if (r.department_name) {
      if (!deptMap[r.department_name]) deptMap[r.department_name] = { total: 0, count: 0 };
      deptMap[r.department_name].total += r.overall_avg;
      deptMap[r.department_name].count++;
    }
    if (r.branch_name) {
      if (!branchMap[r.branch_name]) branchMap[r.branch_name] = { total: 0, count: 0 };
      branchMap[r.branch_name].total += r.overall_avg;
      branchMap[r.branch_name].count++;
    }
  });

  const deptComparison = Object.entries(deptMap).map(([name, stats]) => ({
    'Department Name': name,
    'Average Score': Number((stats.total / stats.count).toFixed(2)),
    'Total Responses': stats.count
  }));

  const branchComparison = Object.entries(branchMap).map(([name, stats]) => ({
    'Branch Name': name,
    'Average Score': Number((stats.total / stats.count).toFixed(2)),
    'Total Responses': stats.count
  }));

  // --- 3. Monthly Trend ---
  const trendSheet = monthly_trend.map((t: any) => ({
    'Month': t.month,
    'Average Score': t.score,
    'Response Count': t.count
  }));

  // --- 4. Low Score Alerts (< 3.0) ---
  const alertsSheet = raw_responses
    .filter((r: any) => r.overall_avg < 3.0)
    .map((r: any) => ({
      'Date': new Date(r.submitted_at || r.created_at).toLocaleDateString(),
      'Branch': r.branch_name,
      'Department': r.department_name,
      'Score': r.overall_avg,
      'Main Issue': r.biggest_issue,
      'Sentiment': r.sentiment_label
    }));

  // --- 5. Heatmap: Weak Areas (Question-level Analysis) ---
  const questionScores: Record<string, { total: number, count: number, cluster: string }> = {};
  questions.forEach(q => {
    questionScores[q.text_en] = { total: 0, count: 0, cluster: q.cluster };
  });

  raw_responses.forEach((r: any) => {
    if (r.ratings) {
      questions.forEach(q => {
        const score = r.ratings[q.field_key];
        if (score && typeof score === 'number' && score > 0) {
          questionScores[q.text_en].total += score;
          questionScores[q.text_en].count++;
        }
      });
    }
  });

  const heatmapSheet = Object.entries(questionScores)
    .filter(([, stats]) => stats.count > 0)
    .map(([text, stats]) => ({
      'Question': text,
      'Category/Cluster': stats.cluster,
      'Average Score': Number((stats.total / stats.count).toFixed(2)),
      'Sample Size': stats.count
    }))
    .sort((a, b) => a['Average Score'] - b['Average Score']);

  // --- 6. Experience-based Analysis ---
  const expMap: Record<string, { total: number, count: number }> = {};
  raw_responses.forEach((r: any) => {
    const range = r.experience_range || 'Unknown';
    if (!expMap[range]) expMap[range] = { total: 0, count: 0 };
    expMap[range].total += r.overall_avg;
    expMap[range].count++;
  });

  const experienceAnalysis = Object.entries(expMap).map(([range, stats]) => ({
    'Experience Range': range,
    'Average Satisfaction': Number((stats.total / stats.count).toFixed(2)),
    'Response Count': stats.count
  }));

  // --- 7. Top Complaints ---
  const complaintsSheet = raw_responses
    .filter((r: any) => r.biggest_issue)
    .map((r: any) => ({
      'Date': new Date(r.submitted_at || r.created_at).toLocaleDateString(),
      'Department': r.department_name,
      'Complaint': r.biggest_issue,
      'Sentiment': r.sentiment_label
    }));

  // --- Create Workbook and Sheets ---
  const wb = XLSX.utils.book_new();
  
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mainData), 'All Responses');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(deptComparison), 'Dept Average');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(branchComparison), 'Branch Comparison');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trendSheet), 'Monthly Trends');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(alertsSheet), 'Low Score Alerts');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(heatmapSheet), 'Weak Areas Heatmap');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(experienceAnalysis), 'Experience Analysis');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(complaintsSheet), 'Complaints');

  // Export
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};
