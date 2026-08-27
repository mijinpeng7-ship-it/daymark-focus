create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  todos jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;
revoke all on table public.user_data from anon, authenticated;
grant select, insert, update, delete on table public.user_data to authenticated;

create policy "Users read own data" on public.user_data for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Users insert own data" on public.user_data for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Users update own data" on public.user_data for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own data" on public.user_data for delete to authenticated
using ((select auth.uid()) = user_id);
