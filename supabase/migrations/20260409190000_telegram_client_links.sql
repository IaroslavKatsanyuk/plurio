-- Telegram-нагадування клієнтам: прив'язка chat_id через персональний deep link.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS telegram_chat_id bigint,
  ADD COLUMN IF NOT EXISTS telegram_link_token text;

CREATE UNIQUE INDEX IF NOT EXISTS clients_telegram_link_token_key
  ON public.clients (telegram_link_token)
  WHERE telegram_link_token IS NOT NULL;

COMMENT ON COLUMN public.clients.telegram_chat_id IS 'Telegram chat id клієнта (після /start з персональним токеном).';
COMMENT ON COLUMN public.clients.telegram_link_token IS 'Одноразовий токен для deep link t.me/bot?start= для клієнта.';
