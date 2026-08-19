export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Marker consumed by @supabase/postgrest-js to select version-specific behavior.
  __InternalSupabase: {
    PostgrestVersion: '12'
  }
  public: {
    Tables: {
      admin_notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string
          read: boolean
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          message: string
          read?: boolean
          title: string
          type: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
        }
        Relationships: []
      }
      carts: {
        Row: {
          items: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          items?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          items?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          id: string
          image: string
          item_count: number
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          id: string
          image: string
          item_count?: number
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          image?: string
          item_count?: number
          name?: string
          slug?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount: number
          callback_data: Json | null
          callback_received: boolean
          created_at: string | null
          currency: string
          customer_email: string
          customer_first_name: string
          customer_last_name: string
          customer_phone: string
          delivery_address: string
          delivery_city: string
          delivery_state: string
          discount: number | null
          external_id: string
          failure_reason: string | null
          final_total: number
          financial_transaction_id: string | null
          id: string
          items: Json
          last_status_check: string | null
          loyalty_discount_applied: Json | null
          payment_confirmed_at: string | null
          payment_method: string
          payment_status: string
          points_earned: number | null
          reference_id: string | null
          subtotal: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          callback_data?: Json | null
          callback_received?: boolean
          created_at?: string | null
          currency?: string
          customer_email: string
          customer_first_name: string
          customer_last_name: string
          customer_phone: string
          delivery_address: string
          delivery_city: string
          delivery_state: string
          discount?: number | null
          external_id: string
          failure_reason?: string | null
          final_total: number
          financial_transaction_id?: string | null
          id?: string
          items: Json
          payment_method?: string
          payment_status?: string
          reference_id?: string | null
          subtotal: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          payment_status?: string
          updated_at?: string | null
          [key: string]: unknown
        }
        Relationships: []
      }
      products: {
        Row: {
          brand: string
          category_slug: string | null
          colors: string[] | null
          created_at: string | null
          description: string
          featured: boolean
          id: string
          image_urls: string[] | null
          keywords: string | null
          name: string
          price: number
          rating: number | null
          review_count: number | null
          sale_price: number | null
          sizes: string[] | null
          slug: string
          stock: number
          video_url: string | null
        }
        Insert: {
          brand: string
          category_slug?: string | null
          colors?: string[] | null
          created_at?: string | null
          description: string
          featured?: boolean
          id?: string
          image_urls?: string[] | null
          keywords?: string | null
          name: string
          price: number
          rating?: number | null
          review_count?: number | null
          sale_price?: number | null
          sizes?: string[] | null
          slug: string
          stock: number
          video_url?: string | null
        }
        Update: {
          brand?: string
          category_slug?: string | null
          colors?: string[] | null
          created_at?: string | null
          description?: string
          featured?: boolean
          id?: string
          image_urls?: string[] | null
          keywords?: string | null
          name?: string
          price?: number
          rating?: number | null
          review_count?: number | null
          sale_price?: number | null
          sizes?: string[] | null
          slug?: string
          stock?: number
          video_url?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          order_id: string
          product_id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          rating?: number
        }
        Relationships: []
      }
      users: {
        Row: {
          address: string | null
          city: string
          country: string
          created_at: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string | null
          phone: string | null
          role: string | null
        }
        Insert: {
          address?: string | null
          city: string
          country: string
          created_at?: string | null
          email?: string | null
          first_name: string
          id: string
          last_name?: string | null
          phone?: string | null
          role?: string | null
        }
        Update: {
          address?: string | null
          city?: string
          country?: string
          email?: string | null
          first_name?: string
          last_name?: string | null
          phone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      featured_products: {
        Row: {
          brand: string | null
          category_image: string | null
          category_name: string | null
          category_slug: string | null
          colors: string[] | null
          created_at: string | null
          description: string | null
          featured: boolean | null
          id: string | null
          image_urls: string[] | null
          keywords: string | null
          name: string | null
          price: number | null
          rating: number | null
          review_count: number | null
          sale_price: number | null
          sizes: string[] | null
          slug: string | null
          stock: number | null
          video_url: string | null
        }
        Relationships: []
      }
      products_with_categories: {
        Row: {
          brand: string | null
          category_image: string | null
          category_name: string | null
          category_slug: string | null
          colors: string[] | null
          created_at: string | null
          description: string | null
          featured: boolean | null
          id: string | null
          image_urls: string[] | null
          keywords: string | null
          name: string | null
          price: number | null
          rating: number | null
          review_count: number | null
          sale_price: number | null
          sizes: string[] | null
          slug: string | null
          stock: number | null
          video_url: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_distinct_brands: {
        Args: Record<PropertyKey, never>
        Returns: { brand: string }[]
      }
      get_my_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_product_by_slug: {
        Args: { product_slug: string }
        Returns: Database['public']['Views']['products_with_categories']['Row']
      }
      get_products_by_category: {
        Args: {
          category_slug_param: string
          page_limit?: number
          page_offset?: number
        }
        Returns: Database['public']['Views']['products_with_categories']['Row'][]
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      search_products: {
        Args: {
          search_term: string
          page_limit?: number
          page_offset?: number
        }
        Returns: Database['public']['Views']['products_with_categories']['Row'][]
      }
    }
    Enums: Record<string, never>
  }
}
