-- Initial schema for the evidence-based diet app prototype.
-- Every user-owned table is protected by row level security: a signed-in user
-- (including an anonymous one) can only read and write their own rows.

-- Profiles ------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  birth_year int check (birth_year between 1900 and 2100),
  sex text check (sex in ('female', 'male')),
  activity text check (activity in ('sedentary', 'moderate', 'active')),
  goals text[] not null default '{}',
  named_diet text not null default 'none',
  -- Safe mode removes personal suggestions and hides numbers (see spec: Safety).
  safe_mode boolean not null default false,
  safe_mode_reasons text[] not null default '{}',
  hide_numbers boolean not null default false,
  onboarded boolean not null default false
);

alter table public.profiles enable row level security;

create policy "profiles: own row" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Create an empty profile whenever a user signs up (anonymous sign-ins included).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Meals ---------------------------------------------------------------------

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  eaten_at timestamptz not null default now(),
  source text not null check (source in ('photo', 'text')),
  description text,
  created_at timestamptz not null default now()
);

create index meals_user_eaten_idx on public.meals (user_id, eaten_at desc);

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  grams numeric not null check (grams >= 0),
  grams_low numeric,
  grams_high numeric,
  food_group text not null,
  nova smallint check (nova between 1 and 4),
  fdc_id int,
  fdc_description text,
  -- Nutrients per 100 g from USDA, keyed by NutrientKey (see functions/_shared/nutrients.ts).
  per_100g jsonb,
  -- Nutrients for the logged amount (per_100g scaled by grams).
  nutrients jsonb
);

create index meal_items_meal_idx on public.meal_items (meal_id);
create index meal_items_user_idx on public.meal_items (user_id);

alter table public.meals enable row level security;
alter table public.meal_items enable row level security;

create policy "meals: own rows" on public.meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "meal_items: own rows" on public.meal_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Evidence library ----------------------------------------------------------

create table public.claims (
  id text primary key,
  category text not null check (category in ('food', 'nutrient', 'diet', 'supplement', 'timing', 'fad')),
  title text not null,
  exposure text not null,
  outcome text not null,
  population text not null,
  direction text not null check (direction in ('increases', 'decreases', 'no_effect', 'unclear')),
  effect text not null,
  confidence text not null check (confidence in ('high', 'moderate', 'low', 'very_low')),
  confidence_reasons text not null,
  summary text not null,
  triggers jsonb not null default '[]',
  sources jsonb not null default '[]',
  review_status text not null default 'draft' check (review_status in ('draft', 'approved')),
  last_reviewed date,
  updated_at timestamptz not null default now()
);

create table public.diets (
  id text primary key,
  name text not null,
  claim_ids text[] not null default '{}'
);

alter table public.claims enable row level security;
alter table public.diets enable row level security;

-- Readable by any signed-in user; writable only with the service role (review console, seed).
create policy "claims: read" on public.claims for select to authenticated using (true);
create policy "diets: read" on public.diets for select to authenticated using (true);

-- Verdicts, fad checks and feedback ----------------------------------------

create table public.verdicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rating text not null,
  confidence text,
  payload jsonb not null,
  claim_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.fad_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  input text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  verdict_id uuid references public.verdicts (id) on delete set null,
  claim_id text references public.claims (id) on delete set null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.verdicts enable row level security;
alter table public.fad_checks enable row level security;
alter table public.feedback enable row level security;

create policy "verdicts: own rows" on public.verdicts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "fad_checks: own rows" on public.fad_checks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "feedback: insert own" on public.feedback
  for insert with check (auth.uid() = user_id);
create policy "feedback: read own" on public.feedback
  for select using (auth.uid() = user_id);
