-- Run once in Supabase SQL Editor before using FastAPI-managed authentication.
-- Supabase remains the Postgres/storage provider; Supabase Auth is not used.

alter table public.profiles drop constraint if exists profiles_id_fkey;

create table if not exists public.app_accounts (
  id uuid primary key references public.profiles(id) on delete cascade,
  email text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists app_accounts_email_unique on public.app_accounts(lower(email));
alter table public.app_accounts enable row level security;
revoke all on public.app_accounts from anon, authenticated;
