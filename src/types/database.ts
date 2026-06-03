/**
 * TypeScript types that mirror the database schema (the SQL migrations in
 * `supabase/migrations/`). Keeping these in sync gives you autocomplete and
 * compile-time checks when querying Supabase.
 *
 * KEEPING THIS IN SYNC:
 *   When you change the schema, update this file too. If you later install the
 *   Supabase CLI, you can auto-generate this instead:
 *     npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 *   For now it is hand-written so no extra tooling is required.
 */

/** Postgres JSON value. */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// --- Enums (mirror the CREATE TYPE statements) -------------------------------
export type UserRole = "user" | "admin";

export type SubscriptionStatus =
  | "free"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

export type AdapterType =
  | "rest_api"
  | "third_party_vendor"
  | "csv_flyer_import"
  | "manual_entry";

// --- Row shapes (one interface per table) ------------------------------------
// `string` is used for timestamptz/uuid columns (Supabase returns them as ISO
// strings). `number` is used for numeric/double columns.

export interface Profile {
  id: string;
  display_name: string | null;
  home_postal_code: string | null;
  home_lat: number | null;
  home_lng: number | null;
  role: UserRole;
  subscription_status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface Store {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  default_currency: string;
  created_at: string;
  updated_at: string;
}

export interface StoreBranch {
  id: string;
  store_id: string;
  name: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  lat: number | null;
  lng: number | null;
  hours: Json | null;
  created_at: string;
  updated_at: string;
}

export interface DataSource {
  id: string;
  store_id: string;
  adapter_type: AdapterType;
  config: Json;
  refresh_interval_minutes: number;
  is_active: boolean;
  last_run: string | null;
  last_status: string;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  package_size: string | null;
  barcode: string | null;
  normalized_key: string;
  created_at: string;
  updated_at: string;
}

export interface Price {
  id: string;
  product_id: string;
  branch_id: string;
  source_id: string;
  regular_price: number;
  sale_price: number | null;
  unit_price_value: number | null;
  unit_price_unit: string | null;
  in_stock: boolean;
  currency: string;
  valid_from: string;
  last_updated: string;
  created_at: string;
}

export interface GroceryList {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface GroceryListItem {
  id: string;
  list_id: string;
  raw_text: string;
  product_id: string | null;
  quantity: number;
  created_at: string;
}

export interface SearchLog {
  id: string;
  user_id: string | null;
  query: string;
  result_count: number | null;
  searched_at: string;
}

/**
 * Helper: build the Insert/Update shapes for a table from its Row type.
 * `Generated` = columns the DB fills in for you (so they are optional on insert).
 */
type Insertable<Row, Generated extends keyof Row> = Omit<Row, Generated> &
  Partial<Pick<Row, Generated>>;

// Columns the database auto-generates/defaults (optional when inserting).
type Timestamps = "created_at" | "updated_at";

/**
 * The `Database` type consumed by the Supabase client (`createClient<Database>`).
 * This is the shape supabase-js expects; it powers typed `.from("table")` calls.
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Insertable<Profile, Timestamps | "role" | "subscription_status">;
        Update: Partial<Profile>;
        Relationships: [];
      };
      stores: {
        Row: Store;
        Insert: Insertable<Store, "id" | Timestamps | "default_currency">;
        Update: Partial<Store>;
        Relationships: [];
      };
      store_branches: {
        Row: StoreBranch;
        Insert: Insertable<StoreBranch, "id" | Timestamps>;
        Update: Partial<StoreBranch>;
        Relationships: [];
      };
      data_sources: {
        Row: DataSource;
        Insert: Insertable<
          DataSource,
          "id" | Timestamps | "config" | "refresh_interval_minutes" | "is_active" | "last_status"
        >;
        Update: Partial<DataSource>;
        Relationships: [];
      };
      products: {
        Row: Product;
        Insert: Insertable<Product, "id" | Timestamps>;
        Update: Partial<Product>;
        Relationships: [];
      };
      prices: {
        Row: Price;
        Insert: Insertable<
          Price,
          "id" | "created_at" | "valid_from" | "last_updated" | "in_stock" | "currency"
        >;
        Update: Partial<Price>;
        Relationships: [];
      };
      grocery_lists: {
        Row: GroceryList;
        Insert: Insertable<GroceryList, "id" | Timestamps | "name">;
        Update: Partial<GroceryList>;
        Relationships: [];
      };
      grocery_list_items: {
        Row: GroceryListItem;
        Insert: Insertable<GroceryListItem, "id" | "created_at" | "quantity">;
        Update: Partial<GroceryListItem>;
        Relationships: [];
      };
      searches_log: {
        Row: SearchLog;
        Insert: Insertable<SearchLog, "id" | "searched_at">;
        Update: Partial<SearchLog>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: {
      user_role: UserRole;
      subscription_status: SubscriptionStatus;
      adapter_type: AdapterType;
    };
    CompositeTypes: Record<string, never>;
  };
}
