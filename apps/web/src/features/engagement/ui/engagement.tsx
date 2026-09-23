"use client";

import { Bell, BellOff, Flag, Heart, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useOptimistic, useState, useTransition } from "react";
import { cn } from "@/shared/lib";
import { Button, Checkbox, Form, FormMessage, Input, SubmitButton, Textarea } from "@/shared/ui";
import {
  answerQuestionAction,
  askQuestionAction,
  complainAction,
  deleteSavedSearchAction,
  saveSearchAction,
  toggleFavoriteAction,
  toggleSubscriptionAction,
} from "../api/actions";

export function FavoriteButton({ lotId, initial, loggedIn }: { lotId: number; initial: boolean; loggedIn: boolean }) {
  const router = useRouter();
  const [fav, setFav] = useOptimistic(initial);
  const [, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        if (!loggedIn) return router.push(`/login?next=/lots/${lotId}`);
        start(async () => {
          setFav(!fav);
          await toggleFavoriteAction(lotId);
        });
      }}
      aria-pressed={fav}
    >
      <Heart className={cn("h-4 w-4", fav && "fill-primary text-primary")} />
      {fav ? "В избранном" : "В избранное"}
    </Button>
  );
}

export function SubscribeButton({ sellerId, initial, loggedIn }: { sellerId: string; initial: boolean; loggedIn: boolean }) {
  const router = useRouter();
  const [sub, setSub] = useOptimistic(initial);
  const [, start] = useTransition();
  return (
    <Button
      variant={sub ? "outline" : "primary"}
      size="sm"
      onClick={() => {
        if (!loggedIn) return router.push(`/login?next=/users/${sellerId}`);
        start(async () => {
          setSub(!sub);
          await toggleSubscriptionAction(sellerId);
        });
      }}
    >
      {sub ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
      {sub ? "Отписаться" : "Подписаться на продавца"}
    </Button>
  );
}

export function AskQuestionForm({ lotId }: { lotId: number }) {
  const [state, action] = useActionState(askQuestionAction, null);
  return (
    <Form action={action} state={state} className="flex flex-col gap-2" key={state?.ok ? "sent" : "form"}>
      <input type="hidden" name="lotId" value={lotId} />
      <Textarea name="text" placeholder="Ваш вопрос продавцу. Контактные данные будут скрыты." required maxLength={1000} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Checkbox name="isPrivate" label="Приватный вопрос — увидит только продавец" />
        <SubmitButton size="sm">Задать вопрос</SubmitButton>
      </div>
      <FormMessage state={state} />
    </Form>
  );
}

export function AnswerQuestionForm({ questionId, lotId }: { questionId: number; lotId: number }) {
  const [state, action] = useActionState(answerQuestionAction, null);
  return (
    <Form action={action} state={state} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="questionId" value={questionId} />
      <input type="hidden" name="lotId" value={lotId} />
      <Textarea name="answer" placeholder="Ваш ответ" className="min-h-16" required />
      <SubmitButton size="sm" className="self-start">
        Ответить
      </SubmitButton>
      <FormMessage state={state} />
    </Form>
  );
}

export function ComplainButton({ targetType, targetId, label = "Пожаловаться" }: { targetType: string; targetId: string | number; label?: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(complainAction, null);
  if (!open) {
    return (
      <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-danger" onClick={() => setOpen(true)}>
        <Flag className="h-3.5 w-3.5" /> {label}
      </button>
    );
  }
  return (
    <Form action={action} state={state} className="mt-2 flex w-full flex-col gap-2 rounded-md border bg-surface p-3">
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={String(targetId)} />
      <Textarea name="reason" placeholder="Что нарушено? Например: передача контактов, подделка, оскорбления" required className="min-h-16" />
      <div className="flex gap-2">
        <SubmitButton size="sm" variant="danger">
          Отправить жалобу
        </SubmitButton>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Отмена
        </Button>
      </div>
      <FormMessage state={state} />
    </Form>
  );
}

export function SaveSearchForm({ filters, defaultName }: { filters: object; defaultName: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(saveSearchAction, null);
  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Bell className="h-4 w-4" /> Сохранить поиск
      </Button>
    );
  }
  return (
    <Form action={action} state={state} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="filters" value={JSON.stringify(filters)} />
      <Input name="name" defaultValue={defaultName} className="h-8 w-56" placeholder="Название поиска" />
      <SubmitButton size="sm">Сохранить</SubmitButton>
      <FormMessage state={state} />
    </Form>
  );
}

export function DeleteSavedSearchButton({ id }: { id: number }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="icon" disabled={pending} onClick={() => start(async () => void (await deleteSavedSearchAction(id)))} aria-label="Удалить">
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
