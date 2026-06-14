import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, RotateCcw, Save, Tags } from 'lucide-react';
import Swal from 'sweetalert2';
import { supabase } from '../../lib/supabase';
import { DEFAULT_MODULE_DISPLAY_ITEMS, MODULE_DISPLAY_LABELS, normalizeModuleDisplaySettings } from '../../lib/moduleDisplay';
import { MaintenanceSettings, ModuleDisplayItemSetting } from '../../types';

interface ModuleDisplaySettingsSectionProps {
  settings?: MaintenanceSettings | null;
  settingsError?: string | null;
  onSettingsChange?: (settings: MaintenanceSettings) => void;
}

const reorderItems = (items: ModuleDisplayItemSetting[], index: number, direction: -1 | 1) => {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= items.length) return items;

  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(targetIndex, 0, item);

  return next.map((entry, entryIndex) => ({
    ...entry,
    order: (entryIndex + 1) * 10
  }));
};

export const ModuleDisplaySettingsSection: React.FC<ModuleDisplaySettingsSectionProps> = ({
  settings,
  settingsError,
  onSettingsChange
}) => {
  const normalizedSettings = useMemo(
    () => normalizeModuleDisplaySettings(settings?.moduleDisplaySettings),
    [settings?.moduleDisplaySettings]
  );
  const [draftItems, setDraftItems] = useState<ModuleDisplayItemSetting[]>(normalizedSettings.items);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraftItems(normalizedSettings.items);
  }, [normalizedSettings]);

  const updateItem = (key: string, patch: Partial<ModuleDisplayItemSetting>) => {
    setDraftItems(current => current.map(item => (
      item.key === key ? { ...item, ...patch } : item
    )));
  };

  const handleSave = async () => {
    if (!settings || isSaving) return;

    setIsSaving(true);
    try {
      const updated = await supabase.systemSettings.updateMaintenanceSettings({
        moduleDisplaySettings: {
          items: draftItems.map((item, index) => ({
            ...item,
            order: (index + 1) * 10,
            badge: item.badge.trim().slice(0, 32)
          }))
        }
      });
      onSettingsChange?.(updated);
      Swal.fire({
        icon: 'success',
        title: 'Module layout updated',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2500
      });
    } catch (error: any) {
      Swal.fire('Error', error?.message || 'Failed to save module layout', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setDraftItems(DEFAULT_MODULE_DISPLAY_ITEMS.map(item => ({ ...item })));
  };

  if (settingsError) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-black text-amber-800">System settings unavailable</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-amber-700">{settingsError}</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
        Module layout settings are not loaded yet.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-brand/10 bg-brand/5 text-brand shadow-sm">
              <Tags size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight text-slate-900">Module order and badges</h3>
              <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-slate-500">
                Arrange the module launcher cards and control visible badges. This changes presentation only; access still follows Users & Roles, feature permissions, and RLS.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="btn-secondary text-[10px] uppercase tracking-widest"
            >
              <RotateCcw size={16} />
              Reset draft
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="btn-primary text-[10px] uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={18} />
              Save layout
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_0.72fr]">
        <section className="space-y-3">
          {draftItems.map((item, index) => {
            const visibleBadge = item.badge.trim() && item.badgeStyle === 'red';

            return (
              <article key={item.key} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[auto_1fr_auto] lg:items-center">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400">
                      <GripVertical size={17} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-black text-slate-950">{MODULE_DISPLAY_LABELS[item.key] || item.key}</h4>
                        {visibleBadge && (
                          <span className="rounded-full bg-brand/85 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{item.key}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-end">
                    <label className="space-y-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Badge text</span>
                      <input
                        type="text"
                        value={item.badge}
                        onChange={event => updateItem(item.key, { badge: event.target.value.slice(0, 32) })}
                        maxLength={32}
                        placeholder="New module, Daily use, Important"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none transition-all focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                      />
                    </label>
                    <label className="flex h-[46px] cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3">
                      <input
                        type="checkbox"
                        checked={item.badgeStyle === 'red'}
                        onChange={event => updateItem(item.key, { badgeStyle: event.target.checked ? 'red' : 'hidden' })}
                        className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/20"
                      />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Show badge</span>
                    </label>
                  </div>

                  <div className="flex gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => setDraftItems(current => reorderItems(current, index, -1))}
                      disabled={index === 0}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-brand/30 hover:bg-brand/5 hover:text-brand disabled:cursor-not-allowed disabled:opacity-30"
                      title="Move up"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraftItems(current => reorderItems(current, index, 1))}
                      disabled={index === draftItems.length - 1}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-brand/30 hover:bg-brand/5 hover:text-brand disabled:cursor-not-allowed disabled:opacity-30"
                      title="Move down"
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4 xl:sticky xl:top-24 xl:self-start">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Preview order</p>
          <div className="mt-3 space-y-2">
            {draftItems.map((item, index) => (
              <div key={`preview-${item.key}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
                <div className="min-w-0">
                  <p className="truncate text-xs font-black text-slate-900">{index + 1}. {MODULE_DISPLAY_LABELS[item.key] || item.key}</p>
                  <p className="mt-0.5 text-[9px] font-black uppercase tracking-widest text-slate-400">{item.key}</p>
                </div>
                {item.badge.trim() && item.badgeStyle === 'red' && (
                  <span className="shrink-0 rounded-full bg-brand/85 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-white">
                    {item.badge}
                  </span>
                )}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};
