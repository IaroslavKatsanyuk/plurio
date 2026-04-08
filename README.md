# Plurio

SaaS для малого бізнесу — розклад, клієнти, нагадування (Next.js App Router + Supabase).

## Supabase

1. Створи проєкт у [Supabase Dashboard](https://supabase.com/dashboard) (новий проєкт → дочекайся готовності бази).
2. Відкрий **Project Settings → API** і скопіюй **Project URL** та ключ **anon public**.
3. У корені проєкту задай змінні в **`.env`** або **`.env.local`**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, за потреби `NEXT_PUBLIC_SITE_URL` (див. пункт 5). Next.js підхоплює обидва файли (`.env.local` має пріоритет, якщо змінна є в обох).

4. Клієнти Supabase лежать у `lib/supabase/` (browser, server, middleware). Для доступу до даних у застосунку надавай перевагу **service layer**, а не сирий `supabase.from()` у компонентах (див. `.cursor/rules/`).
5. **Auth (логін / реєстрація / callback):** у **Authentication → URL Configuration** додай **Site URL** (наприклад `http://localhost:3000`) і **Redirect URLs** з `http://localhost:3000/auth/callback` (плюс продакшен-URL після деплою). У `.env` або `.env.local` за бажанням задай `NEXT_PUBLIC_SITE_URL` — для лінків у листах підтвердження email.

### Міграції схеми (CLI)

У репозиторії: `supabase/migrations/` — SQL-версійність таблиць і RLS. Щоб застосувати зміни до **хмарного** проєкту:

1. Встанови [Supabase CLI](https://supabase.com/docs/guides/cli) (або використовуй `npx supabase`).
2. Увійди: `npx supabase login`.
3. Прив’яжи проєкт: `npx supabase link --project-ref <REF>` (REF — піддомен у `https://<REF>.supabase.co`).
4. Накоти міграції: `npx supabase db push`.

Локально повний стек: `npx supabase start` (потрібен Docker) — опційно для розробки без хмари.

## Запуск

Запусти сервер розробки:

```bash
npm run dev
```

Відкрий [http://localhost:3000](http://localhost:3000) у браузері.

Редагуй `app/page.tsx` — сторінка оновлюється під час збереження.

Проєкт використовує [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) для шрифту [Geist](https://vercel.com/font).

## Документація Next.js

- [Документація Next.js](https://nextjs.org/docs)
- [Навчання Next.js](https://nextjs.org/learn)

## Деплой

Зручний варіант — [Vercel](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme). Деталі: [деплой Next.js](https://nextjs.org/docs/app/building-your-application/deploying).
