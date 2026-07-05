import React, { useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock, FileDown, Lock, MapPin, Pencil, Plus, Trash2, Unlock, Upload, X } from 'lucide-react';
import { deliveryService } from '../../services/deliveryService';
import { branchDeliveryProfileService } from '../../services/branchDeliveryProfileService';
import { pharmacistService } from '../../services/pharmacistService';
import {
  Branch, DeliveryBlock, DeliveryDriver, DeliveryOrder, DeliveryOrderInput, DeliveryPaymentCollectionStatus, DeliveryPaymentType, DeliveryPaymentTypeConfig, Pharmacist
} from '../../types';
import { SearchableSelect } from './components/SearchableSelect';
import { formatBhd, todayKey, yesterdayKey } from './utils';
import {
  DEFAULT_DELIVERY_PAYMENT_TYPES,
  getDeliveryPaymentLabel,
  isDeliveryPaymentBlockExempt,
  isTalabatDeliveryPayment,
  normalizeDeliveryPaymentCode,
  sortDeliveryPaymentTypes
} from '../../lib/deliveryPaymentTypes';
import {
  DELIVERY_ORDER_IMPORT_ACCEPT,
  MAX_DELIVERY_ORDER_IMPORT_BYTES,
  generateDeliveryOrderTemplate,
  isSupportedDeliveryOrderImportFile,
  parseDeliveryOrderUpload
} from '../../utils/deliveryImportUtils';
import { formatBhdAmount, truncateBhd } from '../../utils/money';
import { formatTimeInput24, PaginationControls, TIME_24H_PATTERN, TimeInput24 } from '../shared';

const paymentBadge = (type: string, paymentTypes?: DeliveryPaymentTypeConfig[]) =>
  isTalabatDeliveryPayment(type)
    ? 'border-orange-200 bg-orange-50 text-orange-700'
    : isDeliveryPaymentBlockExempt(type, paymentTypes)
      ? 'border-slate-200 bg-slate-50 text-slate-600'
    : 'border-brand/10 bg-brand/5 text-brand';

const paymentCollectionMeta: Record<DeliveryPaymentCollectionStatus, { label: string; shortLabel: string; className: string }> = {
  paid: {
    label: 'Paid already',
    shortLabel: 'Paid',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700'
  },
  collect_on_delivery: {
    label: 'Collect on delivery',
    shortLabel: 'Collect',
    className: 'border-red-200 bg-red-50 text-red-700'
  },
  partial: {
    label: 'Partial paid',
    shortLabel: 'Partial',
    className: 'border-amber-200 bg-amber-50 text-amber-700'
  }
};

const paymentCollectionOptions: Array<{ value: DeliveryPaymentCollectionStatus; label: string; hint: string }> = [
  { value: 'paid', label: 'Paid', hint: 'Money already received' },
  { value: 'collect_on_delivery', label: 'On delivery', hint: 'Driver collects full amount' },
  { value: 'partial', label: 'Partial', hint: 'Driver collects remaining amount' }
];
const DELIVERY_HISTORY_PAGE_SIZE = 20;

const isPaymentCollectionPending = (order: DeliveryOrder) =>
  order.paymentCollectionStatus !== 'paid' && order.amountToCollectBhd > 0;

const isPaymentCollectionConfirmed = (order: DeliveryOrder) =>
  isPaymentCollectionPending(order)
  && (Boolean(order.driverPaymentCollectedAt) || order.driverPaymentCollectedAmountBhd > 0);

const shouldShowPaymentCollectionStatusBadge = (order: DeliveryOrder) =>
  order.paymentCollectionStatus !== 'collect_on_delivery' || !isPaymentCollectionPending(order);

const collectionValueBadgeClass = (order: DeliveryOrder) =>
  isPaymentCollectionConfirmed(order)
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-red-200 bg-red-50 text-red-700';

const normalizeBhdValue = (value: number) => truncateBhd(Number(value) || 0);

const expectedDriverReturnBhd = (order: DeliveryOrder) =>
  normalizeBhdValue(order.amountToCollectBhd + order.cashHandedToDriverBhd);

const isFinalReconciliationPending = (order: DeliveryOrder) =>
  isPaymentCollectionPending(order) || (order.cashHandedToDriverBhd > 0 && !order.driverReconciledAt);

const driverCashReconciliationBadge = (order: DeliveryOrder) => {
  if (order.driverReconciledAt) {
    const variance = normalizeBhdValue(order.driverReconciliationVarianceBhd);
    if (variance < 0) {
      return {
        label: `Short ${formatBhd(Math.abs(variance))}`,
        className: 'border-red-200 bg-red-50 text-red-700',
        title: `Expected ${formatBhd(order.driverReconciliationExpectedBhd)}, settled ${formatBhd(order.driverReconciliationReturnedBhd)}`
      };
    }
    if (variance > 0) {
      return {
        label: `Over ${formatBhd(variance)}`,
        className: 'border-amber-200 bg-amber-50 text-amber-700',
        title: `Expected ${formatBhd(order.driverReconciliationExpectedBhd)}, settled ${formatBhd(order.driverReconciliationReturnedBhd)}`
      };
    }
    return {
      label: `Settled ${formatBhd(order.driverReconciliationReturnedBhd)}`,
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      title: `Expected ${formatBhd(order.driverReconciliationExpectedBhd)}`
    };
  }

  if (order.cashHandedToDriverBhd <= 0) return null;
  return {
    label: `Driver change ${formatBhd(order.cashHandedToDriverBhd)}`,
    className: 'border-slate-200 bg-slate-50 text-slate-600',
    title: `Expected driver return: ${formatBhd(expectedDriverReturnBhd(order))}`
  };
};

const deliveryBlockAreaLabel = (order: DeliveryOrder, paymentTypes?: DeliveryPaymentTypeConfig[]) => {
  if (isDeliveryPaymentBlockExempt(order.paymentType, paymentTypes)) return '-';
  const block = order.blockNumber?.trim();
  if (!block) return '-';
  return `${block} / ${order.areaName?.trim() || 'Unknown area'}`;
};

const talabatChannelLabel = 'by Talabat';
const talabatChannelBadgeClass = 'inline-flex min-h-[22px] items-center justify-center whitespace-nowrap rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-[10px] font-black uppercase leading-4 text-orange-700';

const firstDriverName = (name?: string | null) => name?.trim().split(/\s+/)[0] || '-';

const driverDisplayName = (order: DeliveryOrder, paymentTypes?: DeliveryPaymentTypeConfig[]) =>
  isDeliveryPaymentBlockExempt(order.paymentType, paymentTypes) ? talabatChannelLabel : firstDriverName(order.driverName);

const TalabatChannelBadge: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`${talabatChannelBadgeClass} ${className}`.trim()} title={talabatChannelLabel}>
    {talabatChannelLabel}
  </span>
);

const deliveryOrderNumber = (order: DeliveryOrder) => order.orderNumber || `#${order.id.slice(0, 8)}`;
const currentTimeValue = () => new Date().toLocaleTimeString('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});
const isBenefitPayOrder = (order: DeliveryOrder) => normalizeDeliveryPaymentCode(order.paymentType) === 'BP';
const benefitPayTimeLabel = (order: DeliveryOrder) =>
  isBenefitPayOrder(order) && order.benefitPayReceivedTime
    ? order.benefitPayReceivedTime.slice(0, 5)
    : null;
const isBenefitPayPending = (order: DeliveryOrder) =>
  isBenefitPayOrder(order) && !benefitPayTimeLabel(order) && order.paymentCollectionStatus !== 'paid';
const collectionDueLabel = (order: DeliveryOrder) =>
  `${isBenefitPayOrder(order) ? 'BP Due' : 'COD'} ${formatBhd(order.amountToCollectBhd)}`;
const showBenefitPayRecordedPopup = (order: DeliveryOrder) => Swal.fire({
  title: 'Benefit Pay Recorded',
  html: `
    <div class="text-left font-sans">
      <p class="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold leading-6 text-emerald-800">
        This Benefit Pay order has been automatically recorded in <b>Benefit Pay Recording &amp; Traceability</b>.
      </p>
      <div class="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
        <p class="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Delivery reference</p>
        <p class="mt-1 text-base font-black text-slate-950">${escapeUploadHtml(deliveryOrderNumber(order))}</p>
      </div>
      <p class="mt-3 text-xs font-bold leading-5 text-slate-500">
        No additional manual entry is required in the Benefit Pay module.
      </p>
    </div>
  `,
  icon: 'success',
  iconColor: '#059669',
  confirmButtonText: 'Got it',
  buttonsStyling: false,
  customClass: {
    popup: 'rounded-xl border border-slate-200 p-0 shadow-2xl',
    title: 'px-6 pt-6 text-left text-xl font-black text-slate-900',
    htmlContainer: 'px-6 pb-2 pt-1',
    actions: 'mb-6 mt-4 flex w-full justify-end px-6',
    confirmButton: 'inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-[11px] font-black uppercase tracking-widest text-white shadow-sm transition hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand/20'
  }
});
type HistoryViewMode = 'all' | 'normal' | 'talabat';
const historyViewOptions: Array<{ id: HistoryViewMode; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'normal', label: 'Normal' },
  { id: 'talabat', label: 'Talabat' }
];
const isTalabatOrder = (order: DeliveryOrder) => isTalabatDeliveryPayment(order.paymentType);
const usesFittedCollectionPanel = (paymentCode: string) =>
  ['CARD', 'BP', 'INSURANCE', 'TALABAT'].includes(paymentCode);
const bahrainTodayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bahrain' });
const canDeleteRecordedOrder = (order: DeliveryOrder) => {
  const status = order.deliveryStatus || 'recorded';
  const isRecordingDelete =
    ['recorded', 'assigned'].includes(status)
    && !order.pickedUpAt
    && !order.deliveredAt
    && !order.cancelledAt;
  const isTodayCancelledDelete =
    status === 'cancelled'
    && order.orderDate === bahrainTodayKey()
    && !order.deliveredAt
    && Boolean(order.cancelledAt);

  return isRecordingDelete || isTodayCancelledDelete;
};
const sameBlockNumber = (left?: string | null, right?: string | null) =>
  Boolean(left && right && left.trim().toLowerCase() === right.trim().toLowerCase());

const editActionClass = 'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100';
const dangerActionClass = 'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-100';
const reconcileActionClass = 'inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-xl border border-red-200 bg-red-50 px-2.5 text-[9px] font-black uppercase tracking-widest text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50';
const confirmBpActionClass = 'inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-2.5 text-[9px] font-black uppercase tracking-widest text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50';
const benefitPayTraceIconClass = 'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100';
const collectionPanelBaseClass = 'rounded-lg border p-2';
const collectionPanelCompactClass = `${collectionPanelBaseClass} min-h-[58px]`;
const collectionPanelFittedClass = `${collectionPanelBaseClass} min-h-[104px]`;
const collectionPanelExpandedClass = `${collectionPanelBaseClass} min-h-[176px]`;
const collectionMessageBaseClass = 'flex min-h-[42px] items-center rounded-lg border bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest';
const collectionInputBaseClass = 'h-11 w-full rounded-lg border bg-white px-3 text-sm font-black outline-none';
const collectionFieldLabelClass = 'flex h-6 items-start gap-1 whitespace-nowrap text-[9px] font-black uppercase tracking-[0.12em] text-red-500';
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
  focusOrderId?: string | null;
  focusOrderDate?: string | null;
  onFocusConsumed?: () => void;
  onOpenBenefitPayTransfer?: (order: DeliveryOrder) => void;
}

const PaymentSummary: React.FC<{
  order: DeliveryOrder;
  paymentTypes: DeliveryPaymentTypeConfig[];
}> = ({ order, paymentTypes }) => {
  const collectionBadge = shouldShowPaymentCollectionStatusBadge(order) && order.paymentCollectionStatus !== 'paid'
    ? paymentCollectionMeta[order.paymentCollectionStatus]
    : null;
  const benefitPayTime = benefitPayTimeLabel(order);
  const reconciliationBadge = driverCashReconciliationBadge(order);
  const detailItems: Array<{ label: string; className: string; title?: string }> = [];

  if (collectionBadge) {
    detailItems.push({
      label: collectionBadge.label,
      className: collectionBadge.className
    });
  }

  if (benefitPayTime) {
    detailItems.push({
      label: `Received ${benefitPayTime}`,
      className: 'border-blue-200 bg-blue-50 text-blue-700'
    });
  }

  if (isBenefitPayPending(order)) {
    detailItems.push({
      label: 'Pending',
      className: 'border-amber-200 bg-amber-50 text-amber-700'
    });
  }

  if (isPaymentCollectionPending(order)) {
    detailItems.push({
      label: collectionDueLabel(order),
      className: collectionValueBadgeClass(order)
    });
  }

  if (reconciliationBadge) {
    detailItems.push({
      label: reconciliationBadge.label,
      className: reconciliationBadge.className,
      title: reconciliationBadge.title
    });
  }

  const [primaryDetailItem, ...secondaryDetailItems] = detailItems;
  const paymentLabel = getDeliveryPaymentLabel(order.paymentType, paymentTypes);
  const isTalabatPayment = isTalabatDeliveryPayment(order.paymentType);

  return (
    <div className="max-w-full">
      <div className="flex min-w-0 items-center gap-1">
        <span
          className={
            isTalabatPayment
              ? 'mr-1 inline-flex min-h-[22px] max-w-full items-center truncate rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-[10px] font-black uppercase leading-4 text-orange-700'
              : 'mr-1 min-w-0 truncate text-[11px] font-black leading-5 text-slate-900'
          }
          title={paymentLabel}
        >
          {paymentLabel}
        </span>
        {primaryDetailItem && (
          <span
            className={`inline-flex min-h-[20px] max-w-full items-center rounded-full border px-2 py-0.5 text-left text-[9px] font-extrabold leading-4 ${primaryDetailItem.className}`}
            title={primaryDetailItem.title}
          >
            <span className="break-words">{primaryDetailItem.label}</span>
          </span>
        )}
      </div>
      {secondaryDetailItems.length > 0 && (
        <div className="mt-1 space-y-1">
          {secondaryDetailItems.map((item, index) => (
            <span
              key={`${item.label}-${index}`}
              className={`inline-flex min-h-[20px] max-w-full items-center rounded-full border px-2 py-0.5 text-left text-[9px] font-extrabold leading-4 ${item.className}`}
              title={item.title}
            >
              <span className="break-words">{item.label}</span>
            </span>
          ))}
        </div>
      )}
      {order.driverPaymentNote && (
        <p className="mt-1.5 max-w-full break-words border-l-2 border-red-200 pl-2 text-[10px] font-semibold leading-4 text-red-600" title={order.driverPaymentNote}>
          {order.driverPaymentNote}
        </p>
      )}
      {order.driverReconciliationNote && order.driverReconciliationNote !== order.driverPaymentNote && (
        <p className="mt-1.5 max-w-full break-words border-l-2 border-slate-200 pl-2 text-[10px] font-semibold leading-4 text-slate-500" title={order.driverReconciliationNote}>
          {order.driverReconciliationNote}
        </p>
      )}
    </div>
  );
};

const OrderDateTimeMeta: React.FC<{ order: DeliveryOrder }> = ({ order }) => {
  const createdTime = new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="mt-1 flex flex-wrap items-center justify-start gap-1.5 text-[11px] font-bold text-slate-400">
      <span className="whitespace-nowrap text-slate-600">{order.orderDate}</span>
      <span className="whitespace-nowrap">{createdTime}</span>
    </div>
  );
};

const PaymentStatusCircleBadge: React.FC<{ order: DeliveryOrder }> = ({ order }) => {
  const isPaid = order.paymentCollectionStatus === 'paid';

  return (
    <span
      className={`mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-center text-[6px] font-black uppercase leading-[7px] tracking-tight shadow-sm ${
        isPaid
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-red-200 bg-red-50 text-red-700'
      }`}
      title={isPaid ? paymentCollectionMeta.paid.label : 'Not paid'}
    >
      {isPaid ? 'Paid' : 'Not paid'}
    </span>
  );
};

export const BranchRecordingPage: React.FC<BranchRecordingPageProps> = ({
  branch,
  canEdit,
  isManager,
  orderToEdit,
  onEditDone,
  focusOrderId,
  focusOrderDate,
  onFocusConsumed,
  onOpenBenefitPayTransfer
}) => {
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
  const [isTemplateDownloading, setIsTemplateDownloading] = useState(false);
  const [isHistoryBulkCancelling, setIsHistoryBulkCancelling] = useState(false);
  const [reconcilingOrderIds, setReconcilingOrderIds] = useState<Set<string>>(() => new Set());
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<DeliveryOrder | null>(null);
  const [historyView, setHistoryView] = useState<HistoryViewMode>('all');
  const [historyPage, setHistoryPage] = useState(1);

  // Form state
  const [orderDate, setOrderDate] = useState(todayKey());
  const [value, setValue] = useState('');
  const [paymentType, setPaymentType] = useState<DeliveryPaymentType>('CASH');
  const [paymentCollectionStatus, setPaymentCollectionStatus] = useState<DeliveryPaymentCollectionStatus>('paid');
  const [amountReceived, setAmountReceived] = useState('');
  const [cashHandedToDriver, setCashHandedToDriver] = useState('');
  const [benefitPayReceivedTime, setBenefitPayReceivedTime] = useState('');
  const [driverPaymentNote, setDriverPaymentNote] = useState('');


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
  const [branchOriginBlockNumber, setBranchOriginBlockNumber] = useState<string | null>(null);

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
  const normalizedPaymentType = normalizeDeliveryPaymentCode(paymentType);
  const isBenefitPaySelected = normalizedPaymentType === 'BP';
  const requiresBlock = selectedPaymentType?.requiresBlock ?? !isDeliveryPaymentBlockExempt(paymentType, paymentTypes);
  const isBlockExemptPayment = !requiresBlock;
  const collectionPanelHeightClass = usesFittedCollectionPanel(normalizedPaymentType)
    ? collectionPanelFittedClass
    : collectionPanelExpandedClass;
  const shouldCaptureBenefitPayTime = isBenefitPaySelected && paymentCollectionStatus !== 'collect_on_delivery';
  const orderValueNumber = Number(value);
  const amountReceivedNumber = Number(amountReceived);
  const amountToCollectPreview = paymentCollectionStatus === 'paid' || !Number.isFinite(orderValueNumber)
    ? 0
    : paymentCollectionStatus === 'collect_on_delivery'
      ? Math.max(orderValueNumber, 0)
      : Number.isFinite(amountReceivedNumber)
        ? Math.max(orderValueNumber - amountReceivedNumber, 0)
        : 0;
  const areaPreview = !requiresBlock
    ? `Not required for ${selectedPaymentType?.label || paymentType}`
    : selectedBlock
      ? `${selectedBlock.areaName} | ${selectedBlock.governorate}`
      : 'Search by customer area name, then choose the block';
  const selectedBlockIsBranchOrigin = requiresBlock && sameBlockNumber(selectedBlock?.blockNumber, branchOriginBlockNumber);
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
  const visibleHistoryOrders = useMemo(
    () => historyView === 'all'
      ? historyOrders
      : historyOrders.filter(order => historyView === 'talabat' ? isTalabatOrder(order) : !isTalabatOrder(order)),
    [historyOrders, historyView]
  );
  const totalHistoryPages = Math.max(1, Math.ceil(visibleHistoryOrders.length / DELIVERY_HISTORY_PAGE_SIZE));
  const currentHistoryPage = Math.min(historyPage, totalHistoryPages);
  const paginatedHistoryOrders = useMemo(() => {
    const start = (currentHistoryPage - 1) * DELIVERY_HISTORY_PAGE_SIZE;
    return visibleHistoryOrders.slice(start, start + DELIVERY_HISTORY_PAGE_SIZE);
  }, [currentHistoryPage, visibleHistoryOrders]);
  const selectedHistoryOrders = useMemo(
    () => visibleHistoryOrders.filter(order => selectedHistoryIds.has(order.id)),
    [selectedHistoryIds, visibleHistoryOrders]
  );
  const allHistorySelected = visibleHistoryOrders.length > 0 && visibleHistoryOrders.every(order => selectedHistoryIds.has(order.id));
  const canUseHistorySelection = canEdit && visibleHistoryOrders.length > 0;

  const loadReference = async () => {
    try {
      const [driverList, pharmacistList, blockList, branchProfile] = await Promise.all([
        deliveryService.drivers.listByBranch(branch.id),
        pharmacistService.listByBranch(branch.id),
        deliveryService.blocks.list(),
        branchDeliveryProfileService.getBranchDeliveryProfile(branch.id).catch(error => {
          console.warn('Branch delivery profile unavailable', error);
          return null;
        })
      ]);
      setDrivers(driverList);
      setPharmacists(pharmacistList);
      setBlocks(blockList);
      setBranchOriginBlockNumber(branchProfile?.originBlockNumber || null);
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
        dateTo: historyRange.to,
        orderKind: 'actual_delivery'
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
    if (!focusOrderId) return;
    setHighlightedOrderId(focusOrderId);
    setHistoryView('all');
    if (focusOrderDate) {
      setHistoryFrom(focusOrderDate);
      setHistoryTo(focusOrderDate);
    }
    onFocusConsumed?.();
  }, [focusOrderDate, focusOrderId, onFocusConsumed]);
  useEffect(() => { setHistoryPage(1); }, [branch.id, historyRange.from, historyRange.to, historyView]);
  useEffect(() => {
    if (historyPage > totalHistoryPages) setHistoryPage(totalHistoryPages);
  }, [historyPage, totalHistoryPages]);
  useEffect(() => {
    if (!highlightedOrderId) return;
    const index = visibleHistoryOrders.findIndex(order => order.id === highlightedOrderId);
    if (index >= 0) setHistoryPage(Math.floor(index / DELIVERY_HISTORY_PAGE_SIZE) + 1);
  }, [highlightedOrderId, visibleHistoryOrders]);
  useEffect(() => {
    if (paymentOptions.length === 0) return;
    if (!paymentOptions.some(type => type.code === paymentType)) {
      setPaymentType(defaultPaymentType);
    }
  }, [defaultPaymentType, paymentOptions, paymentType]);

  useEffect(() => {
    if ((!isBenefitPaySelected || paymentCollectionStatus === 'collect_on_delivery') && benefitPayReceivedTime) {
      setBenefitPayReceivedTime('');
    }
  }, [benefitPayReceivedTime, isBenefitPaySelected, paymentCollectionStatus]);

  useEffect(() => {
    setSelectedHistoryIds(prev => {
      const visibleIds = new Set(visibleHistoryOrders.map(order => order.id));
      const next = new Set([...prev].filter(id => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [visibleHistoryOrders]);

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
    if (!isBlockExemptPayment) return;
    setDriverId(null);
    setIsDriverLocked(false);
    setPaymentCollectionStatus('paid');
    setAmountReceived('');
    setCashHandedToDriver('');
    setBenefitPayReceivedTime('');
    setDriverPaymentNote('');
  }, [isBlockExemptPayment]);

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
    setPaymentCollectionStatus('paid');
    setAmountReceived('');
    setCashHandedToDriver('');
    setDriverPaymentNote('');
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
    const nextPaymentCollectionStatus = isDeliveryPaymentBlockExempt(order.paymentType, paymentTypes)
      ? 'paid'
      : order.paymentCollectionStatus || 'paid';
    setEditingOrder(order);
    setOrderDate(order.orderDate);
    setHistoryFrom(order.orderDate);
    setHistoryTo(order.orderDate);
    setValue(formatBhdAmount(order.valueBhd));
    setPaymentType(order.paymentType);
    setPaymentCollectionStatus(nextPaymentCollectionStatus);
    setAmountReceived(nextPaymentCollectionStatus === 'partial' ? formatBhdAmount(order.amountReceivedBhd) : '');
    setCashHandedToDriver(order.cashHandedToDriverBhd > 0 ? formatBhdAmount(order.cashHandedToDriverBhd) : '');
    setBenefitPayReceivedTime(normalizeDeliveryPaymentCode(order.paymentType) === 'BP' ? (order.benefitPayReceivedTime || '').slice(0, 5) : '');
    setDriverPaymentNote(order.driverPaymentNote || '');
    setPharmacistId(order.pharmacistId || null);
    setDriverId(isDeliveryPaymentBlockExempt(order.paymentType, paymentTypes) ? null : order.driverId || null);
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
    const normalizedPaymentCollectionStatus: DeliveryPaymentCollectionStatus = isBlockExemptPayment ? 'paid' : paymentCollectionStatus;
    const normalizedAmountReceivedInput = normalizedPaymentCollectionStatus === 'paid'
      ? value
      : normalizedPaymentCollectionStatus === 'collect_on_delivery'
        ? 0
        : amountReceived;
    const normalizedAmountReceived = Number(normalizedAmountReceivedInput);
    const normalizedCashHandedToDriverInput = isBlockExemptPayment ? 0 : cashHandedToDriver || 0;
    const normalizedCashHandedToDriver = Number(normalizedCashHandedToDriverInput);
    if (normalizedPaymentCollectionStatus === 'partial' && (!Number.isFinite(normalizedAmountReceived) || normalizedAmountReceived <= 0 || normalizedAmountReceived >= numericValue)) {
      Swal.fire('Partial payment amount required', 'Enter the amount already received. It must be greater than zero and less than the order value.', 'warning');
      return;
    }
    if (!Number.isFinite(normalizedCashHandedToDriver) || normalizedCashHandedToDriver < 0) {
      Swal.fire('Invalid driver change', 'Driver change must be zero or greater.', 'warning');
      return;
    }
    if (shouldCaptureBenefitPayTime && !benefitPayReceivedTime) {
      Swal.fire('BP received time required', 'Select the Benefit Pay received time, or switch Payment collection to On delivery if the customer will transfer later.', 'warning');
      return;
    }
    if (shouldCaptureBenefitPayTime && !TIME_24H_PATTERN.test(benefitPayReceivedTime)) {
      Swal.fire('Invalid BP received time', 'Enter the Benefit Pay received time in 24-hour format, for example 09:30 or 17:45.', 'warning');
      return;
    }
    if (!pharmacistId) {
      Swal.fire('Pharmacist required', 'Select the pharmacist before saving this delivery order.', 'warning');
      return;
    }
    if (!isBlockExemptPayment && !driverId) {
      Swal.fire('Driver required', 'Select the driver before saving this delivery order.', 'warning');
      return;
    }
    if (requiresBlock && !blockInput.trim()) {
      Swal.fire('Block required', `Block is required for ${selectedPaymentType?.label || paymentType} delivery orders.`, 'warning');
      return;
    }
    if (requiresBlock && !selectedBlock) {
      Swal.fire(
        'Select block',
        'Search by customer area name or block number, then choose the real destination block before saving.',
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
    if (selectedBlockIsBranchOrigin) {
      const proceed = await Swal.fire({
        title: 'Same as branch origin block',
        text: `Block ${selectedBlock?.blockNumber} is configured as this pharmacy branch origin block. Save only if the customer delivery address is actually in this same block.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, delivery is there',
        cancelButtonText: 'Choose block',
        confirmButtonColor: '#B91c1c'
      });
      if (!proceed.isConfirmed) return;
    }

    const input: DeliveryOrderInput = {
      branchId: branch.id,
      orderDate,
      valueBhd: value,
      paymentType,
      paymentCollectionStatus: normalizedPaymentCollectionStatus,
      amountReceivedBhd: normalizedAmountReceivedInput,
      cashHandedToDriverBhd: normalizedCashHandedToDriverInput,
      benefitPayReceivedTime: shouldCaptureBenefitPayTime ? benefitPayReceivedTime : null,
      driverPaymentNote: isBlockExemptPayment ? null : driverPaymentNote.trim() || null,
      pharmacistId,
      pharmacistName: pharmacists.find(p => p.id === pharmacistId)?.name || null,
      driverId: isBlockExemptPayment ? null : driverId,
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
      if (isBenefitPayOrder(created)) {
        await showBenefitPayRecordedPopup(created);
      }
    } catch (e: any) {
      Swal.fire(editingOrder ? 'Update failed' : 'Save failed', e?.message || 'Could not save the delivery order.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (order: DeliveryOrder) => {
    if (!canDeleteRecordedOrder(order)) {
      Swal.fire(
        'Delete unavailable',
        'This order is already active, picked up, delivered, or outside the allowed delete window. Use Dispatch actions instead.',
        'info'
      );
      return;
    }

    const confirm = await Swal.fire({
      title: 'Delete recorded invoice?',
      text: `${deliveryOrderNumber(order)} · ${formatBhd(order.valueBhd)} · ${order.paymentType} · ${order.orderDate}`,
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

  const handleOpenBenefitPayTrace = async (order: DeliveryOrder) => {
    if (!isBenefitPayOrder(order)) return;
    if (!benefitPayTimeLabel(order)) {
      await Swal.fire({
        title: 'Benefit Pay trace pending',
        text: 'Add or confirm the Benefit Pay received time first. The order will then appear automatically in Benefit Pay Recording & Traceability.',
        icon: 'info',
        confirmButtonText: 'Got it',
        confirmButtonColor: '#B91c1c'
      });
      return;
    }
    onOpenBenefitPayTransfer?.(order);
  };

  const handleReconcilePayment = async (order: DeliveryOrder) => {
    if (!isFinalReconciliationPending(order) || reconcilingOrderIds.has(order.id)) return;

    const expectedCollection = normalizeBhdValue(order.amountToCollectBhd);
    const changeFloat = normalizeBhdValue(order.cashHandedToDriverBhd);
    const expectedReturn = normalizeBhdValue(expectedCollection + changeFloat);
    const confirm = await Swal.fire({
      title: 'Settle driver cash',
      html: `
        <div class="text-left font-sans">
          <div class="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5">
            <p class="text-[10px] font-black uppercase tracking-widest text-red-700">Driver cash settlement</p>
            <p class="mt-1 text-xs font-bold leading-5 text-red-900/80">Confirm the total cash settled by the driver, including customer collection and driver change.</p>
          </div>
          <div class="grid gap-2">
            <div class="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <span class="text-xs font-black uppercase tracking-widest text-slate-400">Order collection</span>
              <b class="text-sm font-black text-slate-950 tabular-nums">${escapeUploadHtml(formatBhd(expectedCollection))}</b>
            </div>
            <div class="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <span class="text-xs font-black uppercase tracking-widest text-slate-400">Driver change</span>
              <b class="text-sm font-black text-slate-950 tabular-nums">${escapeUploadHtml(formatBhd(changeFloat))}</b>
            </div>
            <div class="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-3 py-3">
              <span class="text-xs font-black uppercase tracking-widest text-red-700">Expected return</span>
              <b class="text-lg font-black text-red-800 tabular-nums">${escapeUploadHtml(formatBhd(expectedReturn))}</b>
            </div>
          </div>
          <label for="driver-returned-bhd" class="mt-4 block text-[10px] font-black uppercase tracking-widest text-slate-400">Actual settled by driver</label>
          <input id="driver-returned-bhd" type="number" inputmode="decimal" min="0" step="0.001" value="${formatBhdAmount(expectedReturn)}" class="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-base font-black text-slate-950 tabular-nums outline-none transition focus:border-red-300 focus:bg-white" />
          <label for="driver-reconcile-note" class="mt-3 block text-[10px] font-black uppercase tracking-widest text-slate-400">Note</label>
          <textarea id="driver-reconcile-note" rows="2" placeholder="Optional settlement note" class="mt-1 min-h-[72px] w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-red-300 focus:bg-white"></textarea>
        </div>
      `,
      icon: 'question',
      iconColor: '#B91c1c',
      showCancelButton: true,
      confirmButtonText: 'Settle Cash',
      cancelButtonText: 'Cancel',
      buttonsStyling: false,
      customClass: {
        popup: 'rounded-xl border border-slate-200 p-0 shadow-2xl',
        title: 'px-6 pt-6 text-left text-xl font-black text-slate-900',
        htmlContainer: 'px-6 pb-2 pt-1',
        actions: 'mb-6 mt-4 flex w-full justify-end gap-2 px-6',
        confirmButton: 'inline-flex h-10 items-center justify-center rounded-lg bg-red-700 px-4 text-[11px] font-black uppercase tracking-widest text-white shadow-sm transition hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-200',
        cancelButton: 'inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-[11px] font-black uppercase tracking-widest text-slate-600 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200'
      },
      preConfirm: () => {
        const input = document.getElementById('driver-returned-bhd') as HTMLInputElement | null;
        const noteInput = document.getElementById('driver-reconcile-note') as HTMLTextAreaElement | null;
        const returnedAmount = normalizeBhdValue(Number(input?.value));
        if (!Number.isFinite(returnedAmount) || returnedAmount < 0) {
          Swal.showValidationMessage('Enter a valid settled amount.');
          return false;
        }
        return {
          returnedAmountBhd: returnedAmount,
          note: noteInput?.value?.trim() || null
        };
      }
    });
    const reconciliation = confirm.value as { returnedAmountBhd: number; note: string | null } | undefined;
    if (!confirm.isConfirmed || !reconciliation) return;

    setReconcilingOrderIds(prev => new Set(prev).add(order.id));
    try {
      const updated = await deliveryService.orders.reconcilePayment(
        order.id,
        expectedCollection,
        reconciliation.returnedAmountBhd,
        reconciliation.note
      );
      setHistoryOrders(prev => {
        const withoutCurrent = prev.filter(item => item.id !== updated.id);
        return isOrderInsideHistoryRange(updated)
          ? sortOrdersNewestFirst([updated, ...withoutCurrent])
          : withoutCurrent;
      });
      setSelectedHistoryIds(prev => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
      const variance = normalizeBhdValue(reconciliation.returnedAmountBhd - expectedReturn);
      const varianceCopy = variance === 0
        ? `Driver cash settled for ${formatBhd(reconciliation.returnedAmountBhd)}.`
        : `Driver return saved with ${variance > 0 ? 'overage' : 'shortage'} of ${formatBhd(Math.abs(variance))}.`;
      Swal.fire('Cash settled', varianceCopy, variance === 0 ? 'success' : 'warning');
    } catch (e: any) {
      Swal.fire('Settle failed', e?.message || 'Could not settle this driver cash return.', 'error');
    } finally {
      setReconcilingOrderIds(prev => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
    }
  };

  const handleConfirmBenefitPayReceived = async (order: DeliveryOrder) => {
    if (!isBenefitPayPending(order) || reconcilingOrderIds.has(order.id)) return;

    const confirm = await Swal.fire({
      title: 'Confirm BP received',
      html: `
        <div class="text-left font-sans">
          <p class="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold leading-5 text-blue-800">
            Save the exact time the Benefit Pay transfer was received for ${escapeUploadHtml(deliveryOrderNumber(order))}.
          </p>
          <label for="bp-received-time" class="block text-[10px] font-black uppercase tracking-widest text-slate-400">BP received time</label>
          <div class="mt-1 flex gap-2">
            <input id="bp-received-time" type="text" inputmode="numeric" maxlength="5" value="${currentTimeValue()}" placeholder="HH:mm" class="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-base font-black text-slate-950 outline-none transition focus:border-blue-300 focus:bg-white" />
            <button id="bp-received-now" type="button" class="h-11 rounded-lg border border-blue-100 bg-white px-3 text-[10px] font-black uppercase tracking-widest text-blue-700 transition hover:border-blue-200 hover:bg-blue-50">Now</button>
          </div>
          <p class="mt-1 text-[10px] font-bold text-slate-400">24-hour format only, example: 17:45</p>
        </div>
      `,
      icon: 'question',
      iconColor: '#2563eb',
      showCancelButton: true,
      confirmButtonText: 'Confirm BP',
      cancelButtonText: 'Cancel',
      buttonsStyling: false,
      customClass: {
        popup: 'rounded-xl border border-slate-200 p-0 shadow-2xl',
        title: 'px-6 pt-6 text-left text-xl font-black text-slate-900',
        htmlContainer: 'px-6 pb-2 pt-1',
        actions: 'mb-6 mt-4 flex w-full justify-end gap-2 px-6',
        confirmButton: 'inline-flex h-10 items-center justify-center rounded-lg bg-blue-700 px-4 text-[11px] font-black uppercase tracking-widest text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-200',
        cancelButton: 'inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-[11px] font-black uppercase tracking-widest text-slate-600 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200'
      },
      didOpen: () => {
        const input = document.getElementById('bp-received-time') as HTMLInputElement | null;
        const nowButton = document.getElementById('bp-received-now') as HTMLButtonElement | null;
        if (!input || !nowButton) return;

        input.addEventListener('input', () => {
          input.value = formatTimeInput24(input.value);
        });
        nowButton.addEventListener('click', () => {
          input.value = currentTimeValue();
          input.focus();
        });
      },
      preConfirm: () => {
        const input = document.getElementById('bp-received-time') as HTMLInputElement | null;
        if (!input?.value) {
          Swal.showValidationMessage('Select the Benefit Pay received time.');
          return false;
        }
        if (!TIME_24H_PATTERN.test(input.value)) {
          Swal.showValidationMessage('Enter time in 24-hour format, for example 09:30 or 17:45.');
          return false;
        }
        return input.value;
      }
    });

    const receivedTime = confirm.value as string | undefined;
    if (!confirm.isConfirmed || !receivedTime) return;

    setReconcilingOrderIds(prev => new Set(prev).add(order.id));
    try {
      const updated = await deliveryService.orders.update(order.id, {
        paymentCollectionStatus: 'paid',
        amountReceivedBhd: order.valueBhd,
        cashHandedToDriverBhd: 0,
        benefitPayReceivedTime: receivedTime
      });
      setHistoryOrders(prev => {
        const withoutCurrent = prev.filter(item => item.id !== updated.id);
        return isOrderInsideHistoryRange(updated)
          ? sortOrdersNewestFirst([updated, ...withoutCurrent])
          : withoutCurrent;
      });
      Swal.fire('BP confirmed', `Benefit Pay received time saved at ${receivedTime}.`, 'success');
    } catch (e: any) {
      Swal.fire('Confirm failed', e?.message || 'Could not confirm Benefit Pay received time.', 'error');
    } finally {
      setReconcilingOrderIds(prev => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
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

  const handleDownloadBulkTemplate = async () => {
    if (isTemplateDownloading) return;
    setIsTemplateDownloading(true);
    try {
      await generateDeliveryOrderTemplate({
        branchId: branch.id,
        branchCode: branch.code,
        branchName: branch.name,
        pharmacists,
        drivers,
        blocks,
        paymentTypes
      });
    } catch (error: any) {
      console.error('Delivery template download failed', error);
      Swal.fire('Template failed', error?.message || 'Could not generate the delivery upload template.', 'error');
    } finally {
      setIsTemplateDownloading(false);
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
      if (visibleHistoryOrders.length > 0 && visibleHistoryOrders.every(order => prev.has(order.id))) {
        return new Set();
      }
      return new Set(visibleHistoryOrders.map(order => order.id));
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
    count: visibleHistoryOrders.length,
    value: visibleHistoryOrders.reduce((acc, o) => acc + o.valueBhd, 0),
    pendingCollection: visibleHistoryOrders.reduce((acc, o) => acc + (isPaymentCollectionPending(o) ? o.amountToCollectBhd : 0), 0),
    pendingCollectionUnconfirmed: visibleHistoryOrders.reduce((acc, o) => acc + (isPaymentCollectionPending(o) && !isPaymentCollectionConfirmed(o) ? o.amountToCollectBhd : 0), 0),
    openDriverFloat: visibleHistoryOrders.reduce((acc, o) => (
      acc + (o.cashHandedToDriverBhd > 0 && !o.driverReconciledAt ? o.cashHandedToDriverBhd : 0)
    ), 0)
  }), [visibleHistoryOrders]);

  const collectionSummaryBadgeClass = totals.pendingCollectionUnconfirmed > 0
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700';

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
                  Editing {deliveryOrderNumber(editingOrder)} / {formatBhd(editingOrder.valueBhd)} / {editingOrder.paymentType}
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
                onClick={handleDownloadBulkTemplate}
                disabled={isTemplateDownloading || isBulkUploading || isSubmitting}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-widest text-slate-600 shadow-sm transition hover:border-brand/30 hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
                title="Download delivery bulk upload template"
              >
                <FileDown className="h-4 w-4" />
                {isTemplateDownloading ? 'Preparing...' : 'Template'}
              </button>
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
              {isBlockExemptPayment && (
                <p className="mt-1 text-[10px] font-bold text-orange-600">
                  Internal driver assignment is disabled for this payment channel.
                </p>
              )}
            </div>

            <div className="order-6 space-y-2 lg:col-start-2 lg:row-start-3 lg:border-l lg:border-slate-100 lg:pl-6">
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Payment collection
              </label>
              <div className="grid grid-cols-3 gap-1 rounded-lg border border-[#0f172a]/20 bg-[#0f172a]/10 p-1">
                {paymentCollectionOptions.map(option => {
                  const isActive = paymentCollectionStatus === option.value || (isBlockExemptPayment && option.value === 'paid');
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={isBlockExemptPayment}
                      onClick={() => setPaymentCollectionStatus(option.value)}
                      className={`rounded-md px-2 py-2 text-center transition-all disabled:cursor-not-allowed ${
                        isActive
                          ? 'bg-[#0f172a] text-white shadow-sm'
                          : 'bg-[#0f172a]/80 text-white/75 hover:bg-[#0f172a] hover:text-white disabled:bg-slate-200 disabled:text-slate-400'
                      }`}
                    >
                      <span className="block text-[10px] font-black uppercase tracking-widest">{option.label}</span>
                      <span className="mt-0.5 block text-[9px] font-bold normal-case tracking-normal opacity-70">{option.hint}</span>
                    </button>
                  );
                })}
              </div>
              {isBlockExemptPayment ? (
                <div className={`${collectionPanelCompactClass} border-orange-100 bg-orange-50/60`}>
                  <p className={`${collectionMessageBaseClass} border-orange-100 text-orange-700`}>
                    By Talabat - handled outside internal driver collection.
                  </p>
                </div>
              ) : paymentCollectionStatus === 'paid' ? (
                <div className={`${shouldCaptureBenefitPayTime ? collectionPanelExpandedClass : collectionPanelCompactClass} border-emerald-100 bg-emerald-50/60`}>
                  <p className={`${collectionMessageBaseClass} border-emerald-100 text-emerald-700`}>
                    Payment received before dispatch
                  </p>
                  {shouldCaptureBenefitPayTime && (
                    <div className="mt-2 space-y-1">
                      <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                        <Clock className="h-3.5 w-3.5" />
                        BP received time <RequiredMark />
                      </label>
                      <div className="flex gap-2">
                        <TimeInput24
                          value={benefitPayReceivedTime}
                          onChange={setBenefitPayReceivedTime}
                          required
                          ariaLabel="Benefit Pay received time"
                        />
                        <button
                          type="button"
                          onClick={() => setBenefitPayReceivedTime(currentTimeValue())}
                          className="h-11 rounded-lg border border-emerald-100 bg-white px-3 text-[10px] font-black uppercase tracking-widest text-emerald-700 transition hover:border-emerald-200 hover:bg-emerald-50"
                        >
                          Now
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className={`grid ${collectionPanelHeightClass} gap-2 border-red-100 bg-red-50/60 ${
                  paymentCollectionStatus === 'partial' ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-3'
                }`}>
                  {shouldCaptureBenefitPayTime && (
                    <div className={`space-y-1 ${paymentCollectionStatus === 'partial' ? 'sm:col-span-2 xl:col-span-4' : 'sm:col-span-3'}`}>
                      <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-red-500">
                        <Clock className="h-3.5 w-3.5" />
                        BP received time <RequiredMark />
                      </label>
                      <div className="flex gap-2">
                        <TimeInput24
                          value={benefitPayReceivedTime}
                          onChange={setBenefitPayReceivedTime}
                          required
                          ariaLabel="Benefit Pay received time"
                        />
                        <button
                          type="button"
                          onClick={() => setBenefitPayReceivedTime(currentTimeValue())}
                          className="h-11 rounded-lg border border-red-100 bg-white px-3 text-[10px] font-black uppercase tracking-widest text-red-700 transition hover:border-red-200 hover:bg-red-50"
                        >
                          Now
                        </button>
                      </div>
                    </div>
                  )}
                  {isBenefitPaySelected && paymentCollectionStatus === 'collect_on_delivery' && (
                    <p className={`${collectionMessageBaseClass} border-amber-200 bg-amber-50 text-amber-700 sm:col-span-3`}>
                      BP pending - confirm received time after customer transfer.
                    </p>
                  )}
                  {paymentCollectionStatus === 'partial' && (
                    <div className="space-y-1">
                      <label className={collectionFieldLabelClass}>
                        Amount received now <RequiredMark />
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.001"
                        min="0"
                        placeholder="0.000"
                        value={amountReceived}
                        onChange={e => setAmountReceived(e.target.value)}
                        className={`${collectionInputBaseClass} border-red-100 text-red-900 focus:border-red-300`}
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className={collectionFieldLabelClass}>
                      Driver should collect
                    </label>
                    <div className="flex h-11 items-center rounded-lg border border-red-100 bg-white px-3 text-sm font-black text-red-800 tabular-nums">
                      {Number.isFinite(amountToCollectPreview) ? formatBhd(amountToCollectPreview) : formatBhd(0)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className={collectionFieldLabelClass}>
                      Driver change
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.001"
                      min="0"
                      placeholder="0.000"
                      value={cashHandedToDriver}
                      onChange={e => setCashHandedToDriver(e.target.value)}
                      className={`${collectionInputBaseClass} border-red-100 text-red-900 focus:border-red-300`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={collectionFieldLabelClass}>
                      Driver note
                    </label>
                    <input
                      type="text"
                      value={driverPaymentNote}
                      onChange={e => setDriverPaymentNote(e.target.value)}
                      placeholder="Optional note"
                      className={`${collectionInputBaseClass} border-red-100 font-bold text-red-900 placeholder:text-red-300 focus:border-red-300`}
                    />
                  </div>
                </div>
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
                Driver {!isBlockExemptPayment && <RequiredMark />} {isBlockExemptPayment ? '(disabled for this payment)' : ''}
              </label>
              <SearchableSelect
                options={drivers.map(d => ({
                  value: d.id,
                  label: d.driverCode ? `${d.driverCode} - ${d.name}` : d.name,
                  hint: d.driverCode
                }))}
                value={isBlockExemptPayment ? null : driverId}
                onChange={setDriverId}
                disabled={isBlockExemptPayment || isDriverLocked}
                allowClear={!isBlockExemptPayment && !isDriverLocked}
                placeholder={isBlockExemptPayment ? 'by Talabat' : 'Select driver'}
              />
              {isBlockExemptPayment ? (
                <p className="mt-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-orange-700">
                  Internal driver off
                </p>
              ) : drivers.length === 0 ? (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-700">
                  No drivers are assigned to this branch yet. Please ask a manager to update driver assignments.
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

            <div className="order-7 space-y-1 lg:col-start-2 lg:row-start-4 lg:border-l lg:border-slate-100 lg:pl-6">
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Block / Area {requiresBlock && <RequiredMark />} {!requiresBlock ? `(not required for ${selectedPaymentType?.label || paymentType})` : ''}
              </label>
              <SearchableSelect
                options={blockOptions}
                value={!requiresBlock ? null : blockInput || null}
                onChange={handleBlockChange}
                placeholder={!requiresBlock ? `Disabled for ${selectedPaymentType?.label || paymentType}` : 'Search customer area or block...'}
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
                      <span className="min-w-0 truncate text-xs font-black text-slate-800">
                        {block.areaName}
                        <span className="font-extrabold text-slate-500"> - {block.governorate}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {requiresBlock && resolvedBlock && (
                <p className="mt-1 flex items-center gap-1 text-xs font-extrabold text-emerald-700">
                  <MapPin className="h-3 w-3" />
                  <span className="font-black text-slate-950">{resolvedBlock.areaName}</span>
                  <span>· {resolvedBlock.governorate}</span>
                </p>
              )}
              {selectedBlockIsBranchOrigin && (
                <p className="mt-1 flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] font-bold text-amber-700">
                  <AlertTriangle className="h-3 w-3" /> This is the branch origin block. Confirm the customer delivery address is in the same block.
                </p>
              )}
              {requiresBlock && blockNotFound && blockInput.trim() && (
                <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-amber-600">
                  <AlertTriangle className="h-3 w-3" /> Block not found in directory
                </p>
              )}
            </div>

            <div className="order-8 space-y-1 lg:col-start-2 lg:row-start-5 lg:border-l lg:border-slate-100 lg:pl-6">
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Area {requiresBlock && <RequiredMark />}
              </label>
              <div className={`flex min-h-[42px] items-center rounded-lg border px-3 py-2.5 text-sm font-bold ${
                resolvedBlock
                  ? 'border-emerald-200 bg-emerald-50 text-slate-950'
                  : blockMatches.length > 0 && blockInput.trim()
                    ? 'border-blue-100 bg-blue-50 text-blue-700'
                  : blockNotFound && blockInput.trim()
                    ? 'border-amber-100 bg-amber-50 text-amber-700'
                    : 'border-slate-200 bg-slate-50 text-slate-400'
              }`}>
                {requiresBlock && selectedBlock ? (
                  <span className="min-w-0 truncate">
                    <span className="font-black text-slate-950">{selectedBlock.areaName}</span>
                    <span className="font-extrabold text-emerald-700"> · {selectedBlock.governorate}</span>
                  </span>
                ) : areaPreview}
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
            <div className="flex rounded-lg border border-slate-200/50 bg-slate-100/60 p-1">
              {historyViewOptions.map(option => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setHistoryView(option.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                    historyView === option.id ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
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
              {totals.pendingCollection > 0 && (
                <>
                  <span className="text-slate-300">|</span>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${collectionSummaryBadgeClass}`}>
                    COD {formatBhd(totals.pendingCollection)}
                  </span>
                </>
              )}
              {totals.openDriverFloat > 0 && (
                <>
                  <span className="text-slate-300">|</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                    Driver change {formatBhd(totals.openDriverFloat)}
                  </span>
                </>
              )}
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
        ) : visibleHistoryOrders.length === 0 ? (
          <div className="flex min-h-[140px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 text-center">
            <CheckCircle2 className="mb-2 h-6 w-6 text-slate-300" />
            <p className="text-xs font-bold text-slate-400">No deliveries recorded in this period.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden rounded-xl border border-slate-100 xl:block">
              <table className="w-full table-fixed text-[13px]">
                <colgroup>
                  {canEdit && <col style={{ width: '3%' }} />}
                  <col style={{ width: canEdit ? '18%' : '20%' }} />
                  <col style={{ width: canEdit ? '11%' : '12%' }} />
                  <col style={{ width: canEdit ? '9%' : '10%' }} />
                  <col style={{ width: canEdit ? '13%' : '14%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: canEdit ? '21%' : '19%' }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {canEdit && (
                      <th className="px-2 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={allHistorySelected}
                          onChange={toggleSelectAllHistory}
                          className="h-4 w-4 rounded border-slate-300 accent-red-700"
                          aria-label="Select all delivery invoices"
                        />
                      </th>
                    )}
                    <th className="border-l border-slate-100 px-4 py-3">
                      <div className="grid w-full grid-cols-[28px_minmax(0,1fr)] items-center gap-2">
                        <span className="h-7 w-7 shrink-0" aria-hidden="true" />
                        <span className="text-center">Order / date</span>
                      </div>
                    </th>
                    <th className="border-l border-slate-100 px-4 py-3 text-center">Pharmacist</th>
                    <th className="border-l border-slate-100 px-4 py-3 text-center">Driver</th>
                    <th className="border-l border-slate-100 px-4 py-3 text-center">Block / Area</th>
                    <th className="border-l border-slate-100 py-3 pl-2 pr-3 text-center">Value</th>
                    <th className="border-l border-slate-100 py-3 pl-3 pr-2 text-center">Payment</th>
                    <th className="border-l border-slate-100 py-3 pl-3 pr-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginatedHistoryOrders.map(order => {
                    const isHighlightedOrder = highlightedOrderId === order.id;
                    const canOpenBenefitPayTrace = isBenefitPayOrder(order) && Boolean(onOpenBenefitPayTransfer);

                    return (
                    <tr key={order.id} className={`transition hover:bg-slate-50/70 ${isHighlightedOrder ? 'bg-brand/5 ring-2 ring-inset ring-brand/20' : ''}`}>
                      {canEdit && (
                        <td className="px-2 py-3 text-center align-top">
                          <input
                            type="checkbox"
                            checked={selectedHistoryIds.has(order.id)}
                            onChange={() => toggleHistorySelection(order.id)}
                            className="h-4 w-4 rounded border-slate-300 accent-red-700"
                            aria-label={`Select invoice ${deliveryOrderNumber(order)}`}
                          />
                        </td>
                      )}
                      <td className="border-l border-slate-50 px-4 py-3 text-center align-top text-xs font-bold text-slate-400">
                        <div className="grid w-full grid-cols-[28px_minmax(0,1fr)] items-start gap-2">
                          <PaymentStatusCircleBadge order={order} />
                          <div className="min-w-0 text-left">
                            <div className="flex min-w-0 items-center justify-start gap-1.5">
                              <span className="block break-words font-black leading-5 text-brand" title={deliveryOrderNumber(order)}>{deliveryOrderNumber(order)}</span>
                              {canOpenBenefitPayTrace && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenBenefitPayTrace(order)}
                                  className={benefitPayTraceIconClass}
                                  title="Open linked Benefit Pay record"
                                  aria-label="Open linked Benefit Pay record"
                                >
                                  <ArrowUpRight className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            <OrderDateTimeMeta order={order} />
                          </div>
                        </div>
                      </td>
                      <td className="border-l border-slate-50 px-4 py-3 text-center align-top font-bold text-slate-600">
                        <span className="block break-words leading-5" title={order.pharmacistName || '-'}>{order.pharmacistName || '-'}</span>
                      </td>
                      <td className="border-l border-slate-50 px-4 py-3 text-center align-top font-bold text-slate-600">
                        {isDeliveryPaymentBlockExempt(order.paymentType, paymentTypes) ? (
                          <TalabatChannelBadge />
                        ) : (
                          <span className="block break-words leading-5" title={driverDisplayName(order, paymentTypes)}>{driverDisplayName(order, paymentTypes)}</span>
                        )}
                      </td>
                      <td className="border-l border-slate-50 px-4 py-3 text-center align-top text-xs font-bold text-slate-500">
                        <span className="block break-words leading-5" title={deliveryBlockAreaLabel(order, paymentTypes)}>{deliveryBlockAreaLabel(order, paymentTypes)}</span>
                        {order.isOutsideGovernorate && (
                          <span className="ml-2 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-black text-amber-700">OUTSIDE</span>
                        )}
                      </td>
                      <td className="border-l border-slate-50 py-3 pl-2 pr-3 text-center align-top">
                        <span className="font-black text-slate-900 tabular-nums">{formatBhdAmount(order.valueBhd)}</span>
                      </td>
                      <td className="border-l border-slate-50 py-3 pl-3 pr-2 text-center align-top">
                        <div className="flex justify-center">
                          <PaymentSummary order={order} paymentTypes={paymentTypes} />
                        </div>
                      </td>
                      <td className="border-l border-slate-50 py-3 pl-3 pr-4 text-right align-top">
                        {canEdit && (
                          <div className="flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
                            {isBenefitPayPending(order) && (
                              <button
                                onClick={() => handleConfirmBenefitPayReceived(order)}
                                disabled={reconcilingOrderIds.has(order.id)}
                                className={confirmBpActionClass}
                                title="Confirm Benefit Pay received"
                                aria-label="Confirm Benefit Pay received"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                {reconcilingOrderIds.has(order.id) ? 'Saving' : 'Confirm BP'}
                              </button>
                            )}
                            {isFinalReconciliationPending(order) && !isBenefitPayPending(order) && (
                              <button
                                onClick={() => handleReconcilePayment(order)}
                                disabled={reconcilingOrderIds.has(order.id)}
                                className={reconcileActionClass}
                                title="Settle driver cash"
                                aria-label="Settle driver cash"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                {reconcilingOrderIds.has(order.id) ? 'Saving' : 'Settle Cash'}
                              </button>
                            )}
                            <button onClick={() => handleEdit(order)} className={editActionClass} title="Edit" aria-label="Edit order">
                              <Pencil className="h-4 w-4" />
                            </button>
                            {canDeleteRecordedOrder(order) && (
                              <button onClick={() => handleDelete(order)} className={dangerActionClass} title="Delete recording" aria-label="Delete recording">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="space-y-2 xl:hidden">
              {paginatedHistoryOrders.map(order => {
                const isHighlightedOrder = highlightedOrderId === order.id;
                const canOpenBenefitPayTrace = isBenefitPayOrder(order) && Boolean(onOpenBenefitPayTransfer);

                return (
                <div key={order.id} className={`rounded-lg border bg-white p-3 ${isHighlightedOrder ? 'border-brand/30 ring-2 ring-brand/20' : 'border-slate-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-black text-slate-900 tabular-nums">{formatBhd(order.valueBhd)}</span>
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <input
                          type="checkbox"
                          checked={selectedHistoryIds.has(order.id)}
                          onChange={() => toggleHistorySelection(order.id)}
                          className="h-4 w-4 rounded border-slate-300 accent-red-700"
                          aria-label={`Select invoice ${deliveryOrderNumber(order)}`}
                        />
                      )}
                    </div>
                  </div>
                  <div className="mt-1 grid w-full grid-cols-[28px_minmax(0,1fr)] items-start gap-2">
                    <PaymentStatusCircleBadge order={order} />
                    <div className="min-w-0 text-left">
                      <div className="flex min-w-0 items-center justify-start gap-1.5">
                        <p className="min-w-0 break-words text-[11px] font-black uppercase tracking-widest text-brand">{deliveryOrderNumber(order)}</p>
                        {canOpenBenefitPayTrace && (
                          <button
                            type="button"
                            onClick={() => handleOpenBenefitPayTrace(order)}
                            className={benefitPayTraceIconClass}
                            title="Open linked Benefit Pay record"
                            aria-label="Open linked Benefit Pay record"
                          >
                            <ArrowUpRight className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <OrderDateTimeMeta order={order} />
                    </div>
                  </div>
                  <div className="mt-2">
                    <PaymentSummary order={order} paymentTypes={paymentTypes} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-slate-500">
                    {order.pharmacistName && <span>{order.pharmacistName}</span>}
                    {order.driverName && <span title={order.driverName}>🛵 {firstDriverName(order.driverName)}</span>}
                    {!order.driverName && isDeliveryPaymentBlockExempt(order.paymentType, paymentTypes) && <TalabatChannelBadge />}
                    {!isDeliveryPaymentBlockExempt(order.paymentType, paymentTypes) && order.blockNumber && (
                      <span>{deliveryBlockAreaLabel(order, paymentTypes)}</span>
                    )}
                    {order.isOutsideGovernorate && <span className="text-amber-600">Outside governorate</span>}
                  </div>
                  {canEdit && (
                    <div className="mt-3 flex flex-nowrap justify-end gap-2">
                      {isBenefitPayPending(order) && (
                        <button
                          onClick={() => handleConfirmBenefitPayReceived(order)}
                          disabled={reconcilingOrderIds.has(order.id)}
                          className={confirmBpActionClass}
                          title="Confirm Benefit Pay received"
                          aria-label="Confirm Benefit Pay received"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {reconcilingOrderIds.has(order.id) ? 'Saving' : 'Confirm BP'}
                        </button>
                      )}
                      {isFinalReconciliationPending(order) && !isBenefitPayPending(order) && (
                        <button
                          onClick={() => handleReconcilePayment(order)}
                          disabled={reconcilingOrderIds.has(order.id)}
                          className={reconcileActionClass}
                          title="Settle driver cash"
                          aria-label="Settle driver cash"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {reconcilingOrderIds.has(order.id) ? 'Saving' : 'Settle Cash'}
                        </button>
                      )}
                      <button onClick={() => handleEdit(order)} className={editActionClass} title="Edit" aria-label="Edit order">
                        <Pencil className="h-4 w-4" />
                      </button>
                      {canDeleteRecordedOrder(order) && (
                        <button onClick={() => handleDelete(order)} className={dangerActionClass} title="Delete recording" aria-label="Delete recording">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                );
              })}
            </div>

            <PaginationControls
              currentPage={currentHistoryPage}
              totalItems={visibleHistoryOrders.length}
              pageSize={DELIVERY_HISTORY_PAGE_SIZE}
              onPageChange={setHistoryPage}
              itemLabel="orders"
            />
          </>
        )}
      </section>
    </div>
  );
};
