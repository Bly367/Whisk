-- Folder deletion tombstones and manually entered grocery items.

alter table public.user_grocery_state
  add column if not exists manual_items jsonb not null default '[]'::jsonb;

create or replace function public.sync_folder_tombstones(p_tombstones jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_id text;
  v_deleted_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;
  if jsonb_typeof(coalesce(p_tombstones, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid folder tombstones';
  end if;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_tombstones, '[]'::jsonb))
  loop
    v_id := v_item->>'id';
    v_deleted_at := nullif(v_item->>'deletedAt', '')::timestamptz;
    if v_id is null or char_length(v_id) not between 1 and 160 or v_deleted_at is null then
      raise exception 'invalid folder tombstone';
    end if;

    insert into public.user_folders (id, user_id, data, updated_at, deleted_at)
    values (
      v_id,
      v_user_id,
      jsonb_build_object('id', v_id),
      v_deleted_at,
      v_deleted_at
    )
    on conflict (user_id, id) do update
      set data = excluded.data,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at
      where public.user_folders.updated_at <= excluded.updated_at;
  end loop;
end;
$$;

create or replace function public.sync_manual_grocery_items(
  p_items jsonb,
  p_updated_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid grocery items';
  end if;

  insert into public.user_grocery_state (
    user_id,
    checked_ids,
    manual_items,
    updated_at
  )
  values (
    v_user_id,
    '[]'::jsonb,
    coalesce(p_items, '[]'::jsonb),
    p_updated_at
  )
  on conflict (user_id) do update
    set manual_items = excluded.manual_items,
        updated_at = excluded.updated_at
    where public.user_grocery_state.updated_at <= excluded.updated_at;
end;
$$;

revoke all on function public.sync_folder_tombstones(jsonb) from public, anon;
revoke all on function public.sync_manual_grocery_items(jsonb, timestamptz)
  from public, anon;

grant execute on function public.sync_folder_tombstones(jsonb) to authenticated;
grant execute on function public.sync_manual_grocery_items(jsonb, timestamptz)
  to authenticated;
