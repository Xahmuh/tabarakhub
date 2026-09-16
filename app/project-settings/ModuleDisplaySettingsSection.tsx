import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, LayoutGrid, RotateCcw, Save, Tags } from 'lucide-react';
import Swal from 'sweetalert2';
import { supabase } from '../../lib/supabase';
import { DEFAULT_MODULE_DISPLAY_ITEMS, DEFAULT_MODULE_GRID_COLUMNS, MODULE_BADGE_MAX_LENGTH, MODULE_DISPLAY_LABELS, normalizeModuleDisplaySettings } from '../../lib/moduleDisplay';
import { MaintenanceSettings, ModuleDisplayGridColumns, ModuleDisplayItemSetting } from '../../types';

interface ModuleDisplaySettingsSectionProps {
  settings?: MaintenanceSettings | null;
  settingsError?: string | null;
  onSettingsChange?: (settings: MaintenanceSettings) => void;
}

type DropPosition = 'before' | 'after';

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

const reorderItemsByDrop = (
  items: ModuleDisplayItemSetting[],
  activeKey: string,
  targetKey: string,
  position: DropPosition
) => {
  const activeIndex = items.findIndex(item => item.key === activeKey);
  const targetIndex = items.findIndex(item => item.key === targetKey);
  if (activeIndex < 0 || targetIndex < 0 || activeIndex === targetIndex) return items;

  const next = [...items];
  const [activeItem] = next.splice(activeIndex, 1);
  let insertIndex = position === 'after' ? targetIndex + 1 : targetIndex;
  if (activeIndex < targetIndex) insertIndex -= 1;

  next.splice(Math.max(0, Math.min(next.length, insertIndex)), 0, activeItem);
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
  const [draftGridColumns, setDraftGridColumns] = useState<ModuleDisplayGridColumns>(normalizedSettings.gridColumns);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedItemKey, setDraggedItemKey] = useState<string | null>(null);
  const [dragOverItemKey, setDragOverItemKey] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<DropPosition>('after');

  useEffect(() => {
    setDraftItems(normalizedSettings.items);
    setDraftGridColumns(normalizedSettings.gridColumns);
  }, [normalizedSettings]);

  const updateItem = (key: string, patch: Partial<ModuleDisplayItemSetting>) => {
    setDraftItems(current => current.map(item => (
      item.key === key ? { ...item, ...patch } : item
    )));
  };

  const resetDragState = () => {
    setDraggedItemKey(null);
    setDragOverItemKey(null);
    setDragOverPosition('after');
  };

  const handleDragStart = (event: React.DragEvent<HTMLElement>, key: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', key);
    setDraggedItemKey(key);
    setDragOverItemKey(null);
  };

  const handleDragOver = (event: React.DragEvent<HTMLElement>, key: string) => {
    if (!draggedItemKey || draggedItemKey === key) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    const rect = event.currentTarget.getBoundingClientRect();
    const nextPosition = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setDragOverItemKey(key);
    setDragOverPosition(nextPosition);
  };

  const handleDrop = (event: React.DragEvent<HTMLElement>, key: string) => {
    event.preventDefault();
    const activeKey = draggedItemKey || event.dataTransfer.getData('text/plain');
    if (activeKey) {
      setDraftItems(current => reorderItemsByDrop(current, activeKey, key, dragOverPosition));
    }
    resetDragState();
  };

  const handleSave = async () => {
    if (!settings || isSaving) return;

    setIsSaving(true);
    try {
      const updated = await supabase.systemSettings.updateMaintenanceSettings({
        moduleDisplaySettings: {
          gridColumns: draftGridColumns,
          items: draftItems.map((item, index) => ({
            ...item,
            order: (index + 1) * 10,
            badge: item.badge.trim().slice(0, MODULE_BADGE_MAX_LENGTH)
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
    setDraftGridColumns(DEFAULT_MODULE_GRID_COLUMNS);
  };

  if (settingsError) {
    return (
      <div className="rounded-2xl border border-amber-200/60 bg-amber-50/80 p-8 shadow-sm backdrop-blur-xl">
        <p className="text-sm font-black text-amber-800">System settings unavailable</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-amber-700">{settingsError}</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-8 text-sm font-bold text-slate-500 shadow-sm backdrop-blur-xl">
        Module layout settings are not loaded yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl transition-all md:p-6 lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand/10 to-brand/5 text-brand ring-1 ring-brand/10">
              <Tags size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Launcher Experience</p>
              <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">Module order, badges, and grid</h3>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">
                Arrange the module launcher cards, control visible badges, and choose the Operations Modules grid. This changes presentation only; access still follows Users & Roles, feature permissions, and RLS.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="btn-secondary rounded-xl text-[11px] uppercase tracking-widest"
            >
              <RotateCcw size={16} />
              Reset draft
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="btn-primary rounded-xl text-[11px] uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={18} />
              Save layout
            </button>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl transition-all md:p-6 lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand/10 to-brand/5 text-brand ring-1 ring-brand/10">
              <LayoutGrid size={24} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">Operations Modules grid</p>
              <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Cards per row</h3>
              <p className="mt-1 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">
                Pick how wide the module launcher feels on desktop. Mobile and tablet still collapse automatically.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200/60 bg-slate-50/50 p-2 sm:min-w-[340px]">
            {([4, 3] as ModuleDisplayGridColumns[]).map(columns => {
              const isSelected = draftGridColumns === columns;
              return (
                <button
                  key={columns}
                  type="button"
                  onClick={() => setDraftGridColumns(columns)}
                  className={`group relative flex flex-col items-center justify-center rounded-xl p-4 transition-all duration-300 ${
                    isSelected
                      ? 'bg-gradient-to-br from-brand to-brand-dark text-white shadow-md shadow-brand/20 ring-1 ring-brand/50'
                      : 'bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-900 hover:shadow border border-slate-200/60'
                  }`}
                >
                  <span className="block text-xl font-black">{columns} <span className="opacity-60 font-bold">x</span> {columns}</span>
                  <span className={`mt-1.5 block text-[10px] font-black uppercase tracking-[0.15em] ${isSelected ? 'text-white/80' : 'text-slate-400 group-hover:text-brand'}`}>
                    {columns === 4 ? 'Compact' : 'Wider cards'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="space-y-6">
        <section className="space-y-4">
          {draftItems.map((item, index) => {
            const badgeText = item.badge.trim();
            const visibleBadge = badgeText && item.badgeStyle === 'red';
            const isDragging = draggedItemKey === item.key;
            const isDropTarget = Boolean(draggedItemKey && dragOverItemKey === item.key && draggedItemKey !== item.key);

            return (
              <article
                key={item.key}
                onDragOver={event => handleDragOver(event, item.key)}
                onDrop={event => handleDrop(event, item.key)}
                onDragEnd={resetDragState}
                className={`relative rounded-2xl border bg-white/80 p-5 shadow-sm backdrop-blur-xl transition-all duration-300 ${isDragging ? 'scale-[0.99] border-brand/40 opacity-70 ring-4 ring-brand/10' : isDropTarget ? 'border-brand/60 bg-brand/5 shadow-md shadow-brand/10' : 'border-slate-200/80 hover:border-slate-300'}`}
              >
                {isDropTarget && (
                  <div className={`pointer-events-none absolute left-4 right-4 z-10 h-1.5 rounded-full bg-brand shadow-sm shadow-brand/30 ${dragOverPosition === 'before' ? '-top-2' : '-bottom-2'}`} />
                )}
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 flex-1 items-center gap-4 pr-4">
                    <button
                      type="button"
                      draggable
                      onDragStart={event => handleDragStart(event, item.key)}
                      onDragEnd={resetDragState}
                      className="group flex h-14 w-14 shrink-0 cursor-grab flex-col items-center justify-center rounded-xl border border-slate-200/60 bg-slate-50 text-slate-400 shadow-inner transition-colors hover:border-brand/30 hover:bg-brand/5 hover:text-brand active:cursor-grabbing focus-ring"
                      title="Drag to reorder"
                      aria-label={`Drag ${MODULE_DISPLAY_LABELS[item.key] || item.key} to reorder`}
                    >
                      <span className="text-[11px] font-black text-slate-300 transition-colors group-hover:text-brand/50">{index + 1}</span>
                      <GripVertical size={16} className="-mt-1 opacity-50 transition-opacity group-hover:opacity-100" />
                    </button>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-base font-black leading-tight tracking-tight text-slate-950 whitespace-normal break-words">{MODULE_DISPLAY_LABELS[item.key] || item.key}</h4>
                        {visibleBadge && (
                          <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-dark px-3.5 py-1 text-center text-[10px] font-black uppercase leading-4 tracking-widest text-white shadow-sm ring-1 ring-brand/20">
                            {badgeText}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{item.key}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-end">
                    <div className="flex flex-1 sm:flex-none flex-col gap-4 sm:flex-row sm:items-end">
                      <label className="block w-full min-w-0 sm:w-40 lg:w-48 xl:w-52 space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Badge Override</span>
                        <input
                          type="text"
                          value={item.badge}
                          onChange={event => updateItem(item.key, { badge: event.target.value.slice(0, MODULE_BADGE_MAX_LENGTH) })}
                          maxLength={MODULE_BADGE_MAX_LENGTH}
                          placeholder="e.g. New, Daily"
                          className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 placeholder:font-medium focus:border-brand/50 focus:bg-white focus:ring-4 focus:ring-brand/10"
                        />
                      </label>
                      <label className="flex h-[46px] w-full sm:w-auto shrink-0 cursor-pointer items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 shadow-sm transition-all hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={item.badgeStyle === 'red'}
                          onChange={event => updateItem(item.key, { badgeStyle: event.target.checked ? 'red' : 'hidden' })}
                          className="h-5 w-5 rounded border-slate-300 text-brand focus:ring-brand/20 transition-all cursor-pointer"
                        />
                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-600">Active</span>
                      </label>
                    </div>

                    <div className="flex h-[46px] shrink-0 gap-2 sm:h-auto sm:items-end">
                      <button
                        type="button"
                        onClick={() => setDraftItems(current => reorderItems(current, index, -1))}
                        disabled={index === 0}
                        className="flex h-[46px] flex-1 sm:flex-none w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-brand/30 hover:bg-brand/5 hover:text-brand disabled:cursor-not-allowed disabled:opacity-30 active:scale-95"
                        title="Move up"
                      >
                        <ArrowUp size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDraftItems(current => reorderItems(current, index, 1))}
                        disabled={index === draftItems.length - 1}
                        className="flex h-[46px] flex-1 sm:flex-none w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-brand/30 hover:bg-brand/5 hover:text-brand disabled:cursor-not-allowed disabled:opacity-30 active:scale-95"
                        title="Move down"
                      >
                        <ArrowDown size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
};
