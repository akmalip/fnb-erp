export type SubscriptionPlan = 'basic' | 'pro' | 'enterprise'
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded'
export type BannerType = 'promo' | 'event' | 'info' | 'announcement'

export interface Outlet {
  id: string; slug: string; name: string; description?: string
  address?: string; phone?: string; logo_url?: string
  primary_color: string; secondary_color: string; accent_color: string; font_choice: string
  qris_image_url?: string; is_open: boolean; open_time: string; close_time: string
  max_table_number: number; table_number_label: string
  subscription_plan: SubscriptionPlan; created_at: string; updated_at: string
}
export interface MenuCategory {
  id: string; outlet_id: string; name: string; emoji: string
  sort_order: number; is_active: boolean; created_at: string
}
export interface MenuItem {
  id: string; outlet_id: string; category_id?: string; name: string
  description?: string; image_url?: string; price: number
  is_available: boolean; is_featured: boolean; sort_order: number
  track_stock: boolean; stock_qty: number; created_at: string; updated_at: string
  category?: MenuCategory
}
export interface OutletBanner {
  id: string; outlet_id: string; title: string; description?: string; image_url?: string
  bg_color: string; text_color: string; icon_emoji: string; banner_type: BannerType
  starts_at?: string; ends_at?: string; is_active: boolean; sort_order: number; created_at: string
}
export interface Customer {
  id: string; name: string; whatsapp: string; email?: string
  first_outlet_id?: string; first_visited_at: string; last_visited_at: string
  total_visits: number; total_spent: number; marketing_consent: boolean; created_at: string
}
export interface Order {
  id: string; outlet_id: string; customer_id?: string; order_number: string
  table_number?: string; status: OrderStatus; subtotal: number
  discount_amount: number; total_amount: number; payment_method: string
  payment_status: PaymentStatus; payment_proof_url?: string
  payment_confirmed_at?: string; notes?: string; created_at: string; updated_at: string
  customer?: Customer; order_items?: OrderItem[]
}
export interface OrderItem {
  id: string; order_id: string; menu_item_id?: string
  item_name: string; item_price: number; quantity: number; subtotal: number
  notes?: string; created_at: string
}
export interface CartItem {
  menuItemId: string; name: string; price: number; quantity: number
  notes?: string; imageUrl?: string
}
export interface CustomerSession {
  id?: string; name: string; whatsapp: string; email?: string; savedAt: string
}
