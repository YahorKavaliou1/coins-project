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
  /** The photo in high quality, for the coin's page. */
  url: string;
  /** Small WebP for cards and lists; see utils/images.ts. */
  thumbnail_url: string | null;
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
  order_status: OrderStatus;
  tracking_code: string | null;
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

/** POST /coins/export: an Excel table of chosen lots plus the photos it names. */
export interface ExportResult {
  filename: string;
  workbook_base64: string;
  photos: { url: string; filename: string }[];
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

export interface ShippingOption {
  name: string;
  price: number;
}

/** A seller with coins in the cart: checkout makes one order per seller. */
export interface CartSeller {
  id: number;
  name: string | null;
  /** Empty: shipping is arranged with the seller. */
  shipping_options: ShippingOption[];
  has_payment_details: boolean;
}

export interface Cart {
  items: CartItemRead[];
  /** Coins only; shipping depends on the options chosen at checkout. */
  total_price: number;
  sellers: CartSeller[];
}

/** awaiting_payment -> paid (the buyer says so) -> shipped (the seller, with a tracking code). */
export type OrderStatus = "awaiting_payment" | "paid" | "shipped";

export interface OrderItemRead {
  id: number;
  /** null once the coin was deleted. */
  coin_id: number | null;
  coin_name_snapshot: string;
  price_paid: number;
  seller_id: number;
  /** Thumbnail of the coin's first photo. */
  image_url: string | null;
}

/** One buyer, one seller: a cart with several sellers' coins becomes several orders. */
export interface Order {
  id: number;
  created_at: string;
  status: OrderStatus;
  paid_at: string | null;
  shipped_at: string | null;
  tracking_code: string | null;
  shipping_address: string;
  /** Both null when shipping is arranged with the seller. */
  shipping_method: string | null;
  shipping_price: number | null;
  /** Coins plus shipping. */
  total_price: number;
  items: OrderItemRead[];
  buyer_id: number;
  buyer_name: string | null;
  seller_id: number;
  seller_name: string | null;
}

export interface SellerContact {
  name: string | null;
  payment_details: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_note: string | null;
}

/** An order as its buyer sees it: with how to pay and reach the seller. */
export interface BuyerOrder extends Order {
  seller: SellerContact;
}

export interface AdminOrder extends Order {
  buyer_email: string;
  seller_email: string;
}

export interface AdminOrderPage {
  items: AdminOrder[];
  total: number;
}

export interface SellerSettings {
  payment_details: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_note: string | null;
  shipping_options: ShippingOption[];
}

export interface AddressFields {
  recipient_name: string;
  phone: string | null;
  country: string;
  city: string;
  postal_code: string;
  address_line: string;
}

export interface Address extends AddressFields {
  id: number;
  is_default: boolean;
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
