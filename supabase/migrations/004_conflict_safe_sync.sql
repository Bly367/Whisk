-- Timestamp-aware sync with durable recipe deletion tombstones.

alter table public.user_recipes
  add column if not exists deleted_at timestamptz;

alter table public.user_folders
  add column if not exists deleted_at timestamptz;

create or replace function public.sync_user_state(
  p_recipes jsonb,
  p_recipe_tombstones jsonb,
  p_folders jsonb,
  p_plan jsonb,
  p_plan_updated_at timestamptz,
  p_grocery_checked_ids jsonb,
  p_grocery_updated_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_id text;
  v_timestamp timestamptz;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  if jsonb_typeof(coalesce(p_recipes, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_recipe_tombstones, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_folders, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_plan, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_grocery_checked_ids, '[]'::jsonb)) <> 'array'
  then
    raise exception 'invalid sync payload';
  end if;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_recipes, '[]'::jsonb))
  loop
    v_id := v_item->>'id';
    v_timestamp := coalesce(
      nullif(v_item->>'updatedAt', '')::timestamptz,
      nullif(v_item->>'createdAt', '')::timestamptz,
      now()
    );
    if v_id is null or char_length(v_id) not between 1 and 160 then
      raise exception 'invalid recipe ID';
    end if;

    insert into public.user_recipes (id, user_id, data, updated_at, deleted_at)
    values (v_id, v_user_id, v_item, v_timestamp, null)
    on conflict (user_id, id) do update
      set data = excluded.data,
          updated_at = excluded.updated_at,
          deleted_at = null
      where public.user_recipes.updated_at <= excluded.updated_at;
  end loop;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_recipe_tombstones, '[]'::jsonb))
  loop
    v_id := v_item->>'id';
    v_timestamp := nullif(v_item->>'deletedAt', '')::timestamptz;
    if v_id is null or char_length(v_id) not between 1 and 160 or v_timestamp is null then
      raise exception 'invalid recipe tombstone';
    end if;

    insert into public.user_recipes (id, user_id, data, updated_at, deleted_at)
    values (
      v_id,
      v_user_id,
      jsonb_build_object('id', v_id),
      v_timestamp,
      v_timestamp
    )
    on conflict (user_id, id) do update
      set data = excluded.data,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at
      where public.user_recipes.updated_at <= excluded.updated_at;
  end loop;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_folders, '[]'::jsonb))
  loop
    v_id := v_item->>'id';
    v_timestamp := coalesce(nullif(v_item->>'updatedAt', '')::timestamptz, now());
    if v_id is null or char_length(v_id) not between 1 and 160 then
      raise exception 'invalid folder ID';
    end if;

    insert into public.user_folders (id, user_id, data, updated_at, deleted_at)
    values (v_id, v_user_id, v_item, v_timestamp, null)
    on conflict (user_id, id) do update
      set data = excluded.data,
          updated_at = excluded.updated_at,
          deleted_at = null
      where public.user_folders.updated_at <= excluded.updated_at;
  end loop;

  insert into public.user_meal_plan (user_id, slots, updated_at)
  values (v_user_id, coalesce(p_plan, '[]'::jsonb), p_plan_updated_at)
  on conflict (user_id) do update
    set slots = excluded.slots,
        updated_at = excluded.updated_at
    where public.user_meal_plan.updated_at <= excluded.updated_at;

  insert into public.user_grocery_state (user_id, checked_ids, updated_at)
  values (
    v_user_id,
    coalesce(p_grocery_checked_ids, '[]'::jsonb),
    p_grocery_updated_at
  )
  on conflict (user_id) do update
    set checked_ids = excluded.checked_ids,
        updated_at = excluded.updated_at
    where public.user_grocery_state.updated_at <= excluded.updated_at;
end;
$$;

revoke all on function public.sync_user_state(
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  timestamptz,
  jsonb,
  timestamptz
) from public, anon;

grant execute on function public.sync_user_state(
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  timestamptz,
  jsonb,
  timestamptz
) to authenticated;
