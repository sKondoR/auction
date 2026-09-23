import { lots, sellerSubscriptions, user } from "@auction/db";
import { REVIEW_RATING_LABELS } from "@auction/domain";
import { lotCards, openNow, userRating } from "@auction/services";
import { and, asc, count, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { listReviewsAbout } from "@/entities/deal/server";
import { LotGrid } from "@/entities/lot";
import { RatingBadge } from "@/entities/user";
import { ComplainButton, SubscribeButton } from "@/features/engagement";
import { getDb, getViewer } from "@/shared/api";
import { cn, formatDate, plural } from "@/shared/lib";
import { Card, CardSection, EmptyState } from "@/shared/ui";

export async function SellerPage({ id }: { id: string }) {
  const db = getDb();
  const [u] = await db.select().from(user).where(eq(user.id, id));
  if (!u || u.isService) notFound();
  const viewer = await getViewer();
  const [rating, active, reviewsList, withdrawn, subscribed, subscribers] = await Promise.all([
    userRating(db, id),
    lotCards(db, and(openNow(), eq(lots.sellerId, id)), [asc(lots.endsAt)], 100),
    listReviewsAbout(id),
    db.select({ n: count() }).from(lots).where(and(eq(lots.sellerId, id), eq(lots.status, "withdrawn"))),
    viewer
      ? db.select({ n: count() }).from(sellerSubscriptions).where(and(eq(sellerSubscriptions.subscriberId, viewer.id), eq(sellerSubscriptions.sellerId, id)))
      : Promise.resolve([{ n: 0 }]),
    db.select({ n: count() }).from(sellerSubscriptions).where(eq(sellerSubscriptions.sellerId, id)),
  ]);
  const withdrawnCount = Number(withdrawn[0]?.n ?? 0);

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <CardSection className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-semibold">{u.name}</h1>
            <RatingBadge {...rating} />
            <p className="text-sm text-muted-foreground">
              {u.city && `${u.city} · `}На площадке с {formatDate(u.createdAt)} · {Number(subscribers[0]?.n ?? 0)} подписчиков
            </p>
            <p className={cn("text-sm", withdrawnCount > 0 ? "text-warning" : "text-muted-foreground")}>
              Досрочно снято с торгов: {withdrawnCount} {plural(withdrawnCount, "лот", "лота", "лотов")}
            </p>
            {u.about && <p className="mt-2 max-w-2xl whitespace-pre-line text-sm">{u.about}</p>}
          </div>
          {!u.deletedAt && viewer?.id !== id && (
            <div className="flex flex-col items-end gap-2">
              <SubscribeButton sellerId={id} initial={Number(subscribed[0]?.n) > 0} loggedIn={!!viewer} />
              {viewer && <ComplainButton targetType="user" targetId={id} label="Пожаловаться на пользователя" />}
            </div>
          )}
        </CardSection>
      </Card>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Активные лоты · {active.length}</h2>
        {active.length ? <LotGrid lots={active} /> : <EmptyState title="Сейчас нет активных лотов" />}
      </section>

      <section id="reviews">
        <h2 className="mb-4 text-xl font-semibold">
          Отзывы · {rating.total}
          <span className="ml-3 text-sm font-normal text-muted-foreground">
            +{rating.counts.positive} / {rating.counts.neutral} / −{rating.counts.negative}
          </span>
        </h2>
        {reviewsList.length === 0 ? (
          <EmptyState title="Отзывов пока нет" />
        ) : (
          <div className="flex flex-col gap-2">
            {reviewsList.map(({ review, authorName, lotTitle, lotId }) => (
              <div key={review.id} className="rounded-lg border bg-surface p-4 text-sm">
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className={cn(
                      "font-semibold",
                      review.rating === "positive" ? "text-success" : review.rating === "negative" ? "text-danger" : "text-muted-foreground",
                    )}
                  >
                    {REVIEW_RATING_LABELS[review.rating]}
                  </span>
                  · {review.isPenalty ? "автоматический" : authorName} · как {review.targetRole === "seller" ? "продавцу" : "покупателю"} ·{" "}
                  <a href={`/lots/${lotId}`} className="hover:underline">
                    {lotTitle}
                  </a>{" "}
                  · {formatDate(review.createdAt)}
                </p>
                {review.text && <p className="mt-1">{review.text}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
