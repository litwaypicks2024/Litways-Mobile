import type { Database } from './database.types';

export type Category = Database['public']['Tables']['categories']['Row'];
export type UserProfile = Database['public']['Tables']['users']['Row'];
export type Order = Database['public']['Tables']['orders']['Row'];
export type Review = Database['public']['Tables']['reviews']['Row'];

export type Product = Database['public']['Views']['products_with_categories']['Row'];

export type PaymentStatus =
  | 'PENDING'
  | 'SUCCESSFUL'
  | 'FAILED'
  | 'COMPLETED'
  | 'REFUNDED'
  | 'DISPUTED';

export interface CartItem {
  productId: string;
  name: string;
  brand: string;
  price: number;
  /** The list price, present only when this item was added while on sale.
   * `price` above is always the EFFECTIVE price and is what every subtotal/
   * checkout total is computed from — `listPrice` is display-only (the
   * struck-through price on the Cart screen). */
  listPrice?: number;
  imageUrl: string;
  size?: string;
  color?: string;
  quantity: number;
  stock: number;
  slug: string;
}

export interface WishlistItem {
  productId: string;
  name: string;
  brand: string;
  price: number;
  salePrice?: number;
  imageUrl: string;
  slug: string;
  stock: number;
}

export interface OrderItem {
  id: string;
  name: string;
  brand: string;
  price: number;
  quantity: number;
  size?: string;
  color?: string;
  imageUrl?: string;
}

export interface CheckoutForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  county: string;
}

export type SortOption = 'featured' | 'price_asc' | 'price_desc' | 'newest' | 'rating' | 'name_asc';

export interface ProductFilters {
  search?: string;
  categorySlug?: string;
  minPrice?: number;
  maxPrice?: number;
  brands?: string[];
  sizes?: string[];
  sort?: SortOption;
}
