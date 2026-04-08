# Plurio

SaaS для малого бізнесу — розклад, клієнти, нагадування (Next.js App Router + Supabase).

## Supabase

1. Створи проєкт у [Supabase Dashboard](https://supabase.com/dashboard) (новий проєкт → дочекайся готовності бази).
2. Відкрий **Project Settings → API** і скопіюй **Project URL** та ключ **anon public**.
3. Скопіюй шаблон змінних оточення й заповни значення:

```bash
cp .env.example .env.local
```

4. Клієнти Supabase лежать у `lib/supabase/` (browser, server, middleware). Для доступу до даних у застосунку надавай перевагу **service layer**, а не сирий `supabase.from()` у компонентах (див. `.cursor/rules/`).

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
