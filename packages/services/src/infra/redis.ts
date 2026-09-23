import { Redis } from "ioredis";

const g = globalThis as unknown as { __auctionRedis?: Redis };

/** Общее подключение для публикации и очередей (переживает hot reload). */
export function getRedis(): Redis {
  if (!g.__auctionRedis) {
    g.__auctionRedis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      lazyConnect: false,
    });
  }
  return g.__auctionRedis;
}

/** Отдельное подключение для подписки (в режиме subscribe другие команды недоступны). */
export function createSubscriber(): Redis {
  return new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: null });
}

export const channels = {
  lot: (lotId: number) => `lot:${lotId}`,
  user: (userId: string) => `user:${userId}`,
};

/** Событие по лоту для SSE: новая ставка, продление, завершение. */
export interface LotEvent {
  type: "bid" | "ended" | "updated";
  lotId: number;
  currentPrice: number | null;
  bidCount: number;
  endsAt: string;
  leaderId: string | null;
  status: string;
  quantitySold?: number;
}

/** Событие пользователю: новое уведомление или сообщение. */
export interface UserEvent {
  type: "notification" | "message";
  unreadNotifications?: number;
  conversationId?: number;
}

export async function publishLotEvent(e: LotEvent): Promise<void> {
  try {
    await getRedis().publish(channels.lot(e.lotId), JSON.stringify(e));
  } catch (err) {
    console.error("[redis] publish lot event failed", err);
  }
}

export async function publishUserEvent(userId: string, e: UserEvent): Promise<void> {
  try {
    await getRedis().publish(channels.user(userId), JSON.stringify(e));
  } catch (err) {
    console.error("[redis] publish user event failed", err);
  }
}
