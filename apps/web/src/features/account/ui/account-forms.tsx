"use client";

import { NOTIFICATION_TYPE_LABELS, NOTIFICATION_TYPES, type NotificationType } from "@auction/domain";
import { useActionState, useTransition } from "react";
import { Button, Field, Form, FormMessage, Input, PhotoUploader, SubmitButton, Table, Textarea } from "@/shared/ui";

import {
  answerBuyoutOfferAction,
  createBuyoutAction,
  deleteAccountAction,
  markAllNotificationsReadAction,
  updateNotificationPrefsAction,
  updateProfileAction,
} from "../api/actions";

export function ProfileForm({ initial }: { initial: { name: string; city: string; about: string; notifyEmail: string } }) {
  const [state, action] = useActionState(updateProfileAction, null);
  return (
    <Form action={action} state={state} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Имя, которое видят другие">
          <Input name="name" defaultValue={initial.name} required maxLength={60} />
        </Field>
        <Field label="Город">
          <Input name="city" defaultValue={initial.city} />
        </Field>
      </div>
      <Field label="Email для уведомлений" hint="Необязательно. Не показывается другим пользователям.">
        <Input type="email" name="notifyEmail" defaultValue={initial.notifyEmail} />
      </Field>
      <Field label="О себе">
        <Textarea name="about" defaultValue={initial.about} maxLength={1000} />
      </Field>
      <SubmitButton className="self-start">Сохранить</SubmitButton>
      <FormMessage state={state} />
    </Form>
  );
}

export function NotificationPrefsForm({ prefs }: { prefs: Record<NotificationType, { site: boolean; email: boolean }> }) {
  const [state, action] = useActionState(updateNotificationPrefsAction, null);
  return (
    <Form action={action} state={state} className="flex flex-col gap-3">
      <Table>
        <thead>
          <tr>
            <th>Событие</th>
            <th className="w-24 text-center">На сайте</th>
            <th className="w-24 text-center">Email</th>
          </tr>
        </thead>
        <tbody>
          {NOTIFICATION_TYPES.filter((t) => t !== "live_starting").map((t) => (
            <tr key={t}>
              <td>{NOTIFICATION_TYPE_LABELS[t]}</td>
              <td className="text-center">
                <input type="checkbox" name={`${t}.site`} defaultChecked={prefs[t].site} className="h-4 w-4 accent-[var(--color-primary)]" />
              </td>
              <td className="text-center">
                <input type="checkbox" name={`${t}.email`} defaultChecked={prefs[t].email} className="h-4 w-4 accent-[var(--color-primary)]" />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="text-xs text-muted-foreground">Уведомления в Telegram появятся позже.</p>
      <SubmitButton className="self-start">Сохранить настройки</SubmitButton>
      <FormMessage state={state} />
    </Form>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccountAction, null);
  return (
    <Form action={action} state={state} className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Имя, телефон и email будут удалены. Лоты, ставки, сделки и отзывы останутся в истории с подписью «Пользователь удалён».
        Действие необратимо.
      </p>
      <Field label="Для подтверждения введите УДАЛИТЬ">
        <Input name="confirm" autoComplete="off" className="max-w-xs" />
      </Field>
      <SubmitButton variant="danger" className="self-start">
        Удалить аккаунт
      </SubmitButton>
      <FormMessage state={state} />
    </Form>
  );
}

export function MarkAllReadButton() {
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => void (await markAllNotificationsReadAction()))}>
      Отметить все прочитанными
    </Button>
  );
}

export function BuyoutRequestForm() {
  const [state, action] = useActionState(createBuyoutAction, null);
  return (
    <Form action={action} state={state} className="flex flex-col gap-4">
      <Field label="Что за предмет">
        <Input name="title" required maxLength={150} placeholder="Например: серебряный портсигар, 1900-е" />
      </Field>
      <Field label="Описание" hint="Состояние, происхождение, клейма, дефекты.">
        <Textarea name="description" required rows={6} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Размер" hint="Габариты и вес, например: 12×8×1,5 см, 180 г">
          <Input name="size" required />
        </Field>
        <Field label="Желаемая цена, ₽">
          <Input name="desiredPrice" inputMode="decimal" required className="tabular" />
        </Field>
      </div>
      <Field label="Фото">
        <PhotoUploader />
      </Field>
      <SubmitButton size="lg" className="self-start">
        Отправить на оценку
      </SubmitButton>
      <FormMessage state={state} />
    </Form>
  );
}

export function BuyoutOfferAnswer({ requestId }: { requestId: number }) {
  const [state, action] = useActionState(answerBuyoutOfferAction, null);
  return (
    <Form action={action} state={state} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <SubmitButton size="sm" name="to" value="accepted">
        Принять предложение
      </SubmitButton>
      <SubmitButton size="sm" variant="outline" name="to" value="rejected">
        Отказаться
      </SubmitButton>
      <FormMessage state={state} />
    </Form>
  );
}
