
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-BH', {
    style: 'currency',
    currency: 'BHD',
    minimumFractionDigits: 3,
  }).format(value);
};

