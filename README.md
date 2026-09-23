# auction

C2C-площадка торгов предметами коллекционирования и антиквариата. Спецификация — [docs/PRD.md](docs/PRD.md), термины — [CONTEXT.md](CONTEXT.md), решения — [docs/adr/](docs/adr/).

Реализован **этап 1**: фиксированная цена и английский аукцион (автоставки, продление торгов, блиц-цена, отмена ставок продавцом), предложения цены, вопросы под лотом, беседы, сделки и отзывы, комиссия с книгой начислений и ежемесячными счетами, поиск с русской морфологией и фильтрами по атрибутам, страница продавца и подписки, сохранённые поиски, рекомендации, «Продать площадке», админка с ролями, уведомления на сайте (real-time через SSE) и по email.

## Структура

```
apps/web          Next.js 16 — сайт, /admin, API, SSE (Feature-Sliced Design)
apps/worker       BullMQ — финализация торгов, напоминания, счета, сохранённые поиски, email
packages/domain   правила торгов на чистом TS + unit-тесты
packages/db       схема Drizzle, миграции, сид
packages/services серверные сценарии поверх domain + db + интеграционные тесты
```

`apps/web/src`: `app` (маршруты) → `views` → `widgets` → `features` → `entities` → `shared`.

## Локальный запуск

Нужны Node 22+, pnpm 10 и Docker.

```bash
cp .env.example .env
pnpm install
docker compose up -d        # PostgreSQL :5433, Redis :6379, MinIO :9000 (консоль :9001), Mailpit :8025
pnpm db:migrate
pnpm db:seed                # категории, настройки, сотрудники и демо-лоты
pnpm dev                    # web на http://localhost:3000 + worker
```

> **Windows без режима разработчика.** Если `pnpm install` падает с `EPERM … symlink`, запускайте pnpm через Node: `npx pnpm@10.28.1 install` (автономный pnpm.exe собран со старым Node и не создаёт junction-ссылки).

> **Почему `next dev --webpack`.** Turbopack на Windows создаёт в `apps/web/.next` junction-ссылки на серверные пакеты (ioredis, sharp, postgres) и может падать с `failed to create junction point … Access is denied`. Webpack этого не делает. Если ошибка всё же появилась — удалите `apps/web/.next`.

Вход — по телефону, SMS-код печатается в консоли `pnpm dev`. Тестовые номера из сида:

| Роль | Телефон |
|---|---|
| Администратор | +7 999 000-00-01 |
| Модератор | +7 999 000-00-02 |
| Оценщик | +7 999 000-00-03 |
| Продавец (демо-лоты) | +7 999 111-11-11 |
| Покупатель | +7 999 222-22-22 |

Письма смотрите в Mailpit: http://localhost:8025 (приходят, если в настройках профиля указан email).

## Тесты

```bash
pnpm --filter @auction/domain test     # правила торгов (unit)
pnpm --filter @auction/services test   # сценарии на базе auction_test (нужен docker compose)
pnpm typecheck
```
