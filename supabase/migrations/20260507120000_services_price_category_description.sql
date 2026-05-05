-- Розширення каталогу послуг: ціна, категорія, опис (MVP CRM).

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS price numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_price_non_negative;
ALTER TABLE public.services
  ADD CONSTRAINT services_price_non_negative CHECK (price >= 0);
