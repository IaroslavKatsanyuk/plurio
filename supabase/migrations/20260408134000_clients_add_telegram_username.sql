-- Додає telegram_username у clients для пошуку та сортування.

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS telegram_username text;

CREATE INDEX IF NOT EXISTS clients_telegram_username_idx
  ON public.clients (telegram_username);
