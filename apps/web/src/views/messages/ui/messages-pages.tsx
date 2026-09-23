import Link from "next/link";
import { listConversations } from "@/entities/conversation/server";
import { requireViewer } from "@/shared/api";
import { cn, formatDateTime } from "@/shared/lib";
import { Badge, Card, EmptyState, PageHeader } from "@/shared/ui";
import { ConversationView } from "@/widgets/conversation";

export async function MessagesPage() {
  const viewer = await requireViewer("/messages");
  const list = await listConversations(viewer.id);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Сообщения" description="Одна беседа на пару «покупатель — продавец»; каждое сообщение привязано к лоту." />
      {list.length === 0 ? (
        <EmptyState title="Бесед пока нет">Нажмите «Связаться с продавцом» на странице лота.</EmptyState>
      ) : (
        <Card className="divide-y">
          {list.map((c) => (
            <Link key={c.id} href={`/messages/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
              <div className="min-w-0 flex-1">
                <p className={cn("truncate", c.unread && "font-semibold")}>
                  {c.otherName} {c.kind === "support" && <Badge tone="primary">администрация</Badge>}
                </p>
                <p className="truncate text-sm text-muted-foreground">{c.lastText}</p>
              </div>
              <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                {formatDateTime(c.lastMessageAt)}
                {c.unread && <span className="h-2 w-2 rounded-full bg-primary" />}
              </div>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}

export async function ConversationPage({ id }: { id: number }) {
  const viewer = await requireViewer(`/messages/${id}`);
  return <ConversationView id={id} viewer={viewer} />;
}
