import { supabase } from '@/lib/supabase';
import { useCartStore } from '@/store/cart';
import { useWishlistStore } from '@/store/wishlist';
import type { WishlistItem } from '@/types';

export interface MoveResult {
  moved: WishlistItem[];
  /** Have several sizes/colours, so the shopper has to choose — left in Favorites. */
  needsChoice: WishlistItem[];
  /** Out of stock or no longer listed — left in Favorites. */
  unavailable: WishlistItem[];
  /** Already in the cart at the full available stock — left in Favorites. */
  atLimit: WishlistItem[];
}

/**
 * Move saved items into the cart in one go. Uses fresh catalogue data (price,
 * stock, options) rather than what was saved, and follows the same rule as the
 * card's + button: a product with a real choice of size/colour is never added
 * blindly. Whatever is added leaves Favorites; the rest stays put.
 */
export async function moveFavoritesToCart(items: WishlistItem[]): Promise<MoveResult> {
  const result: MoveResult = { moved: [], needsChoice: [], unavailable: [], atLimit: [] };
  if (!items.length) return result;

  const { data, error } = await supabase
    .from('products')
    .select('id, name, brand, price, sale_price, image_urls, slug, stock, sizes, colors')
    .in('id', items.map((i) => i.productId));
  if (error) throw error;

  const fresh = new Map((data ?? []).map((p) => [p.id, p]));
  const cart = useCartStore.getState();
  const wishlist = useWishlistStore.getState();

  for (const item of items) {
    const p = fresh.get(item.productId);
    if (!p || (p.stock ?? 0) <= 0) { result.unavailable.push(item); continue; }
    const sizes = p.sizes ?? [];
    const colors = p.colors ?? [];
    if (sizes.length > 1 || colors.length > 1) { result.needsChoice.push(item); continue; }

    const inCart = useCartStore.getState().items.reduce((n, i) => (i.productId === p.id ? n + i.quantity : n), 0);
    if (inCart >= p.stock) { result.atLimit.push(item); continue; }

    const onSale = p.sale_price != null && p.sale_price < p.price;
    cart.addItem({
      productId: p.id,
      name: p.name,
      brand: p.brand,
      price: onSale ? p.sale_price! : p.price,
      listPrice: onSale ? p.price : undefined,
      imageUrl: p.image_urls?.[0] ?? item.imageUrl,
      slug: p.slug,
      stock: p.stock,
      size: sizes[0],
      color: colors[0],
    });
    wishlist.removeItem(item.productId);
    result.moved.push(item);
  }
  return result;
}
