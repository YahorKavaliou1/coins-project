export interface Country {
  id: number;
  name: string;
  code: string | null;
  region: string | null;
  is_historical: boolean;
}

export interface Metal {
  id: number;
  name: string;
}

export interface UserPublic {
  id: number;
  full_name: string | null;
}

export interface CoinImage {
  id: number;
  url: string;
  position: number;
  created_at: string;
}

/** for_sale: in the shop. withdrawn: taken off sale by its seller. sold: bought. */
export type CoinStatus = "for_sale" | "withdrawn" | "sold";

export interface Coin {
  id: number;
  name: string;
  created_at: string;
  year: number;
  weight: number;
  weight_unit: string;
  diameter: number | null;
  denomination: string | null;
  composition: string | null;
  grade: string | null;
  category: string | null;
  labels: string[];
  sku: string | null;
  source_url: string | null;
  catalog_number: string | null;
  extra_info: string | null;
  mintage: number | null;
  price: number | null;
  status: CoinStatus;
  /** status === "for_sale" */
  is_for_sale: boolean;
  country: Country;
  metal: Metal;
  owner: UserPublic;
  images: CoinImage[];
  is_favourite: boolean;
}

/** How a sold lot was bought: what its seller needs to ship it. */
export interface SaleInfo {
  order_id: number;
  sold_at: string;
  price_paid: number;
  buyer_name: string | null;
  shipping_address: string;
}

export interface MyLot extends Coin {
  sale: SaleInfo | null;
}

export interface MyLotsPage {
  items: MyLot[];
  total: number;
  page: number;
  page_size: number;
  counts: Record<CoinStatus, number>;
}

export interface CoinPage {
  items: Coin[];
  total: number;
  page: number;
  page_size: number;
}

export interface CoinCreatePayload {
  country_id: number;
  metal_id: number;
  year: number;
  weight: number;
  weight_unit: string;
  diameter?: number | null;
  denomination?: string | null;
  composition?: string | null;
  grade?: string | null;
  category?: string | null;
  labels?: string[];
  sku?: string | null;
  source_url?: string | null;
  catalog_number?: string | null;
  extra_info?: string | null;
  mintage?: number | null;
  price: number;
}

export type CoinUpdatePayload = Partial<CoinCreatePayload>;

export type UserRole = "user" | "seller" | "admin";

export type BlockReason = "admin";

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  is_blocked: boolean;
  blocked_reason: BlockReason | null;
  blocked_at: string | null;
  failed_login_attempts: number;
  /** Temporary lock after too many wrong passwords; in the past once it has expired. */
  locked_until: string | null;
  verification_deadline: string | null;
}

export type AdminActionType =
  | "role_changed"
  | "blocked"
  | "unblocked"
  | "email_verified"
  | "verification_resent";

/** An entry of the admin audit log. */
export interface AdminAction {
  id: number;
  admin_email: string;
  action: AdminActionType;
  details: string | null;
  created_at: string;
}

export interface CartItemRead {
  id: number;
  coin: Coin;
}

export interface Cart {
  items: CartItemRead[];
  total_price: number;
}

export interface OrderItemRead {
  id: number;
  coin_id: number;
  coin_name_snapshot: string;
  price_paid: number;
  seller_id: number;
}

export interface Order {
  id: number;
  shipping_address: string;
  total_price: number;
  status: string;
  created_at: string;
  items: OrderItemRead[];
}

export type MetalFacet = Pick<Metal, "id" | "name">;

export interface LabelFacet {
  name: string;
  /** Matching coins; the facet comes sorted by it, most used first. */
  count: number;
}

export interface CoinFacets {
  metals: MetalFacet[];
  grades: string[];
  categories: string[];
  labels: LabelFacet[];
}

export interface ImportTable {
  filename: string;
  columns: string[];
  rows: string[][];
}

export interface CoinBatchItem {
  country_id: number;
  metal_id: number;
  year: number;
  weight: number;
  weight_unit: "oz" | "g" | "kg";
  price: number;
  denomination: string | null;
  composition: string | null;
  diameter: number | null;
  grade: string | null;
  category: string | null;
  labels: string[];
  sku: string | null;
  source_url: string | null;
  catalog_number: string | null;
  mintage: number | null;
  extra_info: string | null;
}
