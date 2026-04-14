-- Події для власника (наприклад запис через Telegram): лічильник «дзвіночка» у дашборді.

CREATE TABLE public.owner_inbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'telegram_booking',
  appointment_id uuid REFERENCES public.appointments (id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX owner_inbox_events_user_id_created_idx
  ON public.owner_inbox_events (user_id, created_at DESC);

CREATE INDEX owner_inbox_events_user_unread_idx
  ON public.owner_inbox_events (user_id)
  WHERE read_at IS NULL;

COMMENT ON TABLE public.owner_inbox_events IS 'Події для власника (непрочитані — бейдж у дашборді).';
COMMENT ON COLUMN public.owner_inbox_events.read_at IS 'Коли власник переглянув (null = непрочитано).';

ALTER TABLE public.owner_inbox_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_inbox_events_select_own"
  ON public.owner_inbox_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "owner_inbox_events_update_own"
  ON public.owner_inbox_events FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
