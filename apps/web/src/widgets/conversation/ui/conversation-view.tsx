import { isParticipant, markConversationRead } from "@auction/services";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getThread } from "@/entities/conversation/server";
import { ComplainButton } from "@/features/engagement";
import { ConversationLive, MessageComposer } from "@/features/messaging";
import { type Viewer, getDb } from "@/shared/api";
import { cn, formatDateTime } from "@/shared/lib";
import { Card } from "@/shared/ui";

/** Лента беседы — общая для пользователя и для поддержки в админке. */
export async function ConversationView({ id, viewer, staffMode = false }: { id: number; viewer: Viewer; staffMode?: boolean }) {
  const t = await getThread(id);
  if (!t) notFound();
  if (!staffMode && !isParticipant(t.c, viewer.id)) notFound();
  if (!staffMode) await markConversationRead(getDb(), id, viewer.id);
  const meIsBuyer = t.c.buyerId === viewer.id;
  const otherName = staffMode ? t.buyerName : meIsBuyer ? (t.sellerIsService ? "Администрация площадки" : t.sellerName) : t.buyerName;
  const lastLotId = [...t.messages].reverse().find((m) => m.m.lotId)?.m.lotId ?? null;
  // «Своими» в режиме поддержки считаются сообщения от имени площадки.
  const mine = (senderId: string) => (staffMode ? senderId === t.c.sellerId : senderId === viewer.id);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <ConversationLive conversationId={id} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{otherName}</h1>
        {!staffMode && !t.sellerIsService && (
          <Link href={`/users/${meIsBuyer ? t.c.sellerId : t.c.buyerId}`} className="text-sm text-primary hover:underline">
            Профиль
          </Link>
        )}
      </div>
      <Card className="flex flex-col gap-3 p-4">
        {t.messages.length === 0 && <p className="text-sm text-muted-foreground">Сообщений пока нет.</p>}
        {t.messages.map(({ m, lotTitle, senderName }) =>
          m.isSystem ? (
            <div key={m.id} className="mx-auto max-w-lg rounded-md border border-accent/40 bg-accent-soft/60 px-4 py-2 text-center text-sm">
              <p className="whitespace-pre-line">{m.text}</p>
              {m.dealId && (
                <Link href={`/deals/${m.dealId}`} className="text-xs text-primary underline">
                  Открыть сделку №{m.dealId}
                </Link>
              )}
              <p className="text-[11px] text-muted-foreground">{formatDateTime(m.createdAt)}</p>
            </div>
          ) : (
            <div key={m.id} className={cn("flex flex-col gap-0.5", mine(m.senderId) ? "items-end" : "items-start")}>
              {m.lotId && lotTitle && (
                <Link href={`/lots/${m.lotId}`} className="text-[11px] text-muted-foreground hover:underline">
                  по лоту «{lotTitle}»
                </Link>
              )}
              <div
                className={cn(
                  "max-w-[80%] whitespace-pre-line rounded-lg px-3 py-2 text-sm",
                  mine(m.senderId) ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {m.text}
              </div>
              <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                {staffMode && !mine(m.senderId) && `${senderName} · `}
                {formatDateTime(m.createdAt)}
                {!mine(m.senderId) && !staffMode && <ComplainButton targetType="message" targetId={m.id} label="" />}
              </span>
            </div>
          ),
        )}
      </Card>
      <MessageComposer conversationId={id} lotId={lastLotId} />
    </div>
  );
}
