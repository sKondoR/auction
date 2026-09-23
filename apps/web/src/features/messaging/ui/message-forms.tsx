"use client";

import { MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Button, Form, FormMessage, SubmitButton, Textarea } from "@/shared/ui";
import { contactSellerAction, sendMessageAction } from "../api/actions";

export function ContactSellerForm({ lotId, sellerId, loggedIn }: { lotId: number; sellerId: string; loggedIn: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(contactSellerAction, null);
  if (!open) {
    return (
      <Button
        variant="ghost"
        className="w-full"
        onClick={() => (loggedIn ? setOpen(true) : router.push(`/login?next=/lots/${lotId}`))}
      >
        <MessageSquare className="h-4 w-4" /> Связаться с продавцом
      </Button>
    );
  }
  return (
    <Form action={action} state={state} className="flex flex-col gap-2">
      <input type="hidden" name="lotId" value={lotId} />
      <input type="hidden" name="sellerId" value={sellerId} />
      <Textarea name="text" placeholder="Сообщение продавцу. Телефоны и ссылки будут скрыты." required autoFocus />
      <SubmitButton size="sm">Отправить</SubmitButton>
      <FormMessage state={state} />
    </Form>
  );
}

/** Поле ответа в беседе; после отправки очищается. */
export function MessageComposer({ conversationId, lotId }: { conversationId: number; lotId?: number | null }) {
  const [state, action] = useActionState(sendMessageAction, null);
  return (
    <Form action={action} state={state} className="flex flex-col gap-2">
      <input type="hidden" name="conversationId" value={conversationId} />
      {lotId ? <input type="hidden" name="lotId" value={lotId} /> : null}
      <Textarea
        name="text"
        placeholder="Сообщение. Передача контактов запрещена правилами — они будут скрыты."
        required
        className="min-h-20"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit();
        }}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Ctrl+Enter — отправить</span>
        <SubmitButton size="sm">Отправить</SubmitButton>
      </div>
      {state && !state.ok && <FormMessage state={state} />}
    </Form>
  );
}

/** Обновление беседы при новых сообщениях (SSE пользователя). */
export function ConversationLive({ conversationId }: { conversationId: number }) {
  const router = useRouter();
  useEffect(() => {
    const es = new EventSource("/api/me/events");
    es.onmessage = (ev) => {
      const data = JSON.parse(ev.data) as { type: string; conversationId?: number };
      if (data.type === "message" && data.conversationId === conversationId) router.refresh();
    };
    return () => es.close();
  }, [conversationId, router]);
  return null;
}
