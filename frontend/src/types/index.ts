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

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_verified: boolean;
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
