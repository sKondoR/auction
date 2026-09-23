import { CONTACT_DEADLINE_DAYS, DAY_MS, PAYMENT_DEADLINE_DAYS, availableDealActions, canReview } from "@auction/domain";
import { dealRole } from "@auction/services";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DealProgress, DealStatusBadge } from "@/entities/deal";
import { getDeal } from "@/entities/deal/server";
import { DealActionButtons, ReviewForm } from "@/features/deal-actions";
import { requireViewer } from "@/shared/api";
import { formatDate, formatDateTime, formatRub } from "@/shared/lib";
import { ButtonLink, Card, CardSection, PageHeader } from "@/shared/ui";

export async function DealPage({ id }: { id: number }) {
  const viewer = await requireViewer(`/deals/${id}`);
  const d = await getDeal(id);
  if (!d) notFound();
  const role = dealRole(d.deal, viewer.id);
  if (!role) notFound();
  const now = new Date();
  const actions = availableDealActions(d.deal, role, now);
  const counterpartName = role === "seller" ? d.buyerName : d.sellerName;
  const myReview = d.reviews.find((r) => r.authorId === viewer.id || (r.isPenalty && r.targetId !== viewer.id));
  const aboutMe = d.reviews.filter((r) => r.targetId === viewer.id);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader
        title={`Сделка №${d.deal.id}`}
        description={`${role === "seller" ? "Вы продавец" : "Вы покупатель"} · ${formatDateTime(d.deal.createdAt)}`}
        actions={<DealStatusBadge status={d.deal.status} />}
      />
      <Card>
        <CardSection className="flex gap-4">
          {d.thumbUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.thumbUrl} alt="" className="h-24 w-24 shrink-0 rounded-md border object-cover" />
          )}
          <div className="flex flex-col gap-1">
            <Link href={`/lots/${d.deal.lotId}`} className="font-medium hover:text-primary">
              {d.lotTitle}
            </Link>
            <p className="tabular text-2xl font-semibold">{formatRub(d.deal.totalPrice)}</p>
            {d.deal.quantity > 1 && (
              <p className="text-sm text-muted-foreground">
                {d.deal.quantity} шт. × {formatRub(d.deal.unitPrice)}
              </p>
            )}
            <p className="text-sm">
              {role === "seller" ? "Покупатель" : "Продавец"}:{" "}
              <Link href={`/users/${role === "seller" ? d.deal.buyerId : d.deal.sellerId}`} className="font-medium hover:underline">
                {counterpartName}
              </Link>
            </p>
          </div>
        </CardSection>
        <CardSection className="border-t">
          <DealProgress status={d.deal.status} />
        </CardSection>
      </Card>

      <Card>
        <CardSection className="flex flex-col gap-3 text-sm">
          <p>
            Оплата и доставка обсуждаются в беседе. Сроки: связаться — до{" "}
            <b>{formatDate(new Date(d.deal.createdAt.getTime() + CONTACT_DEADLINE_DAYS * DAY_MS))}</b>, оплатить — до{" "}
            <b>{formatDate(new Date(d.deal.createdAt.getTime() + PAYMENT_DEADLINE_DAYS * DAY_MS))}</b>.
          </p>
          <p className="text-muted-foreground">
            Площадка не участвует в расчётах и не разрешает денежные споры. При нарушении правил — пожалуйтесь модератору.
          </p>
          {d.deal.conversationId && (
            <ButtonLink href={`/messages/${d.deal.conversationId}`} variant="outline" size="sm" className="self-start">
              Открыть беседу
            </ButtonLink>
          )}
          <DealActionButtons dealId={d.deal.id} actions={actions} />
          {role === "seller" && (d.deal.status === "sold" || d.deal.status === "awaiting_payment") && !actions.includes("report_not_paid") && (
            <p className="text-xs text-muted-foreground">
              «Покупатель не оплатил» станет доступно {formatDate(new Date(d.deal.createdAt.getTime() + PAYMENT_DEADLINE_DAYS * DAY_MS))}.
            </p>
          )}
        </CardSection>
      </Card>

      {canReview(d.deal.status) && (
        <Card>
          <CardSection className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Отзывы</h2>
            {myReview ? (
              <p className="text-sm text-muted-foreground">Отзыв о {counterpartName} оставлен.</p>
            ) : (
              <ReviewForm dealId={d.deal.id} targetName={counterpartName} />
            )}
            {aboutMe.map((r) => (
              <p key={r.id} className="text-sm">
                Отзыв о вас: <b>{r.rating === "positive" ? "положительный" : r.rating === "negative" ? "отрицательный" : "нейтральный"}</b>
                {r.text && ` — ${r.text}`}
              </p>
            ))}
          </CardSection>
        </Card>
      )}
    </div>
  );
}
