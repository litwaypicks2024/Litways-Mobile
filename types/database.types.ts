export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
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
          last_status_check?: string | null
          loyalty_discount_applied?: Json | null
          payment_confirmed_at?: string | null
          payment_method?: string
          payment_status?: string
          points_earned?: number | null
          reference_id?: string | null
          subtotal: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          callback_data?: Json | null
          callback_received?: boolean
          created_at?: string | null
          currency?: string
          customer_email?: string
          customer_first_name?: string
          customer_last_name?: string
          customer_phone?: string
          delivery_address?: string
          delivery_city?: string
          delivery_state?: string
          discount?: number | null
          external_id?: string
          failure_reason?: string | null
          final_total?: number
          financial_transaction_id?: string | null
          id?: string
          items?: Json
          last_status_check?: string | null
          loyalty_discount_applied?: Json | null
          payment_confirmed_at?: string | null
          payment_method?: string
          payment_status?: string
          points_earned?: number | null
          reference_id?: string | null
          subtotal?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      product_images: {
        Row: {
          created_at: string | null
          id: string
          product_id: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          url?: string
        }
        Relationships: []
      }
      product_tags: {
        Row: {
          created_at: string | null
          id: string
          product_id: string | null
          tag: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          tag: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_tags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "featured_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_categories"
            referencedColumns: ["id"]
          },
        ]
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
          stock?: number
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
        Relationships: [
          {
            foreignKeyName: "products_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
        ]
      }
      push_tokens: {
        Row: {
          platform: string | null
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          platform?: string | null
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          platform?: string | null
          token?: string
          updated_at?: string
          user_id?: string
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
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "featured_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_categories"
            referencedColumns: ["id"]
          },
        ]
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
          created_at?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string | null
          phone?: string | null
          role?: string | null
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          created_at: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "featured_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_categories"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "products_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "products_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
        ]
      }
    }
    Functions: {
      get_distinct_brands: {
        Args: never
        Returns: {
          brand: string
        }[]
      }
      get_my_role: { Args: never; Returns: string }
      get_order_stats: { Args: never; Returns: Json }
      get_product_by_slug: {
        Args: { product_slug: string }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "products_with_categories"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_products_by_category:
        | {
            Args: { category_slug_param: string }
            Returns: {
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
            }[]
            SetofOptions: {
              from: "*"
              to: "products_with_categories"
              isOneToOne: false
              isSetofReturn: true
            }
          }
        | {
            Args: {
              category_slug_param: string
              page_limit?: number
              page_offset?: number
            }
            Returns: {
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
            }[]
            SetofOptions: {
              from: "*"
              to: "products_with_categories"
              isOneToOne: false
              isSetofReturn: true
            }
          }
      is_admin: { Args: never; Returns: boolean }
      search_products:
        | {
            Args: { search_term: string }
            Returns: {
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
            }[]
            SetofOptions: {
              from: "*"
              to: "products_with_categories"
              isOneToOne: false
              isSetofReturn: true
            }
          }
        | {
            Args: {
              page_limit?: number
              page_offset?: number
              search_term: string
            }
            Returns: {
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
            }[]
            SetofOptions: {
              from: "*"
              to: "products_with_categories"
              isOneToOne: false
              isSetofReturn: true
            }
          }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
