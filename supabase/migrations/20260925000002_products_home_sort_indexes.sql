-- Home's "New arrivals" sorts by created_at; "Deals" filters sale_price and sorts by created_at.
create index if not exists idx_products_created_at on public.products (created_at desc);
create index if not exists idx_products_deals_created_at on public.products (created_at desc) where sale_price is not null;
