-- The backfill in ..._000003 inserted order notifications with an empty body. Fill them with the
-- same wording the order trigger uses so old items show their detail, not just a title.
update public.notifications n
set body = case o.payment_status
  when 'PENDING' then 'Approve the MoMo prompt on your phone to finish order ' || r.ref || '.'
  when 'SUCCESSFUL' then 'Order ' || r.ref || ' is paid. We''re preparing it now.'
  when 'COMPLETED' then 'Order ' || r.ref || ' is complete. Tell us how it was.'
  when 'FAILED' then coalesce(nullif(o.failure_reason, '') || '. Nothing was charged.', 'Order ' || r.ref || ' wasn''t paid, so nothing was charged.')
  when 'REFUNDED' then 'Order ' || r.ref || ' was refunded.'
  else 'We''re looking into order ' || r.ref || '. We''ll be in touch.'
end
from public.orders o
cross join lateral (
  select '#' || upper(case when upper(split_part(o.external_id, '-', 1)) = 'ORDER'
                           then split_part(o.external_id, '-', 2)
                           else split_part(o.external_id, '-', 1) end) as ref
) r
where n.kind = 'order'
  and n.body = ''
  and (n.data->>'order_id')::uuid = o.id;
