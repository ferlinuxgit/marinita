/**
 * Parses an amount cell. Numeric cells are returned as-is; text cells accept both Spanish
 * (`1.234,56`) and English (`1,234.56`) notation. When both separators appear, the last one is the
 * decimal separator. With a single separator, a comma is decimal and a dot followed by exactly
 * three digits is a thousands separator (Spanish convention used by Payhawk exports).
 *
 * Returns 0 for empty cells and `null` when the value cannot be read as a number.
 */
export function parseAmount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value !== "string") {
    return null;
  }

  let text = value.replace(/\s/g, "").replace(/€|EUR/gi, "");

  if (!text) {
    return 0;
  }

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    text = text.split(thousands).join("").replace(decimal, ".");
  } else if (lastComma >= 0) {
    const isThousands = text.indexOf(",") !== lastComma;
    text = isThousands ? text.replace(/,/g, "") : text.replace(",", ".");
  } else if (lastDot >= 0) {
    const isThousands = text.indexOf(".") !== lastDot || /^-?\d{1,3}\.\d{3}$/.test(text);
    text = isThousands ? text.replace(/\./g, "") : text;
  }

  if (!/^-?\d+(?:\.\d+)?$/.test(text)) {
    return null;
  }

  return Number(text);
}
