import React, { useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { AlertTriangle, CheckCircle2, Lock, MapPin, Pencil, Plus, Trash2, Unlock, Upload, X } from 'lucide-react';
import { deliveryService } from '../../services/deliveryService';
import { pharmacistService } from '../../services/pharmacistService';
import {
  Branch, DeliveryBlock, DeliveryDriver, DeliveryOrder, DeliveryOrderInput, DeliveryPaymentType, DeliveryPaymentTypeConfig, Pharmacist
} from '../../types';
import { SearchableSelect } from './components/SearchableSelect';
import { formatBhd, todayKey, yesterdayKey } from './utils';
import {
  DEFAULT_DELIVERY_PAYMENT_TYPES,
  getDeliveryPaymentLabel,
  isDeliveryPaymentBlockExempt,
  isTalabatDeliveryPayment,
  sortDeliveryPaymentTypes
} from '../../lib/deliveryPaymentTypes';
import {
  DELIVERY_ORDER_IMPORT_ACCEPT,
  MAX_DELIVERY_ORDER_IMPORT_BYTES,
  isSupportedDeliveryOrderImportFile,
  parseDeliveryOrderUpload
} from '../../utils/deliveryImportUtils';

const paymentBadge = (type: string, paymentTypes?: DeliveryPaymentTypeConfig[]) =>
  isDeliveryPaymentBlockExempt(type, paymentTypes)
    ? 'border-orange-200 bg-orange-50 text-orange-700'
    : 'border-brand/10 bg-brand/5 text-brand';

const driverDisplayName = (order: DeliveryOrder) =>
  isTalabatDeliveryPayment(order.paymentType) ? 'Talabat fleet' : order.driverName || '-';

const editActionClass = 'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100';
const dangerActionClass = 'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-100';
const lockButtonClass = (locked: boolean) =>
  `mt-2 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition ${
    locked
      ? 'border-brand/20 bg-brand/5 text-brand hover:bg-brand/10'
      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
  }`;

const sortOrdersNewestFirst = (orders: DeliveryOrder[]) => [...orders].sort((a, b) =>
  b.orderDate.localeCompare(a.orderDate) || b.createdAt.localeCompare(a.createdAt)
);

const RequiredMark = () => <span className="ml-1 text-red-600" aria-hidden="true">*</span>;

const escapeUploadHtml = (value: string) => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[char] || char));

const renderDeliveryUploadProgressHtml = (percent: number, label: string, detail?: string) => {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  return `
    <div style="font-family: inherit; text-align: left;">
      <p style="margin: 0 0 8px; font-size: 12px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; color: #94a3b8;">Parsing and uploading delivery orders</p>
      <div style="display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 10px;">
        <span style="font-size: 13px; font-weight: 800; color: #334155;">${escapeUploadHtml(label)}</span>
        <span style="font-size: 18px; font-weight: 900; color: #b91c1c;">${safePercent}%</span>
      </div>
      <div style="height: 10px; border-radius: 999px; background: #e2e8f0; overflow: hidden;">
        <div style="height: 100%; width: ${safePercent}%; border-radius: 999px; background: linear-gradient(90deg, #991b1b, #ef4444); transition: width 180ms ease;"></div>
      </div>
      ${detail ? `<p style="margin: 10px 0 0; font-size: 12px; font-weight: 700; color: #64748b;">${escapeUploadHtml(detail)}</p>` : ''}
    </div>
  `;
};

const renderDeliveryImportErrorsHtml = (errors: { row: number; message: string }[]) => {
  const visibleErrors = errors.slice(0, 10);
  const remaining = Math.max(0, errors.length - visibleErrors.length);
  return `
    <div style="text-align: left; font-family: inherit;">
      <p style="margin: 0 0 10px; color: #475569; font-size: 13px; font-weight: 700;">Fix these rows and upload the file again.</p>
      <div style="max-height: 260px; overflow: auto; border: 1px solid #fee2e2; border-radius: 12px;">
        ${visibleErrors.map(error => `
          <div style="padding: 10px 12px; border-bottom: 1px solid #fee2e2;">
            <span style="display: block; color: #991b1b; font-size: 12px; font-weight: 900;">Row ${error.row}</span>
            <span style="display: block; margin-top: 2px; color: #475569; font-size: 12px; font-weight: 700;">${escapeUploadHtml(error.message)}</span>
          </div>
        `).join('')}
      </div>
      ${remaining > 0 ? `<p style="margin: 10px 0 0; color: #64748b; font-size: 12px; font-weight: 800;">+ ${remaining} more errors</p>` : ''}
    </div>
  `;
};

interface BranchRecordingPageProps {
  branch: Branch;
  canEdit: boolean;
  isManager: boolean;
  orderToEdit?: DeliveryOrder | null;
  onEditDone?: () => void;
}

export const BranchRecordingPage: React.FC<BranchRecordingPageProps> = ({ branch, canEdit, isManager, orderToEdit, onEditDone }) => {
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [pharmacists, setPharmacists] = useState<Pharmacist[]>([]);
  const [blocks, setBlocks] = useState<DeliveryBlock[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<DeliveryPaymentTypeConfig[]>(DEFAULT_DELIVERY_PAYMENT_TYPES);
  const [historyOrders, setHistoryOrders] = useState<DeliveryOrder[]>([]);
  const [historyFrom, setHistoryFrom] = useState(todayKey());
  const [historyTo, setHistoryTo] = useState(todayKey());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [isHistoryBulkCancelling, setIsHistoryBulkCancelling] = useState(false);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());
  const [editingOrder, setEditingOrder] = useState<DeliveryOrder | null>(null);

  // Form state
  const [orderDate, setOrderDate] = useState(todayKey());
  const [value, setValue] = useState('');
  const [paymentType, setPaymentType] = useState<DeliveryPaymentType>('CASH');


  const [pharmacistId, setPharmacistId] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [isPharmacistLocked, setIsPharmacistLocked] = useState(false);
  const [isDriverLocked, setIsDriverLocked] = useState(false);
  const [locksHydrated, setLocksHydrated] = useState(false);
  const [blockInput, setBlockInput] = useState('');
  const [resolvedBlock, setResolvedBlock] = useState<DeliveryBlock | null>(null);
  const [blockMatches, setBlockMatches] = useState<DeliveryBlock[]>([]);
  const [blockNotFound, setBlockNotFound] = useState(false);
  const [isBlockSearching, setIsBlockSearching] = useState(false);

  const selectedBlock = useMemo(
    () => blocks.find(block => block.blockNumber === blockInput) || resolvedBlock,
    [blocks, blockInput, resolvedBlock]
  );
  const blockOptions = useMemo(() => blocks.map(block => ({
    value: block.blockNumber,
    label: `Block ${block.blockNumber}`,
    hint: `${block.areaName} - ${block.governorate}`
  })), [blocks]);

  const activePaymentTypes = useMemo(
    () => sortDeliveryPaymentTypes(paymentTypes).filter(type => type.isActive),
    [paymentTypes]
  );
  const paymentOptions = useMemo(() => {
    const sorted = sortDeliveryPaymentTypes(paymentTypes);
    const active = sorted.filter(type => type.isActive);
    if (paymentType && !active.some(type => type.code === paymentType)) {
      const current = sorted.find(type => type.code === paymentType);
      if (current) return [...active, current];
    }
    return active;
  }, [paymentTypes, paymentType]);
  const defaultPaymentType = activePaymentTypes.find(type => type.code === 'CASH')?.code || activePaymentTypes[0]?.code || 'CASH';
  const selectedPaymentType = paymentOptions.find(type => type.code === paymentType);
  const requiresBlock = selectedPaymentType?.requiresBlock ?? !isDeliveryPaymentBlockExempt(paymentType, paymentTypes);
  const isBlockExemptPayment = !requiresBlock;
  const isTalabatPayment = isTalabatDeliveryPayment(paymentType);
  const areaPreview = !requiresBlock
    ? `Not required for ${selectedPaymentType?.label || paymentType}`
    : selectedBlock
      ? `${selectedBlock.areaName} | ${selectedBlock.governorate}`
      : 'Search by area name, then choose the block number';
  // Branch users may record today or yesterday (late-evening catch-up). Managers: any date.
  const minDate = isManager || editingOrder ? undefined : yesterdayKey();
  const maxDate = isManager || editingOrder ? undefined : todayKey();
  const lockStorageKey = `delivery-entry-locks:${branch.id}`;
  const historyRange = useMemo(() => (
    historyFrom <= historyTo
      ? { from: historyFrom, to: historyTo }
      : { from: historyTo, to: historyFrom }
  ), [historyFrom, historyTo]);
  const isOrderInsideHistoryRange = (order: DeliveryOrder) => order.orderDate >= historyRange.from && order.orderDate <= historyRange.to;
  const selectedHistoryOrders = useMemo(
    () => historyOrders.filter(order => selectedHistoryIds.has(order.id)),
    [historyOrders, selectedHistoryIds]
  );
  const allHistorySelected = historyOrders.length > 0 && historyOrders.every(order => selectedHistoryIds.has(order.id));
  const canUseHistorySelection = canEdit && historyOrders.length > 0;

  const loadReference = async () => {
    try {
      const [driverList, pharmacistList, blockList] = await Promise.all([
        deliveryService.drivers.list(),
        pharmacistService.listByBranch(branch.id),
        deliveryService.blocks.list()
      ]);
      setDrivers(driverList);
      setPharmacists(pharmacistList);
      setBlocks(blockList);
      deliveryService.paymentTypes.list()
        .then(types => setPaymentTypes(sortDeliveryPaymentTypes(types)))
        .catch(error => console.warn('Delivery payment types load failed', error));
    } catch (e) {
      console.error('Delivery reference load failed', e);
    }
  };

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const orders = await deliveryService.orders.list({
        branchId: branch.id,
        dateFrom: historyRange.from,
        dateTo: historyRange.to
      });
      setHistoryOrders(orders);
    } catch (e) {
      console.error('Delivery list failed', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadReference(); }, [branch.id]);
  useEffect(() => { loadHistory(); }, [branch.id, historyRange.from, historyRange.to]);
  useEffect(() => {
    if (paymentOptions.length === 0) return;
    if (!paymentOptions.some(type => type.code === paymentType)) {
      setPaymentType(defaultPaymentType);
    }
  }, [defaultPaymentType, paymentOptions, paymentType]);

  useEffect(() => {
    setSelectedHistoryIds(prev => {
      const visibleIds = new Set(historyOrders.map(order => order.id));
      const next = new Set([...prev].filter(id => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [historyOrders]);

  useEffect(() => {
    setLocksHydrated(false);
    let nextPharmacistId: string | null = null;
    let nextDriverId: string | null = null;
    let nextPharmacistLocked = false;
    let nextDriverLocked = false;
    try {
      const saved = localStorage.getItem(lockStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          pharmacistId?: string | null;
          driverId?: string | null;
          isPharmacistLocked?: boolean;
          isDriverLocked?: boolean;
        };
        if (parsed.isPharmacistLocked && parsed.pharmacistId) {
          nextPharmacistId = parsed.pharmacistId;
          nextPharmacistLocked = true;
        }
        if (parsed.isDriverLocked && parsed.driverId) {
          nextDriverId = parsed.driverId;
          nextDriverLocked = true;
        }
      }
    } catch (error) {
      console.warn('Could not restore delivery entry locks', error);
    } finally {
      setPharmacistId(nextPharmacistId);
      setDriverId(nextDriverId);
      setIsPharmacistLocked(nextPharmacistLocked);
      setIsDriverLocked(nextDriverLocked);
      setLocksHydrated(true);
    }
  }, [lockStorageKey]);

  useEffect(() => {
    if (!locksHydrated) return;
    const hasLockedValue = (isPharmacistLocked && pharmacistId) || (isDriverLocked && driverId);
    if (!hasLockedValue) {
      localStorage.removeItem(lockStorageKey);
      return;
    }
    localStorage.setItem(lockStorageKey, JSON.stringify({
      isPharmacistLocked,
      pharmacistId: isPharmacistLocked ? pharmacistId : null,
      isDriverLocked,
      driverId: isDriverLocked ? driverId : null
    }));
  }, [lockStorageKey, locksHydrated, isPharmacistLocked, pharmacistId, isDriverLocked, driverId]);

  useEffect(() => {
    if (!isTalabatPayment) return;
    setDriverId(null);
    setIsDriverLocked(false);
  }, [isTalabatPayment]);

  // Resolve block -> area as the user types.
  useEffect(() => {
    let cancelled = false;
    setIsBlockSearching(false);
    const trimmed = blockInput.trim();
    if (!trimmed || isBlockExemptPayment) {
      setResolvedBlock(null);
      setBlockMatches([]);
      setBlockNotFound(false);
      return;
    }
    const directoryBlock = blocks.find(block => block.blockNumber.toLowerCase() === trimmed.toLowerCase());
    if (directoryBlock) {
      setResolvedBlock(directoryBlock);
      setBlockMatches([directoryBlock]);
      setBlockNotFound(false);
      return;
    }
    if (
      resolvedBlock
      && (
        resolvedBlock.blockNumber.toLowerCase() === trimmed.toLowerCase()
        || blockMatches.some(block => block.blockNumber === resolvedBlock.blockNumber)
      )
    ) {
      setBlockMatches([resolvedBlock]);
      setBlockNotFound(false);
      return;
    }
    setResolvedBlock(null);
    setBlockMatches([]);
    setBlockNotFound(false);
    const timer = setTimeout(async () => {
      setIsBlockSearching(true);
      const matches = await deliveryService.blocks.search(trimmed, 10);
      if (cancelled) return;
      const normalized = trimmed.toLowerCase();
      const exact = matches.find(block => block.blockNumber.toLowerCase() === normalized);
      const selected = exact || (matches.length === 1 ? matches[0] : null);
      setBlockMatches(matches);
      setResolvedBlock(selected);
      setBlockNotFound(matches.length === 0);
      if (selected && selected.blockNumber !== trimmed) {
        setBlockInput(selected.blockNumber);
      }
      setIsBlockSearching(false);
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [blockInput, isBlockExemptPayment, resolvedBlock, blocks]);

  const selectResolvedBlock = (block: DeliveryBlock) => {
    setBlockInput(block.blockNumber);
    setResolvedBlock(block);
    setBlockMatches([block]);
    setBlockNotFound(false);
  };

  const handleBlockChange = (blockNumber: string | null) => {
    const block = blockNumber ? blocks.find(item => item.blockNumber === blockNumber) || null : null;
    setBlockInput(block?.blockNumber || '');
    setResolvedBlock(block);
    setBlockMatches(block ? [block] : []);
    setBlockNotFound(false);
    setIsBlockSearching(false);
  };

  const resetForm = (preserveBatchContext = true) => {
    // Keep locked people only; unlocked selectors reset after each order.
    setValue('');
    setBlockInput('');
    setResolvedBlock(null);
    setBlockMatches([]);
    setBlockNotFound(false);
    setIsBlockSearching(false);
    setEditingOrder(null);
    if (!preserveBatchContext) {
      setOrderDate(todayKey());
      setPaymentType(defaultPaymentType);
    }
    if (!isPharmacistLocked) {
      setPharmacistId(null);
    }
    if (!isDriverLocked) {
      setDriverId(null);
    }
  };

  const togglePharmacistLock = () => {
    if (isPharmacistLocked) {
      setIsPharmacistLocked(false);
      return;
    }
    if (!pharmacistId) {
      Swal.fire('Select pharmacist first', 'Choose a pharmacist before locking this field.', 'warning');
      return;
    }
    setIsPharmacistLocked(true);
  };

  const toggleDriverLock = () => {
    if (isDriverLocked) {
      setIsDriverLocked(false);
      return;
    }
    if (!driverId) {
      Swal.fire('Select driver first', 'Choose a driver before locking this field.', 'warning');
      return;
    }
    setIsDriverLocked(true);
  };

  const handleEdit = (order: DeliveryOrder) => {
    setEditingOrder(order);
    setOrderDate(order.orderDate);
    setHistoryFrom(order.orderDate);
    setHistoryTo(order.orderDate);
    setValue(order.valueBhd.toFixed(3));
    setPaymentType(order.paymentType);
    setPharmacistId(order.pharmacistId || null);
    setDriverId(isTalabatDeliveryPayment(order.paymentType) ? null : order.driverId || null);
    setBlockInput(isDeliveryPaymentBlockExempt(order.paymentType, paymentTypes) ? '' : order.blockNumber || '');
    setResolvedBlock(null);
    setBlockMatches([]);
    setBlockNotFound(false);
    setIsBlockSearching(false);
    window.requestAnimationFrame(() => {
      document.getElementById('delivery-order-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  useEffect(() => {
    if (orderToEdit) {
      handleEdit(orderToEdit);
      onEditDone?.();
    }
  }, [orderToEdit]);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!orderDate || Number.isNaN(new Date(`${orderDate}T00:00:00`).getTime())) {
      Swal.fire('Missing date', 'Select a valid order date.', 'warning');
      return;
    }
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      Swal.fire('Invalid value', 'Enter an order value greater than zero in BHD.', 'warning');
      return;
    }
    if (!pharmacistId) {
      Swal.fire('Pharmacist required', 'Select the pharmacist before saving this delivery order.', 'warning');
      return;
    }
    if (!isTalabatPayment && !driverId) {
      Swal.fire('Driver required', 'Select the driver before saving this delivery order.', 'warning');
      return;
    }
    if (requiresBlock && !blockInput.trim()) {
      Swal.fire('Block required', `Block number is required for ${selectedPaymentType?.label || paymentType} delivery orders.`, 'warning');
      return;
    }
    if (requiresBlock && !selectedBlock) {
      Swal.fire(
        'Select block number',
        'Search by area name or block number, then choose a real block number from the list before saving.',
        'warning'
      );
      return;
    }
    if (requiresBlock && blockNotFound) {
      const proceed = await Swal.fire({
        title: 'Unknown block',
        text: `Block ${blockInput.trim()} is not in the block directory. The order will be saved without an area — ask the manager to add this block.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Save anyway',
        confirmButtonColor: '#B91c1c'
      });
      if (!proceed.isConfirmed) return;
    }

    const input: DeliveryOrderInput = {
      branchId: branch.id,
      orderDate,
      valueBhd: numericValue,
      paymentType,
      pharmacistId,
      pharmacistName: pharmacists.find(p => p.id === pharmacistId)?.name || null,
      driverId: isTalabatPayment ? null : driverId,
      blockNumber: requiresBlock ? selectedBlock?.blockNumber || null : null
    };

    setIsSubmitting(true);
    try {
      if (editingOrder) {
        const updated = await deliveryService.orders.update(editingOrder.id, input);
        setHistoryOrders(prev => {
          const withoutCurrent = prev.filter(order => order.id !== updated.id);
          return isOrderInsideHistoryRange(updated)
            ? sortOrdersNewestFirst([updated, ...withoutCurrent])
            : withoutCurrent;
        });
        resetForm(false);
        return;
      }

      const duplicate = await deliveryService.orders.findRecentDuplicate(input);
      if (duplicate) {
        const proceed = await Swal.fire({
          title: 'Possible duplicate',
          html: `An identical order (<b>${formatBhd(duplicate.valueBhd)} / ${getDeliveryPaymentLabel(duplicate.paymentType, paymentTypes)}</b>) was recorded a few minutes ago.<br/>Save this one as well?`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Save anyway',
          confirmButtonColor: '#B91c1c'
        });
        if (!proceed.isConfirmed) { setIsSubmitting(false); return; }
      }

      const created = await deliveryService.orders.insert(input);
      if (isOrderInsideHistoryRange(created)) {
        setHistoryOrders(prev => sortOrdersNewestFirst([created, ...prev]));
      }
      resetForm();
    } catch (e: any) {
      Swal.fire(editingOrder ? 'Update failed' : 'Save failed', e?.message || 'Could not save the delivery order.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (order: DeliveryOrder) => {
    const confirm = await Swal.fire({
      title: 'Delete recorded invoice?',
      text: `${formatBhd(order.valueBhd)} · ${order.paymentType} · ${order.orderDate}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete recording',
      confirmButtonColor: '#B91c1c'
    });
    if (!confirm.isConfirmed) return;
    try {
      await deliveryService.orders.delete(order.id);
      setHistoryOrders(prev => prev.filter(o => o.id !== order.id));
      setSelectedHistoryIds(prev => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
    } catch (e: any) {
      Swal.fire('Delete failed', e?.message || 'Could not delete this recorded delivery invoice.', 'error');
    }
  };

  const handleBulkFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || isBulkUploading) return;

    if (!isSupportedDeliveryOrderImportFile(file)) {
      Swal.fire('Invalid file', 'Please upload a .xlsx Excel file or .csv file.', 'warning');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_DELIVERY_ORDER_IMPORT_BYTES) {
      Swal.fire('File too large', 'Delivery bulk upload files must be 5MB or smaller.', 'warning');
      event.target.value = '';
      return;
    }

    if (pharmacists.length === 0) {
      Swal.fire('No pharmacists assigned', 'Assign pharmacists to this branch before using bulk delivery upload.', 'warning');
      event.target.value = '';
      return;
    }

    const updateUploadProgress = (percent: number, label: string, detail?: string) => {
      Swal.update({ html: renderDeliveryUploadProgressHtml(percent, label, detail) });
    };

    setIsBulkUploading(true);
    Swal.fire({
      title: 'Processing...',
      html: renderDeliveryUploadProgressHtml(3, 'Preparing delivery upload', file.name),
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false
    });

    try {
      const { validRows, errors, totalRows } = await parseDeliveryOrderUpload(
        file,
        { branchId: branch.id, pharmacists, drivers, blocks, paymentTypes },
        progress => updateUploadProgress(progress.percent, progress.label, progress.detail)
      );

      if (totalRows === 0) {
        Swal.close();
        Swal.fire('Empty file', 'No delivery rows were found in this file.', 'warning');
        return;
      }

      if (errors.length > 0) {
        Swal.close();
        Swal.fire({
          title: 'Upload validation failed',
          html: renderDeliveryImportErrorsHtml(errors),
          icon: 'error',
          confirmButtonColor: '#B91c1c',
          width: 640
        });
        return;
      }

      const createdOrders: DeliveryOrder[] = [];
      for (const [index, row] of validRows.entries()) {
        updateUploadProgress(
          72 + Math.round((index / Math.max(validRows.length, 1)) * 24),
          'Uploading delivery orders',
          `${index.toLocaleString()} of ${validRows.length.toLocaleString()} rows uploaded`
        );
        const created = await deliveryService.orders.insert(row.input);
        createdOrders.push(created);
      }

      updateUploadProgress(98, 'Refreshing delivery history', `${createdOrders.length.toLocaleString()} rows uploaded`);
      const visibleCreated = createdOrders.filter(isOrderInsideHistoryRange);
      if (visibleCreated.length > 0) {
        setHistoryOrders(prev => sortOrdersNewestFirst([...visibleCreated, ...prev]));
      }
      setSelectedHistoryIds(new Set());
      updateUploadProgress(100, 'Upload complete', `${createdOrders.length.toLocaleString()} delivery orders uploaded`);
      setTimeout(() => Swal.close(), 450);
    } catch (error: any) {
      Swal.close();
      Swal.fire('Upload failed', error?.message || 'Could not upload delivery orders.', 'error');
    } finally {
      setIsBulkUploading(false);
      event.target.value = '';
      if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
    }
  };

  const toggleHistorySelection = (orderId: string) => {
    setSelectedHistoryIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const toggleSelectAllHistory = () => {
    setSelectedHistoryIds(prev => {
      if (historyOrders.length > 0 && historyOrders.every(order => prev.has(order.id))) {
        return new Set();
      }
      return new Set(historyOrders.map(order => order.id));
    });
  };

  const handleBulkDelete = async () => {
    if (selectedHistoryOrders.length === 0 || isHistoryBulkCancelling) return;
    const confirm = await Swal.fire({
      title: 'Delete selected recorded invoices?',
      text: `${selectedHistoryOrders.length.toLocaleString()} delivery invoices will be removed from recording and dispatch if they have not started.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete selected',
      confirmButtonColor: '#B91c1c'
    });
    if (!confirm.isConfirmed) return;

    setIsHistoryBulkCancelling(true);
    Swal.fire({
      title: 'Deleting selected...',
      html: renderDeliveryUploadProgressHtml(5, 'Preparing selected invoices'),
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false
    });

    const deletedIds = new Set<string>();
    const failed: { id: string; message: string }[] = [];

    try {
      for (const [index, order] of selectedHistoryOrders.entries()) {
        Swal.update({
          html: renderDeliveryUploadProgressHtml(
            8 + Math.round((index / Math.max(selectedHistoryOrders.length, 1)) * 86),
            'Deleting recorded invoices',
            `${index.toLocaleString()} of ${selectedHistoryOrders.length.toLocaleString()} invoices processed`
          )
        });
        try {
          await deliveryService.orders.delete(order.id);
          deletedIds.add(order.id);
        } catch (error: any) {
          failed.push({ id: order.id, message: error?.message || 'Could not delete invoice.' });
        }
      }

      setHistoryOrders(prev => prev.filter(order => !deletedIds.has(order.id)));
      setSelectedHistoryIds(new Set(failed.map(item => item.id)));
      Swal.close();

      if (failed.length > 0) {
        Swal.fire(
          'Some invoices failed',
          `${deletedIds.size.toLocaleString()} deleted, ${failed.length.toLocaleString()} failed.`,
          'warning'
        );
        return;
      }

      Swal.fire('Deleted', `${deletedIds.size.toLocaleString()} delivery invoices were deleted.`, 'success');
    } finally {
      setIsHistoryBulkCancelling(false);
    }
  };

  const totals = useMemo(() => ({
    count: historyOrders.length,
    value: historyOrders.reduce((acc, o) => acc + o.valueBhd, 0)
  }), [historyOrders]);

  return (
    <div className="space-y-5">
      {canEdit && (
        <section id="delivery-order-form" className="operational-panel p-4 md:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">
                {editingOrder ? 'Edit delivery order' : 'New delivery order'}
              </h3>
              {editingOrder && (
                <p className="mt-1 text-[11px] font-bold text-slate-500">
                  Editing {formatBhd(editingOrder.valueBhd)} / {editingOrder.paymentType}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={bulkFileInputRef}
                type="file"
                accept={DELIVERY_ORDER_IMPORT_ACCEPT}
                onChange={handleBulkFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => bulkFileInputRef.current?.click()}
                disabled={isBulkUploading || isSubmitting}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-brand/15 bg-brand/5 px-3 text-[10px] font-black uppercase tracking-widest text-brand shadow-sm transition hover:border-brand/30 hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-50"
                title="Bulk upload delivery orders"
              >
                <Upload className="h-4 w-4" />
                {isBulkUploading ? 'Uploading...' : 'Bulk upload'}
              </button>
              {editingOrder && (
                <button
                  type="button"
                  onClick={() => resetForm(false)}
                  className={dangerActionClass}
                  title="Cancel edit"
                  aria-label="Cancel edit"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-x-8">
            <div className="order-1 space-y-1 lg:col-start-1 lg:row-start-1">
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Order date <RequiredMark />
              </label>
              <input
                type="date"
                value={orderDate}
                min={minDate}
                max={maxDate}
                required
                onChange={e => setOrderDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold outline-none focus:border-brand/40"
              />
              {!isManager && !editingOrder && (
                <p className="mt-1 text-[10px] font-bold text-slate-400">Today or yesterday only</p>
              )}
              {!isManager && editingOrder && (
                <p className="mt-1 text-[10px] font-bold text-slate-400">History invoices can be corrected from this form</p>
              )}
            </div>

            <div className="order-4 space-y-1 lg:col-start-2 lg:row-start-1 lg:border-l lg:border-slate-100 lg:pl-6">
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Order value (BHD) <RequiredMark />
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0"
                placeholder="0.000"
                value={value}
                required
                onChange={e => setValue(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-black outline-none focus:border-brand/40"
              />
            </div>

            <div className="order-5 space-y-1 lg:col-start-2 lg:row-start-2 lg:border-l lg:border-slate-100 lg:pl-6">
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Payment type <RequiredMark />
              </label>
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200/50 bg-slate-100/60 p-1 sm:grid-cols-3 xl:grid-cols-5">
                {paymentOptions.map(type => (
                  <button
                    key={type.code}
                    type="button"
                    onClick={() => setPaymentType(type.code)}
                    className={`rounded-md py-2 text-[11px] font-black transition-all ${
                      paymentType === type.code ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
              {selectedPaymentType && !selectedPaymentType.requiresBlock && (
                <p className="mt-1 text-[10px] font-bold text-orange-600">
                  {selectedPaymentType.label} orders do not require block/area mapping.
                </p>
              )}
              {isTalabatPayment && (
                <p className="mt-1 text-[10px] font-bold text-orange-600">
                  Talabat orders are handled by Talabat drivers, so internal driver assignment is disabled.
                </p>
              )}
            </div>

            <div className="order-2 space-y-1 lg:col-start-1 lg:row-start-2">
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Pharmacist <RequiredMark />
              </label>
              <SearchableSelect
                options={pharmacists.map(p => ({
                  value: p.id,
                  label: p.code ? `${p.code} - ${p.name}` : p.name,
                  hint: p.code
                }))}
                value={pharmacistId}
                onChange={setPharmacistId}
                placeholder="Select pharmacist…"
                disabled={pharmacists.length === 0 || isPharmacistLocked}
                allowClear={!isPharmacistLocked}
              />
              <button
                type="button"
                onClick={togglePharmacistLock}
                className={lockButtonClass(isPharmacistLocked)}
              >
                {isPharmacistLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                {isPharmacistLocked ? 'Unlock pharmacist' : 'Lock pharmacist'}
              </button>
              {pharmacists.length === 0 && (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-700">
                  No pharmacists are assigned to this branch yet. Please ask a manager to update pharmacist assignments.
                </p>
              )}
            </div>

            <div className="order-3 space-y-1 lg:col-start-1 lg:row-start-3">
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Driver {!isTalabatPayment && <RequiredMark />} {isTalabatPayment ? '(disabled for Talabat)' : ''}
              </label>
              <SearchableSelect
                options={drivers.map(d => ({
                  value: d.id,
                  label: d.driverCode ? `${d.driverCode} - ${d.name}` : d.name,
                  hint: d.driverCode
                }))}
                value={isTalabatPayment ? null : driverId}
                onChange={setDriverId}
                disabled={isTalabatPayment || isDriverLocked}
                allowClear={!isTalabatPayment && !isDriverLocked}
                placeholder={isTalabatPayment ? 'Talabat fleet handles this order' : 'Select driver'}
              />
              {isTalabatPayment ? (
                <p className="mt-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-orange-700">
                  Internal driver off
                </p>
              ) : (
                <button
                  type="button"
                  onClick={toggleDriverLock}
                  className={lockButtonClass(isDriverLocked)}
                >
                  {isDriverLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                  {isDriverLocked ? 'Unlock driver' : 'Lock driver'}
                </button>
              )}
            </div>

            <div className="order-6 space-y-1 lg:col-start-2 lg:row-start-3 lg:border-l lg:border-slate-100 lg:pl-6">
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Block or Area {requiresBlock && <RequiredMark />} {!requiresBlock ? `(not required for ${selectedPaymentType?.label || paymentType})` : ''}
              </label>
              <SearchableSelect
                options={blockOptions}
                value={!requiresBlock ? null : blockInput || null}
                onChange={handleBlockChange}
                placeholder={!requiresBlock ? `Disabled for ${selectedPaymentType?.label || paymentType}` : 'Search area or block number...'}
                disabled={!requiresBlock || blocks.length === 0}
                allowClear
              />
              {requiresBlock && isBlockSearching && (
                <p className="mt-1 text-[11px] font-bold text-slate-400">Searching block directory...</p>
              )}
              {requiresBlock && blockMatches.length > 1 && !resolvedBlock && (
                <div className="custom-scrollbar mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                  {blockMatches.map(block => (
                    <button
                      key={block.blockNumber}
                      type="button"
                      onClick={() => selectResolvedBlock(block)}
                      className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition hover:bg-brand/5"
                    >
                      <span className="text-sm font-black text-slate-900 tabular-nums">Block {block.blockNumber}</span>
                      <span className="min-w-0 truncate text-[11px] font-bold text-slate-500">{block.areaName} - {block.governorate}</span>
                    </button>
                  ))}
                </div>
              )}
              {requiresBlock && resolvedBlock && (
                <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                  <MapPin className="h-3 w-3" /> {resolvedBlock.areaName} · {resolvedBlock.governorate}
                </p>
              )}
              {requiresBlock && blockNotFound && blockInput.trim() && (
                <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-amber-600">
                  <AlertTriangle className="h-3 w-3" /> Block not found in directory
                </p>
              )}
            </div>

            <div className="order-7 space-y-1 lg:col-start-2 lg:row-start-4 lg:border-l lg:border-slate-100 lg:pl-6">
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Area {requiresBlock && <RequiredMark />}
              </label>
              <div className={`flex min-h-[42px] items-center rounded-lg border px-3 py-2.5 text-sm font-bold ${
                resolvedBlock
                  ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                  : blockMatches.length > 0 && blockInput.trim()
                    ? 'border-blue-100 bg-blue-50 text-blue-700'
                  : blockNotFound && blockInput.trim()
                    ? 'border-amber-100 bg-amber-50 text-amber-700'
                    : 'border-slate-200 bg-slate-50 text-slate-400'
              }`}>
                {areaPreview}
              </div>
              <p className="mt-1 text-[10px] font-bold text-slate-400">Auto-filled from the block directory</p>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="btn-primary text-[11px] uppercase tracking-widest disabled:opacity-50"
            >
              {editingOrder ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {isSubmitting
                ? editingOrder ? 'Updating...' : 'Saving...'
                : editingOrder ? 'Update order' : 'Record order'}
            </button>
          </div>
        </section>
      )}

      <section className="operational-panel p-4 md:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Delivery history</h3>
            <p className="mt-1 text-[11px] font-bold text-slate-400">Edit or cancel recorded invoices from the selected period.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => { setHistoryFrom(todayKey()); setHistoryTo(todayKey()); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 transition hover:border-brand/30 hover:text-brand"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => { setHistoryFrom(yesterdayKey()); setHistoryTo(yesterdayKey()); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 transition hover:border-brand/30 hover:text-brand"
            >
              Yesterday
            </button>
            <input
              type="date"
              value={historyFrom}
              onChange={event => setHistoryFrom(event.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:border-brand/40"
              aria-label="History from date"
            />
            <input
              type="date"
              value={historyTo}
              onChange={event => setHistoryTo(event.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:border-brand/40"
              aria-label="History to date"
            />
            {canUseHistorySelection && (
              <button
                type="button"
                onClick={toggleSelectAllHistory}
                className="rounded-lg border border-brand/15 bg-brand/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-brand transition hover:border-brand/30 hover:bg-brand/10"
              >
                {allHistorySelected ? 'Clear all' : 'Select all'}
              </button>
            )}
          </div>
          <div className="flex w-full flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-500">
            <div className="flex items-center gap-3">
              <span>{totals.count} orders</span>
              <span className="text-slate-300">|</span>
              <span className="text-brand">{formatBhd(totals.value)}</span>
              {selectedHistoryOrders.length > 0 && (
                <>
                  <span className="text-slate-300">|</span>
                  <span className="rounded-full border border-brand/15 bg-brand/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
                    {selectedHistoryOrders.length} selected
                  </span>
                </>
              )}
            </div>
            {selectedHistoryOrders.length > 0 && (
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={isHistoryBulkCancelling}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {isHistoryBulkCancelling ? 'Deleting...' : 'Delete selected'}
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-100 border-t-brand"></div>
          </div>
        ) : historyOrders.length === 0 ? (
          <div className="flex min-h-[140px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 text-center">
            <CheckCircle2 className="mb-2 h-6 w-6 text-slate-300" />
            <p className="text-xs font-bold text-slate-400">No deliveries recorded in this period.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {canEdit && (
                      <th className="w-10 py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={allHistorySelected}
                          onChange={toggleSelectAllHistory}
                          className="h-4 w-4 rounded border-slate-300 accent-red-700"
                          aria-label="Select all delivery invoices"
                        />
                      </th>
                    )}
                    <th className="py-2 pr-3">Date / time</th>
                    <th className="py-2 pr-3 text-right">Value</th>
                    <th className="py-2 px-3">Payment</th>
                    <th className="py-2 pr-3">Pharmacist</th>
                    <th className="py-2 pr-3">Driver</th>
                    <th className="py-2 pr-3">Block / Area</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {historyOrders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50/50">
                      {canEdit && (
                        <td className="py-2.5 pr-2 align-middle">
                          <input
                            type="checkbox"
                            checked={selectedHistoryIds.has(order.id)}
                            onChange={() => toggleHistorySelection(order.id)}
                            className="h-4 w-4 rounded border-slate-300 accent-red-700"
                            aria-label={`Select invoice ${order.orderDate}`}
                          />
                        </td>
                      )}
                      <td className="py-2.5 pr-3 text-xs font-bold text-slate-400">
                        <span className="block text-slate-600">{order.orderDate}</span>
                        <span className="text-[11px] text-slate-400">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-right font-black text-slate-900 tabular-nums">{order.valueBhd.toFixed(3)}</td>
                      <td className="py-2.5 px-3">
                        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${paymentBadge(order.paymentType, paymentTypes)}`}>
                          {getDeliveryPaymentLabel(order.paymentType, paymentTypes)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 font-bold text-slate-600">{order.pharmacistName || '—'}</td>
                      <td className="py-2.5 pr-3 font-bold text-slate-600">{driverDisplayName(order)}</td>
                      <td className="py-2.5 pr-3 text-xs font-bold text-slate-500">
                        {isDeliveryPaymentBlockExempt(order.paymentType, paymentTypes)
                          ? '—'
                          : order.blockNumber
                            ? `${order.blockNumber}${order.areaName ? ` · ${order.areaName}` : ' · Unknown area'}`
                            : '—'}
                        {order.isOutsideGovernorate && (
                          <span className="ml-2 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-black text-amber-700">OUTSIDE</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        {canEdit && (
                          <div className="inline-flex items-center gap-1">
                            <button onClick={() => handleEdit(order)} className={editActionClass} title="Edit" aria-label="Edit order">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleDelete(order)} className={dangerActionClass} title="Cancel invoice" aria-label="Cancel invoice">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {historyOrders.map(order => (
                <div key={order.id} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-black text-slate-900 tabular-nums">{formatBhd(order.valueBhd)}</span>
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <input
                          type="checkbox"
                          checked={selectedHistoryIds.has(order.id)}
                          onChange={() => toggleHistorySelection(order.id)}
                          className="h-4 w-4 rounded border-slate-300 accent-red-700"
                          aria-label={`Select invoice ${order.orderDate}`}
                        />
                      )}
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${paymentBadge(order.paymentType, paymentTypes)}`}>
                        {getDeliveryPaymentLabel(order.paymentType, paymentTypes)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-slate-500">
                    {order.pharmacistName && <span>{order.pharmacistName}</span>}
                    {order.driverName && <span>🛵 {order.driverName}</span>}
                    {isTalabatDeliveryPayment(order.paymentType) && <span>Talabat fleet</span>}
                    {!isDeliveryPaymentBlockExempt(order.paymentType, paymentTypes) && order.blockNumber && (
                      <span>Block {order.blockNumber}{order.areaName ? ` · ${order.areaName}` : ''}</span>
                    )}
                    {order.isOutsideGovernorate && <span className="text-amber-600">Outside governorate</span>}
                  </div>
                  {canEdit && (
                    <div className="mt-3 flex justify-end gap-2">
                      <button onClick={() => handleEdit(order)} className={editActionClass} title="Edit" aria-label="Edit order">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(order)} className={dangerActionClass} title="Cancel invoice" aria-label="Cancel invoice">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
};
