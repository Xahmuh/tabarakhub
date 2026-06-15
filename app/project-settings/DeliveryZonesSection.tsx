import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { AlertTriangle, CheckCircle2, Loader2, MapPinned, Power, Save, Search } from 'lucide-react';
import { Branch, BranchDeliveryProfile, BranchDeliveryProfileInput } from '../../types';
import { branchDeliveryProfileService } from '../../services/branchDeliveryProfileService';
import { BlockGeometryDataset, getBlockCentroid, loadBahrainBlockGeometry, normalizeBlockKey } from '../delivery/bahrainBlockGeometry';

interface DeliveryZonesSectionProps {
  branches: Branch[];
  canEdit: boolean;
}

const DEFAULT_PROFILE = {
  originBlockNumber: '',
  coreRadiusKm: 3,
  standardRadiusKm: 5,
  extendedRadiusKm: 8,
  targetDeliveryMinutes: 25,
  warningDeliveryMinutes: 35,
  isDeliveryEnabled: true,
  notes: ''
};

const asDraft = (branch: Branch, profile?: BranchDeliveryProfile): BranchDeliveryProfileInput => ({
  branchId: branch.id,
  originBlockNumber: profile?.originBlockNumber || DEFAULT_PROFILE.originBlockNumber,
  coreRadiusKm: profile?.coreRadiusKm ?? DEFAULT_PROFILE.coreRadiusKm,
  standardRadiusKm: profile?.standardRadiusKm ?? DEFAULT_PROFILE.standardRadiusKm,
  extendedRadiusKm: profile?.extendedRadiusKm ?? DEFAULT_PROFILE.extendedRadiusKm,
  targetDeliveryMinutes: profile?.targetDeliveryMinutes ?? DEFAULT_PROFILE.targetDeliveryMinutes,
  warningDeliveryMinutes: profile?.warningDeliveryMinutes ?? DEFAULT_PROFILE.warningDeliveryMinutes,
  isDeliveryEnabled: profile?.isDeliveryEnabled ?? DEFAULT_PROFILE.isDeliveryEnabled,
  notes: profile?.notes || DEFAULT_PROFILE.notes
});

const statusFor = (profile: BranchDeliveryProfile | undefined, geometry: BlockGeometryDataset | null) => {
  if (!profile) return { label: 'Missing profile', tone: 'border-amber-200 bg-amber-50 text-amber-700' };
  if (!profile.originBlockNumber) return { label: 'Missing origin', tone: 'border-amber-200 bg-amber-50 text-amber-700' };
  if (geometry?.available && !getBlockCentroid(geometry, profile.originBlockNumber)) {
    return { label: 'Unmapped block', tone: 'border-red-200 bg-red-50 text-red-700' };
  }
  return { label: 'Mapped', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
};

export const DeliveryZonesSection: React.FC<DeliveryZonesSectionProps> = ({ branches, canEdit }) => {
  const [profiles, setProfiles] = useState<BranchDeliveryProfile[]>([]);
  const [drafts, setDrafts] = useState<Record<string, BranchDeliveryProfileInput>>({});
  const [geometry, setGeometry] = useState<BlockGeometryDataset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const profileByBranch = useMemo(
    () => new Map(profiles.map(profile => [profile.branchId, profile])),
    [profiles]
  );

  const filteredBranches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const branchRows = branches.filter(branch => branch.role === 'branch');
    if (!q) return branchRows;
    return branchRows.filter(branch =>
      branch.code.toLowerCase().includes(q)
      || branch.name.toLowerCase().includes(q)
      || profileByBranch.get(branch.id)?.originBlockNumber.includes(q)
    );
  }, [branches, profileByBranch, query]);

  const quality = useMemo(() => {
    const duplicateMap = new Map<string, string[]>();
    let mapped = 0;
    let unmapped = 0;
    let missingOrigin = 0;
    let missingGeoJson = 0;

    for (const profile of profiles) {
      const block = normalizeBlockKey(profile.originBlockNumber);
      const code = profile.branchCode || branches.find(branch => branch.id === profile.branchId)?.code || profile.branchId.slice(0, 6);
      if (!block) {
        missingOrigin += 1;
        unmapped += 1;
        continue;
      }
      const group = duplicateMap.get(block) || [];
      group.push(code);
      duplicateMap.set(block, group);
      if (geometry?.available && !getBlockCentroid(geometry, block)) {
        missingGeoJson += 1;
        unmapped += 1;
      } else {
        mapped += 1;
      }
    }

    return {
      total: profiles.length,
      mapped,
      unmapped,
      missingProfiles: Math.max(0, branches.filter(branch => branch.role === 'branch').length - profiles.length),
      missingOrigin,
      missingGeoJson,
      duplicateGroups: [...duplicateMap.entries()]
        .filter(([, codes]) => codes.length > 1)
        .map(([originBlockNumber, branchCodes]) => ({ originBlockNumber, branchCodes }))
    };
  }, [branches, geometry, profiles]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    Promise.all([
      branchDeliveryProfileService.listBranchDeliveryProfiles(),
      loadBahrainBlockGeometry().catch(() => null)
    ])
      .then(([profileList, geo]) => {
        if (cancelled) return;
        setProfiles(profileList);
        setGeometry(geo);
      })
      .catch((error: any) => {
        if (!cancelled) {
          Swal.fire('Delivery zones unavailable', error?.message || 'Could not load branch delivery profiles.', 'error');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const draftFor = (branch: Branch) => drafts[branch.id] || asDraft(branch, profileByBranch.get(branch.id));

  const updateDraft = (branch: Branch, patch: Partial<BranchDeliveryProfileInput>) => {
    setDrafts(prev => ({
      ...prev,
      [branch.id]: {
        ...draftFor(branch),
        ...patch
      }
    }));
  };

  const saveProfile = async (branch: Branch) => {
    if (!canEdit || savingId) return;
    const draft = draftFor(branch);
    const origin = normalizeBlockKey(draft.originBlockNumber);
    if (!origin) {
      Swal.fire('Origin block required', 'Set the branch origin block before saving the delivery profile.', 'warning');
      return;
    }
    if (geometry?.available && !getBlockCentroid(geometry, origin)) {
      Swal.fire('Origin block not mapped', `Block ${origin} was not found in the Bahrain GeoJSON. No marker will be created from a guessed location.`, 'error');
      return;
    }
    if (draft.coreRadiusKm > draft.standardRadiusKm || draft.standardRadiusKm > draft.extendedRadiusKm) {
      Swal.fire('Invalid radius order', 'Radius bands must be ordered: core <= standard <= extended.', 'warning');
      return;
    }

    setSavingId(branch.id);
    try {
      const saved = await branchDeliveryProfileService.upsertBranchDeliveryProfile({
        ...draft,
        originBlockNumber: origin
      });
      setProfiles(prev => {
        const next = prev.filter(profile => profile.branchId !== branch.id);
        next.push({ ...saved, branchCode: branch.code, branchName: branch.name });
        return next.sort((a, b) => (a.branchCode || '').localeCompare(b.branchCode || ''));
      });
      setDrafts(prev => {
        const next = { ...prev };
        delete next[branch.id];
        return next;
      });
      Swal.fire({ title: 'Delivery zone saved', text: `${branch.code} profile updated.`, icon: 'success', timer: 1400, showConfirmButton: false });
    } catch (error: any) {
      Swal.fire('Save failed', error?.message || 'Could not save delivery zone profile.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading delivery zones</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Profiles" value={quality.total} />
        <Metric label="Mapped markers" value={quality.mapped} tone="good" />
        <Metric label="Unmapped markers" value={quality.unmapped} tone={quality.unmapped ? 'warn' : 'neutral'} />
        <Metric label="Duplicate blocks" value={quality.duplicateGroups.length} tone={quality.duplicateGroups.length ? 'warn' : 'neutral'} />
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-900">
        Service rings are approximate centroid-based visual guides. They are not route-time or driving-distance calculations.
      </div>

      {quality.duplicateGroups.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-900">
          Duplicate origin blocks: {quality.duplicateGroups.map(group => `Block ${group.originBlockNumber} (${group.branchCodes.join(', ')})`).join(' | ')}
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative md:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search branch or origin block"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 pl-10 text-sm font-bold outline-none focus:border-brand/40"
          />
        </div>
        <p className="text-xs font-bold text-slate-500">
          Geometry: {geometry?.available ? `${geometry.featureCount} blocks loaded` : 'unavailable'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {filteredBranches.map(branch => {
          const profile = profileByBranch.get(branch.id);
          const draft = draftFor(branch);
          const status = statusFor(profile, geometry);
          const mapped = geometry?.available && getBlockCentroid(geometry, draft.originBlockNumber);
          return (
            <article key={branch.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-black text-slate-900">{branch.code}</h3>
                    <span className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${status.tone}`}>
                      {status.label}
                    </span>
                    <span className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                      draft.isDeliveryEnabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-400'
                    }`}>
                      {draft.isDeliveryEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-500">{branch.name}</p>
                </div>
                {mapped ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <AlertTriangle className="h-5 w-5 text-amber-500" />}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field
                  label="Origin block"
                  value={draft.originBlockNumber}
                  disabled={!canEdit}
                  onChange={value => updateDraft(branch, { originBlockNumber: value })}
                />
                <NumberField label="Core km" value={draft.coreRadiusKm} disabled={!canEdit} onChange={value => updateDraft(branch, { coreRadiusKm: value })} />
                <NumberField label="Standard km" value={draft.standardRadiusKm} disabled={!canEdit} onChange={value => updateDraft(branch, { standardRadiusKm: value })} />
                <NumberField label="Extended km" value={draft.extendedRadiusKm} disabled={!canEdit} onChange={value => updateDraft(branch, { extendedRadiusKm: value })} />
                <NumberField label="Target min" value={draft.targetDeliveryMinutes} disabled={!canEdit} onChange={value => updateDraft(branch, { targetDeliveryMinutes: value })} />
                <NumberField label="Warning min" value={draft.warningDeliveryMinutes} disabled={!canEdit} onChange={value => updateDraft(branch, { warningDeliveryMinutes: value })} />
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                <textarea
                  value={draft.notes || ''}
                  disabled={!canEdit}
                  onChange={event => updateDraft(branch, { notes: event.target.value })}
                  rows={2}
                  placeholder="Operational notes"
                  className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-bold outline-none focus:border-brand/40 disabled:cursor-not-allowed disabled:text-slate-400"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => updateDraft(branch, { isDeliveryEnabled: !draft.isDeliveryEnabled })}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border transition ${
                      draft.isDeliveryEnabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-400'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                    title={draft.isDeliveryEnabled ? 'Disable delivery profile' : 'Enable delivery profile'}
                  >
                    <Power className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={!canEdit || savingId === branch.id}
                    onClick={() => saveProfile(branch)}
                    className="btn-primary h-10 text-[10px] uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingId === branch.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {filteredBranches.length === 0 && (
        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-center">
          <MapPinned className="mb-2 h-6 w-6 text-slate-300" />
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">No matching delivery zones</p>
        </div>
      )}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string | number; tone?: 'good' | 'warn' | 'neutral' }> = ({ label, value, tone = 'neutral' }) => (
  <div className={`rounded-lg border p-3 ${
    tone === 'good' ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
      : tone === 'warn' ? 'border-amber-100 bg-amber-50 text-amber-800'
        : 'border-slate-200 bg-slate-50 text-slate-700'
  }`}>
    <p className="text-[9px] font-black uppercase tracking-widest opacity-70">{label}</p>
    <p className="mt-1 text-xl font-black tabular-nums">{value}</p>
  </div>
);

const Field: React.FC<{ label: string; value: string; disabled: boolean; onChange: (value: string) => void }> = ({ label, value, disabled, onChange }) => (
  <label className="block">
    <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
    <input
      value={value}
      disabled={disabled}
      onChange={event => onChange(event.target.value)}
      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold outline-none focus:border-brand/40 disabled:cursor-not-allowed disabled:text-slate-400"
    />
  </label>
);

const NumberField: React.FC<{ label: string; value: number; disabled: boolean; onChange: (value: number) => void }> = ({ label, value, disabled, onChange }) => (
  <label className="block">
    <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
    <input
      type="number"
      min="0"
      step="0.5"
      value={value}
      disabled={disabled}
      onChange={event => onChange(Number(event.target.value))}
      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold outline-none focus:border-brand/40 disabled:cursor-not-allowed disabled:text-slate-400"
    />
  </label>
);
