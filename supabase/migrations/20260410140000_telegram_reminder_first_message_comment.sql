-- Перший Telegram по запису: одразу після створення (перший тик cron), не "за 24 год".
COMMENT ON COLUMN public.appointments.telegram_reminder_24h_sent_at IS
  'Коли відправлено перше Telegram-повідомлення про запис (підтвердження; null = ще ні).';
