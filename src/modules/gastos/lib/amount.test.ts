import { describe, expect, it } from "vitest";

import { parseAmount } from "@/modules/gastos/lib/amount";

describe("parseAmount", () => {
  it.each([
    [12.5, 12.5],
    [null, 0],
    [undefined, 0],
    ["", 0],
    ["  ", 0],
    ["12", 12],
    ["12,5", 12.5],
    ["12.5", 12.5],
    ["-3,20", -3.2],
    ["1.234", 1234],
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["1.234.567", 1234567],
    ["1,234,567", 1234567],
    ["1.234.567,89", 1234567.89],
    ["1,234,567.89", 1234567.89],
    ["1234.567", 1234.567],
    ["€ 1.234,56", 1234.56],
    ["1 234,56 EUR", 1234.56],
  ])("parses %j as %j", (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each([["abc"], ["12,5x"], ["#REF!"], [Number.NaN], [Number.POSITIVE_INFINITY], [new Date()], [{}]])(
    "rejects %j",
    (input) => {
      expect(parseAmount(input)).toBeNull();
    },
  );
});
