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
              <h3 className="text-sm font-black tracking-tight text-slate-900">Module order, badges, and grid</h3>
              <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-slate-500">
                Arrange the module launcher cards, control visible badges, and choose the Operations Modules grid. This changes presentation only; access still follows Users & Roles, feature permissions, and RLS.
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

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-brand/10 bg-brand/5 text-brand">
              <LayoutGrid size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">Operations Modules grid</p>
              <h3 className="mt-1 text-sm font-black tracking-tight text-slate-900">Cards per row</h3>
              <p className="mt-1 max-w-2xl text-xs font-semibold leading-5 text-slate-500">
                Pick how wide the module launcher feels on desktop. Mobile and tablet still collapse automatically.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1 sm:min-w-[320px]">
            {([4, 3] as ModuleDisplayGridColumns[]).map(columns => {
              const isSelected = draftGridColumns === columns;
              return (
                <button
                  key={columns}
                  type="button"
                  onClick={() => setDraftGridColumns(columns)}
                  className={`rounded-lg px-4 py-3 text-center transition-all ${
                    isSelected
                      ? 'bg-brand text-white shadow-sm shadow-brand/20'
                      : 'bg-transparent text-slate-500 hover:bg-white hover:text-slate-800'
                  }`}
                >
                  <span className="block text-sm font-black">{columns} x {columns}</span>
                  <span className={`mt-1 block text-[9px] font-black uppercase tracking-widest ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>
                    {columns === 4 ? 'Compact' : 'Wider cards'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_0.72fr]">
        <section className="space-y-3">
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
                className={`relative rounded-lg border bg-white p-4 shadow-sm transition-all duration-200 ${isDragging ? 'scale-[0.99] border-brand/30 opacity-60 ring-2 ring-brand/10' : isDropTarget ? 'border-brand/60 bg-brand/5 shadow-md shadow-brand/10' : 'border-slate-200'}`}
              >
                {isDropTarget && (
                  <div className={`pointer-events-none absolute left-4 right-4 z-10 h-1 rounded-full bg-brand shadow-sm shadow-brand/30 ${dragOverPosition === 'before' ? '-top-2' : '-bottom-2'}`} />
                )}
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(220px,0.8fr)_minmax(360px,1.2fr)_auto] xl:items-center">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      draggable
                      onDragStart={event => handleDragStart(event, item.key)}
                      onDragEnd={resetDragState}
                      className="flex h-10 w-10 cursor-grab items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400 transition-colors hover:border-brand/30 hover:bg-brand/5 hover:text-brand active:cursor-grabbing focus-ring"
                      title="Drag to reorder"
                      aria-label={`Drag ${MODULE_DISPLAY_LABELS[item.key] || item.key} to reorder`}
                    >
                      <GripVertical size={17} />
                    </button>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-black text-slate-950">{MODULE_DISPLAY_LABELS[item.key] || item.key}</h4>
                        {visibleBadge && (
                          <span className="inline-flex max-w-full items-center justify-center rounded-full bg-brand px-3 py-1.5 text-center text-[10px] font-black uppercase leading-4 tracking-[0.08em] text-white shadow-sm ring-1 ring-brand/10 whitespace-normal break-words">
                            {badgeText}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{item.key}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(280px,1fr)_auto] md:items-end">
                    <label className="block min-w-0 space-y-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Badge text</span>
                      <input
                        type="text"
                        value={item.badge}
                        onChange={event => updateItem(item.key, { badge: event.target.value.slice(0, MODULE_BADGE_MAX_LENGTH) })}
                        maxLength={MODULE_BADGE_MAX_LENGTH}
                        placeholder="New module, Daily use, Important"
                        className="min-h-[50px] w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-900 shadow-inner outline-none transition-all placeholder:text-slate-500 focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
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
          <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Launcher grid</p>
            <p className="mt-1 text-sm font-black text-slate-900">{draftGridColumns} x {draftGridColumns}</p>
          </div>
          <div className="mt-3 space-y-2">
            {draftItems.map((item, index) => (
              <div key={`preview-${item.key}`} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words text-xs font-black leading-5 text-slate-900">{index + 1}. {MODULE_DISPLAY_LABELS[item.key] || item.key}</p>
                  <p className="mt-0.5 text-[9px] font-black uppercase tracking-widest text-slate-400">{item.key}</p>
                </div>
                {item.badge.trim() && item.badgeStyle === 'red' && (
                  <span className="inline-flex max-w-full items-center justify-center rounded-full bg-brand px-3 py-1.5 text-center text-[10px] font-black uppercase leading-4 tracking-[0.08em] text-white shadow-sm ring-1 ring-brand/10 whitespace-normal break-words sm:max-w-[48%]">
                    {item.badge.trim()}
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
