import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { AlertTriangle, Bike, Building2, CheckSquare, CreditCard, Download, ImageIcon, Map, MapPin, Plus, Save, Search, Smartphone, Trash2, Trophy, UploadCloud, UsersRound } from 'lucide-react';
import { deliveryService } from '../../services/deliveryService';
import { branchService } from '../../services/branchService';
import { permissionService } from '../../services/permissionService';
import {
  AppUser, Branch, BranchClassification, DeliveryArea, DeliveryBlock, DeliveryDriver, DeliveryDriverMonthlyTarget, DeliveryMobileAppSettings, DeliveryOrder, DeliveryPaymentTypeConfig, DeliverySupervisor, Governorate
} from '../../types';
import { formatBhd, getPresetRange } from './utils';
import { isDeliveryPaymentBlockExempt, normalizeDeliveryPaymentCode } from '../../lib/deliveryPaymentTypes';

const GOVERNORATES: Governorate[] = ['Capital', 'Muharraq', 'Northern', 'Southern'];

type SettingsTab = 'drivers' | 'targets' | 'payments' | 'areas' | 'supervisors' | 'blocks' | 'classification' | 'quality' | 'mobile';

const escapeHtml = (value?: string | null) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const currentMonthKey = () => new Date().toISOString().slice(0, 7);
const monthStartFromKey = (monthKey: string) => `${monthKey}-01`;
const monthEndFromKey = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  const end = new Date(Date.UTC(year, month, 0));
  return end.toISOString().slice(0, 10);
};
const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(Date.UTC(year, month - 1, 1)));
};

const DEFAULT_MOBILE_APP_SETTINGS: DeliveryMobileAppSettings = {
  id: 'global',
  loginLogoUrl: '',
  footerLogoUrl: '',
  footerCredit: 'Developed by Ahmed Elsherbini',
  updatedAt: null,
  updatedBy: null
};

export const DeliverySettings: React.FC = () => {
  const [tab, setTab] = useState<SettingsTab>('drivers');
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [selectedDriverIds, setSelectedDriverIds] = useState<Set<string>>(new Set());
  const [driverTargets, setDriverTargets] = useState<DeliveryDriverMonthlyTarget[]>([]);
  const [driverMonthlyActuals, setDriverMonthlyActuals] = useState<Record<string, number>>({});
  const [targetMonth, setTargetMonth] = useState(currentMonthKey());
  const [paymentTypes, setPaymentTypes] = useState<DeliveryPaymentTypeConfig[]>([]);
  const [areas, setAreas] = useState<DeliveryArea[]>([]);
  const [supervisors, setSupervisors] = useState<DeliverySupervisor[]>([]);
  const [supervisorUsers, setSupervisorUsers] = useState<AppUser[]>([]);
  const [blocks, setBlocks] = useState<DeliveryBlock[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [classifications, setClassifications] = useState<BranchClassification[]>([]);
  const [mobileSettings, setMobileSettings] = useState<DeliveryMobileAppSettings>(DEFAULT_MOBILE_APP_SETTINGS);
  const [isSavingMobileSettings, setIsSavingMobileSettings] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState<'login' | 'footer' | null>(null);
  const [blockSearch, setBlockSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const activeDriverCount = useMemo(() => drivers.filter(driver => driver.isActive).length, [drivers]);
  const inactiveDriverCount = drivers.length - activeDriverCount;
  const selectedDrivers = useMemo(() => drivers.filter(driver => selectedDriverIds.has(driver.id)), [drivers, selectedDriverIds]);
  const allDriversSelected = drivers.length > 0 && selectedDriverIds.size === drivers.length;

  const load = async () => {
    setIsLoading(true);
    try {
      const targetMonthStart = monthStartFromKey(targetMonth);
      const targetMonthEnd = monthEndFromKey(targetMonth);
      const [driverResult, targetResult, dutyResult, paymentResult, areaResult, supervisorResult, supervisorUserResult, blockResult, branchResult, classResult, mobileResult] = await Promise.allSettled([
        deliveryService.drivers.list(true),
        deliveryService.driverTargets.list(targetMonthStart),
        deliveryService.driverDuty.list({ dateFrom: targetMonthStart, dateTo: targetMonthEnd }),
        deliveryService.paymentTypes.list(true),
        deliveryService.areas.list(true),
        deliveryService.supervisors.list(true),
        permissionService.adminListUsers(),
        deliveryService.blocks.list(true),
        branchService.list(),
        deliveryService.classifications.list(),
        deliveryService.mobileAppSettings.get()
      ]);
      setDrivers(driverResult.status === 'fulfilled' ? driverResult.value : []);
      setDriverTargets(targetResult.status === 'fulfilled' ? targetResult.value : []);
      if (dutyResult.status === 'fulfilled') {
        setDriverMonthlyActuals(dutyResult.value.reduce<Record<string, number>>((totals, row) => {
          totals[row.driverId] = (totals[row.driverId] || 0) + row.actualDeliveryCount;
          return totals;
        }, {}));
      } else {
        setDriverMonthlyActuals({});
      }
      setPaymentTypes(paymentResult.status === 'fulfilled' ? paymentResult.value : []);
      setAreas(areaResult.status === 'fulfilled' ? areaResult.value : []);
      setSupervisors(supervisorResult.status === 'fulfilled' ? supervisorResult.value : []);
      setSupervisorUsers(supervisorUserResult.status === 'fulfilled'
        ? supervisorUserResult.value.filter(user => user.role === 'supervisor' && user.isActive)
        : []);
      setBlocks(blockResult.status === 'fulfilled' ? blockResult.value : []);
      setBranches(branchResult.status === 'fulfilled' ? branchResult.value.filter(b => b.role === 'branch') : []);
      setClassifications(classResult.status === 'fulfilled' ? classResult.value : []);
      setMobileSettings(mobileResult.status === 'fulfilled' ? mobileResult.value : DEFAULT_MOBILE_APP_SETTINGS);
    } catch (e) {
      console.error('Delivery settings load failed', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [targetMonth]);
  useEffect(() => {
    setSelectedDriverIds(previous => {
      if (previous.size === 0) return previous;
      const validIds = new Set(drivers.map(driver => driver.id));
      const next = new Set([...previous].filter(id => validIds.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [drivers]);

  // ----- Areas -----
  const editArea = async (area?: DeliveryArea) => {
    const selectedSupervisorId = area?.supervisorId || '';
    const supervisorOptions = supervisors.map(supervisor => `
      <option value="${escapeHtml(supervisor.id)}" ${selectedSupervisorId === supervisor.id ? 'selected' : ''}>
        ${escapeHtml(supervisor.name)}${supervisor.userId ? ' - access linked' : ' - no login link'}${supervisor.isActive ? '' : ' (inactive)'}
      </option>
    `).join('');
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
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Area supervisor</label>
            <select id="swal-area-supervisor-id" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
              <option value="">No supervisor assigned</option>
              ${supervisorOptions}
            </select>
            <p class="mt-1 text-[10px] font-bold leading-5 text-slate-400">
              Branches inherit supervisor access from their assigned area.
            </p>
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
        const supervisorId = (document.getElementById('swal-area-supervisor-id') as HTMLSelectElement).value;
        const notes = (document.getElementById('swal-area-notes') as HTMLTextAreaElement).value.trim();
        if (!name) {
          Swal.showValidationMessage('Area name is required.');
          return false;
        }
        const supervisor = supervisors.find(item => item.id === supervisorId);
        return {
          name,
          governorate,
          supervisorId: supervisor?.id || null,
          supervisorUserId: supervisor?.userId || null,
          notes
        };
      }
    });
    if (!value) return;
    try {
      await deliveryService.areas.upsert({
        id: area?.id,
        name: value.name,
        governorate: value.governorate,
        supervisorId: value.supervisorId,
        supervisorUserId: value.supervisorUserId,
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
    const selectedUserId = supervisor?.userId || supervisorUsers.find(user =>
      user.email.toLowerCase() === supervisor?.email?.toLowerCase()
    )?.userId || '';
    const supervisorUserOptions = supervisorUsers.map(user => `
      <option value="${escapeHtml(user.userId)}" ${selectedUserId === user.userId ? 'selected' : ''}>
        ${escapeHtml(user.email)}
      </option>
    `).join('');
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
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Linked supervisor login</label>
            <select id="swal-supervisor-user-id" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
              <option value="">Not linked to app access</option>
              ${supervisorUserOptions}
            </select>
            <p class="mt-1 text-[10px] font-bold leading-5 text-slate-400">
              Link the supervisor email here so assigned branches become visible in supervisor modules.
            </p>
          </div>
        </div>`,
      showCancelButton: true,
      confirmButtonText: 'Save supervisor',
      confirmButtonColor: '#B91c1c',
      preConfirm: () => {
        const name = (document.getElementById('swal-supervisor-name') as HTMLInputElement).value.trim();
        const phone = (document.getElementById('swal-supervisor-phone') as HTMLInputElement).value.trim();
        const email = (document.getElementById('swal-supervisor-email') as HTMLInputElement).value.trim();
        const userId = (document.getElementById('swal-supervisor-user-id') as HTMLSelectElement).value || null;
        const linkedUser = supervisorUsers.find(user => user.userId === userId);
        if (!name) {
          Swal.showValidationMessage('Supervisor name is required.');
          return false;
        }
        return { name, phone, email: email || linkedUser?.email || '', userId };
      }
    });
    if (!value) return;
    try {
      await deliveryService.supervisors.upsert({
        id: supervisor?.id,
        name: value.name,
        phone: value.phone || undefined,
        email: value.email || undefined,
        userId: value.userId,
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
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Driver ID</label>
            <div class="w-full p-3 bg-slate-100 border border-slate-200 rounded-lg text-sm font-black text-slate-600">
              ${driver?.driverCode ? escapeHtml(driver.driverCode) : 'Auto-generated on save, e.g. D001'}
            </div>
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Name</label>
            <input id="swal-name" value="${escapeHtml(driver?.name)}" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Phone (optional)</label>
            <input id="swal-phone" value="${escapeHtml(driver?.phone)}" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
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

  const toggleDriverSelection = (driverId: string) => {
    setSelectedDriverIds(previous => {
      const next = new Set(previous);
      if (next.has(driverId)) next.delete(driverId);
      else next.add(driverId);
      return next;
    });
  };

  const toggleSelectAllDrivers = () => {
    setSelectedDriverIds(previous => previous.size === drivers.length ? new Set() : new Set(drivers.map(driver => driver.id)));
  };

  const deleteDrivers = async (driversToDelete: DeliveryDriver[]) => {
    if (driversToDelete.length === 0) return;
    const { isConfirmed } = await Swal.fire({
      icon: 'warning',
      title: driversToDelete.length === 1 ? 'Delete driver?' : `Delete ${driversToDelete.length} drivers?`,
      html: `
        <div class="text-left text-sm font-semibold leading-6 text-slate-600">
          <p>This removes the driver profile from Delivery Settings.</p>
          <p class="mt-2">If a driver has delivery history, Supabase may block deletion to protect audit records. Use deactivate for historical drivers.</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#B91c1c'
    });
    if (!isConfirmed) return;

    const deleted: DeliveryDriver[] = [];
    const failed: Array<{ driver: DeliveryDriver; message: string }> = [];
    for (const driver of driversToDelete) {
      try {
        await deliveryService.drivers.delete(driver.id);
        deleted.push(driver);
      } catch (e: any) {
        failed.push({ driver, message: e?.message || 'Could not delete driver.' });
      }
    }

    setSelectedDriverIds(previous => {
      const next = new Set(previous);
      deleted.forEach(driver => next.delete(driver.id));
      return next;
    });
    await load();

    if (failed.length > 0) {
      await Swal.fire({
        icon: deleted.length > 0 ? 'warning' : 'error',
        title: deleted.length > 0 ? 'Some drivers were not deleted' : 'Delete failed',
        html: `
          <div class="text-left text-xs font-bold leading-5 text-slate-600">
            ${deleted.length > 0 ? `<p class="mb-2 text-emerald-700">${deleted.length} deleted successfully.</p>` : ''}
            ${failed.map(item => `<p><span class="text-slate-900">${escapeHtml(item.driver.driverCode || item.driver.name)}</span>: ${escapeHtml(item.message)}</p>`).join('')}
          </div>
        `
      });
    } else {
      await Swal.fire({
        icon: 'success',
        title: 'Drivers deleted',
        text: `${deleted.length} driver${deleted.length === 1 ? '' : 's'} deleted successfully.`,
        timer: 1400,
        showConfirmButton: false
      });
    }
  };

  const exportDriversExcel = async () => {
    const rows = selectedDrivers.length > 0 ? selectedDrivers : drivers;
    if (rows.length === 0) {
      Swal.fire('No drivers', 'There are no driver records to export.', 'info');
      return;
    }
    try {
      const ExcelJS = await import('exceljs');
      const { saveAs } = await import('file-saver');
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Tabarak Hub';
      workbook.created = new Date();
      const sheet = workbook.addWorksheet('Drivers');
      sheet.columns = [
        { header: 'Driver ID', key: 'driverCode', width: 14 },
        { header: 'Name', key: 'name', width: 28 },
        { header: 'Phone', key: 'phone', width: 18 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Auth linked', key: 'authLinked', width: 14 },
        { header: 'Online', key: 'online', width: 10 },
        { header: 'Status changed at', key: 'statusChangedAt', width: 24 },
        { header: 'Last seen at', key: 'lastSeenAt', width: 24 },
        { header: 'Created at', key: 'createdAt', width: 24 },
        { header: 'Updated at', key: 'updatedAt', width: 24 },
        { header: 'Notes', key: 'notes', width: 32 }
      ];
      rows.forEach(driver => {
        sheet.addRow({
          driverCode: driver.driverCode || '',
          name: driver.name,
          phone: driver.phone || '',
          status: driver.isActive ? 'Active' : 'Inactive',
          authLinked: driver.authUserId ? 'Yes' : 'No',
          online: driver.isOnline ? 'Yes' : 'No',
          statusChangedAt: driver.statusChangedAt || '',
          lastSeenAt: driver.lastSeenAt || '',
          createdAt: driver.createdAt || '',
          updatedAt: driver.updatedAt || '',
          notes: driver.notes || ''
        });
      });
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB91C1C' } };
      sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      sheet.autoFilter = 'A1:K1';
      const buffer = await workbook.xlsx.writeBuffer();
      const suffix = selectedDrivers.length > 0 ? 'Selected' : 'All';
      saveAs(new Blob([buffer]), `Delivery_Drivers_${suffix}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e: any) {
      Swal.fire('Export failed', e?.message || 'Could not export drivers.', 'error');
    }
  };

  const editDriverTarget = async (driver: DeliveryDriver, target?: DeliveryDriverMonthlyTarget) => {
    const { value } = await Swal.fire({
      title: `<span class="text-xl font-black tracking-tight">Monthly target - ${escapeHtml(driver.name)}</span>`,
      html: `
        <div class="space-y-3 text-left p-2">
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Target month</p>
            <p class="mt-1 text-sm font-black text-slate-800">${escapeHtml(formatMonthLabel(targetMonth))}</p>
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Actual delivery target</label>
            <input id="swal-target-orders" type="number" min="0" step="1" value="${target?.targetActualDeliveries ?? 0}" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-black">
            <p class="mt-1 text-[10px] font-bold text-slate-400">Counts delivered actual delivery orders only. Internal transfers and order values are excluded.</p>
          </div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Target incentive (BHD)</label>
              <input id="swal-target-incentive" type="number" min="0" step="0.001" value="${target?.targetIncentiveBhd ?? 0}" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-black">
            </div>
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Over-target / extra order (BHD)</label>
              <input id="swal-over-incentive" type="number" min="0" step="0.001" value="${target?.overTargetIncentivePerOrderBhd ?? 0}" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-black">
            </div>
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Notes (optional)</label>
            <textarea id="swal-target-notes" class="min-h-[72px] w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">${escapeHtml(target?.notes)}</textarea>
          </div>
          <label class="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs font-bold text-slate-600">
            <input id="swal-target-active" type="checkbox" class="mt-0.5" ${target?.isActive === false ? '' : 'checked'}>
            <span>Active target for this month</span>
          </label>
        </div>`,
      showCancelButton: true,
      confirmButtonText: 'Save target',
      confirmButtonColor: '#B91c1c',
      width: 640,
      preConfirm: () => {
        const orders = Number((document.getElementById('swal-target-orders') as HTMLInputElement).value);
        const targetIncentive = Number((document.getElementById('swal-target-incentive') as HTMLInputElement).value);
        const overIncentive = Number((document.getElementById('swal-over-incentive') as HTMLInputElement).value);
        const notes = (document.getElementById('swal-target-notes') as HTMLTextAreaElement).value.trim();
        const isActive = (document.getElementById('swal-target-active') as HTMLInputElement).checked;
        if (!Number.isFinite(orders) || orders < 0 || !Number.isInteger(orders)) {
          Swal.showValidationMessage('Actual delivery target must be a whole number.');
          return false;
        }
        if (!Number.isFinite(targetIncentive) || targetIncentive < 0 || !Number.isFinite(overIncentive) || overIncentive < 0) {
          Swal.showValidationMessage('Incentive values must be zero or greater.');
          return false;
        }
        return { orders, targetIncentive, overIncentive, notes, isActive };
      }
    });
    if (!value) return;
    try {
      await deliveryService.driverTargets.upsert({
        id: target?.id,
        driverId: driver.id,
        targetMonth: monthStartFromKey(targetMonth),
        targetActualDeliveries: value.orders,
        targetIncentiveBhd: value.targetIncentive,
        overTargetIncentivePerOrderBhd: value.overIncentive,
        notes: value.notes || null,
        isActive: value.isActive
      });
      await load();
    } catch (e: any) {
      Swal.fire('Save failed', e?.message || 'Could not save driver monthly target.', 'error');
    }
  };

  // ----- Payment types -----
  const editPaymentType = async (paymentType?: DeliveryPaymentTypeConfig) => {
    const { value } = await Swal.fire({
      title: `<span class="text-xl font-black tracking-tight">${paymentType ? 'Edit' : 'Add'} payment type</span>`,
      html: `
        <div class="space-y-3 text-left p-2">
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Label</label>
            <input id="swal-payment-label" value="${escapeHtml(paymentType?.label)}" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold" placeholder="Insurance">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Code</label>
            <input id="swal-payment-code" value="${escapeHtml(paymentType?.code)}" ${paymentType ? 'readonly' : ''} class="w-full p-3 ${paymentType ? 'bg-slate-100 text-slate-500' : 'bg-slate-50'} border border-slate-200 rounded-lg text-sm font-black uppercase" placeholder="INSURANCE">
            <p class="mt-1 text-[10px] font-bold text-slate-400">Used in saved orders. Existing codes are locked to protect history.</p>
          </div>
          <label class="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-600">
            <input id="swal-payment-requires-block" type="checkbox" class="mt-0.5" ${paymentType?.requiresBlock === false ? '' : 'checked'}>
            <span>
              Requires block / area mapping
              <span class="mt-1 block text-[10px] font-bold text-slate-400">Turn this off only for marketplace/external channels like Talabat.</span>
            </span>
          </label>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Display order</label>
            <input id="swal-payment-order" type="number" value="${paymentType?.displayOrder ?? 100}" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
          </div>
        </div>`,
      showCancelButton: true,
      confirmButtonText: 'Save payment type',
      confirmButtonColor: '#B91c1c',
      preConfirm: () => {
        const label = (document.getElementById('swal-payment-label') as HTMLInputElement).value.trim();
        const rawCode = (document.getElementById('swal-payment-code') as HTMLInputElement).value.trim() || label;
        const code = normalizeDeliveryPaymentCode(rawCode);
        const requiresBlock = (document.getElementById('swal-payment-requires-block') as HTMLInputElement).checked;
        const displayOrder = Number((document.getElementById('swal-payment-order') as HTMLInputElement).value || 100);
        if (!label) {
          Swal.showValidationMessage('Payment label is required.');
          return false;
        }
        if (!code) {
          Swal.showValidationMessage('Payment code is required.');
          return false;
        }
        if (!paymentType && paymentTypes.some(type => type.code === code)) {
          Swal.showValidationMessage('This payment code already exists.');
          return false;
        }
        return { code, label, requiresBlock, displayOrder };
      }
    });
    if (!value) return;
    try {
      await deliveryService.paymentTypes.upsert({
        code: paymentType?.code || value.code,
        label: value.label,
        requiresBlock: value.requiresBlock,
        displayOrder: Number.isFinite(value.displayOrder) ? value.displayOrder : 100,
        isActive: paymentType?.isActive ?? true
      });
      await load();
    } catch (e: any) {
      Swal.fire('Save failed', e?.message || 'Could not save payment type.', 'error');
    }
  };

  const togglePaymentType = async (paymentType: DeliveryPaymentTypeConfig) => {
    try {
      await deliveryService.paymentTypes.upsert({ ...paymentType, isActive: !paymentType.isActive });
      await load();
    } catch (e: any) {
      Swal.fire('Update failed', e?.message || 'Could not update payment type.', 'error');
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
    const areaOptions = areas.map(area => `
      <option
        value="${escapeHtml(area.id)}"
        data-supervisor="${escapeHtml(area.supervisorName || supervisors.find(supervisor => supervisor.id === area.supervisorId)?.name || 'No supervisor')}"
        data-access="${area.supervisorUserId || supervisors.find(supervisor => supervisor.id === area.supervisorId)?.userId ? 'access linked' : 'login not linked'}"
        ${selectedAreaId === area.id ? 'selected' : ''}
      >
        ${escapeHtml(area.name)} - ${area.governorate}${area.isActive ? '' : ' (inactive)'}
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
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Inherited supervisor</label>
            <p id="swal-branch-supervisor-preview" class="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-600"></p>
            <p class="mt-1 text-[10px] font-bold leading-5 text-slate-400">
              Change supervisor access from the Area editor, not per branch.
            </p>
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
      didOpen: () => {
        const areaSelect = document.getElementById('swal-branch-area-id') as HTMLSelectElement | null;
        const preview = document.getElementById('swal-branch-supervisor-preview');
        const updatePreview = () => {
          if (!areaSelect || !preview || !areaSelect.value) {
            if (preview) preview.textContent = 'No area selected';
            return;
          }
          const option = areaSelect.selectedOptions[0];
          const supervisorName = option?.getAttribute('data-supervisor') || 'No supervisor';
          const access = option?.getAttribute('data-access') || 'login not linked';
          preview.textContent = `Supervisor from area: ${supervisorName} (${access})`;
        };
        areaSelect?.addEventListener('change', updatePreview);
        updatePreview();
      },
      preConfirm: () => {
        const areaId = (document.getElementById('swal-branch-area-id') as HTMLSelectElement).value;
        const area = areas.find(item => item.id === areaId);
        return {
          areaId: area?.id || null,
          area: area?.name || undefined,
          governorate: area?.governorate || null
        };
      }
    });
    if (value === undefined) return;
    try {
      await deliveryService.classifications.upsert({
        branchId: branch.id,
        areaId: value.areaId,
        area: value.area,
        governorate: (value.governorate || null) as Governorate | null
      });
      await load();
    } catch (e: any) {
      Swal.fire('Save failed', e?.message || 'Could not save classification.', 'error');
    }
  };

  const saveMobileSettings = async (nextSettings = mobileSettings) => {
    setIsSavingMobileSettings(true);
    try {
      const saved = await deliveryService.mobileAppSettings.upsert(nextSettings);
      setMobileSettings(saved);
      await Swal.fire({
        icon: 'success',
        title: 'Mobile app updated',
        text: 'Driver app branding settings were saved.',
        timer: 1400,
        showConfirmButton: false
      });
    } catch (e: any) {
      Swal.fire('Save failed', e?.message || 'Could not save mobile app settings.', 'error');
    } finally {
      setIsSavingMobileSettings(false);
    }
  };

  const uploadMobileLogo = async (slot: 'login' | 'footer', file?: File | null) => {
    if (!file) return;
    setUploadingLogo(slot);
    try {
      const uploadedUrl = await deliveryService.mobileAppSettings.uploadLogo(file, slot);
      const nextSettings = {
        ...mobileSettings,
        [slot === 'login' ? 'loginLogoUrl' : 'footerLogoUrl']: uploadedUrl
      };
      const saved = await deliveryService.mobileAppSettings.upsert(nextSettings);
      setMobileSettings(saved);
      await Swal.fire({
        icon: 'success',
        title: 'Logo uploaded',
        text: `${slot === 'login' ? 'Login' : 'Footer'} logo is now live for the driver app.`,
        timer: 1400,
        showConfirmButton: false
      });
    } catch (e: any) {
      Swal.fire('Upload failed', e?.message || 'Could not upload logo.', 'error');
    } finally {
      setUploadingLogo(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex bg-slate-100/60 p-1 rounded-lg border border-slate-200/50 w-fit max-w-full overflow-x-auto">
        {([
          { id: 'drivers', label: 'Drivers', icon: Bike },
          { id: 'targets', label: 'Driver Targets', icon: Trophy },
          { id: 'payments', label: 'Payments', icon: CreditCard },
          { id: 'areas', label: 'Areas', icon: Map },
          { id: 'supervisors', label: 'Supervisors', icon: UsersRound },
          { id: 'blocks', label: 'Blocks', icon: MapPin },
          { id: 'classification', label: 'Branch Assignment', icon: Building2 },
          { id: 'mobile', label: 'Mobile App', icon: Smartphone },
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
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Delivery drivers</h3>
              <p className="mt-1 text-[11px] font-medium text-slate-500">
                {drivers.length} total drivers - {activeDriverCount} active - {inactiveDriverCount} inactive - {selectedDriverIds.size} selected
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={toggleSelectAllDrivers}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 transition hover:border-brand/30 hover:text-brand"
                disabled={drivers.length === 0}
              >
                <CheckSquare className="h-3.5 w-3.5" /> {allDriversSelected ? 'Clear all' : 'Select all'}
              </button>
              <button
                onClick={exportDriversExcel}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 transition hover:border-brand/30 hover:text-brand"
                disabled={drivers.length === 0}
              >
                <Download className="h-3.5 w-3.5" /> Download Excel
              </button>
              <button
                onClick={() => deleteDrivers(selectedDrivers)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={selectedDrivers.length === 0}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete selected
              </button>
              <button onClick={() => editDriver()} className="btn-primary text-[10px] uppercase tracking-widest">
                <Plus className="h-3.5 w-3.5" /> Add driver
              </button>
            </div>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total drivers</p>
              <p className="mt-1 text-2xl font-black text-slate-900 tabular-nums">{drivers.length}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700/70">Active</p>
              <p className="mt-1 text-2xl font-black text-emerald-800 tabular-nums">{activeDriverCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inactive</p>
              <p className="mt-1 text-2xl font-black text-slate-700 tabular-nums">{inactiveDriverCount}</p>
            </div>
            <div className="rounded-xl border border-brand/20 bg-brand/5 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-brand/70">Selected</p>
              <p className="mt-1 text-2xl font-black text-brand tabular-nums">{selectedDriverIds.size}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {drivers.map(driver => (
              <div key={driver.id} className={`rounded-lg border p-3 ${selectedDriverIds.has(driver.id) ? 'border-brand/40 bg-brand/5' : driver.isActive ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-70'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedDriverIds.has(driver.id)}
                      onChange={() => toggleDriverSelection(driver.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                      aria-label={`Select ${driver.name}`}
                    />
                    <div className="min-w-0">
                    <p className="text-sm font-black text-slate-800">{driver.name}</p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-brand">
                      {driver.driverCode || 'Pending Driver ID'}
                    </p>
                      {driver.authUserId && <p className="mt-1 text-[10px] font-bold text-slate-400">Linked login account</p>}
                    </div>
                  </div>
                  <span className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase ${driver.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-400'}`}>
                    {driver.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {driver.phone && <p className="mt-1 text-[11px] font-bold text-slate-400">{driver.phone}</p>}
                <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-bold">
                  <button onClick={() => editDriver(driver)} className="text-slate-500 hover:text-brand">Edit</button>
                  <button onClick={() => toggleDriver(driver)} className="text-slate-400 hover:text-brand">
                    {driver.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                  <button onClick={() => deleteDrivers([driver])} className="text-red-500 hover:text-red-700">Delete</button>
                </div>
              </div>
            ))}
            {drivers.length === 0 && <p className="text-xs font-bold text-slate-400">No drivers yet — add the first one.</p>}
          </div>
        </section>
      ) : tab === 'targets' ? (
        <section className="operational-panel p-4 md:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Driver monthly targets</h3>
              <p className="mt-1 text-[11px] font-medium text-slate-500">
                Set actual delivery count targets and incentives. Internal transfers and order values are excluded.
              </p>
            </div>
            <input
              type="month"
              value={targetMonth}
              onChange={e => setTargetMonth(e.target.value || currentMonthKey())}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 outline-none focus:border-brand/40"
            />
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Month</p>
              <p className="mt-1 text-sm font-black text-slate-900">{formatMonthLabel(targetMonth)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Configured</p>
              <p className="mt-1 text-2xl font-black text-slate-900 tabular-nums">{driverTargets.filter(target => target.isActive).length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Actual deliveries</p>
              <p className="mt-1 text-2xl font-black text-slate-900 tabular-nums">
                {(Object.values(driverMonthlyActuals) as number[]).reduce((sum, value) => sum + value, 0)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target orders</p>
              <p className="mt-1 text-2xl font-black text-slate-900 tabular-nums">
                {driverTargets.filter(target => target.isActive).reduce((sum, target) => sum + target.targetActualDeliveries, 0)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {drivers.map(driver => {
              const target = driverTargets.find(item => item.driverId === driver.id);
              const actual = driverMonthlyActuals[driver.id] || 0;
              const targetCount = target?.isActive ? target.targetActualDeliveries : 0;
              const progress = targetCount > 0 ? Math.min(100, Math.round((actual / targetCount) * 100)) : 0;
              const overTarget = Math.max(0, actual - targetCount);
              const earned = targetCount > 0 && actual >= targetCount
                ? (target?.targetIncentiveBhd || 0) + (overTarget * (target?.overTargetIncentivePerOrderBhd || 0))
                : 0;
              return (
                <div key={driver.id} className={`rounded-xl border p-4 ${driver.isActive ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">{driver.name}</p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-brand">{driver.driverCode || 'Pending Driver ID'}</p>
                    </div>
                    <span className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase ${
                      target?.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'
                    }`}>
                      {target?.isActive ? 'Configured' : 'No target'}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-slate-50 p-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Actual</p>
                      <p className="mt-1 text-lg font-black text-slate-900 tabular-nums">{actual}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Target</p>
                      <p className="mt-1 text-lg font-black text-slate-900 tabular-nums">{targetCount}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Over</p>
                      <p className="mt-1 text-lg font-black text-slate-900 tabular-nums">{overTarget}</p>
                    </div>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-slate-500">
                    <span>{progress}% achieved</span>
                    <span>Earned {formatBhd(earned)}</span>
                  </div>
                  {target?.isActive && (
                    <p className="mt-2 text-[11px] font-bold leading-5 text-slate-400">
                      Target bonus {formatBhd(target.targetIncentiveBhd)} | over-target {formatBhd(target.overTargetIncentivePerOrderBhd)} / extra delivery
                    </p>
                  )}
                  <button onClick={() => editDriverTarget(driver, target)} className="mt-4 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 transition hover:border-brand/30 hover:text-brand">
                    Configure target
                  </button>
                </div>
              );
            })}
            {drivers.length === 0 && <p className="text-xs font-bold text-slate-400">No drivers yet - add drivers first.</p>}
          </div>
        </section>
      ) : tab === 'payments' ? (
        <section className="operational-panel p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Delivery payment types</h3>
              <p className="mt-1 text-[11px] font-medium text-slate-500">
                Add payment channels for delivery recording. Turn off block mapping only for external marketplace channels.
              </p>
            </div>
            <button onClick={() => editPaymentType()} className="btn-primary text-[10px] uppercase tracking-widest">
              <Plus className="h-3.5 w-3.5" /> Add payment
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {paymentTypes.map(paymentType => (
              <div key={paymentType.code} className={`rounded-lg border p-3 ${paymentType.isActive ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-800">{paymentType.label}</p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-brand">{paymentType.code}</p>
                  </div>
                  <span className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase ${paymentType.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-400'}`}>
                    {paymentType.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="mt-2 text-[11px] font-bold text-slate-500">
                  {paymentType.requiresBlock ? 'Requires block / area mapping' : 'No block required'}
                </p>
                <div className="mt-2 flex gap-3 text-[11px] font-bold">
                  <button onClick={() => editPaymentType(paymentType)} className="text-slate-500 hover:text-brand">Edit</button>
                  <button onClick={() => togglePaymentType(paymentType)} className="text-slate-400 hover:text-brand">
                    {paymentType.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                </div>
              </div>
            ))}
            {paymentTypes.length === 0 && <p className="text-xs font-bold text-slate-400">No payment types yet - add Cash, Card, BP, Talabat, and Insurance.</p>}
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
            {areas.map(area => {
              const supervisor = area.supervisorId ? supervisors.find(item => item.id === area.supervisorId) : undefined;
              const supervisorName = area.supervisorName || supervisor?.name;
              const supervisorAccessLinked = Boolean(area.supervisorUserId || supervisor?.userId);
              return (
                <div key={area.id} className={`rounded-lg border p-3 ${area.isActive ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-800">{area.name}</p>
                      <p className="mt-1 text-[11px] font-bold text-slate-400">{area.governorate}</p>
                      <p className={`mt-1 text-[10px] font-black uppercase tracking-widest ${supervisorName ? (supervisorAccessLinked ? 'text-emerald-600' : 'text-amber-600') : 'text-slate-400'}`}>
                        {supervisorName
                          ? `Supervisor: ${supervisorName}${supervisorAccessLinked ? '' : ' (login not linked)'}`
                          : 'No supervisor assigned'}
                      </p>
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
              );
            })}
            {areas.length === 0 && <p className="text-xs font-bold text-slate-400">No areas yet - add the first one.</p>}
          </div>
        </section>
      ) : tab === 'supervisors' ? (
        <section className="operational-panel p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Delivery supervisors</h3>
              <p className="mt-1 text-[11px] font-medium text-slate-500">Create supervisors first, then assign them to delivery areas.</p>
            </div>
            <button onClick={() => editSupervisor()} className="btn-primary text-[10px] uppercase tracking-widest">
              <Plus className="h-3.5 w-3.5" /> Add supervisor
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {supervisors.map(supervisor => {
              const linkedUser = supervisor.userId
                ? supervisorUsers.find(user => user.userId === supervisor.userId)
                : null;
              return (
                <div key={supervisor.id} className={`rounded-lg border p-3 ${supervisor.isActive ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-800">{supervisor.name}</p>
                      {(supervisor.phone || supervisor.email) && (
                        <p className="mt-1 text-[11px] font-bold text-slate-400">
                          {[supervisor.phone, supervisor.email].filter(Boolean).join(' | ')}
                        </p>
                      )}
                      <p className={`mt-1 text-[10px] font-black uppercase tracking-widest ${supervisor.userId ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {supervisor.userId
                          ? `Linked login: ${linkedUser?.email || 'Supervisor user'}`
                          : 'No linked login access'}
                      </p>
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
              );
            })}
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
            Branch -&gt; area. Supervisor access is inherited from the assigned area; unclassified branches are excluded from outside-governorate analysis.
          </p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {branches.map(branch => {
              const c = classifications.find(x => x.branchId === branch.id);
              const area = c?.areaId ? areas.find(item => item.id === c.areaId) : undefined;
              const supervisor = area?.supervisorId
                ? supervisors.find(item => item.id === area.supervisorId)
                : c?.supervisorId ? supervisors.find(item => item.id === c.supervisorId) : undefined;
              const areaName = area?.name || c?.area;
              const supervisorName = area?.supervisorName || supervisor?.name || c?.supervisorName;
              const governorate = c?.governorate || area?.governorate;
              const supervisorAccessLinked = Boolean(area?.supervisorUserId || supervisor?.userId || c?.supervisorUserId);
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
                  <p className="hidden">
                    {c?.area ? `${c.area}` : 'No area'}{c?.supervisorName ? ` · ${c.supervisorName}` : ' · No supervisor'}
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-slate-400">
                    {areaName || 'No area'}{supervisorName ? ` - ${supervisorName}` : ' - No area supervisor'}
                  </p>
                  {supervisorName && (
                    <p className={`mt-1 text-[10px] font-black uppercase tracking-widest ${supervisorAccessLinked ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {supervisorAccessLinked ? 'Supervisor access linked' : 'Supervisor login not linked'}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ) : tab === 'mobile' ? (
        <section className="operational-panel p-4 md:p-5">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Driver mobile app</h3>
              <p className="mt-1 max-w-2xl text-[11px] font-medium leading-5 text-slate-500">
                Control the logos shown in the driver app login screen. Uploaded images are saved to Supabase Storage and become available to the app without rebuilding.
              </p>
            </div>
            <button
              onClick={() => saveMobileSettings()}
              disabled={isSavingMobileSettings || !!uploadingLogo}
              className="btn-primary text-[10px] uppercase tracking-widest disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" /> {isSavingMobileSettings ? 'Saving...' : 'Save settings'}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_0.9fr]">
            {([
              {
                slot: 'login' as const,
                title: 'Login logo',
                helper: 'Main logo at the top of the driver login screen.',
                value: mobileSettings.loginLogoUrl,
                keyName: 'loginLogoUrl' as const
              },
              {
                slot: 'footer' as const,
                title: 'Footer logo',
                helper: 'Small HUB/developer footer logo under the login form.',
                value: mobileSettings.footerLogoUrl,
                keyName: 'footerLogoUrl' as const
              }
            ]).map(item => (
              <div key={item.slot} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-700">{item.title}</p>
                    <p className="mt-1 text-[11px] font-bold leading-5 text-slate-400">{item.helper}</p>
                  </div>
                  <ImageIcon className="h-4 w-4 shrink-0 text-brand" />
                </div>
                <div className="mb-3 flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
                  {item.value ? (
                    <img src={item.value} alt={item.title} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <div className="text-center">
                      <ImageIcon className="mx-auto h-6 w-6 text-slate-300" />
                      <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Local fallback</p>
                    </div>
                  )}
                </div>
                <label className="mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-brand/15 bg-brand/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-brand transition hover:bg-brand/10">
                  <UploadCloud className="h-3.5 w-3.5" />
                  {uploadingLogo === item.slot ? 'Uploading...' : 'Upload image'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    disabled={!!uploadingLogo}
                    onChange={event => {
                      const file = event.target.files?.[0];
                      event.currentTarget.value = '';
                      uploadMobileLogo(item.slot, file);
                    }}
                  />
                </label>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Image URL</label>
                <input
                  value={item.value}
                  onChange={event => setMobileSettings(previous => ({ ...previous, [item.keyName]: event.target.value }))}
                  placeholder="https://..."
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-brand/40"
                />
                <button
                  onClick={() => setMobileSettings(previous => ({ ...previous, [item.keyName]: '' }))}
                  className="mt-2 text-[11px] font-bold text-slate-400 hover:text-brand"
                >
                  Use app fallback logo
                </button>
              </div>
            ))}

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3">
                <p className="text-xs font-black uppercase tracking-widest text-slate-700">Footer credit</p>
                <p className="mt-1 text-[11px] font-bold leading-5 text-slate-400">
                  Text displayed directly under the footer logo on the driver login screen.
                </p>
              </div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Credit text</label>
              <input
                value={mobileSettings.footerCredit}
                onChange={event => setMobileSettings(previous => ({ ...previous, footerCredit: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-brand/40"
              />
              <div className="mt-4 rounded-xl bg-slate-950 p-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Login footer preview</p>
                <div className="mt-3 flex h-20 items-center justify-center">
                  {mobileSettings.footerLogoUrl ? (
                    <img src={mobileSettings.footerLogoUrl} alt="Driver app footer logo preview" className="max-h-full max-w-[140px] object-contain" />
                  ) : (
                    <div className="rounded-lg border border-white/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white/40">Local logo</div>
                  )}
                </div>
                <p className="mt-2 text-[11px] font-bold text-white/70">{mobileSettings.footerCredit || DEFAULT_MOBILE_APP_SETTINGS.footerCredit}</p>
              </div>
              <p className="mt-3 text-[10px] font-bold leading-5 text-slate-400">
                Tip: leave a logo URL empty to keep using the bundled app fallback.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <DataQualityPanel blocks={blocks} classifications={classifications} branches={branches} paymentTypes={paymentTypes} />
      )}
    </div>
  );
};

// --- Data quality panel: current-month order hygiene ---
const DataQualityPanel: React.FC<{
  blocks: DeliveryBlock[];
  classifications: BranchClassification[];
  branches: Branch[];
  paymentTypes: DeliveryPaymentTypeConfig[];
}> = ({ classifications, branches, paymentTypes }) => {
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
    const unknownBlock = orders.filter(o => !isDeliveryPaymentBlockExempt(o.paymentType, paymentTypes) && o.blockNumber && !o.areaName);
    const missingBlock = orders.filter(o => !isDeliveryPaymentBlockExempt(o.paymentType, paymentTypes) && !o.blockNumber);
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
