import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { AlertTriangle, Bike, Building2, MapPin, Plus, Search } from 'lucide-react';
import { deliveryService } from '../../services/deliveryService';
import { branchService } from '../../services/branchService';
import {
  Branch, BranchClassification, DeliveryBlock, DeliveryDriver, DeliveryOrder, Governorate
} from '../../types';
import { formatBhd, getPresetRange } from './utils';

const GOVERNORATES: Governorate[] = ['Capital', 'Muharraq', 'Northern', 'Southern'];

type SettingsTab = 'drivers' | 'blocks' | 'classification' | 'quality';

export const DeliverySettings: React.FC = () => {
  const [tab, setTab] = useState<SettingsTab>('drivers');
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [blocks, setBlocks] = useState<DeliveryBlock[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [classifications, setClassifications] = useState<BranchClassification[]>([]);
  const [blockSearch, setBlockSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);
    try {
      const [driverList, blockList, branchList, classList] = await Promise.all([
        deliveryService.drivers.list(true),
        deliveryService.blocks.list(true),
        branchService.list(),
        deliveryService.classifications.list()
      ]);
      setDrivers(driverList);
      setBlocks(blockList);
      setBranches(branchList.filter(b => b.role === 'branch'));
      setClassifications(classList);
    } catch (e) {
      console.error('Delivery settings load failed', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

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
    const { value } = await Swal.fire({
      title: `<span class="text-xl font-black tracking-tight">${block ? `Edit block ${block.blockNumber}` : 'Add block'}</span>`,
      html: `
        <div class="space-y-3 text-left p-2">
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Block number</label>
            <input id="swal-block" value="${block?.blockNumber || ''}" ${block ? 'readonly' : ''} class="w-full p-3 ${block ? 'bg-slate-100 text-slate-400' : 'bg-slate-50'} border border-slate-200 rounded-lg text-sm font-bold">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Area name</label>
            <input id="swal-area" value="${block?.areaName || ''}" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Governorate</label>
            <select id="swal-gov" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
              ${GOVERNORATES.map(g => `<option value="${g}" ${block?.governorate === g ? 'selected' : ''}>${g}</option>`).join('')}
            </select>
          </div>
        </div>`,
      showCancelButton: true,
      confirmButtonText: 'Save',
      confirmButtonColor: '#B91c1c',
      preConfirm: () => ({
        blockNumber: (document.getElementById('swal-block') as HTMLInputElement).value.trim(),
        areaName: (document.getElementById('swal-area') as HTMLInputElement).value.trim(),
        governorate: (document.getElementById('swal-gov') as HTMLSelectElement).value as Governorate
      })
    });
    if (!value?.blockNumber || !value.areaName) return;
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
    const { value } = await Swal.fire({
      title: `<span class="text-xl font-black tracking-tight">${branch.name}</span>`,
      html: `
        <div class="space-y-3 text-left p-2">
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Area</label>
            <input id="swal-area" value="${current?.area || ''}" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Supervisor</label>
            <input id="swal-supervisor" value="${current?.supervisorName || ''}" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
          </div>
          <div>
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
      preConfirm: () => ({
        area: (document.getElementById('swal-area') as HTMLInputElement).value.trim(),
        supervisorName: (document.getElementById('swal-supervisor') as HTMLInputElement).value.trim(),
        governorate: (document.getElementById('swal-gov') as HTMLSelectElement).value
      })
    });
    if (value === undefined) return;
    try {
      await deliveryService.classifications.upsert({
        branchId: branch.id,
        area: value.area || undefined,
        supervisorName: value.supervisorName || undefined,
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
          { id: 'blocks', label: 'Blocks & Areas', icon: MapPin },
          { id: 'classification', label: 'Branch Classification', icon: Building2 },
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
          <h3 className="mb-1 text-sm font-black uppercase tracking-widest text-slate-700">Branch classification</h3>
          <p className="mb-4 text-[11px] font-medium text-slate-500">
            Branch → area, supervisor, governorate. The governorate drives the outside-governorate analysis; unclassified branches are excluded from it.
          </p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {branches.map(branch => {
              const c = classifications.find(x => x.branchId === branch.id);
              return (
                <button
                  key={branch.id}
                  onClick={() => editClassification(branch)}
                  className="rounded-lg border border-slate-200 bg-white p-3 text-left transition-colors hover:border-brand/40"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black text-slate-800">{branch.name}</p>
                    {c?.governorate
                      ? <span className="rounded-md border border-brand/10 bg-brand/5 px-2 py-0.5 text-[9px] font-black text-brand">{c.governorate}</span>
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
