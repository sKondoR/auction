import { DELIVERY_METHOD_LABELS, type DeliveryMethod, hasPermission, lotPhase } from "@auction/domain";
import { incrementViews, recentlyViewed, recordView, sellerAlsoSells, similarLots } from "@auction/services";
import { Lock, MapPin, Truck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormatBadge, LotGrid, LotStatusBadge } from "@/entities/lot";
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
    <div className="flex flex-col gap-8">
      {flash && <p className="rounded-md bg-success-soft px-4 py-3 text-sm text-success">{flash}</p>}
      {lot.status === "removed" && (
        <p className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">Лот снят модератором: {lot.removedReason}</p>
      )}

      <nav className="text-sm text-muted-foreground">
        <Link href="/search" className="hover:text-foreground">
          Лоты
        </Link>{" "}
        /{" "}
        <Link href={`/search?category=${d.category.id}`} className="hover:text-foreground">
          {d.category.name}
        </Link>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <LotGallery photos={d.photos} title={lot.title} />
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <FormatBadge format={lot.format} />
              <LotStatusBadge status={lot.status} format={lot.format} startsAt={lot.startsAt} endsAt={lot.endsAt} />
              <span className="text-xs text-muted-foreground">Лот №{lot.id}</span>
            </div>
            <h1 className="text-2xl font-semibold sm:text-3xl">{lot.title}</h1>
          </div>

          {d.attributes.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border bg-surface p-4 text-sm sm:grid-cols-3">
              {d.attributes.map((a) => (
                <div key={a.name}>
                  <dt className="text-muted-foreground">{a.name}</dt>
                  <dd className="font-medium">{a.value}</dd>
                </div>
              ))}
            </dl>
          )}

          <section>
            <h2 className="mb-2 text-xl font-semibold">Описание</h2>
            <div className="whitespace-pre-line leading-relaxed">{lot.description || <span className="text-muted-foreground">Продавец не добавил описание.</span>}</div>
            {d.addenda.map((a) => (
              <div key={a.id} className="mt-4 border-l-2 border-accent bg-accent-soft/50 px-4 py-3">
                <p className="text-xs font-medium text-muted-foreground">Дополнение от {formatDateTime(a.createdAt)}</p>
                <p className="mt-1 whitespace-pre-line">{a.text}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-3 rounded-lg border bg-surface p-4 text-sm sm:grid-cols-2">
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" /> {lot.city}
            </p>
            <div className="flex items-start gap-2">
              <Truck className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p>{lot.deliveryMethods.map((m) => DELIVERY_METHOD_LABELS[m as DeliveryMethod] ?? m).join(", ")}</p>
                {lot.deliveryCost && <p className="text-muted-foreground">{lot.deliveryCost}</p>}
              </div>
            </div>
          </section>

          {lot.format === "english" && (
            <section>
              <h2 className="mb-3 text-xl font-semibold">История ставок</h2>
              {d.bids.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ставок пока нет — начните торги.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border bg-surface">
                  <table className="w-full text-sm">
                    <tbody>
                      {d.bids.map((b, i) => (
                        <tr key={b.id} className={b.cancelledAt ? "text-muted-foreground line-through" : i === 0 ? "bg-success-soft/40" : ""}>
                          <td className="px-3 py-2">
                            {b.bidderId === viewer?.id ? <b>Вы</b> : b.bidderName}
                            {b.isAuto && <Badge className="ml-2">авто</Badge>}
                            {b.cancelledAt && (
                              <span className="ml-2 text-xs no-underline" title={b.cancelReason ?? ""}>
                                отменена: {b.cancelReason}
                              </span>
                            )}
                          </td>
                          <td className="tabular px-3 py-2 text-right font-medium">{formatRub(b.amount)}</td>
                          <td className="px-3 py-2 text-right text-xs text-muted-foreground">{formatDateTime(b.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {isSeller && phase === "open" && activeBidders.size > 0 && (
                <div className="mt-3 rounded-md border bg-surface p-3 text-sm">
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
            <h2 className="mb-3 text-xl font-semibold">Вопросы и ответы</h2>
            <div className="flex flex-col gap-3">
              {d.questions.length === 0 && <p className="text-sm text-muted-foreground">Вопросов пока нет.</p>}
              {d.questions.map((q) => (
                <div key={q.id} className="rounded-lg border bg-surface p-4 text-sm">
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    {q.askerName} · {formatDateTime(q.createdAt)}
                    {q.isPrivate && (
                      <span className="inline-flex items-center gap-1 text-warning">
                        <Lock className="h-3 w-3" /> приватный
                      </span>
                    )}
                  </p>
                  <p className="mt-1">{q.text}</p>
                  {q.answer ? (
                    <div className="mt-2 border-l-2 border-primary pl-3">
                      <p className="text-xs text-muted-foreground">Ответ продавца · {formatDateTime(q.answeredAt!)}</p>
                      <p>{q.answer}</p>
                    </div>
                  ) : isSeller ? (
                    <AnswerQuestionForm questionId={q.id} lotId={lot.id} />
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">Ожидает ответа продавца</p>
                  )}
                  {viewer && !isSeller && <div className="mt-2"><ComplainButton targetType="question" targetId={q.id} /></div>}
                </div>
              ))}
              {viewer && !isSeller && lot.status !== "removed" && <AskQuestionForm lotId={lot.id} />}
              {!viewer && (
                <p className="text-sm">
                  <Link href={`/login?next=/lots/${lot.id}`} className="text-primary underline">
                    Войдите
                  </Link>
                  , чтобы задать вопрос.
                </p>
              )}
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
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
            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
              <FavoriteButton lotId={lot.id} initial={d.isFavorite} loggedIn={!!viewer} />
              {viewer && !isSeller && <ComplainButton targetType="lot" targetId={lot.id} />}
            </div>
            {!isSeller && (
              <div className="border-t p-3">
                <ContactSellerForm lotId={lot.id} sellerId={lot.sellerId} loggedIn={!!viewer} />
              </div>
            )}
          </Card>

          <Card>
            <CardSection className="flex flex-col gap-1 text-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Продавец</p>
              <UserLink id={d.seller.id} name={d.seller.name} deleted={d.seller.deleted} />
              <RatingBadge {...d.sellerRating} />
              <p className="text-xs text-muted-foreground">На площадке с {formatDate(d.seller.createdAt)}</p>
            </CardSection>
          </Card>

          {isSeller && (
            <Card>
              <CardSection className="flex flex-col gap-3">
                <p className="text-sm font-medium">Управление лотом</p>
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
                <p className="text-xs text-muted-foreground">Просмотров: {lot.viewCount}</p>
              </CardSection>
            </Card>
          )}

          {canModerate && lot.status !== "removed" && (
            <Card className="border-danger/40">
              <CardSection>
                <p className="mb-2 text-sm font-medium text-danger">Модерация</p>
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
          <h2 className="mb-4 text-xl font-semibold">Продавец также продаёт</h2>
          <LotGrid lots={alsoSells.slice(0, 5)} />
        </section>
      )}
      {similar.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-semibold">Похожие лоты</h2>
          <LotGrid lots={similar.slice(0, 5)} />
        </section>
      )}
      {viewed.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-semibold">Вы недавно смотрели</h2>
          <LotGrid lots={viewed.slice(0, 5)} />
        </section>
      )}
    </div>
  );
}
