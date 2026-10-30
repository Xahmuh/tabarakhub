import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock, FileDown, Hourglass, Lock, MapPin, Pencil, Plus, Trash2, Unlock, Upload, UserPlus, X } from 'lucide-react';
import { deliveryService, DeliveryDriverDutyStatus } from '../../services/deliveryService';
import { branchDeliveryProfileService } from '../../services/branchDeliveryProfileService';
import { pharmacistService } from '../../services/pharmacistService';
import {
  Branch, DeliveryBlock, DeliveryDriver, DeliveryOrder, DeliveryOrderInput, DeliveryPaymentCollectionStatus, DeliveryPaymentType, DeliveryPaymentTypeConfig, Pharmacist
} from '../../types';
import { SearchableSelect, SelectOption } from './components/SearchableSelect';
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
import { supabaseClient } from '../../lib/supabaseClient';
import { deliveryLockKey, deliveryPaymentOrderLabel, deliverySourceLabel } from '../../lib/deliveryRecording';
import { generateUUID } from '../../utils/uuid';

const paymentBadge = (type: string, paymentTypes?: DeliveryPaymentTypeConfig[]) =>
  isTalabatDeliveryPayment(type)
    ? 'border-orange-200 bg-orange-50 text-orange-700'
    : isDeliveryPaymentBlockExempt(type, paymentTypes)
      ? 'border-slate-200 bg-slate-50 text-slate-600'
    : 'border-brand/10 bg-brand/5 text-brand';

const isTWalletPaymentType = (type: DeliveryPaymentTypeConfig) =>
  normalizeDeliveryPaymentCode(type.code) === 'WALLET'
  || normalizeDeliveryPaymentCode(type.label) === 'T_WALLET';

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
const cashFirstPaymentTypes = (types: DeliveryPaymentTypeConfig[]) => {
  const sorted = sortDeliveryPaymentTypes(types);
  return [
    ...sorted.filter(type => normalizeDeliveryPaymentCode(type.code) === 'CASH'),
    ...sorted.filter(type => normalizeDeliveryPaymentCode(type.code) !== 'CASH')
  ];
};
const DELIVERY_HISTORY_PAGE_SIZE = 20;

const DriverDutyIndicator: React.FC<{ isIn: boolean | null; branchCode: string | null }> = ({ isIn, branchCode }) => (
  <span
    className="inline-flex shrink-0 items-center gap-1 font-black text-slate-500"
    aria-label={isIn === null ? 'Duty status unavailable' : isIn ? `In${branchCode ? ` at branch ${branchCode}` : ''}` : 'Out'}
    title={isIn === null ? 'Duty status unavailable' : isIn ? `In${branchCode ? ` at branch ${branchCode}` : ''}` : 'Out'}
  >
    <span aria-hidden="true">(</span>
    <span aria-hidden="true" className={`inline-block h-3 w-3 rounded-full border ${isIn === null ? 'border-slate-400 bg-slate-300' : isIn ? 'border-emerald-700 bg-emerald-500' : 'border-red-700 bg-red-500'}`} />
    {isIn && branchCode && <span className="text-[11px] text-slate-600">{branchCode}</span>}
    <span aria-hidden="true">)</span>
  </span>
);

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

  return null;
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
  isDeliveryPaymentBlockExempt(order.paymentType, paymentTypes)
    ? talabatChannelLabel
    : firstDriverName(order.dispatchMode === 'log_only' ? order.recordedDriverName || order.driverName : order.driverName);

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
  `${isBenefitPayOrder(order) ? 'BP Due' : 'Cash due'} ${formatBhd(order.amountToCollectBhd)}`;
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
type HistoryViewMode = 'all' | 'whatsapp' | 'talabat' | 'online';
const historyViewOptions: Array<{ id: HistoryViewMode; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'talabat', label: 'Talabat' },
  { id: 'online', label: 'Online' }
];
const isTalabatOrder = (order: DeliveryOrder) => isTalabatDeliveryPayment(order.paymentType);
const usesFittedCollectionPanel = (paymentCode: string) =>
  ['CASH', 'CARD', 'BP', 'INSURANCE', 'TALABAT'].includes(paymentCode);
const bahrainTodayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bahrain' });
const canDeleteRecordedOrder = (order: DeliveryOrder) => {
  if (isTalabatOrder(order) || order.externalSource === 'talabat') return true;
  if (order.externalSource === 'woocommerce') return false;
  if (order.dispatchMode === 'log_only' && order.deliveryStatus !== 'recorded') return false;
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
const editActionClass = 'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100';
const dangerActionClass = 'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-100';
const reconcileActionClass = 'inline-flex h-9 w-28 shrink-0 items-center justify-center gap-1 rounded-xl border border-red-700 bg-red-700 px-2.5 text-[9px] font-black uppercase tracking-widest text-white shadow-sm transition hover:border-red-800 hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50';
const confirmBpActionClass = 'inline-flex h-9 w-28 shrink-0 items-center justify-center gap-1 rounded-xl border border-red-700 bg-red-700 px-2.5 text-[9px] font-black uppercase tracking-widest text-white shadow-sm transition hover:border-red-800 hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50';
const reconciliationStatusClass = 'inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-xl border px-2.5 text-[9px] font-black uppercase tracking-widest shadow-sm';
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
  const showCashDueSubtitle = isPaymentCollectionPending(order) && !isBenefitPayOrder(order);
  const showDriverChangeSubtitle = order.cashHandedToDriverBhd > 0 && !isBenefitPayOrder(order);
  const showBenefitPayDueSubtitle = isPaymentCollectionPending(order) && isBenefitPayOrder(order);
  const settledBadge = order.driverReconciledAt && order.driverReconciliationVarianceBhd === 0
    ? driverCashReconciliationBadge(order)
    : null;
  const detailItems: Array<{ label: string; className: string; title?: string }> = [];

  if (collectionBadge) {
    detailItems.push({
      label: collectionBadge.label,
      className: collectionBadge.className
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
          title={deliveryPaymentOrderLabel(paymentLabel, order.externalSource, order.paymentType)}
        >
          {deliveryPaymentOrderLabel(paymentLabel, order.externalSource, order.paymentType)}
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
      {showDriverChangeSubtitle && (
        <p className="mt-0.5 text-left text-[10px] font-normal leading-4 text-slate-500">
          Driver change <span className="font-bold tabular-nums text-slate-700">{formatBhd(order.cashHandedToDriverBhd)}</span>
        </p>
      )}
      {showCashDueSubtitle && (
        <p className={`${showDriverChangeSubtitle ? '' : 'mt-0.5'} text-left text-[10px] font-normal leading-4 text-slate-500`}>
          Cash due <span className="font-bold tabular-nums text-slate-700">{formatBhd(order.amountToCollectBhd)}</span>
        </p>
      )}
      {showBenefitPayDueSubtitle && (
        <p className="mt-0.5 text-left text-[10px] font-normal leading-4 text-slate-500">
          BP Due <span className="font-bold tabular-nums text-slate-700">{formatBhd(order.amountToCollectBhd)}</span>
          {isBenefitPayPending(order) && (
            <span aria-label="Pending Benefit Pay" role="img" className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#f6b000] align-middle">
              <Hourglass aria-hidden="true" className="h-3 w-3 animate-spin text-white" />
            </span>
          )}
        </p>
      )}
      {settledBadge && (
        <p className="mt-0.5 text-left text-[10px] font-normal leading-4 text-slate-500" title={settledBadge.title}>
          Settled <span className="font-bold tabular-nums text-slate-700">{formatBhd(order.driverReconciliationReturnedBhd)}</span>
        </p>
      )}
      {benefitPayTime && (
        <p className="mt-0.5 text-left text-[10px] font-normal leading-4 text-slate-500">
          Received <span className="font-bold tabular-nums text-slate-700">{benefitPayTime}</span>
        </p>
      )}
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
      <span className="whitespace-nowrap text-slate-600">{order.orderDate}{order.orderTime ? ` ${order.orderTime.slice(0, 5)}` : ''}</span>
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
  const recordingV1 = (import.meta as any).env?.VITE_DELIVERY_RECORDING_V1 === '1';
  const [operatorId, setOperatorId] = useState('');
  const [hydratedLockKey, setHydratedLockKey] = useState('');
  const [dispatchMode, setDispatchMode] = useState<'system' | 'log_only'>('system');
  const [locationUrl, setLocationUrl] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [pendingRecording, setPendingRecording] = useState<DeliveryOrderInput | null>(null);
  useEffect(() => {
    const { data } = supabaseClient.auth.onAuthStateChange((_event, session) => setOperatorId(session?.user?.id || ''));
    void supabaseClient.auth.getSession().then(({ data: auth }) => setOperatorId(auth.session?.user?.id || ''));
    return () => data.subscription.unsubscribe();
  }, []);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [driverDutyStatusById, setDriverDutyStatusById] = useState<Record<string, DeliveryDriverDutyStatus>>({});
  const driverDutyStatusRequest = useRef(0);
  const [pharmacists, setPharmacists] = useState<Pharmacist[]>([]);
  const [referenceDataLoaded, setReferenceDataLoaded] = useState(false);
  const [blocks, setBlocks] = useState<DeliveryBlock[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<DeliveryPaymentTypeConfig[]>(DEFAULT_DELIVERY_PAYMENT_TYPES);
  const [historyOrders, setHistoryOrders] = useState<DeliveryOrder[]>([]);
  const [historyFrom, setHistoryFrom] = useState(todayKey());
  const [historyTo, setHistoryTo] = useState(todayKey());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [isTemplateDownloading, setIsTemplateDownloading] = useState(false);
  const [isHistoryBulkCancelling, setIsHistoryBulkCancelling] = useState(false);
  const [reconcilingOrderIds, setReconcilingOrderIds] = useState<Set<string>>(() => new Set());
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<DeliveryOrder | null>(null);
  const [reassigningOrder, setReassigningOrder] = useState<DeliveryOrder | null>(null);
  const [destinationDetails, setDestinationDetails] = useState<{ order: DeliveryOrder; locationUrl: string | null; customerAddress: string | null; customerPhone: string | null; position: { top: number; left: number; width: number; maxHeight: number } } | null>(null);
  const [destinationDetailsLoadingId, setDestinationDetailsLoadingId] = useState<string | null>(null);
  const [destinationDetailsAvailable, setDestinationDetailsAvailable] = useState<Set<string>>(() => new Set());
  const destinationFlagsRequest = useRef(0);
  const destinationPopupRef = useRef<HTMLDivElement>(null);
  const [reassignDriverId, setReassignDriverId] = useState<string | null>(null);
  const [isReassigning, setIsReassigning] = useState(false);
  const [historyView, setHistoryView] = useState<HistoryViewMode>('all');
  const [historyPage, setHistoryPage] = useState(1);

  const refreshDriverDutyStatus = useCallback(async () => {
    const requestId = ++driverDutyStatusRequest.current;
    try {
      const statuses = await deliveryService.drivers.listDropdownDutyStatus(branch.id);
      if (requestId === driverDutyStatusRequest.current) {
        setDriverDutyStatusById(Object.fromEntries(statuses.map(status => [status.driverId, status])));
      }
    } catch (error) {
      // The driver list and order assignment remain usable if status is unavailable.
      console.warn('Driver duty status unavailable', error);
    }
  }, [branch.id]);

  useEffect(() => {
    driverDutyStatusRequest.current += 1;
    setDriverDutyStatusById({});
    void refreshDriverDutyStatus();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshDriverDutyStatus();
    }, 30_000);
    const onFocus = () => { void refreshDriverDutyStatus(); };
    window.addEventListener('focus', onFocus);
    return () => {
      driverDutyStatusRequest.current += 1;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshDriverDutyStatus]);

  const renderDriverOption = (option: SelectOption) => {
    const status = driverDutyStatusById[option.value];
    return (
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate">{option.label}</span>
        <DriverDutyIndicator isIn={status?.isIn ?? null} branchCode={status?.inBranchCode ?? null} />
      </span>
    );
  };

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
    () => blocks.find(block => block.blockNumber === blockInput.trim()) || (resolvedBlock?.blockNumber === blockInput.trim() ? resolvedBlock : null),
    [blocks, blockInput, resolvedBlock]
  );
  const blockOptions = useMemo(() => blocks.map(block => ({
    value: block.blockNumber,
    label: `Block ${block.blockNumber}`,
    hint: `${block.areaName} - ${block.governorate}`
  })), [blocks]);

  const activePaymentTypes = useMemo(
    () => cashFirstPaymentTypes(paymentTypes).filter(type => type.isActive && !isTWalletPaymentType(type)),
    [paymentTypes]
  );
  const paymentOptions = useMemo(() => {
    const sorted = cashFirstPaymentTypes(paymentTypes);
    const active = sorted.filter(type => type.isActive && (!isTWalletPaymentType(type) || (!!editingOrder && type.code === paymentType)));
    if (paymentType && !active.some(type => type.code === paymentType)) {
      const current = sorted.find(type => type.code === paymentType);
      if (current && (!isTWalletPaymentType(current) || !!editingOrder)) return [...active, current];
    }
    return active;
  }, [editingOrder, paymentTypes, paymentType]);
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
  const driverChangePreview = paymentCollectionStatus === 'collect_on_delivery' && Number.isFinite(Number(cashHandedToDriver))
    ? Math.max(Number(cashHandedToDriver), 0)
    : 0;
  const driverShouldCollectPreview = amountToCollectPreview + driverChangePreview;
  const areaPreview = !requiresBlock
    ? `Not required for ${selectedPaymentType?.label || paymentType}`
    : selectedBlock
      ? `${selectedBlock.areaName} | ${selectedBlock.governorate}`
      : 'Syncs automatically';
  // Branch users may record today or yesterday (late-evening catch-up). Managers: any date.
  const minDate = isManager || editingOrder ? undefined : yesterdayKey();
  const maxDate = isManager || editingOrder ? undefined : todayKey();
  const hasValidRecordingDate = Boolean(orderDate)
    && !Number.isNaN(new Date(`${orderDate}T00:00:00`).getTime())
    && (!minDate || orderDate >= minDate)
    && (!maxDate || orderDate <= maxDate);
  const hasValidRecordingValue = Number.isFinite(orderValueNumber) && orderValueNumber > 0;
  const hasValidPharmacist = Boolean(pharmacistId && pharmacists.some(pharmacist => pharmacist.id === pharmacistId));
  const hasRequiredDriver = isBlockExemptPayment
    || Boolean(driverId && drivers.some(driver => driver.id === driverId && driver.isActive));
  const hasRequiredBlock = !requiresBlock
    || Boolean(selectedBlock && selectedBlock.blockNumber === blockInput.trim());
  const hasRequiredBenefitPayTime = !shouldCaptureBenefitPayTime || TIME_24H_PATTERN.test(benefitPayReceivedTime);
  const hasValidPartialCollection = paymentCollectionStatus !== 'partial'
    || (Number.isFinite(amountReceivedNumber) && amountReceivedNumber > 0 && amountReceivedNumber < orderValueNumber);
  const hasValidDriverChange = paymentCollectionStatus !== 'collect_on_delivery'
    || !cashHandedToDriver.trim()
    || (Number.isFinite(Number(cashHandedToDriver)) && Number(cashHandedToDriver) >= 0);
  const hasValidLocationUrl = !recordingV1
    || !locationUrl.trim()
    || /^https:\/\/[^\s]+$/i.test(locationUrl.trim());
  const isRecordingFormComplete = Boolean(selectedPaymentType)
    && hasValidRecordingDate
    && hasValidRecordingValue
    && hasValidPharmacist
    && hasRequiredDriver
    && hasRequiredBlock
    && hasRequiredBenefitPayTime
    && hasValidPartialCollection
    && hasValidDriverChange
    && hasValidLocationUrl;
  const lockStorageKey = deliveryLockKey(`${window.location.origin}|${(import.meta as any).env?.VITE_SUPABASE_URL || ''}`, operatorId, branch.id);
  const historyRange = useMemo(() => (
    historyFrom <= historyTo
      ? { from: historyFrom, to: historyTo }
      : { from: historyTo, to: historyFrom }
  ), [historyFrom, historyTo]);
  const isOrderInsideHistoryRange = (order: DeliveryOrder) => order.orderDate >= historyRange.from && order.orderDate <= historyRange.to;
  const visibleHistoryOrders = useMemo(
    () => (historyView === 'all'
      ? historyOrders
      : historyOrders.filter(order => deliverySourceLabel(order.externalSource, order.paymentType).toLowerCase() === historyView)),
    [historyOrders, historyView]
  );
  const totalHistoryPages = Math.max(1, Math.ceil(visibleHistoryOrders.length / DELIVERY_HISTORY_PAGE_SIZE));
  const currentHistoryPage = Math.min(historyPage, totalHistoryPages);
  const paginatedHistoryOrders = useMemo(() => {
    const start = (currentHistoryPage - 1) * DELIVERY_HISTORY_PAGE_SIZE;
    return visibleHistoryOrders.slice(start, start + DELIVERY_HISTORY_PAGE_SIZE);
  }, [currentHistoryPage, visibleHistoryOrders]);
  const paginatedHistoryOrderIds = useMemo(
    () => paginatedHistoryOrders.map(order => order.id).join(','),
    [paginatedHistoryOrders]
  );
  const selectedHistoryOrders = useMemo(
    () => visibleHistoryOrders.filter(order => selectedHistoryIds.has(order.id)),
    [selectedHistoryIds, visibleHistoryOrders]
  );
  const allHistorySelected = visibleHistoryOrders.length > 0 && visibleHistoryOrders.every(order => selectedHistoryIds.has(order.id));
  const canUseHistorySelection = canEdit && visibleHistoryOrders.length > 0;

  const loadReference = async () => {
    setReferenceDataLoaded(false);
    try {
      const [driverList, pharmacistList, blockList, branchProfile] = await Promise.all([
        recordingV1 ? deliveryService.drivers.list() : deliveryService.drivers.listByBranch(branch.id),
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
      setReferenceDataLoaded(true);
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
    const requestId = ++destinationFlagsRequest.current;
    const orderIds = paginatedHistoryOrderIds ? paginatedHistoryOrderIds.split(',') : [];
    if (orderIds.length === 0) {
      setDestinationDetailsAvailable(new Set());
      return;
    }

    void (async () => {
      try {
        const { data, error } = await supabaseClient.rpc('app_delivery_get_order_destination_flags', { p_order_ids: orderIds });
        if (requestId !== destinationFlagsRequest.current) return;
        if (error) throw error;
        setDestinationDetailsAvailable(new Set((data || []).filter((row: any) => row.has_details).map((row: any) => row.order_id)));
      } catch (error) {
        if (requestId === destinationFlagsRequest.current) {
          setDestinationDetailsAvailable(new Set());
          console.warn('Delivery destination flags unavailable', error);
        }
      }
    })();

    return () => { destinationFlagsRequest.current += 1; };
  }, [paginatedHistoryOrderIds]);
  useEffect(() => {
    if (!destinationDetails) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!destinationPopupRef.current?.contains(event.target as Node)) setDestinationDetails(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDestinationDetails(null);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [Boolean(destinationDetails)]);
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
    if (!operatorId) { setPharmacistId(null); setDriverId(null); setPendingRecording(null); return; }
    let nextPharmacistId: string | null = null;
    let nextDriverId: string | null = null;
    let nextPharmacistLocked = false;
    let nextDriverLocked = false;
    try {
      const saved = localStorage.getItem(lockStorageKey);
      const pending = localStorage.getItem(lockStorageKey + ':pending');
      setPendingRecording(pending ? JSON.parse(pending) : null);
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
      setHydratedLockKey(lockStorageKey);
    }
  }, [lockStorageKey, operatorId]);

  useEffect(() => {
    if (!locksHydrated || !operatorId || hydratedLockKey !== lockStorageKey) return;
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
  }, [lockStorageKey, locksHydrated, hydratedLockKey, operatorId, isPharmacistLocked, pharmacistId, isDriverLocked, driverId]);

  useEffect(() => {
    if (!isBlockExemptPayment) return;
    if (!recordingV1) { setDriverId(null); setIsDriverLocked(false); }
    setPaymentCollectionStatus('paid');
    setAmountReceived('');
    setCashHandedToDriver('');
    setBenefitPayReceivedTime('');
    setDriverPaymentNote('');
  }, [isBlockExemptPayment, recordingV1]);

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
      const selected = exact || null;
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
    setLocationUrl(''); setCustomerAddress(''); setCustomerPhone('');
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
    setDispatchMode(order.dispatchMode || 'system');
    setOrderDate(order.orderDate);
    setHistoryFrom(order.orderDate);
    setHistoryTo(order.orderDate);
    setValue(formatBhdAmount(order.valueBhd));
    setPaymentType(order.paymentType);
    setLocationUrl(order.locationUrl || '');
    setCustomerAddress(order.customerAddress || '');
    setCustomerPhone('');
    setPaymentCollectionStatus(nextPaymentCollectionStatus);
    setAmountReceived(nextPaymentCollectionStatus === 'partial' ? formatBhdAmount(order.amountReceivedBhd) : '');
    setCashHandedToDriver(order.cashHandedToDriverBhd > 0 ? formatBhdAmount(order.cashHandedToDriverBhd) : '');
    setBenefitPayReceivedTime(normalizeDeliveryPaymentCode(order.paymentType) === 'BP' ? (order.benefitPayReceivedTime || '').slice(0, 5) : '');
    setDriverPaymentNote(order.driverPaymentNote || '');
    setPharmacistId(order.pharmacistId || null);
    setDriverId(isDeliveryPaymentBlockExempt(order.paymentType, paymentTypes) ? null : order.dispatchMode === 'log_only' ? order.recordedDriverId || null : order.driverId || null);
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

  const isCancelledByDriver = (order: DeliveryOrder) => {
    if (order.deliveryStatus !== 'cancelled') return false;
    const reason = order.cancelledReason || '';
    return reason.includes('driver mobile') || reason.includes('تطبيق السائق') || reason.includes('منسوخ') || reason.includes('বাতيل');
  };

  const handleReassignClick = (order: DeliveryOrder) => {
    setReassigningOrder(order);
    setReassignDriverId(order.driverId || null);
  };

  const confirmReassignment = async () => {
    if (!reassigningOrder || !reassignDriverId) return;
    setIsReassigning(true);
    try {
      await deliveryService.orders.update(reassigningOrder.id, { driverId: reassignDriverId });
      await deliveryService.lifecycle.returnOrder({
        orderId: reassigningOrder.id,
        notes: `Reassigned to new driver by pharmacy`
      });
      await loadHistory();
      setReassigningOrder(null);
      Swal.fire({
        title: 'Success',
        text: 'The order has been reassigned and is now active in Dispatch.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error: any) {
      Swal.fire('Reassignment failed', error?.message || 'Could not reassign this order.', 'error');
    } finally {
      setIsReassigning(false);
    }
  };

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      if (recordingV1 && !editingOrder && !isTalabatDeliveryPayment(paymentType)) {
        let selectedMode: 'system' | 'log_only' | null = null;
        await Swal.fire({
          title: 'Record delivery order',
          html: `
            <p class="mb-4 text-left text-xs font-bold text-slate-500">Choose what should happen after this order is recorded.</p>
            <div style="display:grid;gap:10px;text-align:left">
              <button type="button" data-dispatch-mode="log_only" aria-describedby="recorded-only-description" style="display:block;width:100%;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;padding:14px 16px;text-align:left;cursor:pointer">
                <span style="display:block;color:#0f172a;font-size:14px;font-weight:800">Recorded only</span>
                <span id="recorded-only-description" style="display:block;margin-top:4px;color:#64748b;font-size:11px;font-weight:600;line-height:1.45">Save this order with the selected driver recorded, without creating a Driver App task.</span>
              </button>
              <button type="button" data-dispatch-mode="system" aria-describedby="send-to-driver-description" style="display:block;width:100%;border:1px solid #fecaca;border-radius:12px;background:#fff7f7;padding:14px 16px;text-align:left;cursor:pointer">
                <span style="display:block;color:#b91c1c;font-size:14px;font-weight:800">Send to Driver App</span>
                <span id="send-to-driver-description" style="display:block;margin-top:4px;color:#64748b;font-size:11px;font-weight:600;line-height:1.45">Record this order and send it to the selected driver through the delivery system.</span>
              </button>
            </div>
          `,
          showConfirmButton: false,
          showCancelButton: true,
          cancelButtonText: 'Cancel',
          buttonsStyling: false,
          customClass: {
            popup: 'rounded-xl border border-slate-200 p-0 shadow-2xl',
            title: 'px-6 pt-6 text-left text-xl font-black text-slate-900',
            htmlContainer: 'px-6 pb-2 pt-1',
            actions: 'mb-5 mt-3 flex w-full justify-end px-6',
            cancelButton: 'inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-[11px] font-black uppercase tracking-widest text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50'
          },
          didOpen: () => {
            const popup = Swal.getPopup();
            popup?.querySelector<HTMLButtonElement>('[data-dispatch-mode="log_only"]')?.addEventListener('click', () => {
              selectedMode = 'log_only';
              Swal.close();
            });
            popup?.querySelector<HTMLButtonElement>('[data-dispatch-mode="system"]')?.addEventListener('click', () => {
              selectedMode = 'system';
              Swal.close();
            });
          }
        });
        if (!selectedMode) return;
        await submitRecording(selectedMode);
        return;
      }

      await submitRecording(recordingV1 && !editingOrder && isTalabatDeliveryPayment(paymentType) ? 'log_only' : undefined);
    } finally {
      submittingRef.current = false;
    }
  };
  const submitRecording = async (dispatchModeOverride?: 'system' | 'log_only') => {
    const selectedDispatchMode = recordingV1
      ? isTalabatDeliveryPayment(paymentType) ? 'log_only' : dispatchModeOverride || dispatchMode
      : dispatchMode;
    if (!operatorId || !locksHydrated || hydratedLockKey !== lockStorageKey) {
      void Swal.fire('Please wait', 'Confirming your recording identity and saved selections.', 'info');
      return;
    }
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
  if (!isBlockExemptPayment && (!driverId || (recordingV1 && selectedDispatchMode === 'system' && !drivers.some(driver => driver.id === driverId && driver.authUserId)))) {
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
    const input: DeliveryOrderInput = {
      ...(recordingV1 && !editingOrder ? { dispatchMode: selectedDispatchMode, locationUrl, customerAddress, customerPhone, idempotencyKey: generateUUID() } : {}),
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
      driverId: isBlockExemptPayment || selectedDispatchMode === 'log_only' ? null : driverId,
      recordedDriverId: !isBlockExemptPayment && selectedDispatchMode === 'log_only' ? driverId : null,
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

      if (recordingV1) {
        if (!operatorId) throw new Error('Sign in before recording.');
        if (pendingRecording || localStorage.getItem(lockStorageKey + ':pending')) throw new Error('Confirm the pending recording using Retry before starting another.');
        localStorage.setItem(lockStorageKey + ':pending', JSON.stringify(input)); setPendingRecording(input);
      }
      const created = await deliveryService.orders.insert(input);
      localStorage.removeItem(lockStorageKey + ':pending'); setPendingRecording(null);
      if (isOrderInsideHistoryRange(created)) {
        setHistoryOrders(prev => sortOrdersNewestFirst([created, ...prev]));
      }
      resetForm();
      if (isBenefitPayOrder(created)) {
        await showBenefitPayRecordedPopup(created);
      }
    } catch (e: any) {
      if (e?.code === '22023' || e?.code === '22P02' || e?.code === '22007' || e?.code === '22008') {
        localStorage.removeItem(lockStorageKey + ':pending'); setPendingRecording(null);
      }
      Swal.fire(editingOrder ? 'Update failed' : 'Save failed', e?.message || 'Could not save the delivery order.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (order: DeliveryOrder) => {
    const isTalabat = isTalabatOrder(order) || order.externalSource === 'talabat';
    const isRecordedOnly = order.dispatchMode === 'log_only' && !isTalabat;
    const isAuditedVoid = isTalabat || isRecordedOnly;
    if (!canDeleteRecordedOrder(order)) {
      Swal.fire(
        'Delete unavailable',
        'This order is already active, picked up, delivered, or outside the allowed delete window. Use Dispatch actions instead.',
        'info'
      );
      return;
    }

    const confirm = await Swal.fire({
      title: isTalabat ? 'Void Talabat order?' : isRecordedOnly ? 'Void Recorded only order?' : 'Delete recorded invoice?',
      text: isRecordedOnly
        ? `${deliveryOrderNumber(order)} · ${formatBhd(order.valueBhd)} · ${order.paymentType} · ${order.orderDate}. This removes it from active views and preserves an audit record.`
        : isTalabat
          ? `${deliveryOrderNumber(order)} · ${formatBhd(order.valueBhd)} · Talabat · ${order.orderDate}. The audited financial record is retained and hidden from active lists.`
        : `${deliveryOrderNumber(order)} · ${formatBhd(order.valueBhd)} · ${order.paymentType} · ${order.orderDate}`,
      ...(isAuditedVoid ? {
        input: 'textarea' as const,
        inputPlaceholder: 'Reason for voiding this order',
        inputAttributes: { 'aria-label': 'Reason for voiding this order' },
        inputValidator: (value: string) => !value.trim() || value.trim().length < 3
          ? 'Enter a reason with at least 3 characters.'
          : undefined
      } : {}),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: isAuditedVoid ? 'Void order' : 'Delete order',
      confirmButtonColor: '#B91c1c'
    });
    if (!confirm.isConfirmed) return;
    try {
      if (isTalabat) await deliveryService.orders.voidTalabat(order.id, String(confirm.value || '').trim());
      else if (isRecordedOnly) await deliveryService.orders.voidRecordedOnly(order.id, String(confirm.value || '').trim());
      else await deliveryService.orders.delete(order.id);
      setHistoryOrders(prev => prev.filter(o => o.id !== order.id));
      setSelectedHistoryIds(prev => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
    } catch (e: any) {
      Swal.fire(isAuditedVoid ? 'Void failed' : 'Delete failed', e?.message || 'Could not update this recorded delivery invoice.', 'error');
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

  const handleOpenDestinationDetails = async (order: DeliveryOrder, event: React.MouseEvent<HTMLButtonElement>) => {
    const iconRect = event.currentTarget.getBoundingClientRect();
    const popupWidth = Math.min(352, window.innerWidth - 24);
    const top = iconRect.bottom + 4;
    const left = Math.max(12, Math.min(iconRect.left + iconRect.width / 2 - popupWidth / 2, window.innerWidth - popupWidth - 12));
    const popupMaxHeight = Math.max(48, Math.min(544, window.innerHeight - top - 12));
    const position = { top, left, width: popupWidth, maxHeight: popupMaxHeight };
    setDestinationDetailsLoadingId(order.id);
    try {
      const { data, error } = await supabaseClient.rpc('app_delivery_get_order_destination_details', { p_order_id: order.id });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      setDestinationDetails({
        order,
        locationUrl: row?.location_url || null,
        customerAddress: row?.customer_address || null,
        customerPhone: row?.customer_phone || null,
        position
      });
    } catch (error: any) {
      void Swal.fire('Could not load delivery details', error?.message || 'Please try again.', 'error');
    } finally {
      setDestinationDetailsLoadingId(null);
    }
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
      {recordingV1 && operatorId && hydratedLockKey === lockStorageKey && pendingRecording && <div className="rounded-lg border border-amber-300 p-3 text-sm">A recording is awaiting confirmation. Retry sends the original saved entry.
        <button disabled={isSubmitting} className="btn-secondary ml-2" onClick={async () => {
          if (submittingRef.current) return;
          submittingRef.current = true;
          setIsSubmitting(true);
          try {
            const saved = await deliveryService.orders.insert(pendingRecording);
            localStorage.removeItem(lockStorageKey + ':pending'); setPendingRecording(null);
            setHistoryOrders(previous => sortOrdersNewestFirst([saved, ...previous.filter(o => o.id !== saved.id)])); resetForm();
          } catch (error: any) {
            if (['22023','22P02','22007','22008'].includes(error?.code)) { localStorage.removeItem(lockStorageKey + ':pending'); setPendingRecording(null); }
            void Swal.fire('Retry failed', error?.message || 'Keep this request and retry later.', 'error');
          } finally { submittingRef.current = false; setIsSubmitting(false); }
        }}>Retry pending entry</button>
      </div>}
      {canEdit && (
        <section id="delivery-order-form" className="operational-panel p-4 md:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-700">
                {!editingOrder && <img src="/assets/delivery-package.png" alt="" aria-hidden="true" className="h-10 w-10 shrink-0 object-contain" />}
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
                disabled={recordingV1 || isBulkUploading || isSubmitting}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-brand/15 bg-brand/5 px-3 text-[10px] font-black uppercase tracking-widest text-brand shadow-sm transition hover:border-brand/30 hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-50"
                title={recordingV1 ? 'Bulk upload awaits a reviewed per-row retry workflow. Record individually.' : 'Bulk upload delivery orders'}
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
                    {type.code === 'CASH' ? 'Cash' : type.label}
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

            <div className={recordingV1 && !editingOrder && isTalabatDeliveryPayment(paymentType) ? 'hidden' : 'order-6 flex flex-col items-start gap-2 lg:col-start-2 lg:row-start-3 lg:border-l lg:border-slate-100 lg:pl-6'}>
              <label className="block w-full text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                Payment collection
              </label>
              <div className={`grid w-full ${recordingV1 ? 'grid-cols-2' : 'grid-cols-3'} justify-center gap-1`}>
                {paymentCollectionOptions.filter(option => !recordingV1 || option.value !== 'partial').map(option => {
                  const isActive = paymentCollectionStatus === option.value || (isBlockExemptPayment && option.value === 'paid');
                  return (
                    <div key={option.value} className="flex min-w-0 flex-col items-stretch">
                      <button
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
                      {isActive && option.value === 'paid' && isBlockExemptPayment && (
                        <span className="mt-1 px-1 text-center text-[9px] font-bold leading-4 text-emerald-700">
                          By Talabat - handled outside internal driver collection.
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {isBlockExemptPayment ? null : paymentCollectionStatus === 'paid' ? (
                shouldCaptureBenefitPayTime ? <div className={`${collectionPanelBaseClass} border-emerald-100 bg-emerald-50/60`}>
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
                </div> : null
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
                  {paymentCollectionStatus === 'collect_on_delivery' && (
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
                        onWheel={e => e.currentTarget.blur()}
                        className="h-8 w-full rounded-lg border border-red-100 bg-white px-2 text-sm font-black text-red-900 outline-none focus:border-red-300"
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className={collectionFieldLabelClass}>
                      Driver should collect
                    </label>
                    <div className="flex h-8 items-center rounded-lg border border-red-100 bg-white px-2 text-sm font-black text-red-800 tabular-nums">
                      {Number.isFinite(driverShouldCollectPreview) ? formatBhd(driverShouldCollectPreview) : formatBhd(0)}
                    </div>
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
                      className="h-8 w-full rounded-lg border border-red-100 bg-white px-2 text-sm font-bold text-red-900 outline-none placeholder:text-red-300 focus:border-red-300"
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
              {referenceDataLoaded && pharmacists.length === 0 && (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-700">
                  No pharmacists are assigned to this branch yet. Please ask a manager to update pharmacist assignments.
                </p>
              )}
            </div>

            <div className={recordingV1 && !editingOrder && isTalabatDeliveryPayment(paymentType) ? 'hidden' : 'order-3 space-y-1 lg:col-start-1 lg:row-start-3'}>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Assigned driver {!isBlockExemptPayment && <RequiredMark />} {isBlockExemptPayment ? '(disabled for this payment)' : ''}
              </label>
              <SearchableSelect
                options={drivers.map(d => ({
                  value: d.id,
                  label: d.driverCode ? `${d.driverCode} - ${d.name}` : d.name,
                  hint: d.driverCode
                }))}
                value={isBlockExemptPayment ? null : driverId}
                onChange={setDriverId}
                onOpen={refreshDriverDutyStatus}
                renderOption={renderDriverOption}
                renderSelected={renderDriverOption}
                disabled={isBlockExemptPayment || isDriverLocked}
                allowClear={!isBlockExemptPayment && !isDriverLocked}
                placeholder={isBlockExemptPayment ? 'by Talabat' : 'Select driver'}
              />
              {isBlockExemptPayment ? (
                <p className="mt-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-orange-700">
                  Internal driver off
                </p>
              ) : !referenceDataLoaded ? null : drivers.length === 0 ? (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-700">
                  No drivers are assigned to this branch yet. Ask a manager to assign a driver before recording an order.
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

            <div className="hidden">
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
              {requiresBlock && blockMatches.length > 0 && !resolvedBlock && (
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
              {requiresBlock && blockNotFound && blockInput.trim() && (
                <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-amber-600">
                  <AlertTriangle className="h-3 w-3" /> Block not found in directory
                </p>
              )}
            </div>

            <div className="hidden">
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

          {recordingV1 && !isTalabatDeliveryPayment(paymentType) && (
            <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4 md:p-5">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-200 pb-3">
                <img src="/assets/customer-location-route.png" alt="" className="h-12 w-12 object-contain" />
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-700">Customer location &amp; Contact</h4>
              </div>
              <div className="grid items-start gap-4 md:grid-cols-2 md:gap-6">
                <div className="grid min-w-0 gap-4">
                  <label className="block space-y-1">
                    <span className="flex min-h-8 items-end pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Contact no. <span className="ml-1 font-bold normal-case tracking-normal">(optional)</span></span>
                    <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Customer phone number" className="h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none transition focus:border-brand/40" />
                  </label>
                  <label className="block space-y-1">
                    <span className="flex min-h-8 items-end pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">GPS Location URL <span className="ml-1 font-bold normal-case tracking-normal">(optional)</span></span>
                    <input type="url" value={locationUrl} onChange={e => setLocationUrl(e.target.value)} placeholder="https://maps.google.com/..." className="h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none transition focus:border-brand/40" />
                  </label>
                  <label className="block space-y-1">
                    <span className="flex min-h-8 items-end pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Detailed Address <span className="ml-1 font-bold normal-case tracking-normal">(optional)</span></span>
                    <input type="text" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="Building, road, flat, or delivery instructions" className="h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none transition focus:border-brand/40" />
                  </label>
                </div>
                <div className="grid min-w-0 gap-4">
                  <div className="space-y-1">
                    <label className="flex min-h-8 items-end pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Block / Area {requiresBlock && <RequiredMark />} {!requiresBlock ? `(not required for ${selectedPaymentType?.label || paymentType})` : ''}</label>
                    <SearchableSelect options={blockOptions} value={!requiresBlock ? null : blockInput || null} onChange={handleBlockChange} placeholder={!requiresBlock ? `Disabled for ${selectedPaymentType?.label || paymentType}` : 'Search customer area or block...'} disabled={!requiresBlock || blocks.length === 0} allowClear />
                  </div>
                  <div className="space-y-1">
                    <label className="flex min-h-8 items-end pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Area {requiresBlock && <RequiredMark />}</label>
                    <div className={`flex min-h-[48px] w-full items-center rounded-lg border px-3 py-2.5 text-sm font-bold ${resolvedBlock ? 'border-emerald-200 bg-emerald-50 text-slate-950' : blockMatches.length > 0 && blockInput.trim() ? 'border-blue-100 bg-blue-50 text-blue-700' : blockNotFound && blockInput.trim() ? 'border-amber-100 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-400'}`}>
                      {requiresBlock && selectedBlock ? <span className="min-w-0 truncate"><span className="font-black text-slate-950">{selectedBlock.areaName}</span><span className="font-extrabold text-emerald-700"> · {selectedBlock.governorate}</span></span> : areaPreview}
                    </div>
                    {requiresBlock && isBlockSearching && <p className="mt-1 text-[11px] font-bold text-slate-400">Searching block directory...</p>}
                    {requiresBlock && blockNotFound && blockInput.trim() && <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-amber-600"><AlertTriangle className="h-3 w-3" /> Block not found in directory</p>}
                  </div>
                </div>
              </div>
            </section>
          )}

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !isRecordingFormComplete}
              title={!isRecordingFormComplete ? 'Complete all required fields to record this order.' : undefined}
              className="btn-primary text-[11px] uppercase tracking-widest disabled:opacity-50"
            >
              {editingOrder ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {isSubmitting
                ? editingOrder ? 'Updating...' : 'Saving...'
                : editingOrder ? 'Update order' : 'Record order'}
            </button>
          </div>
          {!isRecordingFormComplete && (
            <p className="mt-2 text-right text-[10px] font-bold text-slate-400">Complete all required fields to enable Record order.</p>
          )}
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
                    Cash {formatBhd(totals.pendingCollection)}
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
                    <th className="border-l border-slate-100 py-3 pl-3 pr-2 text-center">Payment / order type</th>
                    <th className="border-l border-slate-100 py-3 pl-3 pr-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginatedHistoryOrders.map(order => {
                    const isHighlightedOrder = highlightedOrderId === order.id;
                    const canOpenBenefitPayTrace = isBenefitPayOrder(order) && Boolean(onOpenBenefitPayTransfer);
                    const reconciliationBadge = driverCashReconciliationBadge(order);

                    const isDriverCancelled = isCancelledByDriver(order);
                    return (
                    <tr
                      key={order.id}
                      className={`transition hover:bg-slate-50/70 ${
                        isHighlightedOrder
                          ? 'bg-brand/5 ring-2 ring-inset ring-brand/20'
                          : isDriverCancelled
                            ? 'bg-red-50/10 ring-2 ring-inset ring-red-300/60'
                            : ''
                      }`}
                    >
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
                            <div className="flex min-w-0 flex-wrap items-center justify-start gap-1.5">
                              <span className="block break-words font-black leading-5 text-brand" title={deliveryOrderNumber(order)}>{deliveryOrderNumber(order)}</span>
                              {isDriverCancelled && (
                                <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-700 animate-pulse">
                                  Cancelled by Driver
                                </span>
                              )}
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
                        <div className="grid w-full grid-cols-[minmax(0,1fr)_24px] items-center gap-1">
                          <span className="min-w-0 break-words text-center leading-5" title={deliveryBlockAreaLabel(order, paymentTypes)}>{deliveryBlockAreaLabel(order, paymentTypes)}</span>
                          {!isDeliveryPaymentBlockExempt(order.paymentType, paymentTypes) && order.blockNumber && destinationDetailsAvailable.has(order.id) ? (
                            <button
                              type="button"
                              onClick={event => void handleOpenDestinationDetails(order, event)}
                              disabled={destinationDetailsLoadingId === order.id}
                              aria-expanded={destinationDetails?.order.id === order.id}
                              aria-haspopup="dialog"
                              className="group inline-flex h-6 w-6 shrink-0 items-center justify-center bg-transparent p-0 disabled:opacity-50"
                              title="Open customer location and contact details"
                              aria-label="Open customer location and contact details"
                            >
                              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><circle cx="12" cy="12" r="10" className={`transition-colors ${destinationDetails?.order.id === order.id ? 'fill-red-600 stroke-red-600' : 'fill-transparent stroke-black group-hover:fill-red-600 group-hover:stroke-red-600'}`} /><path d="m6.5 9.5 5.5 5.5 5.5-5.5" className={`transition-colors ${destinationDetails?.order.id === order.id ? 'stroke-white' : 'stroke-black group-hover:stroke-white'}`} /></svg>
                            </button>
                          ) : null}
                        </div>
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
                        <div className="flex min-w-0 items-center justify-end gap-1">
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
                            {order.deliveryStatus === 'cancelled' && !order.cancelledReason?.startsWith('Recorded only void:') && !isDeliveryPaymentBlockExempt(order.paymentType, paymentTypes) && (
                              <button
                                onClick={() => handleReassignClick(order)}
                                className="inline-flex h-7 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 text-[10px] font-black uppercase tracking-widest text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                                title="Assign new driver and reopen"
                                aria-label="Assign new driver and reopen"
                              >
                                <UserPlus className="h-3.5 w-3.5" />
                                Reassign
                              </button>
                            )}
                            {reconciliationBadge && !reconciliationBadge.label.startsWith('Settled ') && (
                              <span className={`${reconciliationStatusClass} ${reconciliationBadge.className}`} title={reconciliationBadge.title}>
                                {order.driverReconciledAt && <CheckCircle2 className="h-4 w-4" />}
                                {reconciliationBadge.label}
                              </span>
                            )}
                            {(
                              <>
                                <button onClick={() => handleEdit(order)} className={editActionClass} title="Edit" aria-label="Edit order">
                                  <Pencil className="h-4 w-4" />
                                </button>
                              <button onClick={() => handleDelete(order)} className={dangerActionClass} title={order.dispatchMode === 'log_only' ? 'Void Recorded only order' : 'Delete recording'} aria-label={order.dispatchMode === 'log_only' ? 'Void Recorded only order' : 'Delete recording'}>
                                <Trash2 className="h-4 w-4" />
                              </button>
                              </>
                            )}
                          </div>
                        )}
                        </div>
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
                const reconciliationBadge = driverCashReconciliationBadge(order);

                const isDriverCancelled = isCancelledByDriver(order);
                return (
                <div
                  key={order.id}
                  className={`rounded-lg border p-3 bg-white transition-all ${
                    isHighlightedOrder
                      ? 'border-brand/30 ring-2 ring-brand/20'
                      : isDriverCancelled
                        ? 'border-red-300 ring-2 ring-red-100 bg-red-50/5'
                        : 'border-slate-200'
                  }`}
                >
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
                      <div className="flex min-w-0 flex-wrap items-center justify-start gap-1.5">
                        <p className="min-w-0 break-words text-[11px] font-black uppercase tracking-widest text-brand">{deliveryOrderNumber(order)}</p>
                        {isDriverCancelled && (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-700 animate-pulse">
                            Cancelled by Driver
                          </span>
                        )}
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
                    {(order.driverName || order.recordedDriverName) && <span title={order.dispatchMode === 'log_only' ? order.recordedDriverName || order.driverName || '' : order.driverName || ''}>🛵 {driverDisplayName(order, paymentTypes)}</span>}
                    {!order.driverName && !order.recordedDriverName && isDeliveryPaymentBlockExempt(order.paymentType, paymentTypes) && <TalabatChannelBadge />}
                    {!isDeliveryPaymentBlockExempt(order.paymentType, paymentTypes) && order.blockNumber && (
                      <span className="grid w-full grid-cols-[minmax(0,1fr)_24px] items-center gap-1">
                        <span>{deliveryBlockAreaLabel(order, paymentTypes)}</span>
                        {destinationDetailsAvailable.has(order.id) ? <button
                          type="button"
                          onClick={event => void handleOpenDestinationDetails(order, event)}
                          disabled={destinationDetailsLoadingId === order.id}
                          aria-expanded={destinationDetails?.order.id === order.id}
                          aria-haspopup="dialog"
                          className="group inline-flex h-6 w-6 shrink-0 items-center justify-center bg-transparent p-0 disabled:opacity-50"
                          title="Open customer location and contact details"
                          aria-label="Open customer location and contact details"
                        >
                          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><circle cx="12" cy="12" r="10" className={`transition-colors ${destinationDetails?.order.id === order.id ? 'fill-red-600 stroke-red-600' : 'fill-transparent stroke-black group-hover:fill-red-600 group-hover:stroke-red-600'}`} /><path d="m6.5 9.5 5.5 5.5 5.5-5.5" className={`transition-colors ${destinationDetails?.order.id === order.id ? 'stroke-white' : 'stroke-black group-hover:stroke-white'}`} /></svg>
                        </button> : <span aria-hidden="true" />}
                      </span>
                    )}
                    {order.isOutsideGovernorate && <span className="text-amber-600">Outside governorate</span>}
                  </div>
                  {canEdit && (
                    <div className="mt-3 flex flex-nowrap items-center justify-end gap-2">
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
                      {order.deliveryStatus === 'cancelled' && !order.cancelledReason?.startsWith('Recorded only void:') && !isDeliveryPaymentBlockExempt(order.paymentType, paymentTypes) && (
                        <button
                          onClick={() => handleReassignClick(order)}
                          className="inline-flex h-7 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 text-[10px] font-black uppercase tracking-widest text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                          title="Assign new driver and reopen"
                          aria-label="Assign new driver and reopen"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Reassign
                        </button>
                      )}
                      {reconciliationBadge && !reconciliationBadge.label.startsWith('Settled ') && (
                        <span className={`${reconciliationStatusClass} ${reconciliationBadge.className}`} title={reconciliationBadge.title}>
                          {order.driverReconciledAt && <CheckCircle2 className="h-4 w-4" />}
                          {reconciliationBadge.label}
                        </span>
                      )}
                    {(
                      <>
                      <button onClick={() => handleEdit(order)} className={editActionClass} title="Edit" aria-label="Edit order">
                        <Pencil className="h-4 w-4" />
                      </button>
                        <button onClick={() => handleDelete(order)} className={dangerActionClass} title={order.dispatchMode === 'log_only' ? 'Void Recorded only order' : 'Delete recording'} aria-label={order.dispatchMode === 'log_only' ? 'Void Recorded only order' : 'Delete recording'}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
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

      {destinationDetails && createPortal((
        <div
          ref={destinationPopupRef}
          className="fixed z-[3100] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
          style={{ top: destinationDetails.position.top, left: destinationDetails.position.left, width: destinationDetails.position.width, maxHeight: destinationDetails.position.maxHeight }}
          role="dialog"
          aria-modal="false"
          aria-labelledby="delivery-destination-details-title"
        >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 id="delivery-destination-details-title" className="text-base font-black text-slate-900">Customer location &amp; Contact</h3>
                <p className="mt-1 text-xs font-bold text-slate-500">{deliveryOrderNumber(destinationDetails.order)} · Block {destinationDetails.order.blockNumber || '-'}</p>
              </div>
              <button type="button" onClick={() => setDestinationDetails(null)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Close details">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3">
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <h4 className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">GPS Location URL</h4>
                {destinationDetails.locationUrl ? (
                  <a href={destinationDetails.locationUrl} target="_blank" rel="noreferrer" className="break-all text-sm font-bold text-brand underline">Open delivery location</a>
                ) : <p className="text-sm font-bold text-slate-400">Not provided</p>}
              </section>
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <h4 className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Detailed Address</h4>
                <p className="break-words text-sm font-bold text-slate-700">{destinationDetails.customerAddress || 'Not provided'}</p>
              </section>
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <h4 className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Contact no.</h4>
                {destinationDetails.customerPhone ? (
                  <a href={`tel:${destinationDetails.customerPhone.replace(/[^+\d]/g, '')}`} className="text-sm font-bold text-brand">{destinationDetails.customerPhone}</a>
                ) : <p className="text-sm font-bold text-slate-400">Not provided</p>}
              </section>
            </div>
        </div>
      ), document.body)}

      {reassigningOrder && (
        <div
          className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-xl border border-slate-200/60 bg-white shadow-xl shadow-slate-900/10 animate-in zoom-in-95 duration-200 overflow-visible">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-brand">
                  <UserPlus className="h-5 w-5" strokeWidth={2.4} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Order Delivery Reassignment</p>
                  <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950 font-bold">
                    Assign New Driver
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setReassigningOrder(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-ring"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-xs font-bold text-slate-600 space-y-1">
                <p>Order Number: <span className="font-black text-brand">{deliveryOrderNumber(reassigningOrder)}</span></p>
                <p>Value: <span className="font-black text-slate-950">{formatBhd(reassigningOrder.valueBhd)} BHD</span></p>
                <p>Block / Area: <span className="font-black text-slate-950">{deliveryBlockAreaLabel(reassigningOrder, paymentTypes)}</span></p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Select New Driver
                </label>
                <SearchableSelect
                  options={drivers.filter(d => d.isActive).map(d => ({
                    value: d.id,
                    label: d.driverCode ? `${d.driverCode} - ${d.name}` : d.name,
                    hint: d.driverCode
                  }))}
                  value={reassignDriverId}
                  onChange={setReassignDriverId}
                  onOpen={refreshDriverDutyStatus}
                  renderOption={renderDriverOption}
                  renderSelected={renderDriverOption}
                  placeholder="Search and select driver..."
                  allowClear={false}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 rounded-b-xl">
              <button
                type="button"
                onClick={() => setReassigningOrder(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReassignment}
                disabled={!reassignDriverId || isReassigning}
                className="btn-primary min-h-9 px-5 text-xs font-black uppercase tracking-widest disabled:opacity-50"
              >
                {isReassigning ? 'Assigning...' : 'Assign & Reopen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
