-- Telegram-нагадування власнику: chat_id після /start у боті; idempotent поле на записі.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id bigint,
  ADD COLUMN IF NOT EXISTS telegram_link_token text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_telegram_link_token_key
  ON public.profiles (telegram_link_token)
  WHERE telegram_link_token IS NOT NULL;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS telegram_reminder_sent_at timestamptz;

COMMENT ON COLUMN public.profiles.telegram_chat_id IS 'Telegram chat id власника (отримується через бота).';
COMMENT ON COLUMN public.profiles.telegram_link_token IS 'Одноразовий токен для deep link t.me/bot?start=';
COMMENT ON COLUMN public.appointments.telegram_reminder_sent_at IS 'Коли вже відправлено Telegram-нагадування (null = ще ні).';
