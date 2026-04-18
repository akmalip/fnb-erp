import { createClient } from './client'
import type { Outlet, MenuItem, MenuCategory, OutletBanner, Order, Customer } from '@/types'

// Always create fresh client to ensure anon key is included in headers
function getClient() { return createClient() }
const supabase = getClient()

// ─── OUTLET ──────────────────────────────────────────────────────────────────

export async function getOutletBySlug(slug: string): Promise<Outlet | null> {
  const { data, error } = await supabase
    .from('outlets')
    .select('*')
    .eq('slug', slug)
    .single()
  if (error) return null
  return data
}

export async function updateOutlet(id: string, updates: Partial<Outlet>) {
  return supabase.from('outlets').update(updates).eq('id', id)
}

// ─── MENU ────────────────────────────────────────────────────────────────────

export async function getMenuByOutlet(outletId: string): Promise<{ categories: MenuCategory[], items: MenuItem[] }> {
  const [catRes, itemRes] = await Promise.all([
    supabase.from('menu_categories').select('*')
      .eq('outlet_id', outletId).eq('is_active', true).order('sort_order'),
    supabase.from('menu_items').select('*, category:menu_categories(id,name,emoji)')
      .eq('outlet_id', outletId).order('sort_order')
  ])
  return {
    categories: catRes.data ?? [],
    items: itemRes.data ?? []
  }
}

export async function upsertMenuItem(item: Partial<MenuItem> & { outlet_id: string }) {
  if (item.id) {
    return supabase.from('menu_items').update(item).eq('id', item.id)
  }
  return supabase.from('menu_items').insert(item)
}

export async function deleteMenuItem(id: string) {
  return supabase.from('menu_items').delete().eq('id', id)
}

export async function toggleMenuItemAvailability(id: string, isAvailable: boolean) {
  return supabase.from('menu_items').update({ is_available: isAvailable }).eq('id', id)
}

export async function upsertCategory(cat: Partial<MenuCategory> & { outlet_id: string }) {
  if (cat.id) {
    return supabase.from('menu_categories').update(cat).eq('id', cat.id)
  }
  return supabase.from('menu_categories').insert(cat)
}

export async function deleteCategory(id: string) {
  return supabase.from('menu_categories').delete().eq('id', id)
}

// ─── BANNERS ─────────────────────────────────────────────────────────────────

export async function getBannersByOutlet(outletId: string): Promise<OutletBanner[]> {
  const { data } = await supabase
    .from('outlet_banners')
    .select('*')
    .eq('outlet_id', outletId)
    .eq('is_active', true)
    .order('sort_order')
  return data ?? []
}

export async function getAllBannersByOutlet(outletId: string): Promise<OutletBanner[]> {
  const { data } = await supabase
    .from('outlet_banners')
    .select('*')
    .eq('outlet_id', outletId)
    .order('sort_order')
  return data ?? []
}

export async function upsertBanner(banner: Partial<OutletBanner> & { outlet_id: string }) {
  if (banner.id) {
    return supabase.from('outlet_banners').update(banner).eq('id', banner.id)
  }
  return supabase.from('outlet_banners').insert(banner)
}

export async function deleteBanner(id: string) {
  return supabase.from('outlet_banners').delete().eq('id', id)
}

// ─── CUSTOMERS ───────────────────────────────────────────────────────────────

export async function upsertCustomer(
  name: string, whatsapp: string, email: string | undefined, outletId: string
): Promise<string | null> {
  const sb = getClient()
  const { data, error } = await sb.rpc('upsert_customer', {
    p_name: name, p_whatsapp: whatsapp, p_email: email ?? null, p_outlet_id: outletId
  })
  if (error) return null
  return data
}

export async function getCustomersByOutlet(outletId: string): Promise<Customer[]> {
  const { data } = await supabase
    .from('customer_outlets')
    .select('customer:customers(*), visit_count, total_spent_here, last_visit_at')
    .eq('outlet_id', outletId)
    .order('last_visit_at', { ascending: false })
  return (data ?? []).map((d: any) => ({
    ...d.customer,
    visit_count: d.visit_count,
    total_spent_here: d.total_spent_here,
    last_visit_at: d.last_visit_at
  }))
}

// ─── ORDERS ──────────────────────────────────────────────────────────────────

export async function createOrder(order: {
  outlet_id: string
  customer_id?: string
  table_number: string
  items: { menu_item_id: string; item_name: string; item_price: number; quantity: number; notes?: string }[]
  notes?: string
}) {
  const sb = getClient()
  // Generate order number
  const { data: orderNum } = await sb.rpc('generate_order_number', { p_outlet_id: order.outlet_id })

  const subtotal = order.items.reduce((sum, i) => sum + i.item_price * i.quantity, 0)

  const { data: newOrder, error } = await sb
    .from('orders')
    .insert({
      outlet_id: order.outlet_id,
      customer_id: order.customer_id,
      order_number: orderNum,
      table_number: order.table_number,
      subtotal,
      total_amount: subtotal,
      notes: order.notes,
      status: 'pending',
      payment_status: 'unpaid',
      payment_method: 'qris'
    })
    .select()
    .single()

  if (error || !newOrder) return { error }

  // Insert order items
  const orderItems = order.items.map(i => ({
    order_id: newOrder.id,
    menu_item_id: i.menu_item_id,
    item_name: i.item_name,
    item_price: i.item_price,
    quantity: i.quantity,
    subtotal: i.item_price * i.quantity,
    notes: i.notes
  }))

  await sb.from('order_items').insert(orderItems)

  return { data: newOrder }
}

export async function getOrdersByOutlet(outletId: string, limit = 50): Promise<Order[]> {
  const { data } = await supabase
    .from('orders')
    .select('*, customer:customers(id,name,whatsapp), order_items(*)')
    .eq('outlet_id', outletId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function getLiveOrders(outletId: string): Promise<Order[]> {
  const { data } = await supabase
    .from('orders')
    .select('*, customer:customers(id,name,whatsapp), order_items(*)')
    .eq('outlet_id', outletId)
    .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
    .order('created_at', { ascending: true })
  return data ?? []
}

export async function updateOrderStatus(orderId: string, status: string) {
  return supabase.from('orders').update({ status }).eq('id', orderId)
}

export async function confirmPayment(orderId: string) {
  return supabase.from('orders').update({
    payment_status: 'paid',
    payment_confirmed_at: new Date().toISOString()
  }).eq('id', orderId)
}

export async function uploadPaymentProof(file: File, orderId: string): Promise<string | null> {
  const ext = file.name.split('.').pop()
  const path = `${orderId}/bukti-bayar.${ext}`
  const { error } = await supabase.storage.from('payment-proofs').upload(path, file, { upsert: true })
  if (error) return null
  const { data } = supabase.storage.from('payment-proofs').getPublicUrl(path)
  await supabase.from('orders').update({ payment_proof_url: data.publicUrl }).eq('id', orderId)
  return data.publicUrl
}

// ─── DASHBOARD STATS ─────────────────────────────────────────────────────────

export async function getDashboardStats(outletId: string) {
  const today = new Date().toISOString().split('T')[0]

  const [todayOrders, totalCustomers, pendingOrders] = await Promise.all([
    supabase.from('orders').select('total_amount, status')
      .eq('outlet_id', outletId).gte('created_at', today),
    supabase.from('customer_outlets').select('id', { count: 'exact' }).eq('outlet_id', outletId),
    supabase.from('orders').select('id', { count: 'exact' })
      .eq('outlet_id', outletId).eq('status', 'pending')
  ])

  const paidToday = (todayOrders.data ?? []).filter(o => o.status !== 'cancelled')
  const revenue = paidToday.reduce((sum, o) => sum + o.total_amount, 0)

  return {
    revenueToday: revenue,
    ordersToday: paidToday.length,
    totalCustomers: totalCustomers.count ?? 0,
    pendingOrders: pendingOrders.count ?? 0
  }
}
