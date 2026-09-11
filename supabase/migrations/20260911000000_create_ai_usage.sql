-- =============================================================================
-- Docly AI Platform: Usage Tracking and Telemetry (ai_usage)
-- =============================================================================

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  feature text not null,
  input_chars integer default 0,
  page_count integer default 1,
  status text not null default 'success',
  provider text not null default 'docly_ai',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS) on ai_usage
alter table public.ai_usage enable row level security;

-- RLS Policy: Users can view strictly their own AI usage events
drop policy if exists "Users can view own ai usage" on public.ai_usage;
create policy "Users can view own ai usage"
  on public.ai_usage
  for select
  using (auth.uid() = user_id);

-- Indexes for efficient querying by user and feature
create index if not exists idx_ai_usage_user_id on public.ai_usage(user_id);
create index if not exists idx_ai_usage_created_at on public.ai_usage(created_at desc);
create index if not exists idx_ai_usage_feature on public.ai_usage(feature);
