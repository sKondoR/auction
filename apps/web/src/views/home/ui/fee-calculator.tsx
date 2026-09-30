"use client";

import { type BidStepGrid, INVOICE_DUE_DAYS, bidStep, commissionFor, formatRub } from "@auction/domain";
import { AlertCircle } from "lucide-react";
import { useId, useState } from "react";

/** Калькулятор полосы «Как продать вещь»: шаг ставки при цене и счёт площадки. */
export function FeeCalculator({ bidSteps, commissionBps, minInvoice }: { bidSteps: BidStepGrid; commissionBps: number; minInvoice: number }) {
  const id = useId();
  const [raw, setRaw] = useState("12 000");
  const digits = raw.replace(/[\s ]/g, "");
  const valid = /^\d{1,9}$/.test(digits) && Number(digits) > 0;
  const price = valid ? Number(digits) * 100 : 0;
  const fee = commissionFor(price, 1, commissionBps);
  const percent = (commissionBps / 100).toLocaleString("ru-RU");

  return (
    <form className="flex flex-col gap-4 rounded-xl bg-surface p-5 sm:p-8" onSubmit={(e) => e.preventDefault()} noValidate>
      <h3 className="font-serif text-[1.375rem] font-bold leading-tight">Сколько стоит продажа</h3>
      <label htmlFor={id} className="text-sm font-medium">
        Цена, за которую продадите
      </label>
      <div
        className={`flex h-14 items-center rounded-md border bg-surface px-4 transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-[0_0_0_3px_var(--color-sage-mist)] ${valid ? "border-border hover:border-border-strong" : "border-wax"}`}
      >
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          value={raw}
          aria-invalid={!valid}
          aria-describedby={valid ? undefined : `${id}-err`}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={() => valid && setRaw(Number(digits).toLocaleString("ru-RU"))}
          className="tabular w-full min-w-0 bg-transparent text-2xl font-semibold outline-none"
        />
        <span className="text-xl font-semibold text-muted-foreground">₽</span>
      </div>
      {!valid && (
        <p id={`${id}-err`} className="-mt-2 flex items-center gap-1.5 text-sm text-wax">
          <AlertCircle className="size-4" strokeWidth={1.5} /> Введите сумму цифрами, например 4 500
        </p>
      )}
      <dl className="tabular" aria-live="polite">
        <div className="flex items-baseline justify-between gap-4 border-b border-border py-3">
          <dt className="text-[0.9375rem] text-muted-foreground">Покупатель переводит вам</dt>
          <dd className="text-lg font-semibold">{valid ? formatRub(price) : "—"}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-b border-border py-3">
          <dt className="text-[0.9375rem] text-muted-foreground">Шаг ставки при этой цене</dt>
          <dd className="text-lg font-semibold">{valid ? formatRub(bidStep(price, bidSteps)) : "—"}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 py-3">
          <dt className="text-[0.9375rem] text-muted-foreground">Счёт от площадки, {percent}%</dt>
          <dd className="text-2xl font-semibold text-primary">{valid ? formatRub(fee) : "—"}</dd>
        </div>
      </dl>
      <p className="text-[0.8125rem] text-muted-foreground">
        {valid && fee < minInvoice
          ? `Сумма меньше ${formatRub(minInvoice)}, поэтому отдельного счёта не будет: она перенесётся на следующий месяц и сложится с другими продажами.`
          : `Счёт выставляется раз в месяц за проданные лоты, на оплату — ${INVOICE_DUE_DAYS} дней.`}
      </p>
    </form>
  );
}
