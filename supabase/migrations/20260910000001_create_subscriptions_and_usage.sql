-- =============================================================================
-- Docly Monetization: Subscriptions and Daily Usage Tracking
-- =============================================================================

-- 1. Create public subscriptions table linked to auth.users
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status text not null default 'active' check (status in ('active', 'canceled', 'past_due', 'incomplete', 'trialing')),
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  provider text default 'none',
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable Row Level Security on subscriptions
alter table public.subscriptions enable row level security;

-- 3. RLS Policies: Users can view ONLY their own subscription information
drop policy if exists "Users can view own subscription" on public.subscriptions;
create policy "Users can view own subscription"
  on public.subscriptions
  for select
  using (auth.uid() = user_id);

-- 4. Automatically create default free subscription row upon user creation
create or replace function public.handle_new_user_subscription()
returns trigger as $$
begin
  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created_subscription on auth.users;
create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row execute function public.handle_new_user_subscription();

-- Backfill subscriptions for any existing users without a subscription row
insert into public.subscriptions (user_id, plan, status)
select id, 'free', 'active'
from auth.users
where id not in (select user_id from public.subscriptions)
on conflict (user_id) do nothing;

-- 5. Create daily_usage table for tracking conversion & OCR allowances
create table if not exists public.daily_usage (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  tool_id text not null,
  usage_date date not null default (timezone('utc'::text, now()))::date,
  count integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint daily_usage_identifier_tool_date_key unique (identifier, tool_id, usage_date)
);

-- 6. Enable Row Level Security on daily_usage
alter table public.daily_usage enable row level security;

-- 7. RLS Policies for daily_usage: Authenticated users can view their own usage records
drop policy if exists "Users can view own daily usage" on public.daily_usage;
create policy "Users can view own daily usage"
  on public.daily_usage
  for select
  using (identifier = auth.uid()::text or identifier = 'public');
