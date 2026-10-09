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

## Демо на GitHub Pages

Статическая версия сайта без сервера собирается workflow [.github/workflows/pages.yml](.github/workflows/pages.yml): при пуше в `main`, вручную и раз в сутки. Раз в сутки — потому что сроки торгов отсчитываются от момента сборки. В настройках репозитория нужно выбрать **Settings → Pages → Source: GitHub Actions**.

Как устроено (`DEMO=1` в [apps/web/next.config.ts](apps/web/next.config.ts)):

- `output: "export"`: страницы рендерятся при сборке настоящими запросами, но вместо PostgreSQL — PGlite (Postgres в WASM). Дамп собирает [packages/db/src/demo-dump.ts](packages/db/src/demo-dump.ts): миграции, сид и демо-данные из [demo-seed.ts](packages/db/src/demo-seed.ts).
- Сайт показан от лица демо-пользователя «Нумизмат Пётр» с правами администратора: видны кабинеты покупателя и продавца и админка.
- Server Actions заменены заглушками ([apps/web/demo/](apps/web/demo/)). Формы отвечают, что в демо действие недоступно. Вход, загрузка фото и SSE отключены.
- Параметры запроса при сборке недоступны, поэтому вкладки и фильтры (`?tab=`, поиск) показывают вариант по умолчанию.
- Фото лотов — [apps/web/demo/photos/](apps/web/demo/photos/), лицензии там же.

Собрать локально (результат в `apps/web/out`):

```bash
DEMO_BASE_PATH=/auction pnpm --filter @auction/web build:pages
```
