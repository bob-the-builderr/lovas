-- Lovas — anonymous couples whiteboard & shared widget
-- Run this in the Supabase SQL editor to bootstrap the database.
--
-- Design notes:
--  * There is NO auth. Each device is an anonymous row in `devices`.
--  * Devices pair through `couples.pair_code` (WORD-NNNN, e.g. BLUE-4829).
--  * A couple holds exactly two devices (the creator + one partner).
--  * A device can belong to at most one couple.
--  * A couple owns exactly one shared `boards` row.
--  * Strokes are appended in realtime; clients subscribe to INSERT/DELETE via
--    Supabase Realtime and render them as they stream in.
--  * Widget card content (message, accent_color, variant) syncs in realtime on the board.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- devices
-- ---------------------------------------------------------------------------
create table if not exists public.devices (
  id uuid primary key,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- couples
-- ---------------------------------------------------------------------------
create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  pair_code text not null unique,
  created_by uuid not null references public.devices(id),
  created_at timestamptz not null default now()
);

create index if not exists couples_pair_code_idx on public.couples(pair_code);

-- ---------------------------------------------------------------------------
-- couple_members — who is part of a couple
-- ---------------------------------------------------------------------------
create table if not exists public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (couple_id, device_id)
);

-- ---------------------------------------------------------------------------
-- boards — one shared whiteboard / widget per couple
-- ---------------------------------------------------------------------------
create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade unique,
  name text not null default 'Our First Board ❤️',
  message text not null default '',
  accent_color text not null default '#FF5A79',
  variant text not null default 'heartTitle',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- strokes — every pen stroke on a board
-- ---------------------------------------------------------------------------
create table if not exists public.strokes (
  id uuid primary key,
  board_id uuid not null references public.boards(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  points jsonb not null,
  color text not null default '#FF5A79',
  stroke_width float not null default 3,
  tool text not null default 'pen',
  sequence bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists strokes_board_seq_idx on public.strokes(board_id, sequence);
create index if not exists strokes_board_created_idx on public.strokes(board_id, created_at);
create index if not exists strokes_board_id_idx on public.strokes(board_id);

-- ---------------------------------------------------------------------------
-- Realtime — broadcast changes to members
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.strokes;
alter publication supabase_realtime add table public.boards;
alter publication supabase_realtime add table public.couple_members;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.devices enable row level security;
alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.boards enable row level security;
alter table public.strokes enable row level security;

create policy "devices_read_all" on public.devices for select to anon using (true);
create policy "devices_insert_self" on public.devices for insert to anon with check (true);

-- couples are discoverable by pair code (join flow)
create policy "couples_read_all" on public.couples for select to anon using (true);
create policy "couples_insert_self" on public.couples for insert to anon with check (true);
create policy "couples_update_member" on public.couples for update to anon using (true) with check (true);

create policy "members_read_all" on public.couple_members for select to anon using (true);
create policy "members_insert_self" on public.couple_members for insert to anon with check (true);
create policy "members_delete_self" on public.couple_members for delete to anon using (true);

create policy "boards_read_member" on public.boards for select to anon using (true);
create policy "boards_insert_self" on public.boards for insert to anon with check (true);
create policy "boards_update_member" on public.boards for update to anon using (true) with check (true);

create policy "strokes_read_member" on public.strokes for select to anon using (true);
create policy "strokes_insert_member" on public.strokes for insert to anon with check (true);
create policy "strokes_delete_self" on public.strokes for delete to anon using (true);

-- ---------------------------------------------------------------------------
-- Sequence helpers — monotonic per-board stroke ordering across devices
-- ---------------------------------------------------------------------------
create table if not exists public.board_counters (
  board_id uuid primary key references public.boards(id) on delete cascade,
  last_value bigint not null default 0
);

alter table public.board_counters enable row level security;
create policy "counters_rw" on public.board_counters for all to anon using (true) with check (true);

create or replace function public.next_sequence(p_board_id uuid)
returns bigint
language plpgsql
security definer
as $$
declare
  v_next bigint;
begin
  insert into public.board_counters (board_id, last_value)
  values (p_board_id, 1)
  on conflict (board_id)
  do update set last_value = public.board_counters.last_value + 1
  returning public.board_counters.last_value into v_next;

  return v_next;
end;
$$;

-- ---------------------------------------------------------------------------
-- Pairing & Device management
-- ---------------------------------------------------------------------------
create or replace function public.register_device(p_device_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.devices (id)
  values (p_device_id)
  on conflict (id) do nothing;
end;
$$;

create or replace function public.create_couple(
  p_created_by uuid,
  p_pair_code text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_couple uuid;
  v_board uuid;
begin
  perform public.register_device(p_created_by);

  -- Clean up any prior pairing for this device so users never get locked out
  perform public.disconnect_device(p_created_by);

  insert into public.couples (pair_code, created_by)
  values (upper(p_pair_code), p_created_by)
  returning id into v_couple;

  insert into public.couple_members (couple_id, device_id)
  values (v_couple, p_created_by);

  insert into public.boards (couple_id)
  values (v_couple)
  returning id into v_board;

  return v_couple;
end;
$$;

create or replace function public.join_couple(
  p_device_id uuid,
  p_pair_code text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_couple uuid;
  v_member_count integer;
begin
  perform public.register_device(p_device_id);

  -- Look up couple with row lock to serialize concurrent joins
  select id into v_couple
  from public.couples
  where pair_code = upper(p_pair_code)
  limit 1
  for update;

  if v_couple is null then
    raise exception 'Couple not found for that code';
  end if;

  -- If this device is already a member of this couple, return it safely
  if exists (
    select 1 from public.couple_members
    where couple_id = v_couple and device_id = p_device_id
  ) then
    return v_couple;
  end if;

  -- Clean up any prior pairing for this device from a different couple
  perform public.disconnect_device(p_device_id);

  -- A couple holds exactly two devices: the creator plus one partner.
  select count(*) into v_member_count
  from public.couple_members
  where couple_id = v_couple;

  if v_member_count >= 2 then
    raise exception 'This couple is already complete.';
  end if;

  insert into public.couple_members (couple_id, device_id)
  values (v_couple, p_device_id);

  return v_couple;
end;
$$;

-- Disconnect a device from its couple, avoiding permanent lockouts.
create or replace function public.disconnect_device(p_device_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_couple_id uuid;
  v_remaining_members integer;
begin
  select couple_id into v_couple_id
  from public.couple_members
  where device_id = p_device_id
  limit 1;

  if v_couple_id is not null then
    delete from public.couple_members
    where couple_id = v_couple_id and device_id = p_device_id;

    select count(*) into v_remaining_members
    from public.couple_members
    where couple_id = v_couple_id;

    -- If no members remain, cascade remove the empty couple
    if v_remaining_members = 0 then
      delete from public.couples where id = v_couple_id;
    end if;
  end if;
end;
$$;

create or replace function public.get_board_id(p_couple_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_board uuid;
begin
  select id into v_board from public.boards where couple_id = p_couple_id limit 1;
  return v_board;
end;
$$;

create or replace function public.get_boards(p_couple_id uuid)
returns setof public.boards
language plpgsql
security definer
as $$
begin
  return query
    select * from public.boards
    where couple_id = p_couple_id
    order by created_at asc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Whiteboard Strokes RPCs
-- ---------------------------------------------------------------------------
create or replace function public.get_strokes(p_board_id uuid)
returns setof public.strokes
language plpgsql
security definer
as $$
begin
  return query
    select * from public.strokes
    where board_id = p_board_id
    order by sequence asc;
end;
$$;

create or replace function public.add_stroke(
  p_id uuid,
  p_board_id uuid,
  p_device_id uuid,
  p_tool text,
  p_points jsonb,
  p_color text,
  p_stroke_width float
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_seq bigint;
begin
  v_seq := public.next_sequence(p_board_id);

  insert into public.strokes (id, board_id, device_id, tool, points, color, stroke_width, sequence)
  values (p_id, p_board_id, p_device_id, p_tool, p_points, p_color, p_stroke_width, v_seq)
  on conflict (id) do nothing;

  update public.boards set updated_at = now() where id = p_board_id;

  return p_id;
end;
$$;

create or replace function public.delete_stroke(p_stroke_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  delete from public.strokes where id = p_stroke_id;
end;
$$;

create or replace function public.restore_stroke(
  p_id uuid,
  p_board_id uuid,
  p_device_id uuid,
  p_tool text,
  p_points jsonb,
  p_color text,
  p_stroke_width float,
  p_sequence bigint,
  p_created_at timestamptz
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.strokes (id, board_id, device_id, tool, points, color, stroke_width, sequence, created_at)
  values (p_id, p_board_id, p_device_id, p_tool, p_points, p_color, p_stroke_width, p_sequence, p_created_at)
  on conflict (id) do nothing;
end;
$$;

create or replace function public.clear_board(p_board_id uuid, p_device_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  delete from public.strokes where board_id = p_board_id;
  update public.boards set updated_at = now() where id = p_board_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Widget / Board Content RPCs
-- ---------------------------------------------------------------------------
create or replace function public.board_content_columns_exist()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'boards'
       and column_name  = 'message'
  );
$$;

create or replace function public.get_board_content(
  p_board_id uuid,
  p_device_id uuid
)
returns setof public.boards
language plpgsql
security definer
as $$
begin
  if not exists (
    select 1
      from public.boards b
      join public.couple_members cm on cm.couple_id = b.couple_id
     where b.id = p_board_id and cm.device_id = p_device_id
  ) then
    return;
  end if;
  return query select * from public.boards where id = p_board_id;
end;
$$;

create or replace function public.update_board_content(
  p_board_id uuid,
  p_device_id uuid,
  p_message text default null,
  p_accent_color text default null,
  p_variant text default null,
  p_name text default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_couple_id uuid;
begin
  select couple_id into v_couple_id from public.boards where id = p_board_id;
  if v_couple_id is null then
    raise exception 'board not found';
  end if;

  if not exists (
    select 1 from public.couple_members where couple_id = v_couple_id and device_id = p_device_id
  ) then
    raise exception 'forbidden';
  end if;

  update public.boards
     set message = coalesce(p_message, message),
         accent_color = coalesce(p_accent_color, accent_color),
         variant = coalesce(p_variant, variant),
         name = coalesce(nullif(trim(p_name), ''), name),
         updated_at = now()
   where id = p_board_id;
end;
$$;

-- Grant execution to anon and authenticated roles
grant execute on function public.next_sequence(uuid) to anon, authenticated;
grant execute on function public.register_device(uuid) to anon, authenticated;
grant execute on function public.create_couple(uuid, text) to anon, authenticated;
grant execute on function public.join_couple(uuid, text) to anon, authenticated;
grant execute on function public.disconnect_device(uuid) to anon, authenticated;
grant execute on function public.get_board_id(uuid) to anon, authenticated;
grant execute on function public.get_boards(uuid) to anon, authenticated;
grant execute on function public.get_strokes(uuid) to anon, authenticated;
grant execute on function public.add_stroke(uuid, uuid, uuid, text, jsonb, text, float) to anon, authenticated;
grant execute on function public.delete_stroke(uuid) to anon, authenticated;
grant execute on function public.restore_stroke(uuid, uuid, uuid, text, jsonb, text, float, bigint, timestamptz) to anon, authenticated;
grant execute on function public.clear_board(uuid, uuid) to anon, authenticated;
grant execute on function public.board_content_columns_exist() to anon, authenticated;
grant execute on function public.get_board_content(uuid, uuid) to anon, authenticated;
grant execute on function public.update_board_content(uuid, uuid, text, text, text, text) to anon, authenticated;