import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { Branch, CAPA_Task, NHRA_Audit, Pharmacist_Appraisal, User } from '../types';
import { NHRAReportDocument } from '../components/pdf/NHRAReportDocument';
import { AppraisalReportDocument } from '../components/pdf/AppraisalReportDocument';

/**
 * PDF Export Service (Section 7.4)
 * Pure functions generating downloadable PDF Blobs from domain entities.
 */

/**
 * Generates Template 1: NHRA Official Inspection Simulation Report PDF Blob
 */
export async function generateNHRAReportPDF(
  audit: NHRA_Audit,
  branch: Branch,
  supervisor: User,
  capas: CAPA_Task[] = []
): Promise<Blob> {
  const doc = React.createElement(NHRAReportDocument, {
    audit,
    branch,
    supervisor,
    capas
  });
  const instance = pdf(doc as any);
  return await instance.toBlob();
}

/**
 * Generates Template 2: Tabarak Pharmacist Performance Appraisal Form PDF Blob
 */
export async function generateAppraisalPDF(
  appraisal: Pharmacist_Appraisal,
  pharmacist: User,
  branch: Branch,
  supervisor?: User
): Promise<Blob> {
  const doc = React.createElement(AppraisalReportDocument, {
    appraisal,
    pharmacist,
    branch,
    supervisor
  });
  const instance = pdf(doc as any);
  return await instance.toBlob();
}

/**
 * Utility to trigger browser file download from Blob
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * High-level action to generate and download NHRA Report
 */
export async function exportNHRAReport(
  audit: NHRA_Audit,
  branch: Branch,
  supervisor: User,
  capas: CAPA_Task[] = []
): Promise<void> {
  const sanitizedBranchName = branch.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `NHRA_Inspection_Report_${sanitizedBranchName}_${audit.date}.pdf`;
  const blob = await generateNHRAReportPDF(audit, branch, supervisor, capas);
  downloadBlob(blob, filename);
}

/**
 * High-level action to generate and download Pharmacist Appraisal Report
 */
export async function exportAppraisalReport(
  appraisal: Pharmacist_Appraisal,
  pharmacist: User,
  branch: Branch,
  supervisor?: User
): Promise<void> {
  const sanitizedPhName = pharmacist.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Pharmacist_Appraisal_${sanitizedPhName}_${appraisal.year}_${appraisal.month}.pdf`;
  const blob = await generateAppraisalPDF(appraisal, pharmacist, branch, supervisor);
  downloadBlob(blob, filename);
}
