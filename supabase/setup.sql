create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'Other',
  year integer,
  raw_value numeric not null default 0,
  comp_value numeric not null default 0,
  image_path text,
  created_at timestamptz not null default now()
);

alter table public.cards enable row level security;
create policy "Users read own cards" on public.cards for select using (auth.uid() = user_id);
create policy "Users add own cards" on public.cards for insert with check (auth.uid() = user_id);
create policy "Users update own cards" on public.cards for update using (auth.uid() = user_id);
create policy "Users delete own cards" on public.cards for delete using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', false)
on conflict (id) do nothing;

create policy "Users upload own card images" on storage.objects for insert
with check (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users view own card images" on storage.objects for select
using (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own card images" on storage.objects for delete
using (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);
