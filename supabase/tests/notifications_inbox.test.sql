\set ON_ERROR_STOP on
\echo '--- backfill'
do $$ declare n int; r int; begin
  select count(*), count(read_at) into n, r from public.notifications;
  if n <> 2 then raise exception 'backfill expected 2 rows (recent, owned), got %', n; end if;
  if r <> 2 then raise exception 'backfill rows must be marked read'; end if;
  raise notice 'ok: % backfilled, all read', n;
end $$;

\echo '--- trigger: new order, status changes, no duplicate, null user'
insert into public.orders (id, user_id, external_id, payment_status) values ('cccccccc-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001','ORDER-abcdef12-x','PENDING');
update public.orders set payment_status = 'PENDING' where id = 'cccccccc-0000-0000-0000-00000000000a';           -- same status: no row
update public.orders set payment_status = 'SUCCESSFUL' where id = 'cccccccc-0000-0000-0000-00000000000a';
update public.orders set payment_status = 'SUCCESSFUL', failure_reason = 'x' where id = 'cccccccc-0000-0000-0000-00000000000a'; -- still same status
insert into public.orders (id, user_id, external_id, payment_status, failure_reason) values ('cccccccc-0000-0000-0000-00000000000b','bbbbbbbb-0000-0000-0000-000000000002','ORDER-99999999-x','FAILED','Insufficient funds');
insert into public.orders (user_id, external_id) values (null, 'ORDER-nouser-x');
select title, body, href, dedupe_key, read_at is null as unread from public.notifications where created_at > now() - interval '1 minute' order by created_at, title;

do $$ declare n int; begin
  select count(*) into n from public.notifications where created_at > now() - interval '1 minute';
  if n <> 3 then raise exception 'expected 3 new notifications (pending, paid, failed), got %', n; end if;
  raise notice 'ok: 3 new rows, no duplicate for repeated status, none for null user';
end $$;

\echo '--- RLS as authenticated user A'
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$ declare n int; begin
  select count(*) into n from public.notifications;
  if n <> 3 then raise exception 'A should see only own 3 rows, saw %', n; end if;
  if exists (select 1 from public.notifications where user_id <> auth.uid()) then raise exception 'A can see B''s rows'; end if;
  update public.notifications set read_at = now() where id = (select id from public.notifications where read_at is null limit 1);
  raise notice 'ok: sees only own rows and can set read_at';
end $$;
do $$ begin
  begin update public.notifications set title = 'hacked'; raise exception 'title update should be denied';
  exception when insufficient_privilege then raise notice 'ok: cannot change title'; end;
  begin update public.notifications set user_id = 'bbbbbbbb-0000-0000-0000-000000000002'; raise exception 'user_id update should be denied';
  exception when insufficient_privilege then raise notice 'ok: cannot reassign user_id'; end;
  begin insert into public.notifications (user_id, kind, title) values ('aaaaaaaa-0000-0000-0000-000000000001','promo','x'); raise exception 'insert should be denied';
  exception when insufficient_privilege then raise notice 'ok: cannot insert'; end;
end $$;
do $$ declare n int; begin
  delete from public.notifications where user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'A deleted B''s rows'; end if;
  delete from public.notifications where kind = 'order' and created_at < now() - interval '1 day';
  get diagnostics n = row_count;
  raise notice 'ok: delete only touches own rows (% own deleted)', n;
end $$;
rollback;

\echo '--- RLS as anon'
begin; set local role anon;
do $$ begin
  begin perform 1 from public.notifications; raise exception 'anon should have no access';
  exception when insufficient_privilege then raise notice 'ok: anon denied'; end;
end $$;
rollback;

\echo '--- trim keeps newest 100 per user'
insert into public.notifications (user_id, kind, title, created_at)
  select 'aaaaaaaa-0000-0000-0000-000000000001','promo','p'||g, now() - (g || ' minutes')::interval from generate_series(1,130) g;
do $$ declare n int; begin
  select count(*) into n from public.notifications where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if n <> 100 then raise exception 'expected 100 kept for A, got %', n; end if;
  select count(*) into n from public.notifications where user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  if n = 0 then raise exception 'B was trimmed too'; end if;
  raise notice 'ok: A trimmed to 100, B untouched';
end $$;

\echo '--- dedupe key is idempotent'
insert into public.notifications (user_id, kind, title, dedupe_key) values ('bbbbbbbb-0000-0000-0000-000000000002','system','s','k1') on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
insert into public.notifications (user_id, kind, title, dedupe_key) values ('bbbbbbbb-0000-0000-0000-000000000002','system','s','k1') on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
do $$ begin if (select count(*) from public.notifications where dedupe_key='k1') <> 1 then raise exception 'dedupe failed'; end if; raise notice 'ok: dedupe'; end $$;

\echo '--- realtime publication'
select tablename from pg_publication_tables where pubname='supabase_realtime' order by 1;

\echo '--- push flags'
do $$ begin
  if exists (select 1 from public.notifications where dedupe_key like 'order:%' and created_at < now() - interval '1 minute' and pushed_at is null) then raise exception 'backfilled rows must be pre-marked pushed'; end if;
  if (select (data->>'push')::boolean from public.notifications where title = 'Waiting for your payment' and user_id = 'aaaaaaaa-0000-0000-0000-000000000001' order by created_at desc limit 1) is distinct from false then raise exception 'PENDING must carry push=false'; end if;
  if exists (select 1 from public.notifications where title = 'Payment received' and data ? 'push') then raise exception 'non-pending must not carry push=false'; end if;
  raise notice 'ok: backfill pre-pushed, PENDING silent, others pushable';
end $$;
