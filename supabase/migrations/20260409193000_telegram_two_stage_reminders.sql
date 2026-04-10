-- Двоетапні Telegram-нагадування клієнтам: за 24 години та за 2 години до запису.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS telegram_reminder_24h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS telegram_reminder_2h_sent_at timestamptz;

COMMENT ON COLUMN public.appointments.telegram_reminder_24h_sent_at IS 'Коли відправлено нагадування клієнту за 24 години (null = ще ні).';
COMMENT ON COLUMN public.appointments.telegram_reminder_2h_sent_at IS 'Коли відправлено нагадування клієнту за 2 години (null = ще ні).';
