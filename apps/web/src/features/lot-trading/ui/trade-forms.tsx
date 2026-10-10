"use client";

import { Lock } from "lucide-react";
import { useActionState, useState } from "react";
import { formatRub, kopecksToInput } from "@/shared/lib";
import { Button, Field, Form, FormMessage, Input, SubmitButton, Textarea } from "@/shared/ui";
import {
  buyBlitzAction,
  buyFixedAction,
  cancelBidsAction,
  makeOfferAction,
  placeBidAction,
  respondOfferAction,
} from "../api/actions";

/** Форма ставки. `urgent` — последние 5 минут торгов: кнопка становится сургучной (DESIGN.md → Buttons). */
export function BidForm({ lotId, minBid, currentMax, urgent = false }: { lotId: number; minBid: number; currentMax: number | null; urgent?: boolean }) {
  const [state, action] = useActionState(placeBidAction, null);
  const [auto, setAuto] = useState(currentMax !== null);
  return (
    <Form action={action} state={state} className="flex flex-col gap-3">
      <input type="hidden" name="lotId" value={lotId} />
      <Field label="Ваша ставка" hint={`Минимальная ставка ${formatRub(minBid)}`}>
        <div className="flex h-14 items-center rounded-md border border-border bg-surface px-4 transition-[border-color,box-shadow] hover:border-border-strong focus-within:border-primary focus-within:shadow-[0_0_0_3px_var(--color-sage-mist)]">
          <input
            name="amount"
            inputMode="decimal"
            defaultValue={kopecksToInput(minBid)}
            key={minBid}
            required
            aria-label="Сумма ставки, рублей"
            className="tabular w-full min-w-0 bg-transparent text-2xl font-semibold outline-none"
          />
          <span className="text-xl font-semibold text-muted-foreground">₽</span>
        </div>
      </Field>
      <SubmitButton variant={urgent ? "urgent" : "primary"} className="w-full" pendingText="Ставка…">
        Сделать ставку
      </SubmitButton>
      <label className="flex min-h-11 cursor-pointer items-start gap-2.5 text-[0.9375rem]">
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="mt-1 size-5 shrink-0 accent-primary" />
        Автоставка: система будет поднимать мою ставку на шаг до максимума
      </label>
      {auto && (
        <Field label="Мой максимум, ₽" hint={currentMax ? `Сейчас ваш максимум — ${formatRub(currentMax)}. Его видите только вы.` : "Максимум никто не видит."}>
          <Input name="maxAmount" inputMode="decimal" placeholder="Например, 5000" className="tabular" />
        </Field>
      )}
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Lock className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} aria-hidden />
        Ставку нельзя отозвать. Выигрыш обязывает выкупить лот.
      </p>
      <FormMessage state={state} />
    </Form>
  );
}

export function BlitzForm({ lotId, price }: { lotId: number; price: number }) {
  const [state, action] = useActionState(buyBlitzAction, null);
  return (
    <Form
      action={action} state={state}
      onSubmit={(e) => {
        if (!confirm(`Купить лот по блиц-цене ${formatRub(price)}? Покупка обязывает выкупить лот.`)) e.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="lotId" value={lotId} />
      <SubmitButton variant="urgent" className="tabular w-full">
        Купить по блиц-цене {formatRub(price)}
      </SubmitButton>
      <FormMessage state={state} />
    </Form>
  );
}

export function BuyFixedForm({ lotId, price, available }: { lotId: number; price: number; available: number }) {
  const [state, action] = useActionState(buyFixedAction, null);
  const [qty, setQty] = useState(1);
  return (
    <Form
      action={action} state={state}
      onSubmit={(e) => {
        if (!confirm(`Купить за ${formatRub(price * qty)}? Покупка обязывает выкупить лот.`)) e.preventDefault();
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="lotId" value={lotId} />
      {available > 1 && (
        <Field label={`Количество (доступно ${available})`}>
          <Input type="number" name="quantity" min={1} max={available} value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} className="w-28" />
        </Field>
      )}
      <SubmitButton size="lg" className="w-full">
        Купить{qty > 1 ? ` ${qty} шт.` : ""} за {formatRub(price * qty)}
      </SubmitButton>
      <FormMessage state={state} />
    </Form>
  );
}

export function OfferForm({ lotId, available }: { lotId: number; available: number }) {
  const [state, action] = useActionState(makeOfferAction, null);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        Предложить свою цену
      </Button>
    );
  }
  return (
    <Form action={action} state={state} className="flex flex-col gap-3 rounded-lg bg-well p-4">
      <input type="hidden" name="lotId" value={lotId} />
      <div className="flex gap-2">
        <Field label="Ваша цена за шт., ₽" className="flex-1">
          <Input name="price" inputMode="decimal" required className="tabular" />
        </Field>
        {available > 1 && (
          <Field label="Кол-во">
            <Input type="number" name="quantity" min={1} max={available} defaultValue={1} className="w-20" />
          </Field>
        )}
      </div>
      <Textarea name="message" placeholder="Комментарий продавцу (необязательно)" className="min-h-16" />
      <SubmitButton>Отправить предложение</SubmitButton>
      <FormMessage state={state} />
    </Form>
  );
}

export function RespondOfferButtons({ offerId }: { offerId: number }) {
  const [state, action] = useActionState(respondOfferAction, null);
  return (
    <Form action={action} state={state} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="offerId" value={offerId} />
      <SubmitButton size="sm" name="decision" value="accept">
        Принять
      </SubmitButton>
      <SubmitButton size="sm" variant="outline" name="decision" value="reject">
        Отклонить
      </SubmitButton>
      <FormMessage state={state} />
    </Form>
  );
}

export function CancelBidsForm({ lotId, bidderId, bidderName }: { lotId: number; bidderId: string; bidderName: string }) {
  const [state, action] = useActionState(cancelBidsAction, null);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button className="min-h-11 text-sm text-wax underline underline-offset-[3px]" onClick={() => setOpen(true)}>
        отменить
      </button>
    );
  }
  return (
    <Form action={action} state={state} className="mt-2 flex flex-col gap-3 rounded-lg bg-wax-soft p-4">
      <input type="hidden" name="lotId" value={lotId} />
      <input type="hidden" name="bidderId" value={bidderId} />
      <span className="text-sm">Отменить все ставки участника «{bidderName}»</span>
      <Input name="reason" placeholder="Причина (увидит участник)" required />
      <div className="flex gap-2">
        <SubmitButton size="sm" variant="danger">
          Отменить ставки
        </SubmitButton>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Не надо
        </Button>
      </div>
      <FormMessage state={state} />
    </Form>
  );
}
