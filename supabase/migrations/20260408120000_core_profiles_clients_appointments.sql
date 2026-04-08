-- Фундамент Plurio: profiles, clients, appointments + user_id + RLS + базові політики.
-- Політики: лише рядки з user_id = auth.uid() для ролі authenticated.

-- ---------------------------------------------------------------------------
-- Допоміжні функції
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Перевірка: client_id у записі належить тому ж user_id (обхід підміни чужого UUID).
CREATE OR REPLACE FUNCTION public.enforce_appointment_client_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = NEW.client_id
        AND c.user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'appointments.client_id must reference a client owned by the same user';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Таблиці
-- ---------------------------------------------------------------------------

CREATE TABLE public.profiles (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX clients_user_id_idx ON public.clients (user_id);

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  title text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'confirmed', 'cancelled', 'completed')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointments_valid_range CHECK (ends_at > starts_at)
);

CREATE INDEX appointments_user_id_idx ON public.appointments (user_id);
CREATE INDEX appointments_client_id_idx ON public.appointments (client_id);

-- ---------------------------------------------------------------------------
-- Тригери
-- ---------------------------------------------------------------------------

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER clients_set_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER appointments_set_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER appointments_enforce_client_owner
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE PROCEDURE public.enforce_appointment_client_owner();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- profiles: один рядок на користувача, доступ лише до власного user_id
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_delete_own"
  ON public.profiles FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- clients
CREATE POLICY "clients_select_own"
  ON public.clients FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "clients_insert_own"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "clients_update_own"
  ON public.clients FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "clients_delete_own"
  ON public.clients FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- appointments
CREATE POLICY "appointments_select_own"
  ON public.appointments FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "appointments_insert_own"
  ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "appointments_update_own"
  ON public.appointments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "appointments_delete_own"
  ON public.appointments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Права для PostgREST / supabase-js (authenticated + RLS)
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
