-- Indexes for the sorts/filters Shop and category pages page through.
-- Every sort ends in id so paging is deterministic.
create index if not exists idx_products_price on public.products (price, id);
create index if not exists idx_products_rating on public.products (rating desc nulls last, id);
create index if not exists idx_products_featured_created on public.products (featured desc, created_at desc, id);
create index if not exists idx_products_category_featured_created on public.products (category_slug, featured desc, created_at desc, id);
create index if not exists idx_products_brand on public.products (brand);
create index if not exists idx_products_sizes_gin on public.products using gin (sizes);
-- Search matches description and brand with ILIKE '%term%' too (name/keywords already had these).
create index if not exists idx_products_description_trgm on public.products using gin (description gin_trgm_ops);
create index if not exists idx_products_brand_trgm on public.products using gin (brand gin_trgm_ops);
