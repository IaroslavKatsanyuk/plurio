-- Графік прийому для бронювання (Telegram, майбутні публічні слоти) і валідація записів у дашборді.
-- work_weekly_schedule = null → легасі: щодня 08:00–21:00 у booking_timezone (як раніше у боті за Києвом).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS booking_timezone text NOT NULL DEFAULT 'Europe/Kyiv';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS work_weekly_schedule jsonb;

COMMENT ON COLUMN public.profiles.booking_timezone IS 'IANA timezone для календаря слотів і перевірки робочих годин.';
COMMENT ON COLUMN public.profiles.work_weekly_schedule IS 'Тижневий графік: { mon..sun: [{ start, end }] }; порожній масив = вихідний; null = легасі 08–21 щодня.';
