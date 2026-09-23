import { lots } from "@auction/db";
import { lotCards, openNow } from "@auction/services";
import { and, asc, desc, eq } from "drizzle-orm";
import { ArrowRight, Gavel, HandCoins, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getCategoryTree } from "@/entities/category/server";
import { LotGrid } from "@/entities/lot";
import { getDb } from "@/shared/api";
import { ButtonLink } from "@/shared/ui";

function Section({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-2xl font-semibold">{title}</h2>
        <Link href={href} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          Все <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {children}
    </section>
  );
}

export async function HomePage() {
  const db = getDb();
  const [endingSoon, newest, fixed, tree] = await Promise.all([
    lotCards(db, and(openNow(), eq(lots.format, "english")), [asc(lots.endsAt)], 10),
    lotCards(db, openNow(), [desc(lots.createdAt)], 10),
    lotCards(db, and(openNow(), eq(lots.format, "fixed")), [desc(lots.createdAt)], 5),
    getCategoryTree(),
  ]);

  return (
    <div>
      <section className="relative overflow-hidden rounded-xl border bg-[#2a1d17] px-6 py-10 text-[#f8efe2] sm:px-10 sm:py-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{ backgroundImage: "radial-gradient(circle at 85% 20%, #b08d57 0, transparent 45%), radial-gradient(circle at 10% 90%, #7a2a1d 0, transparent 40%)" }}
        />
        <div className="relative max-w-2xl">
          <p className="text-sm uppercase tracking-[0.2em] text-[#d8bf8f]">Нумизматика · Бонистика · Антиквариат</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">Торги для коллекционеров</h1>
          <p className="mt-4 text-[#e6d9c6]">
            Аукционы с автоставками и продажа по фиксированной цене. Размещение бесплатно, комиссия — 1% с продажи.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/search" size="lg" className="bg-[#b08d57] text-[#1f1a17] hover:bg-[#c7a46b]">
              Смотреть лоты
            </ButtonLink>
            <ButtonLink href="/lots/new" size="lg" variant="outline" className="border-[#6b5747] bg-transparent text-[#f8efe2] hover:bg-white/10">
              Выставить предмет
            </ButtonLink>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          [Gavel, "Английский аукцион", "Автоставки, шаг по сетке, продление при ставке в последние минуты."],
          [ShieldCheck, "Проверенные участники", "Вход по телефону, рейтинг и отзывы по каждой сделке."],
          [HandCoins, "Продать площадке", "Предложите предмет на выкуп — оценщик назовёт цену."],
        ].map(([Icon, t, d]) => {
          const I = Icon as typeof Gavel;
          return (
            <div key={t as string} className="flex gap-3 rounded-lg border bg-surface p-4">
              <I className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div>
                <p className="font-medium">{t as string}</p>
                <p className="text-sm text-muted-foreground">{d as string}</p>
              </div>
            </div>
          );
        })}
      </div>

      {endingSoon.length > 0 && (
        <Section title="Скоро завершатся" href="/search?format=english&sort=ending">
          <LotGrid lots={endingSoon} />
        </Section>
      )}
      <Section title="Новые лоты" href="/search?sort=newest">
        <LotGrid lots={newest} />
      </Section>
      {fixed.length > 0 && (
        <Section title="Купить сейчас" href="/search?format=fixed">
          <LotGrid lots={fixed} />
        </Section>
      )}

      <section className="mt-10">
        <h2 className="mb-4 text-2xl font-semibold">Категории</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tree.map((c) => (
            <div key={c.id} className="rounded-lg border bg-surface p-4">
              <Link href={`/search?category=${c.id}`} className="font-serif text-lg hover:text-primary">
                {c.name}
              </Link>
              {c.children.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {c.children.map((ch) => (
                    <li key={ch.id}>
                      <Link href={`/search?category=${ch.id}`} className="hover:text-foreground">
                        {ch.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
