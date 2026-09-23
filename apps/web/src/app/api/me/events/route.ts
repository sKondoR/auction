import { channels } from "@auction/services";
import { getViewer } from "@/shared/api";
import { sseFromChannel } from "@/shared/api/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Личный поток: новые уведомления и сообщения. */
export async function GET(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return new Response("Unauthorized", { status: 401 });
  return sseFromChannel(channels.user(viewer.id), req.signal);
}
