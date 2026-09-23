/** Все суммы в системе — целые копейки. */
export type Kopecks = number;

export const rub = (rubles: number): Kopecks => Math.round(rubles * 100);

export const toRubles = (amount: Kopecks): number => amount / 100;

export function assertKopecks(amount: number, field = "amount"): asserts amount is Kopecks {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new DomainError("invalid_amount", `${field}: ожидается неотрицательное целое число копеек`);
  }
}

/** «1 234,50 ₽» / «1 234 ₽» */
export function formatRub(amount: Kopecks): string {
  const hasKopecks = amount % 100 !== 0;
  return (
    new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: hasKopecks ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(amount / 100) + " ₽"
  );
}

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
