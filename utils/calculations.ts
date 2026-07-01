
import { formatBhdAmount } from './money';

export const formatCurrency = (value: number): string => {
  return `BHD ${formatBhdAmount(value)}`;
};
