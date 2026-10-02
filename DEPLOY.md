# Деплой в облако (бесплатно)

| Что | Где |
|---|---|
| API (FastAPI) | Render, Web Service (Free) — засыпает через 15 мин без запросов, просыпается ~1 мин |
| Фронтенд (React) | Render, Static Site (бесплатно, не засыпает) |
| База данных | Neon Postgres (Free, 1 ГБ, бессрочно) |
| Фото монет | Neon Object Storage (S3-совместимое, бета) |
| Почта | Brevo, через HTTP API (Render Free блокирует исходящий SMTP) |

Оба сервиса Render описаны в [`render.yaml`](render.yaml). После первой настройки каждый
`git push` в `main` обновляет сайт автоматически.

Секреты (строка подключения, ключи) никуда не коммитятся и не пересылаются: они вводятся
только в панели Render и в вашем терминале.

## 1. Neon: база и хранилище

Проект Neon должен быть в регионе **AWS Europe (Frankfurt) / eu-central-1** (хранилище файлов
пока есть только там и в us-east-2). Регион виден в консоли Neon в настройках проекта.

Из корня репозитория:

```bash
npm i -g neon@latest && neon login
neon link --project-id young-shadow-99126238 --branch production -y
neon buckets create coin-photos --access-level public_read
neon credentials create --scope storage:read --scope storage:write
```

Последняя команда один раз показывает `token_id` и `s3_secret_access_key` — сохраните их
(например, в менеджер паролей).

В консоли Neon:
- **Object storage** → **S3 endpoint** (уже вписан в `render.yaml` как `S3_ENDPOINT_URL`;
  если создадите новый проект или ветку — обновите его).
- **Connect** → выключите **Connection pooling** → скопируйте строку подключения
  (`postgresql://…?sslmode=require…`). Она подходит как есть.

## 2. Таблицы и справочники в базе Neon

Один раз, со своего компьютера (на бесплатном Render нет консоли):

```bash
DATABASE_URL='<строка подключения Neon>' make migrate
DATABASE_URL='<строка подключения Neon>' make seed
```

Дальше миграции применяются сами при каждом запуске API.

## 3. Brevo

В Brevo → **Senders** подтвердите отправителя `agaro.coins@gmail.com`.
Создайте API-ключ: **SMTP & API** → **API Keys** → **Generate a new API key**.

Почта уходит через HTTP API Brevo, а не SMTP: бесплатный Render блокирует исходящие
SMTP-порты (25, 465, 587). Brevo первые 30 дней запоминает IP, с которых приходят запросы,
потом блокирует новые; у Render адреса меняются — если письма перестанут уходить с ошибкой 401
про IP, в Brevo: **Settings → Security → Authorized IPs** → отключите блокировку для API
или добавьте исходящие IP Render (Frankfurt) из настроек сервиса.

## 4. Render

1. Закоммитьте и запушьте изменения в `main` на GitHub.
2. render.com → **New** → **Blueprint** → выберите репозиторий `coins-project`.
3. Render покажет два сервиса (`agaro-coins-api`, `agaro-coins`) и попросит значения:

   | Переменная | Откуда |
   |---|---|
   | `DATABASE_URL` | Neon → Connect (без pooling) |
   | `BREVO_API_KEY` | Brevo → SMTP & API → API Keys |
   | `S3_ACCESS_KEY_ID` | `token_id` из шага 1 |
   | `S3_SECRET_ACCESS_KEY` | `s3_secret_access_key` из шага 1 |

   Адрес хранилища (`S3_ENDPOINT_URL`) уже записан в `render.yaml`.

4. **Apply**. Первая сборка занимает несколько минут.

**Проверьте адреса.** Если имя было занято, Render добавит к нему суффикс
(`agaro-coins-x7k2.onrender.com`). Тогда исправьте в `render.yaml` `FRONTEND_URL`,
`CORS_ORIGINS` и `VITE_API_URL` на настоящие адреса и запушьте.

## 5. Первый вход и администратор

1. Откройте `https://agaro-coins-ojxm.onrender.com`, зарегистрируйтесь и подтвердите email.
2. Назначьте себя администратором:

   ```bash
   DATABASE_URL='<строка подключения Neon>' make admin email=agaro.coins@gmail.com
   ```

## 6. Капча (по желанию)

Сейчас стоят тестовые ключи Cloudflare: виджет виден, но пропускает всех. Для настоящей
проверки: dash.cloudflare.com → **Turnstile** → **Add widget**, hostname
`agaro-coins-ojxm.onrender.com`, режим Managed. Site key → `VITE_TURNSTILE_SITE_KEY`
(сервис `agaro-coins`), Secret key → `TURNSTILE_SECRET_KEY` (сервис `agaro-coins-api`),
плюс `TURNSTILE_HOSTNAME=agaro-coins-ojxm.onrender.com`.

## Особенности бесплатного тарифа

- Первый запрос после 15 минут простоя ждёт ~1 минуту, пока API проснётся.
- Письма из очереди уходят, пока API не спит.
- Neon Object Storage в бете. Запасной вариант — любое S3-совместимое хранилище
  (Supabase Storage, Cloudflare R2): поменять `S3_*` переменные, код не меняется.
