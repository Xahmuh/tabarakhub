import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Globe2, Loader2, RefreshCcw, ShieldCheck, Smartphone, XCircle } from 'lucide-react';
import Swal from 'sweetalert2';
import { supabase } from '../../lib/supabase';
import { branchLoginApprovalService } from '../../services/branchLoginApprovalService';
import { BranchLoginApproval, MaintenanceSettings } from '../../types';

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Not available';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
};

const minutesRemaining = (expiresAt: string) => {
  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (remainingMs <= 0) return 'Expired';
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
};

interface BranchLoginApprovalsSectionProps {
  settings?: MaintenanceSettings | null;
  settingsError?: string | null;
  onSettingsChange?: (settings: MaintenanceSettings) => void;
}

export const BranchLoginApprovalsSection: React.FC<BranchLoginApprovalsSectionProps> = ({
  settings,
  settingsError,
  onSettingsChange
}) => {
  const [requests, setRequests] = useState<BranchLoginApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [isSavingSetting, setIsSavingSetting] = useState(false);
  const approvalRequired = settings?.branchLoginApprovalRequired !== false;

  const loadRequests = async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const pending = await branchLoginApprovalService.listPendingBranchLoginApprovals();
      setRequests(pending);
    } catch (loadError: any) {
      setRequests([]);
      setError(loadError?.message || 'Could not load pending branch login approvals.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    const interval = window.setInterval(() => loadRequests(true), 15000);
    return () => window.clearInterval(interval);
  }, []);

  const approveRequest = async (request: BranchLoginApproval) => {
    setBusyRequestId(request.id);
    try {
      await branchLoginApprovalService.approveBranchLoginApproval(request.id);
      await loadRequests(true);
      Swal.fire({
        icon: 'success',
        title: 'Branch login approved',
        text: `${request.branchName || request.branchCode || 'Branch'} can now enter the app.`,
        timer: 1800,
        showConfirmButton: false
      });
    } catch (approveError: any) {
      Swal.fire('Approval failed', approveError?.message || 'Could not approve this login request.', 'error');
    } finally {
      setBusyRequestId(null);
    }
  };

  const rejectRequest = async (request: BranchLoginApproval) => {
    const result = await Swal.fire({
      title: 'Reject branch login?',
      input: 'text',
      inputLabel: 'Optional reason',
      inputPlaceholder: 'Example: unexpected device or wrong shift',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Reject login',
      confirmButtonColor: '#B91c1c'
    });
    if (!result.isConfirmed) return;

    setBusyRequestId(request.id);
    try {
      await branchLoginApprovalService.rejectBranchLoginApproval(request.id, result.value || undefined);
      await loadRequests(true);
      Swal.fire({
        icon: 'success',
        title: 'Branch login rejected',
        timer: 1600,
        showConfirmButton: false
      });
    } catch (rejectError: any) {
      Swal.fire('Rejection failed', rejectError?.message || 'Could not reject this login request.', 'error');
    } finally {
      setBusyRequestId(null);
    }
  };

  const toggleApprovalRequirement = async () => {
    if (!settings || isSavingSetting) return;

    const nextValue = !approvalRequired;
    setIsSavingSetting(true);
    try {
      const updated = await supabase.systemSettings.updateMaintenanceSettings({
        branchLoginApprovalRequired: nextValue
      });
      onSettingsChange?.(updated);
      Swal.fire({
        icon: 'success',
        title: nextValue ? 'Approval layer enabled' : 'Approval layer disabled',
        text: nextValue
          ? 'Branch users will wait for manager approval after password login.'
          : 'Branch users will enter after password login without a manager approval request.',
        timer: 1800,
        showConfirmButton: false
      });
    } catch (saveError: any) {
      Swal.fire('Setting was not saved', saveError?.message || 'Could not update branch login approval setting.', 'error');
    } finally {
      setIsSavingSetting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Loading branch login approvals...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className={`rounded-lg border p-5 shadow-sm ${approvalRequired ? 'border-brand/20 bg-brand/5' : 'border-slate-200 bg-slate-50'}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${approvalRequired ? 'bg-brand text-white' : 'bg-slate-200 text-slate-600'}`}>
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">Second login layer</p>
              <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                Manager approval is {approvalRequired ? 'active' : 'inactive'}
              </h3>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
                When active, branch accounts must wait for approval the first time a device/IP combination is used. Approved devices can enter again until the IP or device changes.
              </p>
              {settingsError && (
                <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-800">
                  Settings could not be verified from Supabase. Login approval remains treated as active until this is fixed.
                </p>
              )}
            </div>
          </div>

          <label className={`relative inline-flex w-full cursor-pointer items-center justify-between gap-4 rounded-lg border px-4 py-3 lg:w-auto ${approvalRequired ? 'border-brand/20 bg-white' : 'border-slate-200 bg-white'}`}>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
              {approvalRequired ? 'Require approval' : 'Password only'}
            </span>
            <input
              type="checkbox"
              className="sr-only"
              checked={approvalRequired}
              disabled={!settings || isSavingSetting}
              onChange={toggleApprovalRequirement}
            />
            <span className={`flex h-7 w-12 items-center rounded-full p-1 transition ${approvalRequired ? 'bg-brand' : 'bg-slate-300'} ${(!settings || isSavingSetting) ? 'opacity-60' : ''}`}>
              <span className={`h-5 w-5 rounded-full bg-white shadow transition ${approvalRequired ? 'translate-x-5' : 'translate-x-0'}`} />
            </span>
            {isSavingSetting && <Loader2 className="h-4 w-4 animate-spin text-brand" />}
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">Branch login approvals</p>
              <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">Pending branch sign-ins</h3>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
                New branch login attempts from an untrusted device or IP appear here with the captured network IP and device details.
              </p>
            </div>
          </div>
          <button onClick={() => loadRequests()} className="btn-secondary text-[10px] uppercase tracking-widest">
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-800">
          {error}
        </div>
      )}

      {requests.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <CheckCircle2 className="mb-3 h-9 w-9 text-emerald-500" />
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-600">No pending login requests</h3>
          <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-slate-400">
            New branch login attempts will appear here after Supabase Auth accepts their password.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(request => {
            const isBusy = busyRequestId === request.id;
            return (
              <article key={request.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                        {request.status}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {request.branchCode || 'Branch'}
                      </span>
                    </div>
                    <h4 className="mt-2 text-lg font-black tracking-tight text-slate-950">
                      {request.branchName || request.branchCode || 'Branch account'}
                    </h4>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {request.userEmail || request.userId}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-xs font-bold text-slate-500 sm:grid-cols-2 xl:w-[560px]">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
                        <Smartphone className="h-3.5 w-3.5" />
                        Device
                      </p>
                      <p className="mt-1 text-slate-800">{request.deviceLabel || 'Unknown device'}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {[request.browserName, request.osName].filter(Boolean).join(' / ') || 'Browser details unavailable'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
                        <Clock3 className="h-3.5 w-3.5" />
                        Request window
                      </p>
                      <p className="mt-1 text-slate-800">Requested {formatDateTime(request.requestedAt)}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Expires {formatDateTime(request.expiresAt)} ({minutesRemaining(request.expiresAt)})
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                      <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
                        <Globe2 className="h-3.5 w-3.5" />
                        Network / fingerprint
                      </p>
                      <p className="mt-1 text-slate-800">Request IP: {request.lastIp || 'Not captured by Supabase request headers'}</p>
                      <p className="mt-1 break-all text-[11px] text-slate-400">
                        Device hash: {request.deviceFingerprintHash || 'Not available'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                  <button
                    onClick={() => rejectRequest(request)}
                    disabled={isBusy}
                    className="btn-secondary justify-center text-[10px] uppercase tracking-widest text-red-600 hover:text-red-700"
                  >
                    {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    Reject
                  </button>
                  <button
                    onClick={() => approveRequest(request)}
                    disabled={isBusy}
                    className="btn-primary justify-center text-[10px] uppercase tracking-widest"
                  >
                    {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Approve
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
