import React, { useState, useEffect } from 'react';
import {
  X, CheckCircle2, AlertTriangle, Clock, Calendar, Building2,
  ShieldCheck, UserCheck, FileText, Upload, Download, Edit2,
  Trash2, RefreshCw, Paperclip, MessageSquare, History, Activity,
  ChevronRight, ArrowRight, ExternalLink, Plus, Banknote
} from 'lucide-react';
import {
  OperationalRenewalRecord,
  OperationalRenewalHistory,
  OperationalRenewalAttachment,
  OperationalRenewalActivity
} from '../../types';
import { operationalRenewalService, getOperationalEntityDisplayName } from '../../services/operationalRenewalService';
import { MarkRenewedModal } from './MarkRenewedModal';

interface RenewalDetailsDrawerProps {
  record: OperationalRenewalRecord;
  currentUser?: { id?: string; name?: string; code?: string };
  canEdit?: boolean;
  canManage?: boolean;
  canDelete?: boolean;
  onClose: () => void;
  onEdit: (record: OperationalRenewalRecord) => void;
  onRecordUpdated: (updated: OperationalRenewalRecord) => void;
  onArchive: (id: string) => void;
}

type DrawerTab = 'overview' | 'history' | 'attachments' | 'audit';

export const RenewalDetailsDrawer: React.FC<RenewalDetailsDrawerProps> = ({
  record,
  currentUser,
  canEdit = true,
  canManage = true,
  canDelete = true,
  onClose,
  onEdit,
  onRecordUpdated,
  onArchive
}) => {
  const [activeTab, setActiveTab] = useState<DrawerTab>('overview');
  const [historyList, setHistoryList] = useState<OperationalRenewalHistory[]>([]);
  const [attachmentsList, setAttachmentsList] = useState<OperationalRenewalAttachment[]>([]);
  const [activitiesList, setActivitiesList] = useState<OperationalRenewalActivity[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Modals & Action States
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [quickNote, setQuickNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);

  const fetchDrawerData = async () => {
    setLoadingData(true);
    try {
      const [hist, att, act] = await Promise.all([
        operationalRenewalService.listHistory(record.id),
        operationalRenewalService.listAttachments(record.id),
        operationalRenewalService.listActivities(record.id)
      ]);
      setHistoryList(hist);
      setAttachmentsList(att);
      setActivitiesList(act);
    } catch (e) {
      console.warn('Error loading drawer data:', e);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchDrawerData();
  }, [record.id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      await operationalRenewalService.uploadAttachment(record.id, file, currentUser);
      await fetchDrawerData();
    } catch (err) {
      console.error('File upload failed:', err);
      alert('Failed to upload file.');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNote.trim()) return;

    setActionLoading(true);
    try {
      const existingNotes = record.notes ? `${record.notes}\n` : '';
      const dateStr = new Date().toISOString().split('T')[0];
      const author = currentUser?.name || 'User';
      const updatedNotes = `${existingNotes}[${dateStr} - ${author}] ${quickNote.trim()}`;

      const updated = await operationalRenewalService.update(record.id, { notes: updatedNotes }, currentUser);
      await operationalRenewalService.addActivity(record.id, 'NOTE_ADDED', quickNote.trim(), undefined, undefined, undefined, currentUser);

      onRecordUpdated(updated);
      setQuickNote('');
      setShowNoteInput(false);
      await fetchDrawerData();
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl flex flex-col z-10 border border-slate-200 overflow-hidden max-h-[92vh] my-auto">
        {/* Drawer Header Banner */}
        <div className="p-6 md:p-8 bg-slate-900 text-white relative overflow-hidden shrink-0">
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-brand/20 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-start justify-between relative z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/10 text-white border border-white/10">
                  {record.renewalType === 'NHRA_PHARMACY' ? 'NHRA Pharmacy' :
                   record.renewalType === 'NHRA_PHARMACIST' ? 'NHRA Pharmacist' :
                   record.renewalType === 'FLEET_VEHICLE' ? 'Fleet Vehicle' :
                   record.renewalType === 'WORK_PERMIT' ? 'Work Permit' :
                   record.renewalType}
                </span>

                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                    record.severity === 'EXPIRED'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                      : record.severity === 'CRITICAL'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      : record.severity === 'URGENT'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : record.severity === 'WARNING'
                      ? 'bg-yellow-500/20 text-yellow-200 border-yellow-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  {record.severity} · {record.daysRemaining < 0 ? `${Math.abs(record.daysRemaining)} Days Expired` : `${record.daysRemaining} Days Left`}
                </span>
              </div>

              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight mt-1">{getOperationalEntityDisplayName(record)}</h2>
              <p className="text-xs text-slate-300 font-medium">
                {record.documentType} · <code className="text-amber-300 font-bold">{record.documentNumber}</code>
              </p>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Quick Action Buttons in Header */}
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/10 flex-wrap relative z-10">

            {canManage && (
              <button
                onClick={() => setShowRenewModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black transition-all shadow-sm"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Mark as Renewed
              </button>
            )}

            {canEdit && (
              <button
                onClick={() => onEdit(record)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors border border-white/10"
              >
                <Edit2 className="h-3 w-3" />
                Edit
              </button>
            )}

            {canDelete && (
              <button
                onClick={() => {
                  if (confirm(`Archive renewal record for ${record.entityName}?`)) {
                    onArchive(record.id);
                    onClose();
                  }
                }}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-colors ml-auto"
                title="Archive Record"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-6 md:px-8 bg-slate-50 gap-4 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 text-xs font-black border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'overview' ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 text-xs font-black border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'history' ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            Renewal History ({historyList.length})
          </button>
          <button
            onClick={() => setActiveTab('attachments')}
            className={`py-3 text-xs font-black border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'attachments' ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Paperclip className="h-3.5 w-3.5" />
            Attachments ({attachmentsList.length})
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`py-3 text-xs font-black border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'audit' ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            Audit Log ({activitiesList.length})
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 md:p-8 flex-1 overflow-y-auto space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Core Information Cards */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Record Information</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block font-semibold">Entity Type:</span>
                    <span className="font-bold text-slate-800">{record.entityType}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Document Number:</span>
                    <span className="font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {record.documentNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Issue Date:</span>
                    <span className="font-bold text-slate-700">{record.issueDate || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Expiration Date:</span>
                    <span className="font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      {record.expiryDate}
                    </span>
                  </div>
                  {(record.branchName || record.metadata?.operationalBranchName) && (
                    <div className="col-span-2 sm:col-span-4 bg-brand/5 border border-brand/20 p-3 rounded-xl">
                      <span className="text-brand font-black text-[10px] block">Operational Branch Name:</span>
                      <span className="font-black text-slate-900 text-xs">
                        {record.branchName || record.metadata?.operationalBranchName}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Cost Center & Payment Planning Card */}
              <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 rounded-2xl p-5 border border-indigo-100 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-indigo-900">
                    <span>Cost Center & Financial Planning</span>
                  </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block font-semibold">Cost Center:</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                        {record.costCenterCode || 'CC-GEN-OPS'}
                      </span>
                      <span className="font-bold text-slate-700 text-[11px] truncate" title={record.costCenterName}>
                        {record.costCenterName}
                      </span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Metadata Details if Employee / CR */}
              {record.metadata && Object.keys(record.metadata).length > 0 && (
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Extended Specifications</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    {record.metadata.employeeCode && (
                      <div>
                        <span className="text-slate-400 block font-semibold">Employee Code:</span>
                        <span className="font-bold text-slate-800">{record.metadata.employeeCode}</span>
                      </div>
                    )}
                    {record.metadata.jobTitle && (
                      <div>
                        <span className="text-slate-400 block font-semibold">Job Title / Category:</span>
                        <span className="font-bold text-slate-800">{record.metadata.jobTitle}</span>
                      </div>
                    )}
                    {record.metadata.department && (
                      <div>
                        <span className="text-slate-400 block font-semibold">Department:</span>
                        <span className="font-bold text-slate-800">{record.metadata.department}</span>
                      </div>
                    )}
                    {record.metadata.cprNumber && (
                      <div>
                        <span className="text-slate-400 block font-semibold">CPR Number:</span>
                        <span className="font-bold text-slate-800">{record.metadata.cprNumber}</span>
                      </div>
                    )}
                    {record.metadata.passportNumber && (
                      <div>
                        <span className="text-slate-400 block font-semibold">Passport Number:</span>
                        <span className="font-bold text-slate-800">{record.metadata.passportNumber}</span>
                      </div>
                    )}
                    {record.metadata.isMaster !== undefined && (
                      <div>
                        <span className="text-slate-400 block font-semibold">CR Classification:</span>
                        <span className="font-bold text-slate-800">{record.metadata.isMaster ? 'Master Group CR' : 'Branch CR'}</span>
                      </div>
                    )}
                    {record.metadata.taxNumber && (
                      <div>
                        <span className="text-slate-400 block font-semibold">Tax / VAT No:</span>
                        <span className="font-bold text-slate-800">{record.metadata.taxNumber}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Operational Notes Section */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Operational Notes</h4>
                  <button
                    type="button"
                    onClick={() => setShowNoteInput(!showNoteInput)}
                    className="text-xs font-bold text-brand hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add Note
                  </button>
                </div>

                {showNoteInput && (
                  <form onSubmit={handleAddNote} className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <textarea
                      rows={2}
                      required
                      value={quickNote}
                      onChange={e => setQuickNote(e.target.value)}
                      placeholder="Enter update, follow-up note, or reference number..."
                      className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowNoteInput(false)}
                        className="px-3 py-1 text-xs font-bold text-slate-500 hover:text-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="px-3 py-1 bg-brand text-white rounded-lg text-xs font-bold"
                      >
                        Save Note
                      </button>
                    </div>
                  </form>
                )}

                <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 font-medium">
                  {record.notes || 'No operational notes added yet.'}
                </p>
              </div>
            </div>
          )}



          {/* TAB 3: RENEWAL HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Renewal History Log</h4>
                  <p className="text-[11px] text-slate-500">All historical renewals and validity periods preserved.</p>
                </div>
                <span className="text-xs font-black bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full">
                  {historyList.length} Archived Periods
                </span>
              </div>

              {historyList.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <History className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">No previous renewal history recorded yet.</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">When you mark this record as renewed, past expirations will be logged here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyList.map(h => (
                    <div key={h.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                        <span className="font-black text-slate-900 flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          {h.action}
                        </span>
                        <span className="text-[11px] text-slate-400 font-semibold">
                          {new Date(h.performedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                        <div>
                          <span className="text-slate-400 block font-medium">Previous Expiry:</span>
                          <span className="font-black text-rose-600">{h.previousExpiryDate || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-medium">Extended New Expiry:</span>
                          <span className="font-black text-emerald-600">{h.newExpiryDate || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-medium">Recorded By:</span>
                          <span className={`inline-flex items-center gap-1 font-bold text-xs ${
                            (h.performedBy || '').toLowerCase().includes('admin')
                              ? 'text-purple-700 font-black'
                              : (h.performedBy || '').toLowerCase().includes('accounts')
                                ? 'text-emerald-700 font-black'
                                : 'text-slate-700'
                          }`}>
                            {h.performedBy || 'System'}
                          </span>
                        </div>
                        {h.attachmentUrl && (
                          <div>
                            <span className="text-slate-400 block font-medium">Document:</span>
                            <a href={h.attachmentUrl} target="_blank" rel="noreferrer" className="text-brand font-bold hover:underline flex items-center gap-1">
                              <ExternalLink className="h-3 w-3" /> View Certificate
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Payment Details if available */}
                      {(h.cost !== undefined || (h.notes && h.notes.includes('[PAID:'))) && (
                        <div className="flex flex-wrap items-center gap-2.5 p-2 bg-emerald-50/80 rounded-lg border border-emerald-200/80 text-[11px] text-emerald-950">
                          <span className="font-black flex items-center gap-1 text-emerald-800">
                            <Banknote className="h-3.5 w-3.5" />
                            {h.cost !== undefined ? `${h.cost.toFixed(3)} BHD` : 'Paid'}
                          </span>
                          {h.paidAt && (
                            <span className="font-semibold text-emerald-700">
                              Paid: <strong>{h.paidAt}</strong>
                            </span>
                          )}
                          {h.paymentMethod && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                              {h.paymentMethod}
                            </span>
                          )}
                          {h.paymentReference && (
                            <span className="font-mono text-[10px] text-emerald-600">
                              Ref: {h.paymentReference}
                            </span>
                          )}
                        </div>
                      )}

                      {h.notes && (
                        <p className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-100">
                          {h.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ATTACHMENTS */}
          {activeTab === 'attachments' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Document Attachments</h4>
                  <p className="text-[11px] text-slate-500">Uploaded copies of licenses, certificates, receipts, or approvals.</p>
                </div>
                <label className="cursor-pointer flex items-center gap-1 px-3 py-1.5 bg-brand text-white rounded-xl text-xs font-bold hover:bg-brand-hover transition-colors">
                  <Upload className="h-3.5 w-3.5" />
                  <span>{uploadingFile ? 'Uploading...' : 'Upload File'}</span>
                  <input
                    type="file"
                    disabled={uploadingFile}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {attachmentsList.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Paperclip className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">No documents attached yet.</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Attach CR copies, NHRA license certificates, or receipts above.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {attachmentsList.map(a => (
                    <div key={a.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="h-5 w-5 text-brand shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 truncate">{a.fileName}</p>
                          <p className="text-[10px] text-slate-400">
                            Uploaded by {a.uploadedBy} · {new Date(a.uploadedAt).toLocaleDateString('en-GB')}
                          </p>
                        </div>
                      </div>

                      <a
                        href={a.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition-colors flex items-center gap-1"
                      >
                        <Download className="h-3 w-3" /> View
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: AUDIT LOG */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Full Audit Trail</h4>
                  <p className="text-[11px] text-slate-500">Immutable chronological record of changes and user actions.</p>
                </div>
              </div>

              {activitiesList.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Activity className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">No audit activity logged yet.</p>
                </div>
              ) : (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {activitiesList.map(act => (
                    <div key={act.id} className="relative text-xs space-y-1">
                      <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-brand ring-4 ring-white" />
                      <div className="flex items-center justify-between">
                        <span className="font-black text-slate-900 text-[11px] uppercase tracking-wider">
                          {act.action}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(act.performedAt).toLocaleString('en-GB')}
                        </span>
                      </div>
                      <p className="text-slate-600 font-medium">{act.notes || 'Action recorded'}</p>
                      <p className="text-[10px] text-slate-400 font-semibold">By: {act.performedBy || 'System'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {/* Pop-up Modal Footer Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span>Created: {new Date(record.createdAt).toLocaleDateString('en-GB')}</span>
            {record.createdBy && <span>• by {record.createdBy}</span>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            Close
          </button>
        </div>
      </div>

      {/* Mark Renewed Modal */}
      {showRenewModal && (
        <MarkRenewedModal
          record={record}
          currentUser={currentUser}
          onClose={() => setShowRenewModal(false)}
          onSuccess={async (updated) => {
            setShowRenewModal(false);
            onRecordUpdated(updated);
            await fetchDrawerData();
          }}
        />
      )}

    </div>
  );
};
