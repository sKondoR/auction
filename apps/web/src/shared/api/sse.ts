import "server-only";
import { createSubscriber } from "@auction/services";

/**
 * SSE-поток из канала Redis pub/sub (ADR 0006). Каждое соединение держит своё
 * подписочное подключение; комментарий-пинг раз в 25 с не даёт прокси закрыть поток.
 */
export function sseFromChannel(channel: string, signal: AbortSignal): Response {
  const encoder = new TextEncoder();
  const sub = createSubscriber();
  let ping: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (s: string) => {
        try {
          controller.enqueue(encoder.encode(s));
        } catch {
          /* поток уже закрыт */
        }
      };
      sub.on("message", (_ch: string, message: string) => send(`data: ${message}\n\n`));
      await sub.subscribe(channel);
      send(": connected\n\n");
      ping = setInterval(() => send(": ping\n\n"), 25_000);
      signal.addEventListener("abort", () => {
        clearInterval(ping);
        void sub.quit().catch(() => undefined);
        try {
          controller.close();
        } catch {
          /* уже закрыт */
        }
      });
    },
    cancel() {
      clearInterval(ping);
      void sub.quit().catch(() => undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
