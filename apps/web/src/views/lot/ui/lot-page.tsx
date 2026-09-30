import { DELIVERY_METHOD_LABELS, type DeliveryMethod, hasPermission, lotPhase } from "@auction/domain";
import { incrementViews, recentlyViewed, recordView, sellerAlsoSells, similarLots } from "@auction/services";
import { Lock, MapPin, Truck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormatBadge, LotRow, LotStatusBadge } from "@/entities/lot";
import { getLotDetails } from "@/entities/lot/server";
import { RatingBadge, UserLink } from "@/entities/user";
import { removeLotAction } from "@/features/admin";
import { AnswerQuestionForm, AskQuestionForm, ComplainButton, FavoriteButton } from "@/features/engagement";
import { AddendumForm, RelistForm, WithdrawForm } from "@/features/lot-editor";
import { CancelBidsForm } from "@/features/lot-trading";
import { ContactSellerForm } from "@/features/messaging";
import { getDb, getViewer } from "@/shared/api";
import { formatDate, formatDateTime, formatRub } from "@/shared/lib";
import { ActionForm, Badge, ButtonLink, Card, CardSection, Input } from "@/shared/ui";
import { LotGallery } from "@/widgets/lot-gallery";
import { TradePanel } from "@/widgets/lot-trade-panel";

export async function LotPage({ id, flash }: { id: number; flash?: string }) {
  const viewer = await getViewer();
  const d = await getLotDetails(id, viewer?.id ?? null);
  if (!d) notFound();
  const { lot } = d;
  const db = getDb();
  const isSeller = viewer?.id === lot.sellerId;
  const now = new Date();
  const phase = lotPhase(lot, now);
  const canModerate = !!viewer && hasPermission(viewer.role, "moderation.lots");
  if (lot.status === "removed" && !isSeller && !canModerate) notFound();

  const price = lot.currentPrice ?? lot.startPrice;
  const [similar, alsoSells, viewed] = await Promise.all([
    similarLots(db, { id: lot.id, categoryId: lot.categoryId, price }),
    sellerAlsoSells(db, lot.sellerId, lot.id),
    viewer ? recentlyViewed(db, viewer.id, lot.id) : Promise.resolve([]),
  ]);
  if (viewer && !isSeller) await recordView(db, viewer.id, lot.id);
  if (!isSeller) await incrementViews(db, lot.id);

  const activeBidders = new Map<string, string>();
  for (const b of d.bids) if (!b.cancelledAt) activeBidders.set(b.bidderId, b.bidderName);
  const hasSales = lot.bidCount > 0 || lot.quantitySold > 0;

  return (
    <div className="flex flex-col gap-10">
      {flash && <p role="status" className="rounded-lg bg-success-soft px-4 py-3 text-success">{flash}</p>}
      {lot.status === "removed" && (
        <p className="rounded-lg bg-wax-soft px-4 py-3 text-wax-deep">Лот снят модератором: {lot.removedReason}</p>
      )}

      <nav aria-label="Хлебные крошки" className="-mb-4 text-sm text-muted-foreground">
        <Link href="/search" className="hover:text-foreground">
          Лоты
        </Link>{" "}
        /{" "}
        <Link href={`/search?category=${d.category.id}`} className="hover:text-foreground">
          {d.category.name}
        </Link>
      </nav>

      <div className="grid gap-8 lg:grid-cols-12 lg:gap-6">
        <div className="flex min-w-0 flex-col gap-8 lg:col-span-7">
          <LotGallery photos={d.photos} title={lot.title} />
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <FormatBadge format={lot.format} className="border border-border" />
              <LotStatusBadge status={lot.status} format={lot.format} startsAt={lot.startsAt} endsAt={lot.endsAt} />
              <span className="tabular text-sm text-muted-foreground">Лот №{lot.id}</span>
            </div>
            <h1 className="headline">{lot.title}</h1>
          </div>

          {d.attributes.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-3 sm:p-6">
              {d.attributes.map((a) => (
                <div key={a.name}>
                  <dt className="text-sm text-muted-foreground">{a.name}</dt>
                  <dd className="font-medium">{a.value}</dd>
                </div>
              ))}
            </dl>
          )}

          <section>
            <h2 className="mb-3 font-serif text-[1.375rem] font-bold leading-tight">Описание</h2>
            <div className="max-w-[70ch] whitespace-pre-line">{lot.description || <span className="text-muted-foreground">Продавец не добавил описание.</span>}</div>
            {d.addenda.map((a) => (
              <div key={a.id} className="mt-4 max-w-[70ch] rounded-lg bg-brass-soft px-4 py-3">
                <p className="text-sm font-medium text-muted-foreground">Дополнение от {formatDateTime(a.createdAt)}</p>
                <p className="mt-1 whitespace-pre-line">{a.text}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2 sm:p-6">
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-5 shrink-0 text-muted-foreground" strokeWidth={1.5} /> {lot.city}
            </p>
            <div className="flex items-start gap-2">
              <Truck className="mt-0.5 size-5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
              <div>
                <p>{lot.deliveryMethods.map((m) => DELIVERY_METHOD_LABELS[m as DeliveryMethod] ?? m).join(", ")}</p>
                {lot.deliveryCost && <p className="text-muted-foreground">{lot.deliveryCost}</p>}
              </div>
            </div>
          </section>

          {lot.format === "english" && (
            <section>
              <h2 className="mb-4 font-serif text-[1.375rem] font-bold leading-tight">История ставок</h2>
              {d.bids.length === 0 ? (
                <p className="text-muted-foreground">Ставок пока нет — начните торги.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border bg-surface">
                  <table className="tabular w-full text-[0.9375rem]">
                    <tbody>
                      {d.bids.map((b, i) => (
                        <tr key={b.id} className={b.cancelledAt ? "text-muted-foreground line-through" : i === 0 ? "bg-sage-mist" : ""}>
                          <td className="px-4 py-3">
                            {b.bidderId === viewer?.id ? <b>Вы</b> : b.bidderName}
                            {b.isAuto && <Badge className="ml-2">авто</Badge>}
                            {b.cancelledAt && (
                              <span className="ml-2 text-xs no-underline" title={b.cancelReason ?? ""}>
                                отменена: {b.cancelReason}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">{formatRub(b.amount)}</td>
                          <td className="px-4 py-3 text-right text-sm text-muted-foreground">{formatDateTime(b.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {isSeller && phase === "open" && activeBidders.size > 0 && (
                <div className="mt-3 rounded-lg border border-border bg-surface p-4">
                  <p className="mb-2 text-muted-foreground">Отмена ставок участника (с указанием причины):</p>
                  <ul className="flex flex-col gap-1">
                    {[...activeBidders].map(([bidderId, name]) => (
                      <li key={bidderId} className="flex flex-col">
                        <span>
                          {name} · <CancelBidsForm lotId={lot.id} bidderId={bidderId} bidderName={name} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          <section id="questions">
            <h2 className="mb-4 font-serif text-[1.375rem] font-bold leading-tight">Вопросы и ответы</h2>
            <div className="flex flex-col gap-3">
              {d.questions.length === 0 && <p className="text-muted-foreground">Вопросов пока нет.</p>}
              {d.questions.map((q) => (
                <div key={q.id} className="rounded-lg border border-border bg-surface p-4 sm:p-5">
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    {q.askerName} · {formatDateTime(q.createdAt)}
                    {q.isPrivate && (
                      <span className="inline-flex items-center gap-1 text-warning">
                        <Lock className="h-3 w-3" /> приватный
                      </span>
                    )}
                  </p>
                  <p className="mt-1">{q.text}</p>
                  {q.answer ? (
                    <div className="mt-3 rounded-md bg-well px-4 py-3">
                      <p className="text-sm text-muted-foreground">Ответ продавца · {formatDateTime(q.answeredAt!)}</p>
                      <p>{q.answer}</p>
                    </div>
                  ) : isSeller ? (
                    <AnswerQuestionForm questionId={q.id} lotId={lot.id} />
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">Ожидает ответа продавца</p>
                  )}
                  {viewer && !isSeller && <div className="mt-2"><ComplainButton targetType="question" targetId={q.id} /></div>}
                </div>
              ))}
              {viewer && !isSeller && lot.status !== "removed" && <AskQuestionForm lotId={lot.id} />}
              {!viewer && (
                <p>
                  <Link href={`/login?next=/lots/${lot.id}`} className="font-medium text-primary underline">
                    Войдите
                  </Link>
                  , чтобы задать вопрос.
                </p>
              )}
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:col-span-5 lg:self-start">
          <Card>
            <CardSection>
              <TradePanel
                lot={{
                  id: lot.id,
                  format: lot.format,
                  status: lot.status,
                  startPrice: lot.startPrice,
                  currentPrice: lot.currentPrice,
                  leaderId: lot.leaderId,
                  leaderMax: lot.leaderMax,
                  bidCount: lot.bidCount,
                  blitzPrice: lot.blitzPrice,
                  quantity: lot.quantity,
                  quantitySold: lot.quantitySold,
                  allowOffers: lot.allowOffers,
                  startsAt: lot.startsAt.toISOString(),
                  endsAt: lot.endsAt.toISOString(),
                  sellerId: lot.sellerId,
                }}
                bidSteps={d.bidSteps}
                viewer={viewer ? { id: viewer.id, phoneVerified: viewer.phoneNumberVerified } : null}
              />
            </CardSection>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 sm:px-6">
              <FavoriteButton lotId={lot.id} initial={d.isFavorite} loggedIn={!!viewer} />
              {viewer && !isSeller && <ComplainButton targetType="lot" targetId={lot.id} />}
            </div>
            {!isSeller && (
              <div className="border-t border-border p-4 sm:px-6">
                <ContactSellerForm lotId={lot.id} sellerId={lot.sellerId} loggedIn={!!viewer} />
              </div>
            )}
          </Card>

          <Card>
            <CardSection className="flex flex-col gap-1.5">
              <p className="label-caps text-muted-foreground">Продавец</p>
              <UserLink id={d.seller.id} name={d.seller.name} deleted={d.seller.deleted} />
              <RatingBadge {...d.sellerRating} />
              <p className="text-sm text-muted-foreground">На площадке с {formatDate(d.seller.createdAt)}</p>
            </CardSection>
          </Card>

          {isSeller && (
            <Card>
              <CardSection className="flex flex-col gap-3">
                <p className="font-serif text-[1.375rem] font-bold leading-tight">Управление лотом</p>
                {phase === "open" ? (
                  <div className="flex flex-wrap gap-2">
                    <ButtonLink href={`/lots/${lot.id}/edit`} variant="outline" size="sm">
                      Редактировать
                    </ButtonLink>
                    {hasSales && <AddendumForm lotId={lot.id} />}
                    <WithdrawForm lotId={lot.id} hasBids={hasSales} />
                  </div>
                ) : lot.relistedToId ? (
                  <Link href={`/lots/${lot.relistedToId}`} className="text-sm text-primary underline">
                    Перевыставлен как лот №{lot.relistedToId}
                  </Link>
                ) : lot.status !== "removed" && lot.quantity - lot.quantitySold > 0 ? (
                  <RelistForm lotId={lot.id} format={lot.format} price={lot.startPrice} />
                ) : (
                  <p className="text-sm text-muted-foreground">Торги завершены.</p>
                )}
                <p className="tabular text-sm text-muted-foreground">Просмотров: {lot.viewCount}</p>
              </CardSection>
            </Card>
          )}

          {canModerate && lot.status !== "removed" && (
            <Card>
              <CardSection>
                <p className="mb-3 font-serif text-[1.375rem] font-bold leading-tight">Модерация</p>
                <ActionForm action={removeLotAction} submit="Снять лот" submitVariant="danger" confirmText="Снять лот с торгов?">
                  <input type="hidden" name="lotId" value={lot.id} />
                  <Input name="reason" placeholder="Причина (увидит продавец)" required />
                </ActionForm>
              </CardSection>
            </Card>
          )}
        </aside>
      </div>

      {alsoSells.length > 0 && (
        <section>
          <h2 className="section-title mb-8">Продавец также продаёт</h2>
          <LotRow lots={alsoSells} />
        </section>
      )}
      {similar.length > 0 && (
        <section>
          <h2 className="section-title mb-8">Похожие лоты</h2>
          <LotRow lots={similar} />
        </section>
      )}
      {viewed.length > 0 && (
        <section>
          <h2 className="section-title mb-8">Вы недавно смотрели</h2>
          <LotRow lots={viewed} />
        </section>
      )}
    </div>
  );
}
