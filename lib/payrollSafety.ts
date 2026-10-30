const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const parseDate = (value: string): number => {
  if (!ISO_DATE.test(value)) throw new Error(`Invalid payroll date: ${value}`);
  const time = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid payroll date: ${value}`);
  }
  return time;
};

export const getPayrollMonthBounds = (month: string): { start: string; end: string } => {
  const match = MONTH.exec(month);
  if (!match) throw new Error(`Invalid payroll month: ${month}`);
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, '0')}` };
};

/** Count only the calendar days of a leave that fall inside the pay month. */
export const getLeaveDaysInMonth = (startDate: string, endDate: string, month: string): number => {
  const leaveStart = parseDate(startDate);
  const leaveEnd = parseDate(endDate);
  if (leaveEnd < leaveStart) throw new Error('Leave ends before it starts');
  const bounds = getPayrollMonthBounds(month);
  const start = Math.max(leaveStart, parseDate(bounds.start));
  const end = Math.min(leaveEnd, parseDate(bounds.end));
  return end < start ? 0 : Math.floor((end - start) / DAY_MS) + 1;
};

/** Bahrain IBAN format and ISO 7064 MOD 97 check digits. */
export const isValidBahrainIban = (value: string | null | undefined): boolean => {
  const iban = (value || '').replace(/\s+/g, '').toUpperCase();
  if (!/^BH\d{2}[A-Z]{4}[A-Z0-9]{14}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const digits = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
};

export const assertSinglePublishedAssignmentPerDay = (
  assignments: ReadonlyArray<{ employee_id: string; date: string }>
): void => {
  const seen = new Set<string>();
  for (const assignment of assignments) {
    const key = `${assignment.employee_id}:${assignment.date}`;
    if (seen.has(key)) {
      throw new Error(`Multiple published duty assignments for ${key}. Payroll cannot be calculated safely.`);
    }
    seen.add(key);
  }
};
