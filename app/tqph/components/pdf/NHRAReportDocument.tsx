import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet
} from '@react-pdf/renderer';
import { Branch, CAPA_Task, NHRA_Audit, User } from '../../types';
import { getComplianceColorBand } from '../../services/scoringService';

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    lineHeight: 1.4
  },
  // Header & Cover Banner
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

  // Meta grid & Score Box
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
    width: 100,
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#475569'
  },
  metaValue: {
    flex: 1,
    fontSize: 8.5,
    color: '#0F172A'
  },

  // Score Badge in Header
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
  scoreBandBadge: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 3
  },

  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginTop: 12,
    marginBottom: 6
  },
  sectionCode: {
    color: '#D9F99D',
    fontFamily: 'Helvetica-Bold',
    fontSize: 9
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    flex: 1,
    marginLeft: 6
  },

  // Checklist Table
  table: {
    width: '100%',
    marginBottom: 10,
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
    paddingVertical: 5,
    paddingHorizontal: 6
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 4.5,
    paddingHorizontal: 6,
    alignItems: 'center'
  },
  colCode: {
    width: '10%',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8
  },
  colLabel: {
    width: '52%',
    fontSize: 8,
    color: '#1E293B',
    paddingRight: 6
  },
  colStatus: {
    width: '18%',
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center'
  },
  colNotes: {
    width: '20%',
    fontSize: 7.5,
    color: '#64748B',
    fontStyle: 'italic'
  },

  // Status Badges in Table
  statusGreen: {
    color: '#065F46',
    backgroundColor: '#D1FAE5',
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 3
  },
  statusAmber: {
    color: '#92400E',
    backgroundColor: '#FEF3C7',
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 3
  },
  statusRed: {
    color: '#991B1B',
    backgroundColor: '#FEE2E2',
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 3
  },
  statusNa: {
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 3
  },

  // CAPA Summary Section
  capaContainer: {
    marginTop: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    overflow: 'hidden'
  },
  capaHeader: {
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
    paddingVertical: 6,
    paddingHorizontal: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  capaHeaderTitle: {
    color: '#991B1B',
    fontFamily: 'Helvetica-Bold',
    fontSize: 9.5
  },
  capaRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: 'center'
  },
  capaItemCode: {
    width: '12%',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: '#0F172A'
  },
  capaViolation: {
    width: '38%',
    fontSize: 8,
    color: '#334155',
    paddingRight: 6
  },
  capaAction: {
    width: '32%',
    fontSize: 8,
    color: '#0F172A',
    paddingRight: 6
  },
  capaSeverity: {
    width: '18%',
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right'
  },

  // Signatures Section
  signaturesContainer: {
    marginTop: 24,
    paddingTop: 16,
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
    marginBottom: 4
  },
  signatureName: {
    fontSize: 8,
    color: '#475569',
    marginBottom: 24
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#94A3B8',
    marginBottom: 4
  },
  signatureSubtext: {
    fontSize: 7,
    color: '#94A3B8'
  },

  // Footer
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

export interface NHRAReportDocumentProps {
  audit: NHRA_Audit;
  branch: Branch;
  supervisor: User;
  capas?: CAPA_Task[];
}

/**
 * Template 1 — NHRA Official Inspection Simulation Report (Section 7.4)
 * Pure functional React-PDF document mapping directly from domain entities.
 */
export const NHRAReportDocument: React.FC<NHRAReportDocumentProps> = ({
  audit,
  branch,
  supervisor,
  capas = []
}) => {
  const band = getComplianceColorBand(audit.compliance_score);

  const scoreBoxStyle = {
    ...styles.scoreBox,
    backgroundColor:
      band.band === 'Green' ? '#F0FDF4' : band.band === 'Amber' ? '#FFFBEB' : '#FEF2F2',
    borderColor:
      band.band === 'Green' ? '#BBF7D0' : band.band === 'Amber' ? '#FDE68A' : '#FECACA'
  };

  const scoreTextColor =
    band.band === 'Green' ? '#15803D' : band.band === 'Amber' ? '#B45309' : '#B91C1C';

  return (
    <Document title={`NHRA_Inspection_${branch.name}_${audit.date}`}>
      {/* ── Page 1: Executive Cover & Sections 1.0 to 4.0 ───── */}
      <Page size="A4" style={styles.page}>
        {/* Header Banner */}
        <View style={styles.headerContainer}>
          <View style={styles.headerTop}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>TABARAK QUALITY HUB</Text>
            </View>
            <Text style={styles.reportSubtitle}>Official Regulatory Oversight Audit</Text>
          </View>
          <Text style={styles.reportTitle}>NHRA Pharmacy Inspection Simulation Report</Text>
        </View>

        {/* Meta & Score Card */}
        <View style={styles.metaSection}>
          <View style={styles.metaLeft}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Facility Name:</Text>
              <Text style={styles.metaValue}>{branch.name}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>NHRA License No:</Text>
              <Text style={styles.metaValue}>{branch.license_no}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Branch Manager:</Text>
              <Text style={styles.metaValue}>{branch.manager_name}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Inspection Date:</Text>
              <Text style={styles.metaValue}>{audit.date}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Lead Inspector:</Text>
              <Text style={styles.metaValue}>{supervisor.name} (Area Quality Supervisor)</Text>
            </View>
          </View>

          {/* Prominent Compliance Score Box (Section 5.3) */}
          <View style={scoreBoxStyle}>
            <Text style={[styles.scoreTitle, { color: scoreTextColor }]}>Compliance Score</Text>
            <Text style={[styles.scoreValue, { color: scoreTextColor }]}>
              {audit.compliance_score.toFixed(1)}%
            </Text>
            <Text
              style={[
                styles.scoreBandBadge,
                {
                  color: scoreTextColor,
                  backgroundColor:
                    band.band === 'Green'
                      ? '#DCFCE7'
                      : band.band === 'Amber'
                      ? '#FEF3C7'
                      : '#FEE2E2'
                }
              ]}
            >
              {band.band.toUpperCase()} BAND
            </Text>
          </View>
        </View>

        {/* Sections 1.0 to 4.0 */}
        {audit.sections.slice(0, 4).map(sec => (
          <View key={sec.section_code} wrap={false}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionCode}>Section {sec.section_code}</Text>
              <Text style={styles.sectionTitle}>{sec.title}</Text>
            </View>

            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.colCode}>Code</Text>
                <Text style={styles.colLabel}>Checklist Item Requirement</Text>
                <Text style={styles.colStatus}>Status</Text>
                <Text style={styles.colNotes}>Observation Notes</Text>
              </View>

              {sec.items.map(item => (
                <View key={item.code} style={styles.tableRow}>
                  <Text style={styles.colCode}>{item.code}</Text>
                  <Text style={styles.colLabel}>{item.label}</Text>
                  <View style={{ width: '18%', alignItems: 'center' }}>
                    <Text
                      style={[
                        styles.colStatus,
                        item.status === 'fully_compliant'
                          ? styles.statusGreen
                          : item.status === 'partially_compliant'
                          ? styles.statusAmber
                          : item.status === 'non_compliant'
                          ? styles.statusRed
                          : styles.statusNa
                      ]}
                    >
                      {item.status === 'fully_compliant'
                        ? 'COMPLIANT'
                        : item.status === 'partially_compliant'
                        ? 'PARTIAL'
                        : item.status === 'non_compliant'
                        ? 'NON-COMPLIANT'
                        : 'N/A'}
                    </Text>
                  </View>
                  <Text style={styles.colNotes}>{item.notes || '—'}</Text>
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

      {/* ── Page 2: Sections 5.0 to 8.0, CAPA Summary & Signatures ───── */}
      <Page size="A4" style={styles.page}>
        {/* Sections 5.0 to 8.0 */}
        {audit.sections.slice(4).map(sec => (
          <View key={sec.section_code} wrap={false}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionCode}>Section {sec.section_code}</Text>
              <Text style={styles.sectionTitle}>{sec.title}</Text>
            </View>

            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.colCode}>Code</Text>
                <Text style={styles.colLabel}>Checklist Item Requirement</Text>
                <Text style={styles.colStatus}>Status</Text>
                <Text style={styles.colNotes}>Observation Notes</Text>
              </View>

              {sec.items.map(item => (
                <View key={item.code} style={styles.tableRow}>
                  <Text style={styles.colCode}>{item.code}</Text>
                  <Text style={styles.colLabel}>{item.label}</Text>
                  <View style={{ width: '18%', alignItems: 'center' }}>
                    <Text
                      style={[
                        styles.colStatus,
                        item.status === 'fully_compliant'
                          ? styles.statusGreen
                          : item.status === 'partially_compliant'
                          ? styles.statusAmber
                          : item.status === 'non_compliant'
                          ? styles.statusRed
                          : styles.statusNa
                      ]}
                    >
                      {item.status === 'fully_compliant'
                        ? 'COMPLIANT'
                        : item.status === 'partially_compliant'
                        ? 'PARTIAL'
                        : item.status === 'non_compliant'
                        ? 'NON-COMPLIANT'
                        : 'N/A'}
                    </Text>
                  </View>
                  <Text style={styles.colNotes}>{item.notes || '—'}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Violations Summary & CAPA Section (Section 7.4) */}
        {capas.length > 0 && (
          <View style={styles.capaContainer} wrap={false}>
            <View style={styles.capaHeader}>
              <Text style={styles.capaHeaderTitle}>
                CORRECTIVE & PREVENTIVE ACTIONS (CAPA) — 48H RESOLUTION SLA
              </Text>
              <Text style={{ fontSize: 7.5, color: '#991B1B', fontFamily: 'Helvetica-Bold' }}>
                {capas.length} Action{capas.length > 1 ? 's' : ''} Required
              </Text>
            </View>

            {capas.map(capa => (
              <View key={capa.id} style={styles.capaRow}>
                <Text style={styles.capaItemCode}>Item {capa.element_code}</Text>
                <Text style={styles.capaViolation}>{capa.violation}</Text>
                <Text style={styles.capaAction}>{capa.required_action}</Text>
                <Text
                  style={[
                    styles.capaSeverity,
                    {
                      color:
                        capa.severity === 'Critical'
                          ? '#DC2626'
                          : capa.severity === 'Major'
                          ? '#D97706'
                          : '#2563EB'
                    }
                  ]}
                >
                  [{capa.severity.toUpperCase()}]
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Official Signatures Section */}
        <View style={styles.signaturesContainer} wrap={false}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureTitle}>Area Quality Supervisor:</Text>
            <Text style={styles.signatureName}>{supervisor.name}</Text>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureSubtext}>Official Signature & License Endorsement</Text>
          </View>

          <View style={styles.signatureBox}>
            <Text style={styles.signatureTitle}>Branch Pharmacist-in-Charge:</Text>
            <Text style={styles.signatureName}>{branch.manager_name}</Text>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureSubtext}>Facility Manager Receipt & Acknowledgment Stamp</Text>
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
