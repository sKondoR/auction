"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export interface LiveLotState {
  currentPrice: number | null;
  bidCount: number;
  endsAt: string;
  leaderId: string | null;
  status: string;
  quantitySold?: number;
}

/**
 * Состояние торгов в реальном времени: SSE (Redis pub/sub), при обрыве —
 * опрос через обновление серверного компонента (ADR 0006).
 */
export function useLotLive(lotId: number, initial: LiveLotState): LiveLotState {
  const [state, setState] = useState(initial);
  const router = useRouter();
  const lastRefresh = useRef(0);

  // Серверные данные обновились (после router.refresh) — синхронизируем. Сравниваем по
  // значениям: объект initial создаётся заново на каждом рендере родителя.
  const initialKey = `${initial.currentPrice}|${initial.bidCount}|${initial.endsAt}|${initial.leaderId}|${initial.status}|${initial.quantitySold}`;
  const [syncedKey, setSyncedKey] = useState(initialKey);
  if (syncedKey !== initialKey) {
    setSyncedKey(initialKey);
    setState(initial);
  }

  useEffect(() => {
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    const refresh = () => {
      const now = Date.now();
      if (now - lastRefresh.current > 1000) {
        lastRefresh.current = now;
        router.refresh();
      }
    };
    const startPolling = () => {
      if (!poll) poll = setInterval(refresh, 15_000);
    };
    try {
      es = new EventSource(`/api/lots/${lotId}/events`);
      es.onmessage = (ev) => {
        const data = JSON.parse(ev.data) as LiveLotState & { type: string };
        setState((s) => ({ ...s, ...data }));
        // Историю ставок и доступные действия пересчитывает сервер.
        refresh();
      };
      es.onerror = () => startPolling();
      es.onopen = () => {
        if (poll) clearInterval(poll);
        poll = null;
      };
    } catch {
      startPolling();
    }
    return () => {
      es?.close();
      if (poll) clearInterval(poll);
    };
  }, [lotId, router]);

  return state;
}
