/**
 * Shared application types.
 *
 * Database row types live in `database.ts` (they mirror the SQL schema). The
 * normalized product shape that every data source adapter returns will be added
 * alongside the adapter interface in `src/lib/data-sources/types.ts` (Phase 3).
 */

export type {
  Database,
  Json,
  UserRole,
  SubscriptionStatus,
  AdapterType,
  Profile,
  Store,
  StoreBranch,
  DataSource,
  Product,
  Price,
  GroceryList,
  GroceryListItem,
  SearchLog,
} from "./database";
