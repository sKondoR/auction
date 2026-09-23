"use client";

import { DEAL_ACTION_LABELS, type DealAction, REVIEW_RATING_LABELS, REVIEW_RATINGS } from "@auction/domain";
import { useActionState } from "react";
import { Form, FormMessage, SubmitButton, Textarea } from "@/shared/ui";
import { dealAction, reviewAction } from "../api/actions";

const DANGEROUS: DealAction[] = ["report_not_paid", "report_not_received"];

const CONFIRM: Partial<Record<DealAction, string>> = {
  report_not_paid: "Отметить, что покупатель не оплатил? Покупатель получит штрафной отзыв, комиссия по сделке будет сторнирована.",
  report_not_received: "Отметить, что товар не получен? Это повлияет на рейтинг продавца.",
};

export function DealActionButtons({ dealId, actions }: { dealId: number; actions: DealAction[] }) {
  const [state, action] = useActionState(dealAction, null);
  if (actions.length === 0) return null;
  return (
    <Form
      action={action} state={state}
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const msg = submitter ? CONFIRM[submitter.value as DealAction] : undefined;
        if (msg && !confirm(msg)) e.preventDefault();
      }}
    >
      <input type="hidden" name="dealId" value={dealId} />
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <SubmitButton key={a} name="action" value={a} variant={DANGEROUS.includes(a) ? "outline" : "primary"} size="sm">
            {DEAL_ACTION_LABELS[a]}
          </SubmitButton>
        ))}
      </div>
      <FormMessage state={state} />
    </Form>
  );
}

export function ReviewForm({ dealId, targetName }: { dealId: number; targetName: string }) {
  const [state, action] = useActionState(reviewAction, null);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <Form action={action} state={state} className="flex flex-col gap-3">
      <input type="hidden" name="dealId" value={dealId} />
      <p className="text-sm font-medium">Отзыв о пользователе {targetName}</p>
      <div className="flex flex-wrap gap-4">
        {REVIEW_RATINGS.map((r) => (
          <label key={r} className="flex items-center gap-1.5 text-sm">
            <input type="radio" name="rating" value={r} defaultChecked={r === "positive"} className="accent-[var(--color-primary)]" />
            {REVIEW_RATING_LABELS[r]}
          </label>
        ))}
      </div>
      <Textarea name="text" placeholder="Как прошла сделка?" maxLength={2000} />
      <SubmitButton size="sm" className="self-start">
        Оставить отзыв
      </SubmitButton>
      <FormMessage state={state} />
    </Form>
  );
}
