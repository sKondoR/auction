import { DEAL_STATUS_LABELS, type DealStatus, INVOICE_STATUS_LABELS, type InvoiceStatus } from "@auction/domain";
import { Badge, type BadgeTone } from "@/shared/ui";

const DEAL_TONES: Record<DealStatus, BadgeTone> = {
  sold: "info",
  awaiting_payment: "warning",
  paid: "accent",
  shipped: "accent",
  received: "success",
  completed: "success",
  not_paid: "danger",
  not_received: "danger",
};

export function DealStatusBadge({ status }: { status: DealStatus }) {
  return <Badge tone={DEAL_TONES[status]}>{DEAL_STATUS_LABELS[status]}</Badge>;
}

const INVOICE_TONES: Record<InvoiceStatus, BadgeTone> = {
  issued: "warning",
  paid: "success",
  overdue: "danger",
  cancelled: "neutral",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge tone={INVOICE_TONES[status]}>{INVOICE_STATUS_LABELS[status]}</Badge>;
}

/** Шкала этапов сделки. */
export function DealProgress({ status }: { status: DealStatus }) {
  const steps: DealStatus[] = ["sold", "awaiting_payment", "paid", "shipped", "received", "completed"];
  const idx = steps.indexOf(status);
  if (idx === -1) return <DealStatusBadge status={status} />;
  return (
    <ol className="flex flex-wrap gap-x-1 gap-y-2 text-xs">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-1">
          <span
            className={
              i < idx
                ? "rounded-sm bg-success-soft px-1.5 py-0.5 text-success"
                : i === idx
                  ? "rounded-sm bg-primary px-1.5 py-0.5 text-primary-foreground"
                  : "rounded-sm bg-muted px-1.5 py-0.5 text-muted-foreground"
            }
          >
            {i === steps.length - 1 ? "Отзывы" : DEAL_STATUS_LABELS[s]}
          </span>
          {i < steps.length - 1 && <span className="text-muted-foreground">→</span>}
        </li>
      ))}
    </ol>
  );
}
