"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { IS_DEMO } from "@/shared/config";

/** Обновляет счётчики в шапке при новых уведомлениях и сообщениях. */
export function UserLive() {
  const router = useRouter();
  useEffect(() => {
    if (IS_DEMO) return;
    const es = new EventSource("/api/me/events");
    let t: ReturnType<typeof setTimeout> | undefined;
    es.onmessage = () => {
      clearTimeout(t);
      t = setTimeout(() => router.refresh(), 300);
    };
    return () => {
      clearTimeout(t);
      es.close();
    };
  }, [router]);
  return null;
}
