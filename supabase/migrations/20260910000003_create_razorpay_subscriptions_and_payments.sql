-- =============================================================================
-- Docly Monetization: Razorpay Subscriptions, Payments & Idempotency
-- Migration: 20260910000003_create_razorpay_subscriptions_and_payments.sql
-- =============================================================================

-- 1. Create or update public.subscriptions table with Razorpay fields
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status text not null default 'active' check (status in ('active', 'authenticated', 'pending', 'halted', 'cancelled', 'expired', 'past_due')),
  razorpay_customer_id text,
  razorpay_subscription_id text,
  razorpay_plan_id text,
  started_at timestamp with time zone,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamp with time zone,
  expired_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add any missing columns to existing subscriptions table
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'razorpay_customer_id') then
    alter table public.subscriptions add column razorpay_customer_id text;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'razorpay_subscription_id') then
    alter table public.subscriptions add column razorpay_subscription_id text;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'razorpay_plan_id') then
    alter table public.subscriptions add column razorpay_plan_id text;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'cancel_at_period_end') then
    alter table public.subscriptions add column cancel_at_period_end boolean not null default false;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'cancelled_at') then
    alter table public.subscriptions add column cancelled_at timestamp with time zone;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'expired_at') then
    alter table public.subscriptions add column expired_at timestamp with time zone;
  end if;
end $$;

-- 2. Create or update public.payments table with Razorpay fields
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  razorpay_payment_id text,
  razorpay_order_id text,
  razorpay_subscription_id text,
  razorpay_invoice_id text,
  amount numeric not null,
  currency text not null default 'INR',
  status text not null,
  payment_method text,
  paid_at timestamp with time zone default timezone('utc'::text, now()),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add any missing columns to existing payments table
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payments' and column_name = 'razorpay_payment_id') then
    alter table public.payments add column razorpay_payment_id text;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payments' and column_name = 'razorpay_order_id') then
    alter table public.payments add column razorpay_order_id text;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payments' and column_name = 'razorpay_subscription_id') then
    alter table public.payments add column razorpay_subscription_id text;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payments' and column_name = 'razorpay_invoice_id') then
    alter table public.payments add column razorpay_invoice_id text;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payments' and column_name = 'payment_method') then
    alter table public.payments add column payment_method text;
  end if;
end $$;

-- 3. Create public.webhook_events table for webhook idempotency
create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text unique not null,
  event_type text not null,
  processed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Ensure public.profiles table and role column exist
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'role') then
    alter table public.profiles add column role text not null default 'user' check (role in ('user', 'admin'));
  end if;
end $$;

-- Profiles RLS policies
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, email, display_name)
select id, email, split_part(email, '@', 1)
from auth.users
where id not in (select id from public.profiles)
on conflict (id) do nothing;


-- 5. Enable Row Level Security (RLS)
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;
alter table public.profiles enable row level security;

-- 6. Helper function to check if requesting user is admin
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$ language plpgsql security definer set search_path = public;

-- 7. Subscriptions RLS policies:
-- Users may read ONLY their own subscription; Admins can read all
drop policy if exists "Users can view own subscription" on public.subscriptions;
create policy "Users can view own subscription"
  on public.subscriptions
  for select
  using (auth.uid() = user_id or public.is_admin());

-- 8. Payments RLS policies:
-- Users may read ONLY their own payments; Admins can read all
drop policy if exists "Users can view own payments" on public.payments;
create policy "Users can view own payments"
  on public.payments
  for select
  using (auth.uid() = user_id or public.is_admin());

-- 9. Auto-create default free subscription for new auth.users
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
