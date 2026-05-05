-- Витрати власника (фінанси).

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  amount numeric(14, 2) NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'інше',
  notes text,
  occurred_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expenses_amount_non_negative CHECK (amount >= 0)
);

CREATE INDEX expenses_user_id_occurred_on_idx ON public.expenses (user_id, occurred_on DESC);

CREATE TRIGGER expenses_set_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_select_own"
  ON public.expenses FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "expenses_insert_own"
  ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "expenses_update_own"
  ON public.expenses FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "expenses_delete_own"
  ON public.expenses FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
