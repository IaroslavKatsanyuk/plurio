-- Каталог послуг: тривалість послуги у хвилинах + зв'язок із записами.

CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX services_user_id_idx ON public.services (user_id);

ALTER TABLE public.appointments
  ADD COLUMN service_id uuid REFERENCES public.services (id) ON DELETE SET NULL;

CREATE INDEX appointments_service_id_idx ON public.appointments (service_id);

CREATE OR REPLACE FUNCTION public.enforce_appointment_service_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.service_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.services s
      WHERE s.id = NEW.service_id
        AND s.user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'appointments.service_id must reference a service owned by the same user';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER services_set_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER appointments_enforce_service_owner
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE PROCEDURE public.enforce_appointment_service_owner();

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_select_own"
  ON public.services FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "services_insert_own"
  ON public.services FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "services_update_own"
  ON public.services FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "services_delete_own"
  ON public.services FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
