import { channels } from "@auction/services";
import { sseFromChannel } from "@/shared/api/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return new Response("Bad request", { status: 400 });
  return sseFromChannel(channels.lot(id), req.signal);
}
