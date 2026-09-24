import React from 'react';
import { CAPA_Task } from '../../types';
import { StatusBadge } from '../ui/StatusBadge';
import { CAPAProofUpload } from './CAPAProofUpload';
import { AlertCircle, AlertTriangle, Calendar, CheckCircle2, Clock, ExternalLink, ShieldAlert, User } from 'lucide-react';

interface CAPACardProps {
  capa: CAPA_Task;
  onResolve: (taskId: string, proofUrl: string, resolutionComment: string) => void;
  disabled?: boolean;
  className?: string;
}

export const CAPACard: React.FC<CAPACardProps> = ({
  capa,
  onResolve,
  disabled = false,
  className = ''
}) => {
  const isResolved = capa.status === 'resolved';
  const dueDate = new Date(capa.due_date);
  const now = new Date();
  const isOverdue = !isResolved && dueDate.getTime() < now.getTime();

  // Formatting due date
  const formattedDueDate = dueDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const formattedResolvedAt = capa.resolved_at
    ? new Date(capa.resolved_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : null;

  return (
    <div
      className={`
        p-4 sm:p-5 rounded-xl border transition-all space-y-3.5
        ${
          isResolved
            ? 'bg-white border-slate-200 opacity-95 shadow-sm'
            : isOverdue
            ? 'bg-red-50/30 border-red-300 shadow-sm'
            : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
        }
        ${className}
      `}
    >
      {/* Header: Code, Severity, SLA Status */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
            {capa.element_code}
          </span>
          <StatusBadge variant={{ type: 'capa', severity: capa.severity }} size="sm" />
        </div>

        <div className="flex items-center gap-2">
          {isResolved ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Resolved</span>
            </span>
          ) : isOverdue ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-black text-red-700 bg-red-50 px-2.5 py-1 rounded-md border border-red-200 animate-pulse">
              <Clock className="w-3.5 h-3.5" />
              <span>Overdue (&gt;48h SLA)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
              <Clock className="w-3.5 h-3.5" />
              <span>Action Pending</span>
            </span>
          )}
        </div>
      </div>

      {/* Violation & Action Text */}
      <div className="space-y-2">
        <div>
          <span className="text-[10px] font-black text-slate-400 block uppercase font-mono">
            Observed Violation:
          </span>
          <p className="text-sm font-bold text-slate-900 mt-0.5 leading-snug">
            {capa.violation}
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] font-black text-red-700 block uppercase font-mono">
            Required Corrective Action:
          </span>
          <p className="text-xs text-slate-700 mt-1 leading-relaxed font-medium">
            {capa.required_action}
          </p>
        </div>
      </div>

      {/* Metadata & Resolution Proof Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs text-slate-500">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Due: <strong className={isOverdue ? 'text-red-700 font-black' : 'text-slate-800 font-bold'}>{formattedDueDate}</strong></span>
          </div>

          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>Assigned: <strong className="text-slate-800 font-bold">{capa.assigned_to}</strong></span>
          </div>
        </div>

        {/* Action / Proof display */}
        <div>
          {isResolved ? (
            <div className="flex items-center gap-3">
              {capa.resolution_proof_url && (
                <a
                  href={capa.resolution_proof_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 underline font-bold"
                >
                  <span>View Proof Photo</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {formattedResolvedAt && (
                <span className="text-[11px] text-slate-400 font-mono">
                  Resolved: {formattedResolvedAt}
                </span>
              )}
            </div>
          ) : (
            <CAPAProofUpload
              taskId={capa.id}
              disabled={disabled}
              onResolve={(proofUrl, comment) => onResolve(capa.id, proofUrl, comment)}
            />
          )}
        </div>
      </div>
    </div>
  );
};
