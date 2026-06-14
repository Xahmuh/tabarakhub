import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, Loader2, LogOut, ShieldCheck, Smartphone } from 'lucide-react';
import { BranchLoginApproval } from '../../types';
import { branchLoginApprovalService } from '../../services/branchLoginApprovalService';
import { clientConfig } from '../../config/clientConfig';

interface BranchLoginApprovalWaitingPageProps {
  request: BranchLoginApproval;
  branchName?: string | null;
  onApproved: (approval: BranchLoginApproval) => void;
  onRejected: (approval: BranchLoginApproval) => void;
  onExpired: (approval: BranchLoginApproval) => void;
  onVerificationError: () => void;
  onCancel: () => void;
  logoUrl?: string;
}

const formatTime = (value?: string | null) => {
  if (!value) return 'Not available';
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(value));
};

const formatCountdown = (expiresAt: string) => {
  const remainingMs = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const BranchLoginApprovalWaitingPage: React.FC<BranchLoginApprovalWaitingPageProps> = ({
  request,
  branchName,
  onApproved,
  onRejected,
  onExpired,
  onVerificationError,
  onCancel,
  logoUrl
}) => {
  const [currentRequest, setCurrentRequest] = useState(request);
  const [countdown, setCountdown] = useState(() => formatCountdown(request.expiresAt));
  const displayBranchName = branchName || currentRequest.branchName || currentRequest.branchCode || 'Branch account';
  const deviceLabel = currentRequest.deviceLabel || 'Current browser session';
  const brandLogoUrl = logoUrl || clientConfig.logoUrl;

  const requestedAt = useMemo(() => formatTime(currentRequest.requestedAt), [currentRequest.requestedAt]);
  const expiresAt = useMemo(() => formatTime(currentRequest.expiresAt), [currentRequest.expiresAt]);

  useEffect(() => {
    setCurrentRequest(request);
  }, [request]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown(formatCountdown(currentRequest.expiresAt));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [currentRequest.expiresAt]);

  useEffect(() => {
    const unsubscribe = branchLoginApprovalService.subscribeToBranchLoginApproval(
      currentRequest.id,
      approval => {
        setCurrentRequest(approval);
        if (approval.status === 'approved') onApproved(approval);
        if (approval.status === 'rejected') onRejected(approval);
        if (approval.status === 'expired' || approval.status === 'cancelled') onExpired(approval);
      },
      () => onVerificationError()
    );

    return unsubscribe;
  }, [currentRequest.id, onApproved, onExpired, onRejected, onVerificationError]);

  return (
    <div className="min-h-screen bg-slate-50 px-5 py-8 selection:bg-brand/10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center justify-center">
        <section className="w-full rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm md:p-8">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-brand shadow-lg shadow-brand/20">
            <img src={brandLogoUrl} alt={`${clientConfig.clientName} logo`} className="h-full w-full object-cover" />
          </div>

          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-lg border border-brand/10 bg-brand/5 text-brand">
            <ShieldCheck className="h-7 w-7" />
          </div>

          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand">Secure branch sign-in</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
            Waiting for Admin Approval
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-slate-500">
            Your login request is waiting for admin approval. Please contact your manager if this was not expected.
          </p>

          <div className="mt-7 grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Branch</p>
              <p className="mt-1 truncate text-sm font-black text-slate-900">{displayBranchName}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</p>
              <p className="mt-1 inline-flex items-center gap-2 text-sm font-black text-amber-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                Pending approval
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <Smartphone className="h-3.5 w-3.5" />
                Device
              </p>
              <p className="mt-1 text-sm font-black text-slate-900">{deviceLabel}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <Clock3 className="h-3.5 w-3.5" />
                Expires in
              </p>
              <p className="mt-1 text-sm font-black text-slate-900 tabular-nums">{countdown}</p>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4 text-left">
            <div className="grid grid-cols-1 gap-3 text-xs font-bold text-slate-500 sm:grid-cols-2">
              <div>
                <span className="text-slate-400">Requested at</span>
                <p className="mt-1 text-slate-800">{requestedAt}</p>
              </div>
              <div>
                <span className="text-slate-400">Approval window</span>
                <p className="mt-1 text-slate-800">Until {expiresAt}</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary mx-auto mt-6 text-[10px] uppercase tracking-widest"
          >
            <LogOut className="h-4 w-4" />
            Cancel and sign out
          </button>
        </section>
      </div>
    </div>
  );
};
