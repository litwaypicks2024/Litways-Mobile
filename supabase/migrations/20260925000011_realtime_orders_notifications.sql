-- The supabase_realtime publication is currently EMPTY, so every realtime
-- subscription in the app (checkout's live payment tracking, the inbox refresh)
-- silently receives nothing and only the polling fallback works. Publish the two
-- tables the app listens to. Row visibility still follows RLS: a shopper's
-- subscription only ever delivers their own rows.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
