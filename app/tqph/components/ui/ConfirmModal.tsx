import React, { useEffect, useState } from 'react';
import { AlertTriangle, Lock, ShieldCheck, CheckCircle2, ArrowRight, Loader2, Send } from 'lucide-react';
import { DistributionLog } from '../../types';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<{ success: boolean; logs: DistributionLog[]; error?: string }>;
  branchName: string;
  pharmacistName: string;
  complianceScore: number;
  creditScore: number;
  capaCount: number;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  branchName,
  pharmacistName,
  complianceScore,
  creditScore,
  capaCount
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [distributionLogs, setDistributionLogs] = useState<DistributionLog[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsProcessing(false);
      setDistributionLogs(null);
      setErrorMessage(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen) return null;

  const handleExecuteLock = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const result = await onConfirm();
      if (result.success) {
        setDistributionLogs(result.logs);
      } else {
        setErrorMessage(result.error || 'Distribution failed. Please check network logs.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lock-modal-title"
    >
      <div
        className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 text-left space-y-6 text-slate-900"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex-shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-black uppercase text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                Irreversible Action
              </span>
            </div>
            <h2 id="lock-modal-title" className="text-lg font-black text-slate-950 mt-1">
              Confirm Official Lock & Multi-Portal Distribution
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed font-medium">
              Locking seals this evaluation permanently. Once submitted, the audit and appraisal become immutable and will auto-route to designated stakeholder portals.
            </p>
          </div>
        </div>

        {/* Audit Highlights Matrix */}
        <div className="grid grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] font-black uppercase tracking-wider">NHRA Compliance</span>
            <span className="font-black text-base text-slate-950 mt-0.5 block tabular-nums">
              {complianceScore.toFixed(1)}%
            </span>
            <span className="text-[10px] text-slate-500 font-bold truncate block">{branchName}</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] font-black uppercase tracking-wider">Pharmacist Credit</span>
            <span className="font-black text-base text-slate-950 mt-0.5 block tabular-nums">
              {creditScore} / 150
            </span>
            <span className="text-[10px] text-slate-500 font-bold truncate block">{pharmacistName}</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] font-black uppercase tracking-wider">Auto CAPA Tasks</span>
            <span className="font-black text-base text-red-700 mt-0.5 block tabular-nums">
              {capaCount} Generated
            </span>
            <span className="text-[10px] text-slate-500 font-bold">48-Hour SLA</span>
          </div>
        </div>

        {/* Multi-Portal Routing Preview (Section 5.6) */}
        <div className="space-y-2.5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-2">
            <Send className="w-3.5 h-3.5 text-red-700" />
            <span>Target Distribution Routes (Section 5.6):</span>
          </span>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <div className="w-2 h-2 rounded-full bg-emerald-600" />
                <span>1. Branch Manager Portal</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">NHRA Audit PDF + CAPA</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <div className="w-2 h-2 rounded-full bg-emerald-600" />
                <span>2. Pharmacist Personal Portal</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">Appraisal Performance Sheet</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <div className="w-2 h-2 rounded-full bg-emerald-600" />
                <span>3. Executive Admin Archive</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">Audit Trail + Ranking Feed</span>
            </div>
          </div>
        </div>

        {/* Distribution Resolution Feedback */}
        {distributionLogs && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5 text-xs text-emerald-800">
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>All 3 Distribution Logs Created & Resolved</span>
            </div>
            <p className="text-[11px] text-emerald-600">
              Receipt references logged. The record is now locked and immutable.
            </p>
          </div>
        )}

        {/* Error Feedback */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-bold">
            {errorMessage}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          {!distributionLogs ? (
            <>
              <button
                type="button"
                disabled={isProcessing}
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel & Review
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={handleExecuteLock}
                className="
                  flex items-center gap-2 px-5 py-2.5 text-xs font-black rounded-xl transition-all
                  bg-red-700 hover:bg-red-800 text-white active:scale-[0.98]
                  shadow-md shadow-red-700/25 disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Sealing & Distributing...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-white" />
                    <span>Confirm Lock & Distribute</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="
                flex items-center gap-2 px-5 py-2 text-xs font-black rounded-xl
                bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm
              "
            >
              <span>Done (Return to Hub)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
