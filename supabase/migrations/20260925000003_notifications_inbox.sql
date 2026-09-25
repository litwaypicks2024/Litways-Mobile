-- Per-user notification inbox.
--
-- One row per thing a shopper should hear about. Rows are written by the
-- database itself (the order trigger below) or by the service role (a future
-- promo/stock job); shoppers can only READ their own rows, mark them read, and
-- delete them. Everything the mobile inbox shows for order updates comes from
-- here once this is applied (the app falls back to deriving them from `orders`
-- while the table doesn't exist).

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('order', 'stock', 'price', 'promo', 'system')),
  title       text not null,
  body        text not null default '',
  -- In-app path the tap opens, e.g. /order/<id>. The app only follows known prefixes.
  href        text,
  image_url   text,
  data        jsonb not null default '{}'::jsonb,
  -- Makes writers idempotent: retries and re-fired triggers can't double-insert.
  dedupe_key  text,
  created_at  timestamptz not null default now(),
  read_at     timestamptz,
  -- Set by the send-push function once a push went out for this row.
  pushed_at   timestamptz
);

create unique index if not exists notifications_dedupe_idx
  on public.notifications (user_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists notifications_user_recent_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- Shoppers: read, mark read (read_at only, see grants) and delete their own rows. No insert policy on purpose.
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- RLS decides WHICH rows; grants decide WHICH columns. Clients may only ever change read_at.
revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Keep the table bounded: the newest 100 per shopper.
create or replace function public.trim_user_notifications()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  delete from public.notifications
  where user_id = new.user_id
    and id in (
      select id from public.notifications
      where user_id = new.user_id
      order by created_at desc
      offset 100
    );
  return null;
end;
$$;

drop trigger if exists trg_trim_user_notifications on public.notifications;
create trigger trg_trim_user_notifications
  after insert on public.notifications
  for each row execute function public.trim_user_notifications();

-- Order updates: one notification each time an order's payment_status changes
-- (and when it is first created). Wording mirrors the app's orderEvent().
create or replace function public.notify_order_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  ref   text;
  head  text;
  t     text;
  b     text;
begin
  if new.user_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.payment_status is not distinct from old.payment_status then
    return new;
  end if;

  -- 'ORDER-0642ca57-…' -> '#0642CA57'
  head := split_part(new.external_id, '-', 1);
  if upper(head) = 'ORDER' then
    head := split_part(new.external_id, '-', 2);
  end if;
  ref := '#' || upper(head);

  case new.payment_status
    when 'PENDING' then
      t := 'Waiting for your payment';
      b := 'Approve the MoMo prompt on your phone to finish order ' || ref || '.';
    when 'SUCCESSFUL' then
      t := 'Payment received';
      b := 'Order ' || ref || ' is paid. We''re preparing it now.';
    when 'COMPLETED' then
      t := 'Order complete';
      b := 'Order ' || ref || ' is complete. Tell us how it was.';
    when 'FAILED' then
      t := 'Payment didn''t go through';
      b := coalesce(nullif(new.failure_reason, '') || '. Nothing was charged.',
                    'Order ' || ref || ' wasn''t paid, so nothing was charged.');
    when 'REFUNDED' then
      t := 'Order refunded';
      b := 'Order ' || ref || ' was refunded.';
    when 'DISPUTED' then
      t := 'Order in dispute';
      b := 'We''re looking into order ' || ref || '. We''ll be in touch.';
    else
      return new;
  end case;

  insert into public.notifications (user_id, kind, title, body, href, data, dedupe_key)
  values (
    new.user_id, 'order', t, b, '/order/' || new.id,
    -- 'push: false' = keep it in the inbox but don't buzz the phone: the shopper is looking at the MoMo prompt.
    jsonb_build_object('order_id', new.id, 'status', new.payment_status)
      || case when new.payment_status = 'PENDING' then jsonb_build_object('push', false) else '{}'::jsonb end,
    'order:' || new.id || ':' || new.payment_status
  )
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

  return new;
end;
$$;

drop trigger if exists trg_notify_order_status on public.orders;
create trigger trg_notify_order_status
  after insert or update of payment_status on public.orders
  for each row execute function public.notify_order_status();

-- Existing orders from the last 30 days get their current-state notification,
-- already marked read (and already 'pushed') so nobody opens the app to a wall of
-- unread items and no old news is ever sent as a push.
insert into public.notifications (user_id, kind, title, body, href, data, dedupe_key, created_at, read_at, pushed_at)
select
  o.user_id, 'order',
  case o.payment_status
    when 'PENDING' then 'Waiting for your payment'
    when 'SUCCESSFUL' then 'Payment received'
    when 'COMPLETED' then 'Order complete'
    when 'FAILED' then 'Payment didn''t go through'
    when 'REFUNDED' then 'Order refunded'
    else 'Order in dispute'
  end,
  '',
  '/order/' || o.id,
  jsonb_build_object('order_id', o.id, 'status', o.payment_status),
  'order:' || o.id || ':' || o.payment_status,
  coalesce(o.updated_at, o.created_at, now()),
  now(),
  now()
from public.orders o
where o.user_id is not null
  and o.payment_status in ('PENDING', 'SUCCESSFUL', 'COMPLETED', 'FAILED', 'REFUNDED', 'DISPUTED')
  and coalesce(o.updated_at, o.created_at) > now() - interval '30 days'
on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
