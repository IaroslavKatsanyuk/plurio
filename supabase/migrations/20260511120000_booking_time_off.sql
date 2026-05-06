-- Додаткові неробочі періоди (відпустка тощо): календарні дні у графіку майстра; бронювання на ці дні заборонено.

CREATE TABLE public.booking_time_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_time_off_range_ok CHECK (end_date >= start_date)
);

CREATE INDEX booking_time_off_user_dates_idx ON public.booking_time_off (user_id, start_date DESC);

CREATE TRIGGER booking_time_off_set_updated_at
  BEFORE UPDATE ON public.booking_time_off
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.booking_time_off ENABLE ROW LEVEL SECURITY;

CREATE POLICY "booking_time_off_select_own"
  ON public.booking_time_off FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "booking_time_off_insert_own"
  ON public.booking_time_off FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "booking_time_off_update_own"
  ON public.booking_time_off FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "booking_time_off_delete_own"
  ON public.booking_time_off FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_time_off TO authenticated;

COMMENT ON TABLE public.booking_time_off IS 'Неробочі дні/діапазони власника; дати inclusive у календарі booking_timezone.';
