// Sends a push for a notification row. NOT deployed yet: see docs/NOTIFICATIONS.md for rollout.
//
// Wire it up as a Database Webhook on INSERT into public.notifications, with the
// header `Authorization: Bearer <PUSH_WEBHOOK_SECRET>`. It looks up the shopper's
// Expo push tokens, sends one message per device, prunes tokens Expo reports as
// dead, and stamps pushed_at so a retry can't send twice.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (both provided by Supabase),
//      PUSH_WEBHOOK_SECRET (set with `supabase secrets set`).
import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');

interface NotificationRow {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  data: Record<string, unknown> | null;
  pushed_at: string | null;
}

Deno.serve(async (req) => {
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('unauthorized', { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const n = payload?.record as NotificationRow | undefined;
  if (payload?.type !== 'INSERT' || !n?.id || !n.user_id) return new Response('ignored');
  // Already sent (retry), or deliberately silent (e.g. "waiting for payment", old backfilled rows).
  if (n.pushed_at || n.data?.push === false) return new Response('skipped');

  const { data: tokens, error } = await supabase.from('push_tokens').select('token').eq('user_id', n.user_id);
  if (error) return new Response(`token lookup failed: ${error.message}`, { status: 500 });
  if (!tokens?.length) return new Response('no devices');

  const messages = tokens.map((t) => ({
    to: t.token,
    title: n.title,
    body: n.body,
    sound: 'default',
    channelId: 'orders',
    // `screen` is what the app's tap handler follows; notification_id lets the app
    // link the push to this inbox row instead of showing it twice.
    data: { screen: n.href ?? undefined, type: n.kind, notification_id: n.id },
  }));

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  if (!res.ok) return new Response(`expo push failed: ${res.status}`, { status: 502 });

  const { data: tickets } = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
  const dead = (tickets ?? [])
    .map((tk, i) => (tk.status === 'error' && tk.details?.error === 'DeviceNotRegistered' ? tokens[i].token : null))
    .filter((t): t is string => !!t);
  if (dead.length) await supabase.from('push_tokens').delete().in('token', dead);

  await supabase.from('notifications').update({ pushed_at: new Date().toISOString() }).eq('id', n.id);
  return new Response('sent');
});
