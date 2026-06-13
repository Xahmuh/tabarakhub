import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { AlertTriangle, Bike, Building2, Map, MapPin, Plus, Search, UsersRound } from 'lucide-react';
import { deliveryService } from '../../services/deliveryService';
import { branchService } from '../../services/branchService';
import {
  Branch, BranchClassification, DeliveryArea, DeliveryBlock, DeliveryDriver, DeliveryOrder, DeliverySupervisor, Governorate
} from '../../types';
import { formatBhd, getPresetRange } from './utils';

const GOVERNORATES: Governorate[] = ['Capital', 'Muharraq', 'Northern', 'Southern'];

type SettingsTab = 'drivers' | 'areas' | 'supervisors' | 'blocks' | 'classification' | 'quality';

const escapeHtml = (value?: string | null) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export const DeliverySettings: React.FC = () => {
  const [tab, setTab] = useState<SettingsTab>('drivers');
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [areas, setAreas] = useState<DeliveryArea[]>([]);
  const [supervisors, setSupervisors] = useState<DeliverySupervisor[]>([]);
  const [blocks, setBlocks] = useState<DeliveryBlock[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [classifications, setClassifications] = useState<BranchClassification[]>([]);
  const [blockSearch, setBlockSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);
    try {
      const [driverResult, areaResult, supervisorResult, blockResult, branchResult, classResult] = await Promise.allSettled([
        deliveryService.drivers.list(true),
        deliveryService.areas.list(true),
        deliveryService.supervisors.list(true),
        deliveryService.blocks.list(true),
        branchService.list(),
        deliveryService.classifications.list()
      ]);
      setDrivers(driverResult.status === 'fulfilled' ? driverResult.value : []);
      setAreas(areaResult.status === 'fulfilled' ? areaResult.value : []);
      setSupervisors(supervisorResult.status === 'fulfilled' ? supervisorResult.value : []);
      setBlocks(blockResult.status === 'fulfilled' ? blockResult.value : []);
      setBranches(branchResult.status === 'fulfilled' ? branchResult.value.filter(b => b.role === 'branch') : []);
      setClassifications(classResult.status === 'fulfilled' ? classResult.value : []);
    } catch (e) {
      console.error('Delivery settings load failed', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ----- Areas -----
  const editArea = async (area?: DeliveryArea) => {
    const { value } = await Swal.fire({
      title: `<span class="text-xl font-black tracking-tight">${area ? 'Edit' : 'Add'} area</span>`,
      html: `
        <div class="space-y-3 text-left p-2">
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Area name</label>
            <input id="swal-area-name" value="${escapeHtml(area?.name)}" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
          </div>
          <div class="hidden">
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Governorate</label>
            <select id="swal-area-gov" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
              ${GOVERNORATES.map(g => `<option value="${g}" ${area?.governorate === g ? 'selected' : ''}>${g}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Notes (optional)</label>
            <textarea id="swal-area-notes" class="min-h-[80px] w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">${escapeHtml(area?.notes)}</textarea>
          </div>
        </div>`,
      showCancelButton: true,
      confirmButtonText: 'Save area',
      confirmButtonColor: '#B91c1c',
      preConfirm: () => {
        const name = (document.getElementById('swal-area-name') as HTMLInputElement).value.trim();
        const governorate = (document.getElementById('swal-area-gov') as HTMLSelectElement).value as Governorate;
        const notes = (document.getElementById('swal-area-notes') as HTMLTextAreaElement).value.trim();
        if (!name) {
          Swal.showValidationMessage('Area name is required.');
          return false;
        }
        return { name, governorate, notes };
      }
    });
    if (!value) return;
    try {
      await deliveryService.areas.upsert({
        id: area?.id,
        name: value.name,
        governorate: value.governorate,
        notes: value.notes || undefined,
        isActive: area?.isActive ?? true
      });
      await load();
    } catch (e: any) {
      Swal.fire('Save failed', e?.message || 'Could not save area.', 'error');
    }
  };

  const toggleArea = async (area: DeliveryArea) => {
    try {
      await deliveryService.areas.upsert({ ...area, isActive: !area.isActive });
      await load();
    } catch (e: any) {
      Swal.fire('Update failed', e?.message || 'Could not update area.', 'error');
    }
  };

  // ----- Supervisors -----
  const editSupervisor = async (supervisor?: DeliverySupervisor) => {
    const { value } = await Swal.fire({
      title: `<span class="text-xl font-black tracking-tight">${supervisor ? 'Edit' : 'Add'} supervisor</span>`,
      html: `
        <div class="space-y-3 text-left p-2">
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Name</label>
            <input id="swal-supervisor-name" value="${escapeHtml(supervisor?.name)}" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Phone (optional)</label>
            <input id="swal-supervisor-phone" value="${escapeHtml(supervisor?.phone)}" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Email (optional)</label>
            <input id="swal-supervisor-email" value="${escapeHtml(supervisor?.email)}" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
          </div>
        </div>`,
      showCancelButton: true,
      confirmButtonText: 'Save supervisor',
      confirmButtonColor: '#B91c1c',
      preConfirm: () => {
        const name = (document.getElementById('swal-supervisor-name') as HTMLInputElement).value.trim();
        const phone = (document.getElementById('swal-supervisor-phone') as HTMLInputElement).value.trim();
        const email = (document.getElementById('swal-supervisor-email') as HTMLInputElement).value.trim();
        if (!name) {
          Swal.showValidationMessage('Supervisor name is required.');
          return false;
        }
        return { name, phone, email };
      }
    });
    if (!value) return;
    try {
      await deliveryService.supervisors.upsert({
        id: supervisor?.id,
        name: value.name,
        phone: value.phone || undefined,
        email: value.email || undefined,
        isActive: supervisor?.isActive ?? true
      });
      await load();
    } catch (e: any) {
      Swal.fire('Save failed', e?.message || 'Could not save supervisor.', 'error');
    }
  };

  const toggleSupervisor = async (supervisor: DeliverySupervisor) => {
    try {
      await deliveryService.supervisors.upsert({ ...supervisor, isActive: !supervisor.isActive });
      await load();
    } catch (e: any) {
      Swal.fire('Update failed', e?.message || 'Could not update supervisor.', 'error');
    }
  };

  // ----- Drivers -----
  const editDriver = async (driver?: DeliveryDriver) => {
    const { value } = await Swal.fire({
      title: `<span class="text-xl font-black tracking-tight">${driver ? 'Edit' : 'Add'} driver</span>`,
      html: `
        <div class="space-y-3 text-left p-2">
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Name</label>
            <input id="swal-name" value="${driver?.name || ''}" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Phone (optional)</label>
            <input id="swal-phone" value="${driver?.phone || ''}" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
          </div>
        </div>`,
      showCancelButton: true,
      confirmButtonText: 'Save',
      confirmButtonColor: '#B91c1c',
      preConfirm: () => ({
        name: (document.getElementById('swal-name') as HTMLInputElement).value.trim(),
        phone: (document.getElementById('swal-phone') as HTMLInputElement).value.trim()
      })
    });
    if (!value?.name) return;
    try {
      await deliveryService.drivers.upsert({ id: driver?.id, name: value.name, phone: value.phone || undefined, isActive: driver?.isActive ?? true });
      await load();
    } catch (e: any) {
      Swal.fire('Save failed', e?.message || 'Could not save driver.', 'error');
    }
  };

  const toggleDriver = async (driver: DeliveryDriver) => {
    try {
      await deliveryService.drivers.upsert({ ...driver, isActive: !driver.isActive });
      await load();
    } catch (e: any) {
      Swal.fire('Update failed', e?.message || 'Could not update driver.', 'error');
    }
  };

  // ----- Blocks -----
  const editBlock = async (block?: DeliveryBlock) => {
    const selectedAreaId = block?.areaId || areas.find(area =>
      area.name.toLowerCase() === block?.areaName?.toLowerCase()
      && area.governorate === block?.governorate
    )?.id || '';
    const areaOptions = areas.map(area => `
      <option value="${area.id}" ${selectedAreaId === area.id ? 'selected' : ''}>
        ${escapeHtml(area.name)} - ${area.governorate}${area.isActive ? '' : ' (inactive)'}
      </option>
    `).join('');
    const { value } = await Swal.fire({
      title: `<span class="text-xl font-black tracking-tight">${block ? `Edit block ${block.blockNumber}` : 'Add block'}</span>`,
      html: `
        <div class="space-y-3 text-left p-2">
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Block number</label>
            <input id="swal-block" value="${block?.blockNumber || ''}" ${block ? 'readonly' : ''} class="w-full p-3 ${block ? 'bg-slate-100 text-slate-400' : 'bg-slate-50'} border border-slate-200 rounded-lg text-sm font-bold">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Area</label>
            <select id="swal-area-id" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
              <option value="">Select existing area</option>
              ${areaOptions}
            </select>
            <p class="mt-1 text-[10px] font-bold text-slate-400">Add areas first from the Areas tab.</p>
          </div>
        </div>`,
      showCancelButton: true,
      confirmButtonText: 'Save',
      confirmButtonColor: '#B91c1c',
      preConfirm: () => {
        const blockNumber = (document.getElementById('swal-block') as HTMLInputElement).value.trim();
        const areaId = (document.getElementById('swal-area-id') as HTMLSelectElement).value;
        const area = areas.find(item => item.id === areaId);
        if (!blockNumber) {
          Swal.showValidationMessage('Block number is required.');
          return false;
        }
        if (!area) {
          Swal.showValidationMessage('Select an area first.');
          return false;
        }
        return {
          blockNumber,
          areaId: area.id,
          areaName: area.name,
          governorate: area.governorate
        };
      }
    });
    if (!value) return;
    try {
      await deliveryService.blocks.upsert({ ...value, isActive: block?.isActive ?? true });
      await load();
    } catch (e: any) {
      Swal.fire('Save failed', e?.message || 'Could not save block.', 'error');
    }
  };

  const filteredBlocks = useMemo(() => {
    const q = blockSearch.trim().toLowerCase();
    if (!q) return blocks;
    return blocks.filter(b => b.blockNumber.includes(q) || b.areaName.toLowerCase().includes(q) || b.governorate.toLowerCase().includes(q));
  }, [blocks, blockSearch]);

  // ----- Branch classification -----
  const editClassification = async (branch: Branch) => {
    const current = classifications.find(c => c.branchId === branch.id);
    const selectedAreaId = current?.areaId || areas.find(area =>
      area.name.toLowerCase() === current?.area?.toLowerCase()
      && (!current?.governorate || area.governorate === current.governorate)
    )?.id || '';
    const selectedSupervisorId = current?.supervisorId || supervisors.find(supervisor =>
      supervisor.name.toLowerCase() === current?.supervisorName?.toLowerCase()
    )?.id || '';
    const areaOptions = areas.map(area => `
      <option value="${area.id}" ${selectedAreaId === area.id ? 'selected' : ''}>
        ${escapeHtml(area.name)} - ${area.governorate}${area.isActive ? '' : ' (inactive)'}
      </option>
    `).join('');
    const supervisorOptions = supervisors.map(supervisor => `
      <option value="${supervisor.id}" ${selectedSupervisorId === supervisor.id ? 'selected' : ''}>
        ${escapeHtml(supervisor.name)}${supervisor.isActive ? '' : ' (inactive)'}
      </option>
    `).join('');
    const { value } = await Swal.fire({
      title: `<span class="text-xl font-black tracking-tight">${branch.name}</span>`,
      html: `
        <div class="space-y-3 text-left p-2">
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Area</label>
            <select id="swal-branch-area-id" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
              <option value="">Not assigned</option>
              ${areaOptions}
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Supervisor</label>
            <select id="swal-branch-supervisor-id" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
              <option value="">Not assigned</option>
              ${supervisorOptions}
            </select>
          </div>
          <div class="hidden">
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Governorate</label>
            <select id="swal-gov" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
              <option value="">— Not set —</option>
              ${GOVERNORATES.map(g => `<option value="${g}" ${current?.governorate === g ? 'selected' : ''}>${g}</option>`).join('')}
            </select>
          </div>
        </div>`,
      showCancelButton: true,
      confirmButtonText: 'Save',
      confirmButtonColor: '#B91c1c',
      preConfirm: () => {
        const areaId = (document.getElementById('swal-branch-area-id') as HTMLSelectElement).value;
        const supervisorId = (document.getElementById('swal-branch-supervisor-id') as HTMLSelectElement).value;
        const area = areas.find(item => item.id === areaId);
        const supervisor = supervisors.find(item => item.id === supervisorId);
        return {
          areaId: area?.id || null,
          area: area?.name || undefined,
          governorate: area?.governorate || null,
          supervisorId: supervisor?.id || null,
          supervisorName: supervisor?.name || undefined
        };
      }
    });
    if (value === undefined) return;
    try {
      await deliveryService.classifications.upsert({
        branchId: branch.id,
        areaId: value.areaId,
        area: value.area,
        supervisorId: value.supervisorId,
        supervisorName: value.supervisorName,
        governorate: (value.governorate || null) as Governorate | null
      });
      await load();
    } catch (e: any) {
      Swal.fire('Save failed', e?.message || 'Could not save classification.', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex bg-slate-100/60 p-1 rounded-lg border border-slate-200/50 w-fit max-w-full overflow-x-auto">
        {([
          { id: 'drivers', label: 'Drivers', icon: Bike },
          { id: 'areas', label: 'Areas', icon: Map },
          { id: 'supervisors', label: 'Supervisors', icon: UsersRound },
          { id: 'blocks', label: 'Blocks', icon: MapPin },
          { id: 'classification', label: 'Branch Assignment', icon: Building2 },
          { id: 'quality', label: 'Data Quality', icon: AlertTriangle }
        ] as Array<{ id: SettingsTab; label: string; icon: React.ElementType }>).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-2 rounded-md text-xs font-bold transition-all ${
              tab === t.id ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-100 border-t-brand"></div>
        </div>
      ) : tab === 'drivers' ? (
        <section className="operational-panel p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Delivery drivers</h3>
            <button onClick={() => editDriver()} className="btn-primary text-[10px] uppercase tracking-widest">
              <Plus className="h-3.5 w-3.5" /> Add driver
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {drivers.map(driver => (
              <div key={driver.id} className={`rounded-lg border p-3 ${driver.isActive ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-slate-800">{driver.name}</p>
                  <span className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase ${driver.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-400'}`}>
                    {driver.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {driver.phone && <p className="mt-1 text-[11px] font-bold text-slate-400">{driver.phone}</p>}
                <div className="mt-2 flex gap-3 text-[11px] font-bold">
                  <button onClick={() => editDriver(driver)} className="text-slate-500 hover:text-brand">Edit</button>
                  <button onClick={() => toggleDriver(driver)} className="text-slate-400 hover:text-brand">
                    {driver.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                </div>
              </div>
            ))}
            {drivers.length === 0 && <p className="text-xs font-bold text-slate-400">No drivers yet — add the first one.</p>}
          </div>
        </section>
      ) : tab === 'areas' ? (
        <section className="operational-panel p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Delivery areas</h3>
              <p className="mt-1 text-[11px] font-medium text-slate-500">Create areas first, then link blocks and branches to them.</p>
            </div>
            <button onClick={() => editArea()} className="btn-primary text-[10px] uppercase tracking-widest">
              <Plus className="h-3.5 w-3.5" /> Add area
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {areas.map(area => (
              <div key={area.id} className={`rounded-lg border p-3 ${area.isActive ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-800">{area.name}</p>
                    <p className="mt-1 text-[11px] font-bold text-slate-400">{area.governorate}</p>
                  </div>
                  <span className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase ${area.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-400'}`}>
                    {area.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {area.notes && <p className="mt-2 text-[11px] font-bold text-slate-400">{area.notes}</p>}
                <div className="mt-2 flex gap-3 text-[11px] font-bold">
                  <button onClick={() => editArea(area)} className="text-slate-500 hover:text-brand">Edit</button>
                  <button onClick={() => toggleArea(area)} className="text-slate-400 hover:text-brand">
                    {area.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                </div>
              </div>
            ))}
            {areas.length === 0 && <p className="text-xs font-bold text-slate-400">No areas yet - add the first one.</p>}
          </div>
        </section>
      ) : tab === 'supervisors' ? (
        <section className="operational-panel p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Delivery supervisors</h3>
              <p className="mt-1 text-[11px] font-medium text-slate-500">Create supervisors first, then assign branches to them.</p>
            </div>
            <button onClick={() => editSupervisor()} className="btn-primary text-[10px] uppercase tracking-widest">
              <Plus className="h-3.5 w-3.5" /> Add supervisor
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {supervisors.map(supervisor => (
              <div key={supervisor.id} className={`rounded-lg border p-3 ${supervisor.isActive ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-800">{supervisor.name}</p>
                    {(supervisor.phone || supervisor.email) && (
                      <p className="mt-1 text-[11px] font-bold text-slate-400">
                        {[supervisor.phone, supervisor.email].filter(Boolean).join(' | ')}
                      </p>
                    )}
                  </div>
                  <span className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase ${supervisor.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-400'}`}>
                    {supervisor.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="mt-2 flex gap-3 text-[11px] font-bold">
                  <button onClick={() => editSupervisor(supervisor)} className="text-slate-500 hover:text-brand">Edit</button>
                  <button onClick={() => toggleSupervisor(supervisor)} className="text-slate-400 hover:text-brand">
                    {supervisor.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                </div>
              </div>
            ))}
            {supervisors.length === 0 && <p className="text-xs font-bold text-slate-400">No supervisors yet - add the first one.</p>}
          </div>
        </section>
      ) : tab === 'blocks' ? (
        <section className="operational-panel p-4 md:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Blocks directory ({blocks.length})</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
                <input
                  value={blockSearch}
                  onChange={e => setBlockSearch(e.target.value)}
                  placeholder="Search block / area…"
                  className="rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-bold outline-none focus:border-brand/40"
                />
              </div>
              <button onClick={() => editBlock()} className="btn-primary text-[10px] uppercase tracking-widest">
                <Plus className="h-3.5 w-3.5" /> Add block
              </button>
            </div>
          </div>
          <div className="max-h-[560px] overflow-y-auto rounded-lg border border-slate-100">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-3 py-2">Block</th>
                  <th className="px-3 py-2">Area</th>
                  <th className="px-3 py-2">Governorate</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredBlocks.slice(0, 300).map(block => (
                  <tr key={block.blockNumber} className="bg-white hover:bg-slate-50/50">
                    <td className="px-3 py-2 font-black text-slate-800 tabular-nums">{block.blockNumber}</td>
                    <td className="px-3 py-2 font-bold text-slate-600">{block.areaName}</td>
                    <td className="px-3 py-2 text-xs font-bold text-slate-500">{block.governorate}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => editBlock(block)} className="text-[11px] font-bold text-slate-400 hover:text-brand">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredBlocks.length > 300 && (
              <p className="bg-slate-50 p-2 text-center text-[10px] font-bold text-slate-400">Showing first 300 — refine the search.</p>
            )}
          </div>
        </section>
      ) : tab === 'classification' ? (
        <section className="operational-panel p-4 md:p-5">
          <h3 className="mb-1 text-sm font-black uppercase tracking-widest text-slate-700">Branch assignment</h3>
          <p className="mb-4 text-[11px] font-medium text-slate-500">
            Branch → area, supervisor, governorate. The governorate drives the outside-governorate analysis; unclassified branches are excluded from it.
          </p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {branches.map(branch => {
              const c = classifications.find(x => x.branchId === branch.id);
              const area = c?.areaId ? areas.find(item => item.id === c.areaId) : undefined;
              const supervisor = c?.supervisorId ? supervisors.find(item => item.id === c.supervisorId) : undefined;
              const areaName = c?.area || area?.name;
              const supervisorName = c?.supervisorName || supervisor?.name;
              const governorate = c?.governorate || area?.governorate;
              return (
                <button
                  key={branch.id}
                  onClick={() => editClassification(branch)}
                  className="rounded-lg border border-slate-200 bg-white p-3 text-left transition-colors hover:border-brand/40"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black text-slate-800">{branch.name}</p>
                    {governorate
                      ? <span className="rounded-md border border-brand/10 bg-brand/5 px-2 py-0.5 text-[9px] font-black text-brand">{governorate}</span>
                      : <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-black text-amber-700">UNCLASSIFIED</span>}
                  </div>
                  <p className="mt-1 text-[11px] font-bold text-slate-400">
                    {c?.area ? `${c.area}` : 'No area'}{c?.supervisorName ? ` · ${c.supervisorName}` : ' · No supervisor'}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <DataQualityPanel blocks={blocks} classifications={classifications} branches={branches} />
      )}
    </div>
  );
};

// --- Data quality panel: current-month order hygiene ---
const DataQualityPanel: React.FC<{
  blocks: DeliveryBlock[];
  classifications: BranchClassification[];
  branches: Branch[];
}> = ({ classifications, branches }) => {
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const range = getPresetRange('month');
    deliveryService.orders.list({ dateFrom: range.from, dateTo: range.to })
      .then(setOrders)
      .catch(e => console.error(e))
      .finally(() => setIsLoading(false));
  }, []);

  const issues = useMemo(() => {
    const missingDriver = orders.filter(o => !o.driverId);
    const missingPharmacist = orders.filter(o => !o.pharmacistId && !o.pharmacistName);
    const unknownBlock = orders.filter(o => o.paymentType !== 'TALABAT' && o.blockNumber && !o.areaName);
    const missingBlock = orders.filter(o => o.paymentType !== 'TALABAT' && !o.blockNumber);
    const outside = orders.filter(o => o.isOutsideGovernorate);
    const classifiedIds = new Set(classifications.filter(c => c.governorate).map(c => c.branchId));
    const unclassifiedBranches = branches.filter(b => !classifiedIds.has(b.id));
    return { missingDriver, missingPharmacist, unknownBlock, missingBlock, outside, unclassifiedBranches };
  }, [orders, classifications, branches]);

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-100 border-t-brand"></div>
      </div>
    );
  }

  const Tile: React.FC<{ label: string; items: DeliveryOrder[]; tone: 'amber' | 'red' | 'slate' }> = ({ label, items, tone }) => (
    <div className={`rounded-lg border p-4 ${
      items.length === 0
        ? 'border-emerald-100 bg-emerald-50/50'
        : tone === 'red' ? 'border-red-100 bg-red-50/60' : tone === 'amber' ? 'border-amber-100 bg-amber-50/60' : 'border-slate-200 bg-white'
    }`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-900 tabular-nums">{items.length}</p>
      <p className="text-[11px] font-bold text-slate-400">{formatBhd(items.reduce((a, o) => a + o.valueBhd, 0))} this month</p>
    </div>
  );

  return (
    <section className="operational-panel p-4 md:p-5">
      <h3 className="mb-1 text-sm font-black uppercase tracking-widest text-slate-700">Data quality — current month</h3>
      <p className="mb-4 text-[11px] font-medium text-slate-500">Orders with missing or unresolvable data weaken the analytics. Chase these with the branches.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Tile label="Missing driver" items={issues.missingDriver} tone="amber" />
        <Tile label="Missing pharmacist" items={issues.missingPharmacist} tone="amber" />
        <Tile label="Missing block (non-Talabat)" items={issues.missingBlock} tone="red" />
        <Tile label="Unknown block" items={issues.unknownBlock} tone="red" />
        <Tile label="Outside governorate" items={issues.outside} tone="slate" />
      </div>
      {issues.unclassifiedBranches.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">
          <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5" />
          {issues.unclassifiedBranches.length} branch(es) have no governorate classification:
          {' '}{issues.unclassifiedBranches.map(b => b.name).join(', ')} — their orders are excluded from the outside-governorate analysis.
        </div>
      )}
    </section>
  );
};
