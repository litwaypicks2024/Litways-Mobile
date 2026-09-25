# Migration tests

Behaviour tests for the notifications migrations, run against a throwaway Postgres (never the real project):

```sh
initdb -D /tmp/pgdata -U postgres --auth=trust
pg_ctl -D /tmp/pgdata -o "-p 54329 -c listen_addresses='' -c unix_socket_directories=/tmp" start
createdb -h /tmp -p 54329 -U postgres t1
psql -h /tmp -p 54329 -U postgres -d t1 -v ON_ERROR_STOP=1 \
  -f supabase/tests/stub_supabase.sql \
  -f supabase/migrations/20260925000003_notifications_inbox.sql \
  -f supabase/migrations/20260925000004_realtime_orders_notifications.sql \
  -f supabase/tests/notifications_inbox.test.sql
```

`stub_supabase.sql` fakes just enough of Supabase (roles, `auth.users`, `auth.uid()`, a minimal `orders` table with a few pre-existing rows) for the migration to apply. Every check prints `ok: …`; any failure raises an error.
