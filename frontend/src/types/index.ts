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

export interface Coin {
  id: number;
  name: string;
  year: number;
  weight: number;
  weight_unit: string;
  diameter: number | null;
  denomination: string | null;
  composition: string | null;
  grade: string | null;
  catalog_number: string | null;
  extra_info: string | null;
  mintage: number | null;
  price: number | null;
  is_for_sale: boolean;
  country: Country;
  metal: Metal;
  owner: UserPublic;
  images: CoinImage[];
  is_favourite: boolean;
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
  catalog_number?: string | null;
  extra_info?: string | null;
  mintage?: number | null;
  price: number;
  is_for_sale?: boolean;
}

export type CoinUpdatePayload = Partial<Omit<CoinCreatePayload, "is_for_sale">>;

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

export interface CoinFacets {
  metals: MetalFacet[];
  grades: string[];
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
  catalog_number: string | null;
  mintage: number | null;
  extra_info: string | null;
}
