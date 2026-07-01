import { truncateBhd } from './money';

export const BAHRAIN_VAT_RATE = 0.1;

export const getProductVatRate = (vatEnabled?: boolean, vatRate?: number | null) =>
  vatEnabled ? Number(vatRate ?? BAHRAIN_VAT_RATE) : 0;

export const getPriceIncludingVat = (priceExVat: number, vatEnabled?: boolean, vatRate?: number | null) => {
  const rate = getProductVatRate(vatEnabled, vatRate);
  return truncateBhd(Number(priceExVat || 0) * (1 + rate));
};

export const formatVatLabel = (vatEnabled?: boolean, vatRate?: number | null) =>
  vatEnabled ? `YES (${Math.round(getProductVatRate(true, vatRate) * 100)}%)` : 'NO (0%)';

export const parseVatEnabled = (value: unknown) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return false;
  return ['yes', 'y', 'true', '1', '10', '10%'].includes(normalized);
};
