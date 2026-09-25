import { PixelRatio } from 'react-native';
import type { Product } from '@/types';

/**
 * Only the columns a product card draws or acts on. List screens select these
 * instead of `*` so descriptions, keywords, video and category images never
 * travel, get parsed, sit in the query cache or land in the persisted copy.
 * The product page still loads the full row.
 */
export const CARD_COLUMNS =
  'id,name,slug,brand,price,sale_price,stock,rating,review_count,image_urls,sizes,colors,category_slug,category_name';

/** What a card needs. Sizes/colours are optional: the recently-viewed snapshot doesn't keep them. */
export type CardProduct = Pick<
  Product,
  | 'id' | 'name' | 'slug' | 'brand' | 'price' | 'sale_price' | 'stock'
  | 'rating' | 'review_count' | 'image_urls' | 'category_slug' | 'category_name'
> &
  Partial<Pick<Product, 'sizes' | 'colors'>>;

const PEXELS = 'https://images.pexels.com/';

/**
 * Ask the image host for the pixels we will actually draw. The catalogue
 * stores 800px-wide originals; a 172pt card at 3x needs ~516px. Decoded
 * bitmaps cost width x height x 4 bytes, so this roughly halves the RAM each
 * card image holds. Widths snap to a multiple of 40 so nearby sizes share one
 * cache entry. Non-Pexels URLs pass through untouched.
 */
export function thumb(url: string | null | undefined, points: number): string | undefined {
  if (!url) return undefined;
  if (!url.startsWith(PEXELS)) return url;
  const px = Math.ceil((points * Math.min(PixelRatio.get(), 3)) / 40) * 40;
  return /[?&]w=\d+/.test(url) ? url.replace(/([?&])w=\d+/, `$1w=${px}`) : url;
}

/** Keep the first occurrence of each id. Offset paging can repeat a row if the catalogue changes between two page loads. */
export function dedupeById<T extends { id: string | null }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    if (r.id) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
    }
    out.push(r);
  }
  return out;
}
