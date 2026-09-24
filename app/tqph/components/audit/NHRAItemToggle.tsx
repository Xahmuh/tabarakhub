import React, { useState } from 'react';
import { Attachment, ComplianceStatus, NHRAChecklistItem } from '../../types';
import { RatingCard } from '../ui/RatingCard';
import { PhotoUpload } from './PhotoUpload';
import { AlertCircle, AlertTriangle, FileText, ChevronDown, ChevronUp } from 'lucide-react';

interface NHRAItemToggleProps {
  item: NHRAChecklistItem;
  sectionCode: string;
  attachments: Attachment[];
  onChange: (updatedItem: NHRAChecklistItem) => void;
  onAddAttachment: (attachment: Attachment) => void;
  onRemoveAttachment: (attachmentId: string) => void;
  disabled?: boolean;
}

export const NHRAItemToggle: React.FC<NHRAItemToggleProps> = ({
  item,
  sectionCode,
  attachments,
  onChange,
  onAddAttachment,
  onRemoveAttachment,
  disabled = false
}) => {
  const [showNotes, setShowNotes] = useState(
    Boolean(item.notes || item.status === 'non_compliant' || item.status === 'partially_compliant')
  );

  const handleStatusChange = (newStatus: ComplianceStatus) => {
    const updated: NHRAChecklistItem = {
      ...item,
      status: newStatus
    };

    if (newStatus === 'non_compliant') {
      setShowNotes(true);
    }

    onChange(updated);
  };

  const handleNotesChange = (notes: string) => {
    onChange({
      ...item,
      notes
    });
  };

  const handleRequiresActionChange = (checked: boolean) => {
    onChange({
      ...item,
      requires_corrective_action: checked
    });
  };

  return (
    <div
      className={`
        p-4 rounded-xl border transition-all space-y-3.5
        ${
          item.status === 'non_compliant'
            ? 'bg-red-50/30 border-red-200 shadow-xs'
            : item.status === 'partially_compliant'
            ? 'bg-amber-50/30 border-amber-200 shadow-xs'
            : item.status === 'fully_compliant'
            ? 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
            : 'bg-slate-50/60 border-slate-200 opacity-75'
        }
      `}
    >
      {/* Item Header & Code */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 flex-shrink-0 mt-0.5">
            {item.code}
          </span>
          <p className="text-sm font-bold text-slate-900 leading-snug">
            {item.label}
          </p>
        </div>

        {/* Rating Card Toggles (Section 7.5) */}
        <div className="flex-shrink-0">
          <RatingCard
            variant="compliance"
            value={item.status}
            onChange={handleStatusChange}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Inline Non-Compliant Violation Tag (Section 7.3.1) */}
      {item.status === 'non_compliant' && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 space-y-2 text-xs text-red-950 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 text-red-700 font-bold">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Violation Flagged — Auto-Generates CAPA Task upon Lock</span>
          </div>

          <div>
            <label className="block text-slate-600 text-[11px] mb-1 font-bold">
              Violation Details & Specific Observation:
            </label>
            <input
              type="text"
              disabled={disabled}
              value={item.notes || ''}
              onChange={e => handleNotesChange(e.target.value)}
              placeholder={`Describe non-compliance observed for [${item.code}]...`}
              className="w-full px-3 py-2 rounded-lg bg-white border border-red-200 text-slate-900 placeholder-slate-400 text-xs focus:ring-2 focus:ring-red-100 focus:border-red-400 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Partially Compliant CAPA Trigger Checkbox (Section 5.4 & Section 8, #2) */}
      {item.status === 'partially_compliant' && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2 text-xs text-amber-950 animate-in fade-in duration-150">
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none text-amber-900 font-bold">
              <input
                type="checkbox"
                disabled={disabled}
                checked={item.requires_corrective_action === true}
                onChange={e => handleRequiresActionChange(e.target.checked)}
                className="rounded border-amber-300 text-amber-600 focus:ring-amber-300"
              />
              <span>Requires Corrective Action (Auto-generate CAPA Task)</span>
            </label>

            <span className="text-[10px] font-mono text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-200 font-bold">
              Optional Flag
            </span>
          </div>

          <input
            type="text"
            disabled={disabled}
            value={item.notes || ''}
            onChange={e => handleNotesChange(e.target.value)}
            placeholder="Specify partial compliance reason or corrective guidance..."
            className="w-full px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-slate-900 placeholder-slate-400 text-xs focus:ring-2 focus:ring-amber-100 focus:border-amber-400 focus:outline-none"
          />
        </div>
      )}

      {/* Optional General Notes Toggle (for Compliant / N/A items) */}
      {item.status !== 'non_compliant' && item.status !== 'partially_compliant' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowNotes(!showNotes)}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-bold transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>{item.notes ? 'Edit Notes' : '+ Add Note'}</span>
              {showNotes ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {showNotes && (
            <textarea
              rows={2}
              disabled={disabled}
              value={item.notes || ''}
              onChange={e => handleNotesChange(e.target.value)}
              placeholder="Add supervisor observation notes (optional)..."
              className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-xs focus:ring-2 focus:ring-red-100 focus:border-red-400 focus:outline-none"
            />
          )}
        </div>
      )}

      {/* Photo Attachment (Wired to Attachment entity per Section 4 & 6) */}
      <PhotoUpload
        itemId={item.code}
        attachmentIds={item.attachment_ids}
        attachments={attachments}
        onAddAttachment={att => {
          onAddAttachment(att);
          if (!item.attachment_ids.includes(att.id)) {
            onChange({
              ...item,
              attachment_ids: [...item.attachment_ids, att.id]
            });
          }
        }}
        onRemoveAttachment={attId => {
          onRemoveAttachment(attId);
          onChange({
            ...item,
            attachment_ids: item.attachment_ids.filter(id => id !== attId)
          });
        }}
        disabled={disabled}
      />
    </div>
  );
};
