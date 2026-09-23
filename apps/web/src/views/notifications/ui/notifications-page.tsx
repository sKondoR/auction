import { markNotificationsRead } from "@auction/services";
import Link from "next/link";
import { listNotifications } from "@/entities/notification/server";
import { MarkAllReadButton } from "@/features/account";
import { getDb, requireViewer } from "@/shared/api";
import { cn, formatDateTime } from "@/shared/lib";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/shared/ui";

export async function NotificationsPage() {
  const viewer = await requireViewer("/notifications");
  const list = await listNotifications(viewer.id);
  const unreadIds = list.filter((n) => !n.readAt).map((n) => n.id);
  // Открытие страницы отмечает показанные уведомления прочитанными; выделение остаётся на этот показ.
  if (unreadIds.length) await markNotificationsRead(getDb(), viewer.id, unreadIds);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Уведомления"
        actions={
          <>
            <MarkAllReadButton />
            <ButtonLink href="/cabinet/settings#notifications" variant="ghost" size="sm">
              Настроить
            </ButtonLink>
          </>
        }
      />
      {list.length === 0 ? (
        <EmptyState title="Уведомлений нет" />
      ) : (
        <Card className="divide-y">
          {list.map((n) => {
            const body = (
              <>
                <p className={cn("text-sm", !n.readAt && "font-semibold")}>{n.title}</p>
                {n.body && <p className="mt-0.5 whitespace-pre-line text-sm text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
              </>
            );
            return n.link ? (
              <Link key={n.id} href={n.link} className={cn("block px-4 py-3 hover:bg-muted/50", !n.readAt && "bg-accent-soft/40")}>
                {body}
              </Link>
            ) : (
              <div key={n.id} className={cn("px-4 py-3", !n.readAt && "bg-accent-soft/40")}>
                {body}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
