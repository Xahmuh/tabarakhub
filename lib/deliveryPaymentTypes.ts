import { DeliveryOrder, DeliveryPaymentTypeConfig } from '../types';

export const DEFAULT_DELIVERY_PAYMENT_TYPES: DeliveryPaymentTypeConfig[] = [
  { code: 'BP', label: 'BP', requiresBlock: true, isActive: true, displayOrder: 10 },
  { code: 'CASH', label: 'Cash', requiresBlock: true, isActive: true, displayOrder: 20 },
  { code: 'CARD', label: 'Card', requiresBlock: true, isActive: true, displayOrder: 30 },
  { code: 'TALABAT', label: 'Talabat', requiresBlock: false, isActive: true, displayOrder: 40 },
  { code: 'INSURANCE', label: 'Insurance', requiresBlock: true, isActive: true, displayOrder: 50 }
];

export const normalizeDeliveryPaymentCode = (value?: string | null) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

export const normalizeDeliveryPaymentLabel = (value?: string | null) =>
  String(value || '').trim().replace(/\s+/g, ' ');

export const isValidDeliveryPaymentCode = (value?: string | null) =>
  /^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(String(value || ''));

export const sortDeliveryPaymentTypes = (types: DeliveryPaymentTypeConfig[]) =>
  [...types].sort((a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label));

export const mergeDeliveryPaymentTypes = (types?: DeliveryPaymentTypeConfig[] | null) => {
  const map = new Map<string, DeliveryPaymentTypeConfig>();
  for (const type of DEFAULT_DELIVERY_PAYMENT_TYPES) {
    map.set(type.code, type);
  }
  for (const type of types || []) {
    const code = normalizeDeliveryPaymentCode(type.code);
    if (!code) continue;
    map.set(code, {
      code,
      label: normalizeDeliveryPaymentLabel(type.label) || code,
      requiresBlock: type.requiresBlock,
      isActive: type.isActive,
      displayOrder: Number.isFinite(type.displayOrder) ? type.displayOrder : 100,
      createdAt: type.createdAt,
      updatedAt: type.updatedAt
    });
  }
  return sortDeliveryPaymentTypes([...map.values()]);
};

export const getDeliveryPaymentTypeConfig = (
  code?: string | null,
  types?: DeliveryPaymentTypeConfig[] | null
) => {
  const normalized = normalizeDeliveryPaymentCode(code);
  return mergeDeliveryPaymentTypes(types).find(type => type.code === normalized) || null;
};

export const getDeliveryPaymentLabel = (
  code?: string | null,
  types?: DeliveryPaymentTypeConfig[] | null
) => getDeliveryPaymentTypeConfig(code, types)?.label || normalizeDeliveryPaymentCode(code) || 'Unknown';

export const isDeliveryPaymentBlockExempt = (
  code?: string | null,
  types?: DeliveryPaymentTypeConfig[] | null
) => {
  const config = getDeliveryPaymentTypeConfig(code, types);
  return config ? !config.requiresBlock : normalizeDeliveryPaymentCode(code) === 'TALABAT';
};

export const isTalabatDeliveryPayment = (code?: string | null) =>
  normalizeDeliveryPaymentCode(code) === 'TALABAT';

export const isInternalTransferPayment = (code?: string | null) =>
  normalizeDeliveryPaymentCode(code) === 'INTERNAL_TRANSFER';

export const isDirectDeliveryOrder = (
  order: DeliveryOrder,
  types?: DeliveryPaymentTypeConfig[] | null
) => order.orderKind !== 'internal_transfer'
  && !isInternalTransferPayment(order.paymentType)
  && !isDeliveryPaymentBlockExempt(order.paymentType, types)
  && !isTalabatDeliveryPayment(order.paymentType);
