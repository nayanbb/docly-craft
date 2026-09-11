-- =============================================================================
-- Docly Monetization: Subscriptions, Payments, and Admin Roles
-- Migration: 20260910000002_create_subscriptions_and_payments.sql
-- =============================================================================

-- 1. Ensure public.subscriptions table has all required fields and constraints
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'cancelled', 'expired', 'incomplete', 'unpaid')),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  started_at timestamp with time zone,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamp with time zone,
  expired_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Alter existing columns if table already existed with earlier schema
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'id') then
    alter table public.subscriptions add column id uuid default gen_random_uuid();
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'stripe_customer_id') then
    alter table public.subscriptions add column stripe_customer_id text;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'stripe_subscription_id') then
    alter table public.subscriptions add column stripe_subscription_id text;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'stripe_price_id') then
    alter table public.subscriptions add column stripe_price_id text;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'started_at') then
    alter table public.subscriptions add column started_at timestamp with time zone;
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

-- 2. Create public.payments table for recording verified Stripe invoices/payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_payment_id text,
  stripe_invoice_id text,
  amount numeric not null,
  currency text not null default 'inr',
  status text not null check (status in ('succeeded', 'failed', 'refunded', 'pending')),
  paid_at timestamp with time zone default timezone('utc'::text, now()),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Add role to public.profiles if not exists
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'role') then
    alter table public.profiles add column role text not null default 'user' check (role in ('user', 'admin'));
  end if;
end $$;

-- 4. Enable Row Level Security (RLS)
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.profiles enable row level security;

-- 5. Helper function to check if requesting user is admin
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$ language plpgsql security definer set search_path = public;

-- 6. Subscriptions RLS policies:
-- Users may read ONLY their own subscription; Admins can read all
drop policy if exists "Users can view own subscription" on public.subscriptions;
create policy "Users can view own subscription"
  on public.subscriptions
  for select
  using (auth.uid() = user_id or public.is_admin());

-- Disallow normal users from inserting or updating subscriptions directly.
-- Only server/service-role or security-definer procedures can write to subscriptions.
drop policy if exists "Users cannot modify subscription" on public.subscriptions;

-- 7. Payments RLS policies:
-- Users may read ONLY their own payments; Admins can read all
drop policy if exists "Users can view own payments" on public.payments;
create policy "Users can view own payments"
  on public.payments
  for select
  using (auth.uid() = user_id or public.is_admin());

-- 8. Auto-create default free subscription for new auth.users
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

-- Backfill subscriptions for any existing users
insert into public.subscriptions (user_id, plan, status)
select id, 'free', 'active'
from auth.users
where id not in (select user_id from public.subscriptions)
on conflict (user_id) do nothing;
