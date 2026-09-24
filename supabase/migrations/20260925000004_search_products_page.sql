-- Server-side search page: match, filter, sort and page in the database.
-- The older search_products(term, limit, offset) had no ORDER BY (pages could repeat or skip rows)
-- and the app filtered/sorted each 24-row page on the client, so sorts and filters only applied
-- within a page. This one is additive; the old functions are left in place.

create or replace function public.search_products_page(
  search_term text,
  category_slug_param text default null,
  sale_only boolean default false,
  min_price numeric default null,
  max_price numeric default null,
  brands_param text[] default null,
  sizes_param text[] default null,
  sort_key text default 'featured',
  page_limit integer default 24,
  page_offset integer default 0
)
returns setof public.products_with_categories
language sql
stable
set search_path to 'public'
as $$
  with q as (
    select '%' || replace(replace(replace(coalesce(search_term, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
  )
  select p.*
  from public.products_with_categories p, q
  where (
      p.name          ilike q.pat or
      p.description   ilike q.pat or
      p.brand         ilike q.pat or
      p.category_name ilike q.pat or
      p.keywords      ilike q.pat or
      exists (select 1 from public.product_tags pt where pt.product_id = p.id and pt.tag ilike q.pat)
    )
    and (category_slug_param is null or p.category_slug = category_slug_param)
    and (not sale_only or (p.sale_price is not null and p.sale_price < p.price))
    and (min_price is null or p.price >= min_price)
    and (max_price is null or p.price <= max_price)
    and (brands_param is null or cardinality(brands_param) = 0 or p.brand = any (brands_param))
    and (sizes_param is null or cardinality(sizes_param) = 0 or p.sizes && sizes_param)
  order by
    case when sort_key = 'price_asc'  then p.price end asc,
    case when sort_key = 'price_desc' then p.price end desc,
    case when sort_key = 'newest'     then p.created_at end desc,
    case when sort_key = 'rating'     then p.rating end desc nulls last,
    -- default ("featured"): best textual match first, then featured, then newest
    case when sort_key not in ('price_asc', 'price_desc', 'newest', 'rating')
         then case when p.name ilike q.pat then 0 when p.brand ilike q.pat then 1 else 2 end end asc,
    case when sort_key not in ('price_asc', 'price_desc', 'newest', 'rating') then p.featured end desc,
    p.created_at desc,
    p.id
  limit least(greatest(page_limit, 1), 100)
  offset greatest(page_offset, 0)
$$;

-- Category breakdown of the WHOLE result set (ignoring the category chip), so the chips
-- describe every match, not just the pages loaded so far.
create or replace function public.search_category_counts(
  search_term text,
  sale_only boolean default false,
  min_price numeric default null,
  max_price numeric default null,
  brands_param text[] default null,
  sizes_param text[] default null
)
returns table (slug text, name text, n bigint)
language sql
stable
set search_path to 'public'
as $$
  with q as (
    select '%' || replace(replace(replace(coalesce(search_term, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
  )
  select p.category_slug, p.category_name, count(*)
  from public.products_with_categories p, q
  where (
      p.name          ilike q.pat or
      p.description   ilike q.pat or
      p.brand         ilike q.pat or
      p.category_name ilike q.pat or
      p.keywords      ilike q.pat or
      exists (select 1 from public.product_tags pt where pt.product_id = p.id and pt.tag ilike q.pat)
    )
    and p.category_slug is not null
    and (not sale_only or (p.sale_price is not null and p.sale_price < p.price))
    and (min_price is null or p.price >= min_price)
    and (max_price is null or p.price <= max_price)
    and (brands_param is null or cardinality(brands_param) = 0 or p.brand = any (brands_param))
    and (sizes_param is null or cardinality(sizes_param) = 0 or p.sizes && sizes_param)
  group by p.category_slug, p.category_name
  order by count(*) desc, p.category_slug
$$;
