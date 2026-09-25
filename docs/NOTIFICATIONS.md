# Notifications: how it works and how to roll it out

## What exists today (client only)

The app's inbox merges three sources on the device: order updates derived from the `orders` table, saved-item alerts (price drop / back in stock) detected against the catalogue, and pushes captured when received or found in the tray. Nothing is stored server-side, so a second phone shows nothing the first one captured, and no push is ever sent (see findings).

## Findings from inspecting the live project (read-only)

| Finding | Consequence |
|---|---|
| `supabase_realtime` publication has **no tables** | Every realtime subscription (checkout's live payment tracking, the inbox refresh) receives nothing. Only the 6-second polling fallback works. Fixed by migration `…000004`. |
| `push_tokens` has **0 rows** | No device has ever registered for pushes. Registration only ran after sign-in, on dev/production builds. The onboarding pre-prompt now asks guests too. |
| No edge functions; `pg_net` not enabled | Nothing in the project sends pushes. Whatever sends them lives outside it (or nothing does). |
| `orders.payment_status` values in use: PENDING, SUCCESSFUL, COMPLETED, FAILED, REFUNDED | The trigger covers these plus DISPUTED. |
| `orders` RLS: owner reads by `user_id` or `customer_email` | Realtime respects it, so publishing `orders` only delivers a shopper's own rows. |

## Design

```
orders.payment_status changes
        │  (trigger notify_order_status, SECURITY DEFINER)
        ▼
public.notifications  ──(Database Webhook, INSERT)──►  Edge Function send-push ──► Expo Push ──► phone
        │                                                     │
        │ realtime (RLS: own rows)                            └─ prunes dead tokens, stamps pushed_at
        ▼
the app's inbox (read / unread / delete write back to the row)
```

* **`public.notifications`**: `user_id, kind, title, body, href, image_url, data, dedupe_key, created_at, read_at, pushed_at`. Shoppers can read and delete their own rows and change **only** `read_at` (column-level grant); nobody but the database/service role can insert. `dedupe_key` (unique per user) makes every writer idempotent. The newest 100 per shopper are kept.
* **Order trigger**: one row per status change, worded like the app's `orderEvent()`. `PENDING` rows carry `data.push = false`: they belong in the inbox but must not buzz the phone while the shopper is looking at the MoMo prompt.
* **Backfill**: orders from the last 30 days get their current-state row, pre-marked read **and pre-marked pushed**, so nobody opens the app to a wall of unread items and no old news is ever pushed.
* **send-push** (draft, `supabase/functions/send-push`): looks up the shopper's tokens, sends one Expo message per device with `data.screen` (the app's tap target) and `data.notification_id` (so the app links the push to the inbox row instead of showing it twice), removes tokens Expo reports as `DeviceNotRegistered`, stamps `pushed_at`.
* **The app** reads `notifications` when the table exists and falls back to deriving order updates from `orders` when it doesn't, so the client can ship **before** the migration is applied. Once it is applied, the server rows replace the derived ones (no duplicates).

## Rollout checklist (nothing below has been applied)

1. **Review, then apply** `20260925000003_notifications_inbox.sql` and `20260925000004_realtime_orders_notifications.sql` (Supabase SQL editor or `supabase db push`). Tested on a throwaway Postgres 17; see `supabase/tests/README.md`. Enabling realtime on `orders` also switches on checkout's live payment tracking, which has been running on polling alone.
2. **Regenerate types**: `supabase gen types typescript` (or the MCP `generate_typescript_types`) so `notifications` is typed; the client currently casts the table name.
3. **Deploy the sender**: `supabase secrets set PUSH_WEBHOOK_SECRET=<random>` then `supabase functions deploy send-push --no-verify-jwt`.
4. **Create the webhook**: Dashboard → Database → Webhooks → table `notifications`, event `INSERT`, HTTP POST to the function URL, header `Authorization: Bearer <PUSH_WEBHOOK_SECRET>`.
5. **Confirm with the web backend team** that the web app doesn't already push order updates. If it does, either drop that or set `data.push = false` on order rows so shoppers don't get two.
6. **Test end to end** on a physical device (pushes don't work in Expo Go or on the simulator): sign in, allow notifications, place a test order, approve the prompt; expect an inbox row within a second and a push on `SUCCESSFUL`.

## Not covered

* **Stock and price alerts, promos** are still detected on the device (saved items) or absent (promos). Server-side versions are just more writers into `notifications` (a scheduled function comparing `wishlists` with the catalogue; an admin tool for promos): the table, RLS, push and app already handle them.
* **Per-category push preferences**: there is no preferences table. Add one and have `send-push` consult it before sending.
* **Email / SMS**: out of scope.
