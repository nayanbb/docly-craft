-- =============================================================================
-- Docly Monetization: Provider-Neutral Subscriptions & Payments (PayU Migration)
-- Migration: 20260912000000_neutralize_subscriptions_and_payments_for_payu.sql
-- =============================================================================

-- 1. Add provider-neutral columns to public.subscriptions
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'provider') then
    alter table public.subscriptions add column provider text not null default 'payu';
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'provider_subscription_id') then
    alter table public.subscriptions add column provider_subscription_id text;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'provider_customer_id') then
    alter table public.subscriptions add column provider_customer_id text;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'provider_plan_id') then
    alter table public.subscriptions add column provider_plan_id text;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'amount') then
    alter table public.subscriptions add column amount numeric default 25.00;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'currency') then
    alter table public.subscriptions add column currency text default 'INR';
  end if;
end $$;

-- 2. Add provider-neutral columns to public.payments
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payments' and column_name = 'provider') then
    alter table public.payments add column provider text not null default 'payu';
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payments' and column_name = 'provider_payment_id') then
    alter table public.payments add column provider_payment_id text;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payments' and column_name = 'provider_order_id') then
    alter table public.payments add column provider_order_id text;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payments' and column_name = 'provider_subscription_id') then
    alter table public.payments add column provider_subscription_id text;
  end if;
end $$;

-- 3. Backfill existing historical Razorpay records so both fields stay populated
update public.subscriptions
set
  provider = 'razorpay',
  provider_subscription_id = coalesce(provider_subscription_id, razorpay_subscription_id),
  provider_customer_id = coalesce(provider_customer_id, razorpay_customer_id),
  provider_plan_id = coalesce(provider_plan_id, razorpay_plan_id)
where razorpay_subscription_id is not null;

update public.payments
set
  provider = 'razorpay',
  provider_payment_id = coalesce(provider_payment_id, razorpay_payment_id),
  provider_order_id = coalesce(provider_order_id, razorpay_order_id),
  provider_subscription_id = coalesce(provider_subscription_id, razorpay_subscription_id)
where razorpay_payment_id is not null;

-- 4. Create index on provider_subscription_id for quick lookups
create index if not exists idx_subscriptions_provider_sub_id on public.subscriptions (provider_subscription_id);
create index if not exists idx_payments_provider_payment_id on public.payments (provider_payment_id);
