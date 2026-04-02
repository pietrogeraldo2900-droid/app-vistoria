import { describe, expect, it } from "vitest";
import {
  formatMonthYearForReport,
  isMonthYearExpired,
  isMonthYearValid,
  parseMonthYear
} from "@/domain/utils/monthYear";

describe("monthYear utils", () => {
  it("parseia formatos YYYY-MM e MM/YYYY", () => {
    expect(parseMonthYear("2026-01")).toEqual({ year: 2026, month: 1 });
    expect(parseMonthYear("01/2026")).toEqual({ year: 2026, month: 1 });
  });

  it("valida competencia vigente e identifica vencida", () => {
    const referenceDate = new Date("2026-04-01T00:00:00.000Z");

    expect(isMonthYearValid("2026-04", referenceDate)).toBe(true);
    expect(isMonthYearValid("05/2026", referenceDate)).toBe(true);
    expect(isMonthYearExpired("2026-01", referenceDate)).toBe(true);
    expect(isMonthYearExpired("01/2026", referenceDate)).toBe(true);
  });

  it("normaliza para MM/YYYY no relatorio quando for parseavel", () => {
    expect(formatMonthYearForReport("2026-01")).toBe("01/2026");
    expect(formatMonthYearForReport("01/2026")).toBe("01/2026");
    expect(formatMonthYearForReport("janeiro de 2026")).toBe("janeiro de 2026");
  });
});

