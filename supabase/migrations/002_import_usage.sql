-- Durable, service-only import quotas and telemetry.
-- Quotas reset at midnight UTC. The default allowance is 20 imports per user per day.

create table public.import_daily_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  used_count integer not null default 0 check (used_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

create table public.import_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  import_kind text not null check (import_kind in ('url', 'image')),
  source_category text not null check (
    source_category in ('url', 'instagram', 'tiktok', 'facebook', 'image')
  ),
  status text not null check (
    status in ('started', 'succeeded', 'failed', 'rate_limited')
  ),
  http_status integer check (http_status between 100 and 599),
  error_code text check (
    error_code is null or (
      char_length(error_code) between 1 and 64
      and error_code ~ '^[a-z0-9_]+$'
    )
  ),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index import_events_user_created_at_idx
  on public.import_events (user_id, created_at desc);

alter table public.import_daily_usage enable row level security;
alter table public.import_events enable row level security;

-- No client policies are defined. Only the service role receives table/function access.
revoke all on table public.import_daily_usage from public, anon, authenticated;
revoke all on table public.import_events from public, anon, authenticated;
revoke all on sequence public.import_events_id_seq from public, anon, authenticated;

create or replace function public.consume_import_quota(
  p_user_id uuid,
  p_import_kind text,
  p_source_category text
)
returns table (
  event_id bigint,
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit constant integer := 20;
  v_used integer;
  v_event_id bigint;
  v_allowed boolean;
  v_today date := (now() at time zone 'utc')::date;
  v_reset_at timestamptz :=
    ((now() at time zone 'utc')::date + 1)::timestamp at time zone 'utc';
begin
  if p_import_kind not in ('url', 'image') then
    raise exception 'invalid import kind';
  end if;
  if p_source_category not in ('url', 'instagram', 'tiktok', 'facebook', 'image') then
    raise exception 'invalid source category';
  end if;

  insert into public.import_daily_usage (user_id, usage_date, used_count)
  values (p_user_id, v_today, 1)
  on conflict (user_id, usage_date) do update
    set used_count = public.import_daily_usage.used_count + 1,
        updated_at = now()
    where public.import_daily_usage.used_count < v_limit
  returning used_count into v_used;

  v_allowed := v_used is not null;
  if not v_allowed then
    select used_count
      into v_used
      from public.import_daily_usage
      where user_id = p_user_id and usage_date = v_today;
  end if;

  insert into public.import_events (
    user_id,
    import_kind,
    source_category,
    status,
    http_status,
    error_code,
    completed_at
  )
  values (
    p_user_id,
    p_import_kind,
    p_source_category,
    case when v_allowed then 'started' else 'rate_limited' end,
    case when v_allowed then null else 429 end,
    case when v_allowed then null else 'daily_quota_exceeded' end,
    case when v_allowed then null else now() end
  )
  returning id into v_event_id;

  return query select
    v_event_id,
    v_allowed,
    greatest(v_limit - coalesce(v_used, v_limit), 0),
    v_reset_at;
end;
$$;

create or replace function public.complete_import_event(
  p_event_id bigint,
  p_user_id uuid,
  p_status text,
  p_http_status integer,
  p_error_code text,
  p_duration_ms integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('succeeded', 'failed') then
    raise exception 'invalid terminal import status';
  end if;
  if p_http_status not between 100 and 599 then
    raise exception 'invalid HTTP status';
  end if;
  if p_duration_ms < 0 then
    raise exception 'invalid duration';
  end if;
  if p_error_code is not null and (
    char_length(p_error_code) not between 1 and 64
    or p_error_code !~ '^[a-z0-9_]+$'
  ) then
    raise exception 'invalid error code';
  end if;

  update public.import_events
    set status = p_status,
        http_status = p_http_status,
        error_code = p_error_code,
        duration_ms = p_duration_ms,
        completed_at = now()
    where id = p_event_id
      and user_id = p_user_id
      and status = 'started';
end;
$$;

create or replace function public.record_import_event(
  p_user_id uuid,
  p_import_kind text,
  p_source_category text,
  p_http_status integer,
  p_error_code text,
  p_duration_ms integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_import_kind not in ('url', 'image') then
    raise exception 'invalid import kind';
  end if;
  if p_source_category not in ('url', 'instagram', 'tiktok', 'facebook', 'image') then
    raise exception 'invalid source category';
  end if;
  if p_http_status not between 100 and 599 then
    raise exception 'invalid HTTP status';
  end if;
  if p_duration_ms < 0 then
    raise exception 'invalid duration';
  end if;
  if p_error_code is null or (
    char_length(p_error_code) not between 1 and 64
    or p_error_code !~ '^[a-z0-9_]+$'
  ) then
    raise exception 'invalid error code';
  end if;

  insert into public.import_events (
    user_id,
    import_kind,
    source_category,
    status,
    http_status,
    error_code,
    duration_ms,
    completed_at
  )
  values (
    p_user_id,
    p_import_kind,
    p_source_category,
    'failed',
    p_http_status,
    p_error_code,
    p_duration_ms,
    now()
  );
end;
$$;

revoke all on function public.consume_import_quota(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.complete_import_event(bigint, uuid, text, integer, text, integer)
  from public, anon, authenticated;
revoke all on function public.record_import_event(uuid, text, text, integer, text, integer)
  from public, anon, authenticated;

grant select, insert, update on table public.import_daily_usage to service_role;
grant select, insert, update on table public.import_events to service_role;
grant usage, select on sequence public.import_events_id_seq to service_role;
grant execute on function public.consume_import_quota(uuid, text, text) to service_role;
grant execute on function public.complete_import_event(bigint, uuid, text, integer, text, integer)
  to service_role;
grant execute on function public.record_import_event(uuid, text, text, integer, text, integer)
  to service_role;
