export const BAHRAIN_CALLING_CODE = '973';

export const asciiPhoneDigits = (text: string) =>
  text.replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) & 0xf));

export const customerPhoneLimit = (code: string) => code === BAHRAIN_CALLING_CODE ? 8 : 15 - code.length;

export const formatCustomerPhone = (code: string, number: string): string | null => {
  if (!/^[1-9]\d{0,2}$/.test(code) || !/^\d+$/.test(number)) return null;
  if (code === BAHRAIN_CALLING_CODE && number.length !== 8) return null;
  const full = code + number;
  return full.length >= 7 && full.length <= 15 ? `+${full}` : null;
};

export const parseCustomerPhoneInput = (text: string, code: string) => {
  const normalized = asciiPhoneDigits(text).trim();
  if (!/^\+?[\d\s().-]*$/.test(normalized)) return null;
  const digits = normalized.replace(/\D/g, '');
  const international = normalized.startsWith('+') ? digits : digits.startsWith('00') ? digits.slice(2) : null;
  if (international?.startsWith(BAHRAIN_CALLING_CODE) || /^973\d{8}$/.test(digits)) {
    const number = (international ?? digits).slice(3);
    return number.length === 8 ? { code: BAHRAIN_CALLING_CODE, number } : null;
  }
  if (international) {
    const number = international.slice(code.length);
    return code && international.startsWith(code) && formatCustomerPhone(code, number) ? { code, number } : null;
  }
  return digits.length <= customerPhoneLimit(code) ? { code, number: digits } : null;
};
