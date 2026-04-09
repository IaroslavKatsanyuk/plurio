-- Публічне бронювання: унікальний slug у профілі (URL /u/[username]).
-- Значення зберігається в нижньому регістрі; порожні рядки перетворюються на NULL.

CREATE OR REPLACE FUNCTION public.profiles_normalize_booking_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.booking_slug IS NOT NULL THEN
    NEW.booking_slug := NULLIF(BTRIM(NEW.booking_slug), '');
    IF NEW.booking_slug IS NOT NULL THEN
      NEW.booking_slug := lower(NEW.booking_slug);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS booking_slug text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_booking_slug_key
  ON public.profiles (booking_slug)
  WHERE booking_slug IS NOT NULL;

DROP TRIGGER IF EXISTS profiles_normalize_booking_slug ON public.profiles;
CREATE TRIGGER profiles_normalize_booking_slug
  BEFORE INSERT OR UPDATE OF booking_slug ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.profiles_normalize_booking_slug();
