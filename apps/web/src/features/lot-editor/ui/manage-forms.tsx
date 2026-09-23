"use client";

import { LOT_FORMAT_LABELS, type LotFormat } from "@auction/domain";
import { useActionState, useState } from "react";
import { kopecksToInput } from "@/shared/lib";
import { Button, Field, Form, FormMessage, Input, Select, SubmitButton, Textarea } from "@/shared/ui";
import { addAddendumAction, relistLotAction, relistManyAction, withdrawLotAction } from "../api/actions";

export function AddendumForm({ lotId }: { lotId: number }) {
  const [state, action] = useActionState(addAddendumAction, null);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Дополнить описание
      </Button>
    );
  }
  return (
    <Form action={action} state={state} className="flex w-full flex-col gap-2" key={state?.ok ? "done" : "form"}>
      <input type="hidden" name="lotId" value={lotId} />
      <Textarea name="text" placeholder="Дополнение будет показано отдельным блоком с датой" required />
      <SubmitButton size="sm" className="self-start">
        Опубликовать дополнение
      </SubmitButton>
      <FormMessage state={state} />
    </Form>
  );
}

export function WithdrawForm({ lotId, hasBids }: { lotId: number; hasBids: boolean }) {
  const [state, action] = useActionState(withdrawLotAction, null);
  const [open, setOpen] = useState(false);
  if (state?.ok) return <FormMessage state={state} />;
  if (!open) {
    return (
      <Button variant="ghost" size="sm" className="text-danger" onClick={() => setOpen(true)}>
        Снять с торгов
      </Button>
    );
  }
  return (
    <Form action={action} state={state} className="flex w-full flex-col gap-2 rounded-md border bg-danger-soft/40 p-3">
      <input type="hidden" name="lotId" value={lotId} />
      <p className="text-sm">
        {hasBids
          ? "Участники торгов получат уведомление, на вашей странице вырастет счётчик досрочно снятых лотов."
          : "Лот будет снят с торгов. Его можно будет перевыставить."}
      </p>
      <Input name="reason" placeholder="Причина (необязательно)" />
      <div className="flex gap-2">
        <SubmitButton size="sm" variant="danger">
          Снять лот
        </SubmitButton>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Отмена
        </Button>
      </div>
      <FormMessage state={state} />
    </Form>
  );
}

export function RelistForm({ lotId, format, price }: { lotId: number; format: LotFormat; price: number }) {
  const [state, action] = useActionState(relistLotAction, null);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <div className="flex flex-wrap gap-2">
        <Form action={action} state={state}>
          <input type="hidden" name="lotId" value={lotId} />
          <SubmitButton size="sm">Перевыставить</SubmitButton>
        </Form>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          С изменениями…
        </Button>
        <FormMessage state={state} />
      </div>
    );
  }
  return (
    <Form action={action} state={state} className="flex w-full flex-col gap-3 rounded-md border bg-muted/40 p-3">
      <input type="hidden" name="lotId" value={lotId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Формат">
          <Select name="format" defaultValue={format}>
            {(["english", "fixed"] as const).map((f) => (
              <option key={f} value={f}>
                {LOT_FORMAT_LABELS[f]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Цена, ₽">
          <Input name="price" defaultValue={kopecksToInput(price)} inputMode="decimal" />
        </Field>
        <Field label="Срок, дней">
          <Input name="durationDays" type="number" min={1} max={60} placeholder="как раньше" />
        </Field>
      </div>
      <SubmitButton size="sm" className="self-start">
        Перевыставить
      </SubmitButton>
      <FormMessage state={state} />
    </Form>
  );
}

/** Массовое перевыставление: оборачивает список лотов с чекбоксами name="lotIds". */
export function RelistManyForm({ children }: { children: React.ReactNode }) {
  const [state, action] = useActionState(relistManyAction, null);
  return (
    <Form action={action} state={state} className="flex flex-col gap-3">
      {children}
      <div className="flex items-center gap-3">
        <SubmitButton size="sm">Перевыставить выбранные</SubmitButton>
        <FormMessage state={state} />
      </div>
    </Form>
  );
}
