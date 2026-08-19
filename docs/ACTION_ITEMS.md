# Your Action Items — LitwaysPicks Mobile

These are steps **only you can do** (they need Supabase dashboard / Expo account / device access that I can't reach from the code). Each one unblocks or completes a fix I've already made in the app. Check them off as you go.

Last updated: 2026-07-03

---

## 🔴 Do soon — these complete fixes already merged in code

### [ ] 1. Add the password-reset redirect URL (completes A-05)
The in-app "set new password" flow is built and points the reset email at `litwaypicks://new-password`. Supabase will only honor that redirect if it's allow-listed.

**Steps:**
1. Supabase dashboard → **Authentication → URL Configuration → Redirect URLs**.
2. Add: `litwaypicks://new-password`
3. (Optional but tidy) also add: `litwaypicks://reset-password`
4. Save.

**Test after:** trigger "Forgot password?" in the app → open the email link on your phone → you should land on the new-password screen and be able to set a password.

---

### [ ] 2. Create the new-user profile trigger (completes A-04)
Because email confirmation is ON, new signups have no session yet, so the app can't create the profile row directly (RLS blocks it). I've changed the app to send the name via signup metadata; this trigger creates the `public.users` row automatically from that metadata.

**Steps:** Supabase dashboard → **SQL Editor** → New query → paste and **Run**:

```sql
-- Auto-create a public.users profile row whenever an auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, first_name, last_name, email, city, country, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(new.raw_user_meta_data ->> 'last_name', ''),
    new.email,
    '',
    'Liberia',
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

**Notes:**
- `security definer` lets the trigger bypass RLS; `on conflict do nothing` makes it safe to re-run.
- Safe for existing users — it only fires on *new* signups. Existing accounts without a profile row are unaffected (tell me if you want a one-time backfill script for those).

**Test after:** register a brand-new account in the app → verify a row appears in the `users` table with the first/last name you entered.

---

## 🔵 Verify with the backend team (payment fixes just merged)

### [ ] 4. Confirm the payment realtime filter column (B-02)
Checkout listens for order updates with `filter: external_id = <referenceId>`. But the `orders` table has **two** columns — `external_id` *and* `reference_id` — and the payment API returns **two** values, `referenceId` *and* `externalId`. Strong chance the MoMo `referenceId` is actually stored in **`reference_id`**, meaning the current realtime filter never matches and every confirmation relies on the (new) polling fallback instead of instant realtime.

**What to confirm:** which `orders` column receives the payment `referenceId`?
- If it's `reference_id`, tell me and I'll change the filter to `reference_id=eq.…` (one line).
- If it's genuinely `external_id`, no change needed.

*(Not urgent — the new polling fallback confirms payments either way, just up to ~6s slower if the filter is wrong.)*

### [ ] 5. Confirm the MoMo phone-number format (B-04)
The app now validates the phone as a Liberian mobile and normalizes it to **`231XXXXXXXX`** (international MSISDN, no `+`) before sending to `/api/momo/pay`.

**What to confirm:** does the MoMo backend expect exactly that format? If it wants `0XXXXXXXX`, `+231…`, or something else, tell me — it's a one-line change in [lib/phone.ts](../lib/phone.ts) (`normalizeLiberianPhone`).

---

## 🟡 Coming up — needed for the next fix (A-03, push notifications)

### [ ] 3. Provide/confirm the EAS project (needed for A-03)
Push notifications can't mint a device token in a real build without an EAS project ID, and there's nowhere to store the token yet. When we start A-03 you'll need to:
1. Have an **Expo account** and run `eas login` (CLI is already installed).
2. Run `eas init` in the project (creates the project + writes the `projectId` into `app.json`), **or** paste me the existing project ID.
3. I'll add a `push_token` column / device-tokens table (SQL I'll provide) so the backend can send to devices.

*(No action needed yet — just a heads-up on what A-03 will require from you.)*

---

## ✅ Reference — already handled in code (no action from you)
- **A-01** TypeScript build fixed (0 errors) + `npm run typecheck` gate added.
- **A-02** Cart now syncs to the server on change.
- **A-05** New-password screen + reset flow built *(needs item #1 above to work end-to-end)*.
- **A-04** Signup now sends name via metadata + client insert removed *(needs item #2 above to work end-to-end)*.

See [MOBILE_APP_AUDIT.md](MOBILE_APP_AUDIT.md) for the full tracker.
