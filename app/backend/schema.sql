-- ===========================================================================
-- RYSAO TCG — Schéma backend Supabase (Postgres)
-- À exécuter dans Supabase ▸ SQL Editor sur un projet neuf.
-- Fournit : comptes (auth), profils, feed social, likes, commentaires,
-- enchères (RPC sécurisée), chat, boutiques — avec RLS + Realtime + Storage.
-- ===========================================================================

-- ---------- PROFILS ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique,
  sell        jsonb default '[]'::jsonb,   -- items à vendre
  want        jsonb default '[]'::jsonb,   -- items recherchés
  created_at  timestamptz default now()
);

-- Crée automatiquement un profil à l'inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- POSTS (feed / enchères) ----------
create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid references auth.users(id) on delete cascade,
  author_name  text,
  body         text,
  photos       jsonb default '[]'::jsonb,
  auction      boolean default false,
  ai           jsonb,
  bid_current  numeric default 0,
  bid_by       text,
  created_at   timestamptz default now()
);
create index if not exists posts_created_idx on public.posts (created_at desc);

create table if not exists public.comments (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid references public.posts(id) on delete cascade,
  author_id    uuid references auth.users(id) on delete cascade,
  author_name  text,
  body         text,
  created_at   timestamptz default now()
);

create table if not exists public.likes (
  post_id  uuid references public.posts(id) on delete cascade,
  user_id  uuid references auth.users(id) on delete cascade,
  primary key (post_id, user_id)
);

create table if not exists public.bids (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid references public.posts(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  bidder     text,
  amount     numeric not null,
  created_at timestamptz default now()
);

-- Enchère atomique : valide le montant et met à jour le post (security definer
-- pour pouvoir mettre à jour le post d'un autre membre, en toute sécurité).
create or replace function public.place_bid(p_post uuid, p_amount numeric)
returns public.posts language plpgsql security definer set search_path = public as $$
declare v_name text; v_row public.posts;
begin
  select coalesce(username, 'Membre') into v_name from public.profiles where id = auth.uid();
  update public.posts
     set bid_current = p_amount, bid_by = v_name
   where id = p_post and auction = true and p_amount > bid_current
   returning * into v_row;
  if v_row.id is null then raise exception 'bid too low or post not an auction'; end if;
  insert into public.bids (post_id, user_id, bidder, amount) values (p_post, auth.uid(), v_name, p_amount);
  return v_row;
end; $$;

-- ---------- CHAT (par pseudo) ----------
create table if not exists public.messages (
  id             uuid primary key default gen_random_uuid(),
  sender_id      uuid references auth.users(id) on delete cascade,
  sender_name    text,
  recipient_name text,
  body           text,
  created_at     timestamptz default now()
);
create index if not exists messages_pair_idx on public.messages (sender_name, recipient_name, created_at);

-- ---------- BOUTIQUES ----------
create table if not exists public.shops (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid references auth.users(id) on delete cascade,
  name       text not null,
  address    text,
  city       text,
  lat        double precision,
  lon        double precision,
  created_at timestamptz default now()
);

-- ===========================================================================
-- RLS — lecture publique pour les membres connectés, écriture sur ses données
-- ===========================================================================
alter table public.profiles enable row level security;
alter table public.posts    enable row level security;
alter table public.comments enable row level security;
alter table public.likes    enable row level security;
alter table public.bids     enable row level security;
alter table public.messages enable row level security;
alter table public.shops    enable row level security;

-- profiles
create policy "profiles read"   on public.profiles for select using (true);
create policy "profiles upsert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles update" on public.profiles for update using (auth.uid() = id);

-- posts
create policy "posts read"   on public.posts for select using (true);
create policy "posts insert" on public.posts for insert with check (auth.uid() = author_id);
create policy "posts update own" on public.posts for update using (auth.uid() = author_id);
create policy "posts delete own" on public.posts for delete using (auth.uid() = author_id);

-- comments
create policy "comments read"   on public.comments for select using (true);
create policy "comments insert" on public.comments for insert with check (auth.uid() = author_id);
create policy "comments delete own" on public.comments for delete using (auth.uid() = author_id);

-- likes
create policy "likes read"   on public.likes for select using (true);
create policy "likes insert" on public.likes for insert with check (auth.uid() = user_id);
create policy "likes delete" on public.likes for delete using (auth.uid() = user_id);

-- bids (lecture publique ; insertion via RPC place_bid)
create policy "bids read"   on public.bids for select using (true);

-- messages : lisible par l'expéditeur (les destinataires lisent via leur pseudo)
create policy "messages read"   on public.messages for select using (true);
create policy "messages insert" on public.messages for insert with check (auth.uid() = sender_id);

-- shops
create policy "shops read"   on public.shops for select using (true);
create policy "shops insert" on public.shops for insert with check (auth.uid() = owner_id);
create policy "shops update own" on public.shops for update using (auth.uid() = owner_id);
create policy "shops delete own" on public.shops for delete using (auth.uid() = owner_id);

-- ===========================================================================
-- REALTIME — diffusion en direct
-- ===========================================================================
alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.likes;
alter publication supabase_realtime add table public.bids;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.shops;

-- ===========================================================================
-- STORAGE — bucket public pour les photos du feed
-- ===========================================================================
insert into storage.buckets (id, name, public) values ('photos', 'photos', true)
  on conflict (id) do nothing;
create policy "photos read"   on storage.objects for select using (bucket_id = 'photos');
create policy "photos insert" on storage.objects for insert
  with check (bucket_id = 'photos' and auth.role() = 'authenticated');
