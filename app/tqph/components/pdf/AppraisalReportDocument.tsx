import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet
} from '@react-pdf/renderer';
import { Branch, Pharmacist_Appraisal, User } from '../../types';

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    lineHeight: 1.4
  },
  // Header Banner
  headerContainer: {
    borderBottomWidth: 2,
    borderBottomColor: '#0F172A',
    paddingBottom: 12,
    marginBottom: 16
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  logoBox: {
    backgroundColor: '#0F172A',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4
  },
  logoText: {
    color: '#D9F99D',
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    letterSpacing: 1
  },
  reportSubtitle: {
    fontSize: 8,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  reportTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginTop: 2
  },

  // Meta & Score Section
  metaSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  metaLeft: {
    width: '65%'
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 3
  },
  metaLabel: {
    width: 110,
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#475569'
  },
  metaValue: {
    flex: 1,
    fontSize: 8.5,
    color: '#0F172A'
  },

  // Total Credit Score Box
  scoreBox: {
    width: '32%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1
  },
  scoreTitle: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2
  },
  scoreValue: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2
  },
  scoreSubtext: {
    fontSize: 7.5,
    color: '#64748B',
    marginBottom: 4
  },
  statusBadge: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 3
  },

  // Pillar Section Header
  pillarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 4.5,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginTop: 10,
    marginBottom: 5
  },
  pillarId: {
    color: '#D9F99D',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5
  },
  pillarTitle: {
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    flex: 1,
    marginLeft: 6
  },

  // Matrix Table
  table: {
    width: '100%',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden'
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    paddingVertical: 4.5,
    paddingHorizontal: 6
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: 'center'
  },
  colCode: {
    width: '10%',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8
  },
  colLabel: {
    width: '66%',
    fontSize: 8,
    color: '#1E293B',
    paddingRight: 6
  },
  colGrade: {
    width: '12%',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center'
  },
  colPoints: {
    width: '12%',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right'
  },

  // Comments & Feedback Box
  commentsBox: {
    marginTop: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    overflow: 'hidden'
  },
  commentsHeader: {
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 5,
    paddingHorizontal: 8
  },
  commentsHeaderTitle: {
    color: '#0F172A',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5
  },
  commentsBody: {
    padding: 8,
    fontSize: 8,
    color: '#334155',
    fontStyle: 'italic',
    lineHeight: 1.5
  },

  // Dual Signatures
  signaturesContainer: {
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  signatureBox: {
    width: '45%'
  },
  signatureTitle: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginBottom: 3
  },
  signatureName: {
    fontSize: 8,
    color: '#475569',
    marginBottom: 20
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#94A3B8',
    marginBottom: 3
  },
  signatureSubtext: {
    fontSize: 7,
    color: '#94A3B8'
  },

  // Footer Page Number
  pageNumber: {
    position: 'absolute',
    fontSize: 7.5,
    bottom: 20,
    left: 36,
    right: 36,
    textAlign: 'center',
    color: '#94A3B8'
  }
});

export interface AppraisalReportDocumentProps {
  appraisal: Pharmacist_Appraisal;
  pharmacist: User;
  branch: Branch;
  supervisor?: User;
}

/**
 * Template 2 — Tabarak Pharmacist Performance Appraisal Form (Section 7.4)
 * Pure functional React-PDF document mapping directly from domain entities.
 */
export const AppraisalReportDocument: React.FC<AppraisalReportDocumentProps> = ({
  appraisal,
  pharmacist,
  branch,
  supervisor
}) => {
  // Section 9 CPR privacy protection
  const maskCPR = (cpr: string) => {
    if (!cpr || cpr.length < 4) return '*********';
    return `******${cpr.slice(-3)}`;
  };

  const isPassed = appraisal.passed;

  const scoreBoxStyle = {
    ...styles.scoreBox,
    backgroundColor: isPassed ? '#F0FDF4' : '#FEF2F2',
    borderColor: isPassed ? '#BBF7D0' : '#FECACA'
  };

  const scoreTextColor = isPassed ? '#15803D' : '#B91C1C';

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const cycleLabel = `${monthNames[appraisal.month - 1] || appraisal.month} ${appraisal.year}`;

  return (
    <Document title={`Appraisal_${pharmacist.name}_${cycleLabel}`}>
      {/* ── Page 1: Executive Cover & Pillars I to III ───── */}
      <Page size="A4" style={styles.page}>
        {/* Header Banner */}
        <View style={styles.headerContainer}>
          <View style={styles.headerTop}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>TABARAK QUALITY HUB</Text>
            </View>
            <Text style={styles.reportSubtitle}>Human Capital Quality & Performance</Text>
          </View>
          <Text style={styles.reportTitle}>Pharmacist Performance Appraisal Report</Text>
        </View>

        {/* Meta & Total Credit Score Card */}
        <View style={styles.metaSection}>
          <View style={styles.metaLeft}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Pharmacist Name:</Text>
              <Text style={styles.metaValue}>{pharmacist.name}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Bahrain CPR (Masked):</Text>
              <Text style={styles.metaValue}>{maskCPR(pharmacist.cpr)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Assigned Branch:</Text>
              <Text style={styles.metaValue}>{branch.name}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Evaluation Cycle:</Text>
              <Text style={styles.metaValue}>{cycleLabel}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Evaluating Supervisor:</Text>
              <Text style={styles.metaValue}>
                {supervisor?.name || 'Dr. Abdelrahman Ahmed (Area Operations & Quality Supervisor)'}
              </Text>
            </View>
          </View>

          {/* Credit Score & Pass/Fail Badge */}
          <View style={scoreBoxStyle}>
            <Text style={[styles.scoreTitle, { color: scoreTextColor }]}>Credit Score</Text>
            <Text style={[styles.scoreValue, { color: scoreTextColor }]}>
              {appraisal.total_credit_score}
            </Text>
            <Text style={styles.scoreSubtext}>out of 150 points (Pass ≥95)</Text>
            <Text
              style={[
                styles.statusBadge,
                {
                  color: scoreTextColor,
                  backgroundColor: isPassed ? '#DCFCE7' : '#FEE2E2'
                }
              ]}
            >
              {isPassed ? 'PASSED (≥ 95 PTS)' : 'DID NOT PASS (< 95 PTS)'}
            </Text>
          </View>
        </View>

        {/* Pillars I to III */}
        {appraisal.sections.slice(0, 3).map(sec => (
          <View key={sec.section_id} wrap={false}>
            <View style={styles.pillarHeader}>
              <Text style={styles.pillarId}>Pillar {sec.section_id}</Text>
              <Text style={styles.pillarTitle}>{sec.title}</Text>
            </View>

            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.colCode}>Code</Text>
                <Text style={styles.colLabel}>Competency Evaluation Criterion</Text>
                <Text style={styles.colGrade}>Grade</Text>
                <Text style={styles.colPoints}>Points</Text>
              </View>

              {sec.criteria.map(crit => (
                <View key={crit.code} style={styles.tableRow}>
                  <Text style={styles.colCode}>{crit.code}</Text>
                  <Text style={styles.colLabel}>{crit.label}</Text>
                  <Text
                    style={[
                      styles.colGrade,
                      {
                        color:
                          crit.grade === 'A*' || crit.grade === 'A'
                            ? '#15803D'
                            : crit.grade === 'B'
                            ? '#0369A1'
                            : crit.grade === 'C'
                            ? '#B45309'
                            : '#B91C1C'
                      }
                    ]}
                  >
                    {crit.grade}
                  </Text>
                  <Text style={styles.colPoints}>{crit.points} / 5</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>

      {/* ── Page 2: Pillars IV to VI, Supervisor Feedback & Signatures ───── */}
      <Page size="A4" style={styles.page}>
        {/* Pillars IV to VI */}
        {appraisal.sections.slice(3).map(sec => (
          <View key={sec.section_id} wrap={false}>
            <View style={styles.pillarHeader}>
              <Text style={styles.pillarId}>Pillar {sec.section_id}</Text>
              <Text style={styles.pillarTitle}>{sec.title}</Text>
            </View>

            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.colCode}>Code</Text>
                <Text style={styles.colLabel}>Competency Evaluation Criterion</Text>
                <Text style={styles.colGrade}>Grade</Text>
                <Text style={styles.colPoints}>Points</Text>
              </View>

              {sec.criteria.map(crit => (
                <View key={crit.code} style={styles.tableRow}>
                  <Text style={styles.colCode}>{crit.code}</Text>
                  <Text style={styles.colLabel}>{crit.label}</Text>
                  <Text
                    style={[
                      styles.colGrade,
                      {
                        color:
                          crit.grade === 'A*' || crit.grade === 'A'
                            ? '#15803D'
                            : crit.grade === 'B'
                            ? '#0369A1'
                            : crit.grade === 'C'
                            ? '#B45309'
                            : '#B91C1C'
                      }
                    ]}
                  >
                    {crit.grade}
                  </Text>
                  <Text style={styles.colPoints}>{crit.points} / 5</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Supervisor Comments & Development Plan */}
        <View style={styles.commentsBox} wrap={false}>
          <View style={styles.commentsHeader}>
            <Text style={styles.commentsHeaderTitle}>
              SUPERVISOR CLINICAL FEEDBACK & IMPROVEMENT DIRECTIVES
            </Text>
          </View>
          <Text style={styles.commentsBody}>
            {appraisal.comments_and_improvement ||
              'Maintains solid clinical standards and regulatory adherence throughout the evaluation period.'}
          </Text>
        </View>

        {/* Dual Signatures Section */}
        <View style={styles.signaturesContainer} wrap={false}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureTitle}>Evaluating Supervisor:</Text>
            <Text style={styles.signatureName}>
              {supervisor?.name || 'Dr. Abdelrahman Ahmed'}
            </Text>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureSubtext}>Supervisor Signature & Professional License No.</Text>
          </View>

          <View style={styles.signatureBox}>
            <Text style={styles.signatureTitle}>Appraised Pharmacist:</Text>
            <Text style={styles.signatureName}>{pharmacist.name}</Text>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureSubtext}>Pharmacist Acknowledgment & Performance Review Signature</Text>
          </View>
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
};
