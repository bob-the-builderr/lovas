-- Lovas widget + whiteboard migration
-- Run this in the Supabase SQL editor (Dashboard -> SQL -> New query)

-- 1. Widget content columns on the shared board.
ALTER TABLE public.boards
  ADD COLUMN IF NOT EXISTS message text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS accent_color text NOT NULL DEFAULT '#FF5A79',
  ADD COLUMN IF NOT EXISTS variant text NOT NULL DEFAULT 'heartTitle';

-- 2. Probe: does the schema carry the content columns?
CREATE OR REPLACE FUNCTION board_content_columns_exist()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'boards'
       AND column_name  = 'message'
  );
$$;

-- 3. Read the shared content (device-membership gated, typed UUID).
CREATE OR REPLACE FUNCTION get_board_content(
  p_board_id uuid,
  p_device_id uuid
)
RETURNS SETOF public.boards
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM public.boards b
      JOIN public.couple_members cm ON cm.couple_id = b.couple_id
     WHERE b.id = p_board_id AND cm.device_id = p_device_id
  ) THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM public.boards WHERE id = p_board_id;
END;
$$;

-- 4. Persist content & title edits from either partner (device-membership gated, typed UUID).
CREATE OR REPLACE FUNCTION update_board_content(
  p_board_id uuid,
  p_device_id uuid,
  p_message text,
  p_accent_color text,
  p_variant text,
  p_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_couple_id uuid;
BEGIN
  SELECT couple_id INTO v_couple_id FROM public.boards WHERE id = p_board_id;
  IF v_couple_id IS NULL THEN
    RAISE EXCEPTION 'board not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.couple_members WHERE couple_id = v_couple_id AND device_id = p_device_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.boards
     SET message = p_message,
         accent_color = p_accent_color,
         variant = p_variant,
         name = COALESCE(NULLIF(TRIM(p_name), ''), name),
         updated_at = now()
   WHERE id = p_board_id;
END;
$$;

-- 5. Disconnect a device from its couple, avoiding permanent lockouts.
CREATE OR REPLACE FUNCTION disconnect_device(p_device_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_couple_id uuid;
  v_remaining_members integer;
BEGIN
  SELECT couple_id INTO v_couple_id
  FROM public.couple_members
  WHERE device_id = p_device_id
  LIMIT 1;

  IF v_couple_id IS NOT NULL THEN
    DELETE FROM public.couple_members
    WHERE couple_id = v_couple_id AND device_id = p_device_id;

    SELECT COUNT(*) INTO v_remaining_members
    FROM public.couple_members
    WHERE couple_id = v_couple_id;

    IF v_remaining_members = 0 THEN
      DELETE FROM public.couples WHERE id = v_couple_id;
    END IF;
  END IF;
END;
$$;

-- 6. Expose the new functions to the anon key the app uses.
GRANT EXECUTE ON FUNCTION board_content_columns_exist() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_board_content(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_board_content(uuid, uuid, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION disconnect_device(uuid) TO anon, authenticated;

-- 7. Realtime publications
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.boards;
  EXCEPTION WHEN duplicate_object THEN
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.couple_members;
  EXCEPTION WHEN duplicate_object THEN
  END;
END;
$$;