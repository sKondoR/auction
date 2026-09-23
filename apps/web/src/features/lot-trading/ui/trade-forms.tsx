"use client";

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

export function BidForm({ lotId, minBid, currentMax }: { lotId: number; minBid: number; currentMax: number | null }) {
  const [state, action] = useActionState(placeBidAction, null);
  const [auto, setAuto] = useState(currentMax !== null);
  return (
    <Form action={action} state={state} className="flex flex-col gap-3">
      <input type="hidden" name="lotId" value={lotId} />
      <Field label="Ваша ставка, ₽" hint={`Минимальная ставка — ${formatRub(minBid)}`}>
        <div className="flex gap-2">
          <Input name="amount" inputMode="decimal" defaultValue={kopecksToInput(minBid)} key={minBid} className="tabular text-base" required />
          <SubmitButton className="shrink-0" pendingText="Ставка…">
            Сделать ставку
          </SubmitButton>
        </div>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-[var(--color-primary)]" />
        Автоставка — система будет повышать мою ставку на шаг до максимума
      </label>
      {auto && (
        <Field label="Мой максимум, ₽" hint={currentMax ? `Сейчас ваш максимум — ${formatRub(currentMax)}. Его видите только вы.` : "Максимум никто не видит."}>
          <Input name="maxAmount" inputMode="decimal" placeholder="Например, 5000" className="tabular" />
        </Field>
      )}
      <p className="text-xs text-muted-foreground">Ставку нельзя отозвать. Выигрыш обязывает выкупить лот.</p>
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
        if (!confirm(`Купить лот сейчас за ${formatRub(price)}? Покупка обязывает выкупить лот.`)) e.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="lotId" value={lotId} />
      <SubmitButton variant="outline" className="w-full">
        Купить сейчас за {formatRub(price)}
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
    <Form action={action} state={state} className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3">
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
      <button className="text-xs text-danger hover:underline" onClick={() => setOpen(true)}>
        отменить
      </button>
    );
  }
  return (
    <Form action={action} state={state} className="mt-2 flex flex-col gap-2 rounded-md border bg-danger-soft/40 p-2">
      <input type="hidden" name="lotId" value={lotId} />
      <input type="hidden" name="bidderId" value={bidderId} />
      <span className="text-xs">Отменить все ставки участника «{bidderName}»</span>
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
