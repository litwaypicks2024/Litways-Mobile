create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
create table public.orders (
  id uuid primary key default gen_random_uuid(), user_id uuid, external_id text not null,
  payment_status text not null default 'PENDING', failure_reason text,
  created_at timestamptz default now(), updated_at timestamptz);
create publication supabase_realtime;
insert into auth.users values ('aaaaaaaa-0000-0000-0000-000000000001'), ('bbbbbbbb-0000-0000-0000-000000000002');
-- orders that exist BEFORE the migration (backfill)
insert into public.orders (user_id, external_id, payment_status, created_at, updated_at) values
 ('aaaaaaaa-0000-0000-0000-000000000001','ORDER-0642ca57-6b9d-1','SUCCESSFUL', now()-interval '40 days', now()-interval '40 days'),
 ('aaaaaaaa-0000-0000-0000-000000000001','ORDER-11111111-6b9d-2','COMPLETED',  now()-interval '2 days',  now()-interval '2 days'),
 ('bbbbbbbb-0000-0000-0000-000000000002','ORDER-22222222-6b9d-3','FAILED',     now()-interval '1 day',   now()-interval '1 day'),
 (null,'ORDER-33333333-6b9d-4','PENDING', now(), now());
