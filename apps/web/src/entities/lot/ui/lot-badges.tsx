import { LOT_FORMAT_LABELS, LOT_STATUS_LABELS, type LotFormat, type LotStatus, lotPhase } from "@auction/domain";
import { Badge, type BadgeTone } from "@/shared/ui";

const FORMAT_TONES: Record<LotFormat, BadgeTone> = {
  fixed: "info",
  english: "accent",
  dutch: "warning",
  live: "primary",
};

export function FormatBadge({ format }: { format: LotFormat }) {
  return <Badge tone={FORMAT_TONES[format]}>{format === "fixed" ? "Купить сейчас" : LOT_FORMAT_LABELS[format]}</Badge>;
}

/** Статус с учётом времени: «active» с прошедшим сроком показывается как завершённый. */
export function LotStatusBadge({ status, format, startsAt, endsAt }: { status: LotStatus; format: LotFormat; startsAt: Date; endsAt: Date }) {
  const phase = lotPhase({ status, format, startsAt, endsAt }, new Date());
  if (phase === "open") return <Badge tone="success">Идут торги</Badge>;
  if (phase === "upcoming") return <Badge tone="info">Скоро начнётся</Badge>;
  if (status === "active") return <Badge>Торги завершены</Badge>;
  const tone: BadgeTone = status === "sold" ? "primary" : status === "removed" ? "danger" : "neutral";
  return <Badge tone={tone}>{LOT_STATUS_LABELS[status]}</Badge>;
}
