import type { ReactNode } from "react";
import { requireViewer } from "@/shared/api";
import { SideNav } from "@/widgets/side-nav";

export async function CabinetLayout({ children }: { children: ReactNode }) {
  await requireViewer("/cabinet");
  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside>
        <SideNav
          groups={[
            {
              title: "Кабинет",
              items: [
                { href: "/cabinet", label: "Обзор" },
                { href: "/messages", label: "Сообщения" },
                { href: "/notifications", label: "Уведомления" },
                { href: "/cabinet/settings", label: "Настройки" },
              ],
            },
            {
              title: "Покупаю",
              items: [
                { href: "/cabinet/bids", label: "Мои ставки" },
                { href: "/cabinet/deals?role=buyer", label: "Покупки и выигрыши" },
                { href: "/cabinet/favorites", label: "Избранное" },
                { href: "/cabinet/searches", label: "Сохранённые поиски" },
                { href: "/cabinet/subscriptions", label: "Подписки на продавцов" },
                { href: "/cabinet/viewed", label: "Недавно смотрели" },
              ],
            },
            {
              title: "Продаю",
              items: [
                { href: "/cabinet/lots", label: "Мои лоты" },
                { href: "/cabinet/deals?role=seller", label: "Продажи" },
                { href: "/cabinet/offers", label: "Предложения цены" },
                { href: "/cabinet/invoices", label: "Счета и комиссия" },
                { href: "/cabinet/buyout", label: "Продать площадке" },
              ],
            },
          ]}
        />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
