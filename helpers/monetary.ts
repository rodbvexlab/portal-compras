export type NumericInput = number | string | null | undefined;

export function toFiniteNumber(value: NumericInput, fallback = 0): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) return fallback;
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

export function normalizeQuantity(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return 1;
  const integerValue = Math.trunc(value as number);
  return integerValue > 0 ? integerValue : 1;
}

export function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function hasPositiveAmount(value: NumericInput): boolean {
  return toFiniteNumber(value, 0) > 0;
}

export function calculateEstimatedTotal(args: {
  valorEstimadoUnitario: NumericInput;
  quantidade: number | null | undefined;
}): number {
  const unitario = toFiniteNumber(args.valorEstimadoUnitario, 0);
  const quantidade = normalizeQuantity(args.quantidade);
  return roundCurrency(unitario * quantidade);
}

export function resolveRealUnitario(args: {
  valorRealCompraUnitario?: NumericInput;
  valorRealCompraLegado?: NumericInput;
  quantidade: number | null | undefined;
}): number | null {
  const unitario = toFiniteNumber(args.valorRealCompraUnitario, 0);
  if (unitario > 0) {
    return roundCurrency(unitario);
  }

  const legadoTotal = toFiniteNumber(args.valorRealCompraLegado, 0);
  const quantidade = normalizeQuantity(args.quantidade);
  if (legadoTotal > 0 && quantidade > 0) {
    return roundCurrency(legadoTotal / quantidade);
  }

  return null;
}

export function calculateRealTotal(args: {
  valorRealCompraUnitario?: NumericInput;
  valorRealCompraLegado?: NumericInput;
  quantidade: number | null | undefined;
}): number {
  const unitario = toFiniteNumber(args.valorRealCompraUnitario, 0);
  const quantidade = normalizeQuantity(args.quantidade);

  if (unitario > 0) {
    return roundCurrency(unitario * quantidade);
  }

  const legadoTotal = toFiniteNumber(args.valorRealCompraLegado, 0);
  return legadoTotal > 0 ? roundCurrency(legadoTotal) : 0;
}
