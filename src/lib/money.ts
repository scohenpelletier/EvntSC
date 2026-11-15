/**
 * Integer-cent currency helpers. No floating-point arithmetic touches money:
 * inputs are parsed as strings into integer cents (and quantities into
 * integer hundredths), multiplied as integers, and rounded half-up once.
 */

export type Parsed<T> =
  | { kind: "empty" }
  | { kind: "ok"; value: T }
  | { kind: "invalid"; reason: string };

const MONEY_RE = /^\$?\s*(\d{1,9}|\d{1,3}(,\d{3}){1,2})(\.(\d{1,2}))?$/;
const QTY_RE = /^(\d{1,6})(\.(\d{1,2}))?$/;

/** Parse "$1,234.50" / "1234.5" / "0" into cents. Negative values are invalid. */
export function parseMoney(input: string): Parsed<number> {
  const s = input.trim();
  if (s === "") return { kind: "empty" };
  if (s.startsWith("-")) return { kind: "invalid", reason: "Amount cannot be negative" };
  const m = MONEY_RE.exec(s);
  if (!m) return { kind: "invalid", reason: "Enter an amount like 125 or 125.50" };
  const dollars = Number(m[1].replace(/,/g, ""));
  const fraction = (m[4] ?? "").padEnd(2, "0");
  return { kind: "ok", value: dollars * 100 + Number(fraction || "0") };
}

/** Parse a positive quantity with up to 2 decimals into hundredths. */
export function parseQuantity(input: string): Parsed<number> {
  const s = input.trim();
  if (s === "") return { kind: "empty" };
  const m = QTY_RE.exec(s);
  if (!m) return { kind: "invalid", reason: "Quantity must be a positive number (up to 2 decimals)" };
  const hundredths = Number(m[1]) * 100 + Number((m[3] ?? "").padEnd(2, "0") || "0");
  if (hundredths <= 0) return { kind: "invalid", reason: "Quantity must be greater than zero" };
  return { kind: "ok", value: hundredths };
}

/** quantity (hundredths) × unit cost (cents) → cents, rounded half-up. */
export function lineAmountCents(qtyHundredths: number, unitCents: number): number {
  // Both operands are integers well below 2^53 / 1e6, so the product is exact.
  const product = qtyHundredths * unitCents;
  return Math.floor((product + 50) / 100);
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  return `${sign}$${dollars.toLocaleString("en-US")}.${rem.toString().padStart(2, "0")}`;
}

export function formatQuantity(hundredths: number): string {
  const whole = Math.floor(hundredths / 100);
  const rem = hundredths % 100;
  if (rem === 0) return String(whole);
  return `${whole}.${rem.toString().padStart(2, "0").replace(/0$/, "")}`;
}
