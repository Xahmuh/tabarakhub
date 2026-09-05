import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronRight,
  Filter,
  Layers,
  Loader2,
  Lock,
  RotateCcw,
  Save,
  Search,
  Shield,
  Sparkles,
  Wrench,
  X
} from 'lucide-react';
import Swal from 'sweetalert2';
import { permissionService } from '../../services';
import { AppUser, Role, RolePermission, UserFeaturePermission } from '../../types';
import {
  getEnabledAccessFeatures,
  getSubToolsForModule,
  PERMISSION_PRESETS,
  PermissionPreset,
  SUB_TOOLS,
  SubTool
} from '../../lib/moduleRegistry';
import { resolveAccessLevel, ROLE_LABELS } from '../../lib/access';

interface SubToolPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AppUser | null;
  roleDefaults: RolePermission[];
  onSaveSuccess?: () => void;
}

export const SubToolPermissionModal: React.FC<SubToolPermissionModalProps> = ({
  isOpen,
  onClose,
  user,
  roleDefaults,
  onSaveSuccess
}) => {
  const [selectedModuleId, setSelectedModuleId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [userPermissions, setUserPermissions] = useState<Map<string, 'none' | 'read' | 'edit'>>(new Map());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [appliedPresetId, setAppliedPresetId] = useState<string | null>(null);

  const enabledModules = useMemo(() => getEnabledAccessFeatures(), []);

  useEffect(() => {
    if (!isOpen || !user) return;

    let isMounted = true;
    setIsLoading(true);
    setAppliedPresetId(null);

    permissionService
      .listRawForUser(user.userId)
      .then(raw => {
        if (!isMounted) return;
        const permMap = new Map<string, 'none' | 'read' | 'edit'>();
        raw.forEach(p => {
          if (p.accessLevel) {
            permMap.set(p.featureName, p.accessLevel);
          }
        });
        setUserPermissions(permMap);
      })
      .catch(err => {
        if (!isMounted) return;
        Swal.fire('Error', err?.message || 'Failed to load user permissions.', 'error');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, user]);

  const handleSetLevel = (featureKey: string, level: 'none' | 'read' | 'edit' | '') => {
    setUserPermissions(prev => {
      const next = new Map(prev);
      if (!level) {
        next.delete(featureKey);
      } else {
        next.set(featureKey, level);
      }
      return next;
    });
    setAppliedPresetId(null);
  };

  const handleApplyPreset = (preset: PermissionPreset) => {
    if (preset.id === 'reset_default') {
      setUserPermissions(new Map());
      setAppliedPresetId('reset_default');
      return;
    }

    const next = new Map<string, 'none' | 'read' | 'edit'>();
    preset.permissions.forEach(p => {
      next.set(p.featureName, p.accessLevel);
    });
    setUserPermissions(next);
    setAppliedPresetId(preset.id);
  };

  const handleSave = async () => {
    if (!user || isSaving) return;

    setIsSaving(true);
    try {
      const payload = Array.from(userPermissions.entries()).map(([featureName, accessLevel]) => ({
        featureName,
        accessLevel
      }));

      await permissionService.replaceUserPermissions(user.userId, payload);

      Swal.fire({
        icon: 'success',
        title: 'Permissions Updated',
        text: `Permissions for ${user.email} were saved successfully.`,
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });

      onSaveSuccess?.();
      onClose();
    } catch (err: any) {
      Swal.fire('Save Failed', err?.message || 'Could not save permissions.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredModules = useMemo(() => {
    if (selectedModuleId === 'all') {
      if (!searchQuery.trim()) return enabledModules;
      const q = searchQuery.toLowerCase();
      return enabledModules.filter(m => {
        const matchesModule = m.label.toLowerCase().includes(q) || m.id.toLowerCase().includes(q);
        const subTools = getSubToolsForModule(m.id);
        const matchesSubTool = subTools.some(
          st => st.label.toLowerCase().includes(q) || st.id.toLowerCase().includes(q) || st.description.toLowerCase().includes(q)
        );
        return matchesModule || matchesSubTool;
      });
    }
    return enabledModules.filter(m => m.id === selectedModuleId);
  }, [enabledModules, searchQuery, selectedModuleId]);

  if (!isOpen || !user) return null;

  const isOwner = user.role === 'owner';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand/10 bg-brand/5 text-brand shadow-sm">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-slate-900">
                  Granular Permissions & Sub-Tools
                </h3>
                <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-black uppercase text-slate-600">
                  {ROLE_LABELS[user.role] || user.role}
                </span>
              </div>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                Configuring access overrides for <span className="font-bold text-slate-800">{user.email}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Presets Bar */}
        <div className="border-b border-slate-100 bg-white px-6 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Quick Presets:
            </span>
            {PERMISSION_PRESETS.map(preset => {
              const isSelected = appliedPresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => handleApplyPreset(preset)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                    isSelected
                      ? 'border-brand bg-brand text-white shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-brand/30 hover:bg-brand/5'
                  }`}
                  title={preset.description}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setSelectedModuleId('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                selectedModuleId === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              All Modules ({enabledModules.length})
            </button>
            {enabledModules.slice(0, 6).map(m => (
              <button
                key={m.id}
                onClick={() => setSelectedModuleId(m.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  selectedModuleId === m.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search module or sub-tool..."
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs font-bold outline-none focus:border-brand/40"
            />
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-brand" />
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading permissions...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredModules.map(module => {
                const subTools = getSubToolsForModule(module.id);
                const moduleOverride = userPermissions.get(module.id);
                const roleDefault =
                  roleDefaults.find(p => p.role === user.role && p.featureName === module.id)?.accessLevel || 'none';

                return (
                  <div key={module.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    {/* Module Header */}
                    <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/90 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-slate-900">{module.label}</h4>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {module.id}
                          </span>
                        </div>
                        {module.description && (
                          <p className="mt-0.5 text-xs font-medium text-slate-500">{module.description}</p>
                        )}
                      </div>

                      {/* Parent Module Override Control */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Module Level:
                        </span>
                        <select
                          value={moduleOverride || ''}
                          onChange={e => handleSetLevel(module.id, e.target.value as any)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-800 outline-none focus:border-brand/40"
                        >
                          <option value="">Role Default ({roleDefault})</option>
                          <option value="none">None (Block)</option>
                          <option value="read">Read</option>
                          {!isOwner && <option value="edit">Edit</option>}
                        </select>
                      </div>
                    </div>

                    {/* Sub-Tools List */}
                    {subTools.length > 0 ? (
                      <div className="divide-y divide-slate-100">
                        {subTools.map(subTool => {
                          const subOverride = userPermissions.get(subTool.id);
                          const subRoleDefault =
                            roleDefaults.find(p => p.role === user.role && p.featureName === subTool.id)?.accessLevel ||
                            roleDefault;

                          const effectiveLevel = subOverride || moduleOverride || subRoleDefault;

                          return (
                            <div
                              key={subTool.id}
                              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/50"
                            >
                              <div className="min-w-0 pl-3">
                                <div className="flex items-center gap-2">
                                  <Wrench className="h-3.5 w-3.5 text-slate-400" />
                                  <span className="text-xs font-black text-slate-800">{subTool.label}</span>
                                  <span className="text-[9px] font-bold text-slate-400">({subTool.id})</span>
                                  <span
                                    className={`rounded-md border px-1.5 py-0.5 text-[8px] font-black uppercase ${
                                      effectiveLevel === 'edit'
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                        : effectiveLevel === 'read'
                                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                                        : 'border-slate-200 bg-slate-50 text-slate-400'
                                    }`}
                                  >
                                    Effective: {effectiveLevel}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-[11px] font-medium text-slate-400">{subTool.description}</p>
                              </div>

                              <div className="flex items-center gap-2">
                                <select
                                  value={subOverride || ''}
                                  onChange={e => handleSetLevel(subTool.id, e.target.value as any)}
                                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 outline-none focus:border-brand/40"
                                >
                                  <option value="">Inherit Module / Role</option>
                                  <option value="none">None</option>
                                  <option value="read">Read</option>
                                  {!isOwner && <option value="edit">Edit</option>}
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="px-4 py-3 text-xs font-medium text-slate-400">
                        No separate sub-tools defined for this module. Access inherits the Module Level setting above.
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredModules.length === 0 && (
                <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                  <Filter className="mb-2 h-7 w-7 text-slate-300" />
                  <p className="text-sm font-black text-slate-700">No matching modules found</p>
                  <p className="mt-1 text-xs font-medium text-slate-400">Try adjusting your search query or filter.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
          <div className="text-xs font-bold text-slate-400">
            {userPermissions.size} override{userPermissions.size === 1 ? '' : 's'} configured
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="btn-secondary text-xs font-bold uppercase tracking-wider"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="btn-primary text-xs font-bold uppercase tracking-wider"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Overrides
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
