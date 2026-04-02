interface ParsedMonthYear {
  year: number;
  month: number;
}

export const parseMonthYear = (
  value: string | undefined
): ParsedMonthYear | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  const isoMatch = normalized.match(/^(\d{4})-(\d{2})$/);
  if (isoMatch) {
    return { year: Number(isoMatch[1]), month: Number(isoMatch[2]) };
  }

  const brMatch = normalized.match(/^(\d{2})\/(\d{4})$/);
  if (brMatch) {
    return { year: Number(brMatch[2]), month: Number(brMatch[1]) };
  }

  return null;
};

const toYearMonthNumber = (parsed: ParsedMonthYear): number =>
  parsed.year * 100 + parsed.month;

const getCurrentYearMonthNumber = (referenceDate: Date): number =>
  referenceDate.getFullYear() * 100 + (referenceDate.getMonth() + 1);

export const isMonthYearValid = (
  value: string | undefined,
  referenceDate: Date = new Date()
): boolean => {
  const parsed = parseMonthYear(value);
  if (!parsed) {
    return false;
  }

  if (parsed.month < 1 || parsed.month > 12) {
    return false;
  }

  return toYearMonthNumber(parsed) >= getCurrentYearMonthNumber(referenceDate);
};

export const isMonthYearExpired = (
  value: string | undefined,
  referenceDate: Date = new Date()
): boolean => {
  const parsed = parseMonthYear(value);
  if (!parsed) {
    return false;
  }

  if (parsed.month < 1 || parsed.month > 12) {
    return false;
  }

  return toYearMonthNumber(parsed) < getCurrentYearMonthNumber(referenceDate);
};

export const formatMonthYearForReport = (
  value: string | undefined
): string | undefined => {
  const parsed = parseMonthYear(value);
  if (!parsed) {
    return value?.trim();
  }

  const month = String(parsed.month).padStart(2, "0");
  const year = String(parsed.year);
  return `${month}/${year}`;
};

