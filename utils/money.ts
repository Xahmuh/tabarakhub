const BHD_DECIMAL_PLACES = 3;
const BHD_SCALE = 10 ** BHD_DECIMAL_PLACES;

const numberToPlainText = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  const scaled = value * BHD_SCALE;
  const nearestFils = Math.round(scaled);
  if (Math.abs(scaled - nearestFils) < 1e-9) {
    return (nearestFils / BHD_SCALE).toFixed(BHD_DECIMAL_PLACES);
  }
  return value.toLocaleString('en-US', {
    useGrouping: false,
    maximumFractionDigits: 20
  });
};

const normalizeMoneyText = (value: number | string | null | undefined) => {
  const raw = typeof value === 'number' ? numberToPlainText(value) : String(value ?? '');
  return raw.replace(/bhd/gi, '').replace(/,/g, '').trim();
};

const moneyParts = (value: number | string | null | undefined) => {
  const text = normalizeMoneyText(value);
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) return { sign: '', integer: '0', fraction: '000' };

  const integer = String(Number(match[2] || '0'));
  const fraction = (match[3] || '').slice(0, BHD_DECIMAL_PLACES).padEnd(BHD_DECIMAL_PLACES, '0');
  return {
    sign: match[1] === '-' && (integer !== '0' || Number(fraction) > 0) ? '-' : '',
    integer,
    fraction
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
