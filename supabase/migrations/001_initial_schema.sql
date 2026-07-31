-- Whisk cloud sync schema (run via Supabase SQL editor or `supabase db push`)

create table if not exists public.user_recipes (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.user_folders (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.user_meal_plan (
  user_id uuid primary key references auth.users (id) on delete cascade,
  slots jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_grocery_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  checked_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_recipes enable row level security;
alter table public.user_folders enable row level security;
alter table public.user_meal_plan enable row level security;
alter table public.user_grocery_state enable row level security;

create policy "Users manage own recipes"
  on public.user_recipes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own folders"
  on public.user_folders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own meal plan"
  on public.user_meal_plan for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own grocery state"
  on public.user_grocery_state for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists user_recipes_user_id_idx on public.user_recipes (user_id);
