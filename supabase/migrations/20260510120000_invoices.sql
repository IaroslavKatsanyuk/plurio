-- Рахунки-фактури (інвойси) власника: позиції в JSON, номер за порядком для user_id.

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  number integer NOT NULL,
  client_name text NOT NULL,
  client_email text,
  client_phone text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'issued', 'paid', 'void')),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric(14, 2) NOT NULL DEFAULT 0,
  notes text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoices_total_non_negative CHECK (total >= 0),
  CONSTRAINT invoices_number_positive CHECK (number > 0),
  CONSTRAINT invoices_user_number_unique UNIQUE (user_id, number)
);

CREATE INDEX invoices_user_id_created_at_idx ON public.invoices (user_id, created_at DESC);

CREATE TRIGGER invoices_set_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select_own"
  ON public.invoices FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "invoices_insert_own"
  ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "invoices_update_own"
  ON public.invoices FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "invoices_delete_own"
  ON public.invoices FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
