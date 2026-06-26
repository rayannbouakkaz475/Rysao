-- ===========================================================================
-- RYSAO TCG — Push notifications (à exécuter APRÈS schema.sql)
-- Stocke les abonnements Web Push et déclenche l'Edge Function "push" à chaque
-- nouvelle enchère (bids) ou message (messages).
-- ===========================================================================

create table if not exists public.push_subscriptions (
  endpoint    text primary key,
  user_id     uuid references auth.users(id) on delete cascade,
  username    text,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz default now()
);

alter table public.push_subscriptions enable row level security;
create policy "push read own"   on public.push_subscriptions for select using (auth.uid() = user_id);
create policy "push insert own" on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy "push update own" on public.push_subscriptions for update using (auth.uid() = user_id);
create policy "push delete own" on public.push_subscriptions for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Déclenchement de l'Edge Function via pg_net.
-- Renseigne ton ref de projet et un secret partagé, puis exécute ce bloc.
-- (Alternative sans SQL : Dashboard ▸ Database ▸ Webhooks → POST vers la
--  fonction "push" sur INSERT de public.bids et public.messages.)
-- ---------------------------------------------------------------------------
create extension if not exists pg_net;

create or replace function public.notify_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  fn_url text := 'https://VOTRE-PROJET.functions.supabase.co/push';
  shared text := 'VOTRE_SECRET_PARTAGE';  -- doit valoir PUSH_SHARED_SECRET côté fonction
begin
  perform net.http_post(
    url     := fn_url,
    headers := jsonb_build_object('Content-Type','application/json','x-rysao-secret', shared),
    body    := jsonb_build_object('table', TG_TABLE_NAME, 'record', to_jsonb(NEW))
  );
  return NEW;
end; $$;

drop trigger if exists on_bid_push on public.bids;
create trigger on_bid_push      after insert on public.bids      for each row execute function public.notify_push();

drop trigger if exists on_message_push on public.messages;
create trigger on_message_push  after insert on public.messages  for each row execute function public.notify_push();
