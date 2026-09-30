import { LOT_STATUS_LABELS, type LotFormat, type LotStatus, lotPhase } from "@auction/domain";
import { Badge, type BadgeTone } from "@/shared/ui";
import { cn } from "@/shared/lib";

const FORMAT_SHORT: Record<LotFormat, string> = {
  fixed: "Фикс. цена",
  english: "Аукцион",
  dutch: "Голландский",
  live: "Живой",
};

/** Бейдж формата торгов (DESIGN.md → Chips): белый ярлык 4px, прописные. */
export function FormatBadge({ format, className }: { format: LotFormat; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-xs bg-surface px-2 py-1 text-[0.6875rem] font-semibold uppercase leading-none tracking-[0.08em] text-foreground",
        className,
      )}
    >
      {FORMAT_SHORT[format]}
    </span>
  );
}

/** Статус с учётом времени: «active» с прошедшим сроком показывается как завершённый. */
export function LotStatusBadge({ status, format, startsAt, endsAt }: { status: LotStatus; format: LotFormat; startsAt: Date; endsAt: Date }) {
  const phase = lotPhase({ status, format, startsAt, endsAt }, new Date());
  if (phase === "open") return <Badge tone="success">Идут торги</Badge>;
  if (phase === "upcoming") return <Badge tone="info">Скоро начнутся</Badge>;
  if (status === "active") return <Badge>Торги завершены</Badge>;
  const tone: BadgeTone = status === "sold" ? "primary" : status === "removed" ? "danger" : "neutral";
  return <Badge tone={tone}>{LOT_STATUS_LABELS[status]}</Badge>;
}
