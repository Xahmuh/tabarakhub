const BHD_DECIMAL_PLACES = 3;
const BHD_SCALE = 10 ** BHD_DECIMAL_PLACES;

const moneyParts = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return { sign: '', integer: '0', fraction: '000' };

  const numValue = typeof value === 'number' ? value : Number(String(value).replace(/bhd/gi, '').replace(/,/g, '').trim());
  if (!Number.isFinite(numValue)) return { sign: '', integer: '0', fraction: '000' };

  const rounded = Math.round(numValue * BHD_SCALE) / BHD_SCALE;
  const text = Math.abs(rounded).toFixed(BHD_DECIMAL_PLACES);
  const match = /^(\d+)\.(\d+)$/.exec(text);
  if (!match) return { sign: '', integer: '0', fraction: '000' };

  return {
    sign: rounded < 0 ? '-' : '',
    integer: match[1],
    fraction: match[2]
  };
};

export const truncateBhd = (value: number | string | null | undefined) => {
  const { sign, integer, fraction } = moneyParts(value);
  return Number(`${sign}${integer}.${fraction}`);
};

export const formatBhdAmount = (value: number | string | null | undefined) => {
  const { sign, integer, fraction } = moneyParts(value);
  return `${sign}${integer}.${fraction}`;
};

export const toBhdStorageValue = (value: number | string | null | undefined) =>
  formatBhdAmount(value);

export const formatBhdWithCurrency = (value: number | string | null | undefined) =>
  `${formatBhdAmount(value)} BHD`;
