"use client";

import { type BidStepGrid, type LotFormat, type LotStatus, isBlitzAvailable, lotPhase, minNextBid } from "@auction/domain";
import { Crown } from "lucide-react";
import Link from "next/link";
import { Countdown, useLotLive } from "@/entities/lot";
import { BidForm, BlitzForm, BuyFixedForm, OfferForm } from "@/features/lot-trading";
import { formatDateTime, formatRub, plural } from "@/shared/lib";
import { ButtonLink } from "@/shared/ui";

export interface TradePanelProps {
  lot: {
    id: number;
    format: LotFormat;
    status: LotStatus;
    startPrice: number;
    currentPrice: number | null;
    leaderId: string | null;
    leaderMax: number | null;
    bidCount: number;
    blitzPrice: number | null;
    quantity: number;
    quantitySold: number;
    allowOffers: boolean;
    startsAt: string;
    endsAt: string;
    sellerId: string;
  };
  bidSteps: BidStepGrid;
  viewer: { id: string; phoneVerified: boolean } | null;
}

export function TradePanel({ lot, bidSteps, viewer }: TradePanelProps) {
  const live = useLotLive(lot.id, {
    currentPrice: lot.currentPrice,
    bidCount: lot.bidCount,
    endsAt: lot.endsAt,
    leaderId: lot.leaderId,
    status: lot.status,
    quantitySold: lot.quantitySold,
  });
  const phase = lotPhase(
    { status: live.status as LotStatus, format: lot.format, startsAt: new Date(lot.startsAt), endsAt: new Date(live.endsAt) },
    new Date(),
  );
  const isSeller = viewer?.id === lot.sellerId;
  const isLeader = !!viewer && live.leaderId === viewer.id;
  const state = { startPrice: lot.startPrice, currentPrice: live.currentPrice, leaderId: live.leaderId, leaderMax: null };
  const minBid = minNextBid(state, bidSteps);
  const available = lot.quantity - (live.quantitySold ?? lot.quantitySold);

  const cta = !viewer ? (
    <ButtonLink href={`/login?next=/lots/${lot.id}`} size="lg" className="w-full">
      Войдите, чтобы {lot.format === "english" ? "сделать ставку" : "купить"}
    </ButtonLink>
  ) : isSeller ? (
    <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">Это ваш лот.</p>
  ) : null;

  return (
    <div className="flex flex-col gap-4">
      {lot.format === "english" ? (
        <>
          <div>
            <p className="text-sm text-muted-foreground">{live.currentPrice === null ? "Стартовая цена" : "Текущая ставка"}</p>
            <p className="tabular font-serif text-4xl font-semibold">{formatRub(live.currentPrice ?? lot.startPrice)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {live.bidCount > 0 ? `${live.bidCount} ${plural(live.bidCount, "ставка", "ставки", "ставок")}` : "Ставок пока нет"}
            </p>
          </div>
          {isLeader && phase === "open" && (
            <p className="flex items-center gap-2 rounded-md bg-success-soft px-3 py-2 text-sm text-success">
              <Crown className="h-4 w-4" /> Вы лидируете{lot.leaderMax ? `, автоставка до ${formatRub(lot.leaderMax)}` : ""}
            </p>
          )}
          {!isLeader && viewer && !isSeller && live.leaderId && phase === "open" && lot.bidCount > 0 && (
            <p className="text-sm text-muted-foreground">Лидирует другой участник.</p>
          )}
        </>
      ) : (
        <div>
          <p className="text-sm text-muted-foreground">Цена{lot.quantity > 1 ? " за штуку" : ""}</p>
          <p className="tabular font-serif text-4xl font-semibold">{formatRub(lot.startPrice)}</p>
          {lot.quantity > 1 && (
            <p className="mt-1 text-sm text-muted-foreground">
              В наличии {available} из {lot.quantity} шт.
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between rounded-md bg-muted/60 px-3 py-2 text-sm">
        {phase === "open" ? (
          <>
            <span className="text-muted-foreground">{lot.format === "english" ? "До окончания торгов" : "До окончания размещения"}</span>
            <Countdown endsAt={live.endsAt} className="text-base" />
          </>
        ) : phase === "upcoming" ? (
          <span>Начало: {formatDateTime(lot.startsAt)}</span>
        ) : (
          <span className="font-medium">Торги завершены {formatDateTime(live.endsAt)}</span>
        )}
      </div>
      {lot.format === "english" && phase === "open" && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Окончание: {formatDateTime(live.endsAt)} МСК. Ставка в последние 5 минут продлевает торги на 5 минут.
        </p>
      )}

      {phase === "open" &&
        (cta ??
          (lot.format === "english" ? (
            <>
              <BidForm lotId={lot.id} minBid={minBid} currentMax={isLeader ? lot.leaderMax : null} />
              {isBlitzAvailable(lot.blitzPrice, live.currentPrice) && <BlitzForm lotId={lot.id} price={lot.blitzPrice!} />}
            </>
          ) : (
            <>
              <BuyFixedForm lotId={lot.id} price={lot.startPrice} available={available} />
              {lot.allowOffers && <OfferForm lotId={lot.id} available={available} />}
            </>
          )))}

      {phase === "open" && viewer && !isSeller && !viewer.phoneVerified && (
        <p className="text-sm text-warning">
          Подтвердите телефон, чтобы участвовать в торгах. <Link href="/cabinet/settings" className="underline">Настройки</Link>
        </p>
      )}
    </div>
  );
}
