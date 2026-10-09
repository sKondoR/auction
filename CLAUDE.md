# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

C2C-площадка торгов предметами коллекционирования (pnpm-монорепо, TypeScript, Node 22+). Спецификация — [docs/PRD.md](docs/PRD.md), термины предметной области — [CONTEXT.md](CONTEXT.md) (используй их и избегай слов из `_Avoid_`), решения — [docs/adr/](docs/adr/), дизайн-система — [DESIGN.md](DESIGN.md), продукт и аудитория — [PRODUCT.md](PRODUCT.md). Реализован этап 1: фиксированная цена и английский аукцион; голландский и живой аукционы пока есть только в схеме БД.

## Команды

```bash
docker compose up -d          # PostgreSQL :5433 (не 5432!), Redis :6379, MinIO :9000/:9001, Mailpit :8025
pnpm db:migrate && pnpm db:seed
pnpm dev                      # web (http://localhost:3000) + worker; dev:web / dev:worker — по отдельности
pnpm typecheck                # tsc во всех пакетах
pnpm test                     # все тесты
pnpm --filter @auction/domain test                          # unit-тесты правил
pnpm --filter @auction/services test                        # интеграционные, нужен docker compose
pnpm --filter @auction/domain exec vitest run src/rules.test.ts -t "<имя теста>"   # один тест
pnpm db:generate              # новая миграция drizzle-kit после правки packages/db/src/schema
pnpm --filter @auction/web build
pnpm --filter @auction/web build:pages   # статическое демо для GitHub Pages → apps/web/out (ADR 0009); DEMO_BASE_PATH=/auction
```

- Линтера в проекте нет; проверка — `pnpm typecheck`.
- Windows: если `pnpm install` падает с `EPERM … symlink`, используй `npx pnpm@10.28.1 install`.
- Web запускается через `next dev --webpack`: Turbopack на Windows падает на junction-ссылках. При ошибке `failed to create junction point` удали `apps/web/.next`.
- Вход по телефону; SMS-код печатается в консоли `pnpm dev`. Тестовые телефоны из сида: админ `+7 999 000-00-01`, модератор `…-02`, оценщик `…-03`, продавец с демо-лотами `+7 999 111-11-11`, покупатель `+7 999 222-22-22`. Письма — в Mailpit (http://localhost:8025).
- Интеграционные тесты `services` сами создают базу `auction_test`, накатывают миграции и очищают таблицы ([packages/services/test/setup-db.ts](packages/services/test/setup-db.ts)). Новую таблицу добавь в `truncate` там же.

## Архитектура

Пакеты зависят только вниз: `apps/web`, `apps/worker` → `packages/services` → `packages/db` → `packages/domain`. Пакеты экспортируют исходники `.ts` напрямую, без сборки.

- **`packages/domain`** — правила торгов как чистые функции без фреймворков и БД (ADR 0004): сетка шагов, автоставки, продление, блиц, статусы сделки, комиссия, маскировка контактов, лимиты новичков, роли и права (`hasPermission`). Ошибки — `DomainError` с кодом. **Все суммы — целые копейки** (`Kopecks`, `rub()`, `formatRub()`).
- **`packages/db`** — схема Drizzle (`casing: snake_case`), миграции в `packages/db/migrations`, сид. Схема рассчитана сразу на все четыре формата торгов. Поиск — полнотекстовый PostgreSQL с русской морфологией (ADR 0005).
- **`packages/services`** — серверные сценарии, общие для web и worker (ADR 0008): применяют правила `domain` в транзакциях. Ставки идут с блокировкой строки лота (`SELECT … FOR UPDATE`). `placeBid` (web) и `finalizeLot` (worker) создают сделку через один и тот же `createDeal`. Ошибки бросаются через `fail`/`notFound`/`forbidden`, `userMessage()` превращает их в текст для формы. `infra/` — Redis pub/sub, S3 (MinIO, фото сжимаются в WebP через sharp), SMTP, SMS (`SMS_PROVIDER=console|smsru`).
- **Состояние торгов вычисляется из времени** (ADR 0003): открыт ли лот, определяется по сохранённым моментам и правилам `domain`, а не по статусу из фоновой задачи. Поэтому ставка после окончания отклоняется, даже если финализации ещё не было. Продление меняет `endsAt` в той же транзакции, что и ставка. Финализация обязана быть идемпотентной.
- **`apps/worker`** — BullMQ, очередь `auction`, часовой пояс Europe/Moscow. Точные отложенные задачи `finalize-lot` (jobId включает `endsAt`, поэтому при продлении появляется новая задача, а старая отрабатывает вхолостую) + периодический `sweep`. Также напоминания, счета 1-го числа, просрочки, сохранённые поиски и отправка email из outbox: уведомления пишутся в БД в той же транзакции, письма шлёт worker.
- **Real-time** (ADR 0006): сервисы публикуют `LotEvent`/`UserEvent` в Redis-каналы `lot:{id}` / `user:{id}`. Route handlers `app/api/lots/[id]/events` и `app/api/me/events` отдают их как SSE ([apps/web/src/shared/api/sse.ts](apps/web/src/shared/api/sse.ts)). На клиенте их читает, например, `entities/lot/model/use-lot-live.ts`.
- **Auth** — Better Auth с входом по телефону и OTP (ADR 0007), [apps/web/src/shared/api/auth.ts](apps/web/src/shared/api/auth.ts), `getViewer()` в `shared/api/session.ts`.

### apps/web — Feature-Sliced Design

Next.js 16 + React 19 + Tailwind 4. Это новая версия Next.js с ломающими изменениями: перед правками читай гайды в `apps/web/node_modules/next/dist/docs/` (см. [apps/web/AGENTS.md](apps/web/AGENTS.md)).

Слои `src/`: `app` (только тонкие обёртки маршрутов) → `views` (страницы; не `pages`, чтобы не конфликтовать с pages router) → `widgets` → `features` → `entities` → `shared`.
- Импорты идут только вниз; соседние слайсы одного слоя друг друга не импортируют. Общие компоненты без бизнес-логики кладутся в `shared/ui`.
- Публичный API слайса: `index.ts` — UI, безопасный для клиента; `server.ts` — серверные запросы (`import "server-only"`). Запросы к БД — в `entities/*/api/queries.ts`.
- Server actions — в `features/*/api/actions.ts`, обёрнуты в `authed(fn, { permission })` из `shared/api/action.ts`. Обёртка проверяет вход и права, возвращает `ActionResult` и переводит доменные ошибки в сообщение. На клиенте их вызывает `shared/ui/action-form.tsx`.
- Админка `/admin` разграничена по ролям через `hasPermission` из `domain`.
- Фото лотов в списках и карточках должны оставаться крупными; компактности добиваются за счёт остальных элементов.

### Статическое демо (GitHub Pages)

Тот же web собирается в статический сайт на встроенной PGlite с демо-данными; подмены модулей — только в демо-сборке (ADR 0009, [apps/web/demo/](apps/web/demo/)). Чтобы её не сломать:
- Server Actions — только в `features/*/api/actions.ts` с `"use server"` в первой строке: в демо их заменяет заглушка.
- У динамического маршрута — `export const generateStaticParams = () => demoStaticParams(...)` из `shared/api`.
- `searchParams` читай через `readSearchParams()` из `shared/lib`.
- Клиентский код, который ходит на сервер (SSE, `fetch` к `/api`, Better Auth), выключай по `IS_DEMO` из `shared/config`.
- Новые сущности в демо-данные добавляй в [packages/db/src/demo-seed.ts](packages/db/src/demo-seed.ts). Проверка — `build:pages`.

## Дизайн-концепты (скилл frontend-design)

Если скилл `frontend-design` используется без правок в коде приложения, то есть результат — отдельный артефакт-концепт, сохраняй его в папку `frontend-ideas/xx/`:

- `xx` — следующий свободный двузначный номер: `01`, `02`, `03`… Перед созданием посмотри, какие номера уже заняты.
- В папке создай `README.md`. В нём должны быть заголовок с названием концепта, ссылка на опубликованный артефакт и текст, которым концепт был представлен: что сделано, как устроено, какие допущения.
- Относительные ссылки в `README.md` пиши от этой папки, например `../../apps/web/...`.
- Сразу после `<title>` каждой HTML-страницы концепта подключай общий переключатель: `<script src="../switcher.js" defer></script>`. Новый концепт и все его страницы добавь в список `CONCEPTS` в [frontend-ideas/switcher.js](frontend-ideas/switcher.js).
- Концепты публикуются на GitHub Pages по адресу `<base>/design/` (https://skondor.github.io/auction/design/): workflow копирует папки `NN/`, `switcher.js` и `index.html`. Поэтому файлы концепта (картинки и т. п.) держи внутри его папки, а не в `frontend-ideas/images` или `_task`.

Если скилл применяется для правки кода в `apps/web`, папка `frontend-ideas` не нужна: результат — сами изменения в коде.
