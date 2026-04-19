'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

function formatRp(n: number) { return 'Rp ' + Math.round(n).toLocaleString('id-ID') }
function formatTime(s: string) {
  return new Date(s).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
}

interface MenuItem { id: string; name: string; price: number; is_available: boolean; category_id: string }
interface Category { id: string; name: string; emoji: string }
interface BillItem { menuItemId: string; name: string; price: number; quantity: number; note: string }
interface Bill {
  id: string // table number or custom
  label: string
  items: BillItem[]
  customer?: string
  createdAt: Date
  status: 'open' | 'paid'
  payMethod: 'cash' | 'qris' | 'transfer'
  discount: number
  fromOrderId?: string // if came from customer order
}

type PayMethod = 'cash' | 'qris' | 'transfer'

export default function POSPage() {
  const [outletId, setOutletId] = useState('')
  const [outletSlug, setOutletSlug] = useState('')
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [activeBillId, setActiveBillId] = useState<string | null>(null)
  const [activeCat, setActiveCat] = useState('all')
  const [searchQ, setSearchQ] = useState('')
  const [payMethod, setPayMethod] = useState<PayMethod>('cash')
  const [showPayModal, setShowPayModal] = useState(false)
  const [cashReceived, setCashReceived] = useState('')
  const [discount, setDiscount] = useState('')
  const [showNewBillModal, setShowNewBillModal] = useState(false)
  const [newBillTable, setNewBillTable] = useState('')
  const [newBillCustomer, setNewBillCustomer] = useState('')
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [toast, setToast] = useState('')
  const [completedOrders, setCompletedOrders] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'pos' | 'bills' | 'completed'>('pos')
  const sb = createClient()

  useEffect(() => {
    const id = localStorage.getItem('fnb_outlet_id') || ''
    const slug = localStorage.getItem('fnb_outlet_slug') || ''
    setOutletId(id)
    setOutletSlug(slug)
    if (id) { loadMenu(id); subscribeOrders(id) }
  }, [])

  const loadMenu = async (id: string) => {
    const [catRes, itemRes] = await Promise.all([
      sb.from('menu_categories').select('*').eq('outlet_id', id).eq('is_active', true).order('sort_order'),
      sb.from('menu_items').select('*').eq('outlet_id', id).eq('is_available', true).order('sort_order'),
    ])
    setCategories(catRes.data || [])
    setMenuItems(itemRes.data || [])
  }

  const subscribeOrders = (id: string) => {
    // Load existing pending orders
    sb.from('orders').select('*, order_items(*)').eq('outlet_id', id)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
      .then(({ data }) => {
        if (data) setPendingOrders(data)
      })

    // Real-time subscription
    sb.channel('pos-orders').on('postgres_changes', {
      event: '*', schema: 'public', table: 'orders',
      filter: `outlet_id=eq.${id}`
    }, (payload: any) => {
      if (payload.eventType === 'INSERT') {
        setPendingOrders(prev => [payload.new, ...prev])
        showToast('🔔 Order baru masuk dari meja ' + payload.new.table_number)
        // Play chime
        try {
          const ctx = new AudioContext()
          ;[880, 1100, 1320].forEach((freq, i) => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain); gain.connect(ctx.destination)
            osc.frequency.value = freq; osc.type = 'sine'
            gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.15)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.15)
            osc.start(ctx.currentTime + i * 0.15)
            osc.stop(ctx.currentTime + i * 0.15 + 0.2)
          })
        } catch {}
      } else if (payload.eventType === 'UPDATE') {
        setPendingOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o).filter(o => ['pending','confirmed','preparing','ready'].includes(o.status)))
      }
    }).subscribe()
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // ── BILLS ──
  const createBill = () => {
    if (!newBillTable.trim()) return
    const bill: Bill = {
      id: Date.now().toString(),
      label: newBillTable.startsWith('Meja') ? newBillTable : 'Meja ' + newBillTable,
      items: [], customer: newBillCustomer, createdAt: new Date(),
      status: 'open', payMethod: 'cash', discount: 0
    }
    setBills(prev => [...prev, bill])
    setActiveBillId(bill.id)
    setNewBillTable(''); setNewBillCustomer('')
    setShowNewBillModal(false)
    setActiveTab('pos')
  }

  const importOrderToBill = async (order: any) => {
    // Fetch order items
    const { data: items } = await sb.from('order_items').select('*').eq('order_id', order.id)
    const billItems: BillItem[] = (items || []).map((i: any) => ({
      menuItemId: i.menu_item_id || '',
      name: i.item_name,
      price: i.item_price,
      quantity: i.quantity,
      note: i.notes || ''
    }))
    const bill: Bill = {
      id: order.id,
      label: 'Meja ' + order.table_number,
      items: billItems,
      customer: order.customer_id ? 'Customer' : 'Guest',
      createdAt: new Date(order.created_at),
      status: 'open',
      payMethod: 'qris',
      discount: 0,
      fromOrderId: order.id
    }
    setBills(prev => {
      const existing = prev.find(b => b.id === order.id)
      if (existing) return prev
      return [...prev, bill]
    })
    setActiveBillId(bill.id)
    setActiveTab('pos')
    showToast('✅ Order meja ' + order.table_number + ' dibuka di POS')
  }

  const activeBill = bills.find(b => b.id === activeBillId)

  const addItem = (item: MenuItem) => {
    if (!activeBillId) { showToast('⚠️ Pilih atau buat bill dulu'); return }
    setBills(prev => prev.map(b => {
      if (b.id !== activeBillId) return b
      const existing = b.items.find(i => i.menuItemId === item.id)
      if (existing) {
        return { ...b, items: b.items.map(i => i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i) }
      }
      return { ...b, items: [...b.items, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1, note: '' }] }
    }))
  }

  const changeQty = (menuItemId: string, delta: number) => {
    setBills(prev => prev.map(b => {
      if (b.id !== activeBillId) return b
      const items = b.items.map(i => i.menuItemId === menuItemId ? { ...i, quantity: i.quantity + delta } : i).filter(i => i.quantity > 0)
      return { ...b, items }
    }))
  }

  const getSubtotal = (bill: Bill) => bill.items.reduce((s, i) => s + i.price * i.quantity, 0)

  const getDiscountAmount = (bill: Bill) => {
    const d = discount || bill.discount.toString()
    const sub = getSubtotal(bill)
    if (!d) return 0
    if (d.endsWith('%')) return sub * parseFloat(d) / 100
    return parseInt(d) || 0
  }

  const getTotal = (bill: Bill) => Math.max(0, getSubtotal(bill) - getDiscountAmount(bill))

  const openPayment = () => {
    if (!activeBill || activeBill.items.length === 0) return
    setCashReceived('')
    setShowPayModal(true)
  }

  const confirmPayment = async () => {
    if (!activeBill) return
    const total = getTotal(activeBill)

    if (payMethod === 'cash') {
      const received = parseInt(cashReceived) || 0
      if (received < total) { showToast('⚠️ Uang kurang'); return }
    }

    // If came from a real order, confirm it in Supabase
    if (activeBill.fromOrderId) {
      await sb.from('orders').update({
        status: 'completed',
        payment_status: 'paid',
        payment_method: payMethod,
        payment_confirmed_at: new Date().toISOString()
      }).eq('id', activeBill.fromOrderId)
    }

    const completed = { ...activeBill, status: 'paid' as const, payMethod, discount: getDiscountAmount(activeBill), paidAt: new Date(), total, cashReceived: parseInt(cashReceived) || 0 }
    setCompletedOrders(prev => [completed, ...prev])
    setBills(prev => prev.filter(b => b.id !== activeBillId))
    setActiveBillId(null)
    setShowPayModal(false)
    setDiscount('')
    showToast('✅ Pembayaran berhasil! ' + (payMethod === 'cash' ? 'Kembalian: ' + formatRp(parseInt(cashReceived) - total) : ''))
  }

  const deleteBill = (id: string) => {
    if (!confirm('Hapus bill ini?')) return
    setBills(prev => prev.filter(b => b.id !== id))
    if (activeBillId === id) setActiveBillId(null)
  }

  // Filter menu
  const filteredMenu = menuItems.filter(m => {
    const catMatch = activeCat === 'all' || m.category_id === activeCat
    const searchMatch = !searchQ || m.name.toLowerCase().includes(searchQ.toLowerCase())
    return catMatch && searchMatch
  })

  const inCartCount = (id: string) => activeBill?.items.find(i => i.menuItemId === id)?.quantity || 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: 'calc(100vh - 60px)', overflow: 'hidden' }}>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 6, padding: '0 0 14px', flexShrink: 0 }}>
        {(['pos', 'bills', 'completed'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            padding: '7px 16px', borderRadius: 10, border: '1.5px solid',
            borderColor: activeTab === t ? '#C8873A' : 'rgba(0,0,0,0.1)',
            background: activeTab === t ? '#C8873A' : 'white',
            color: activeTab === t ? 'white' : '#8B7355',
            fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit'
          }}>
            {t === 'pos' ? '🧾 Kasir' : t === 'bills' ? `📋 Open Bills (${bills.filter(b => b.status === 'open').length})` : `✅ Selesai (${completedOrders.length})`}
            {t === 'pos' && pendingOrders.length > 0 && (
              <span style={{ marginLeft: 6, background: '#E24B4A', color: 'white', borderRadius: 20, padding: '1px 7px', fontSize: 11 }}>{pendingOrders.length}</span>
            )}
          </button>
        ))}
        <button onClick={() => setShowNewBillModal(true)} style={{
          marginLeft: 'auto', padding: '7px 16px', borderRadius: 10, background: '#2C1810',
          border: 'none', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit'
        }}>+ New Bill</button>
      </div>

      {/* ── POS TAB ── */}
      {activeTab === 'pos' && (
        <div style={{ display: 'flex', gap: 14, flex: 1, overflow: 'hidden', minHeight: 0 }}>

          {/* MENU PANEL */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
            {/* Search */}
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="🔍 Cari menu..."
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit', outline: 'none', marginBottom: 10, background: 'white' }} />
            {/* Category tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', flexShrink: 0, paddingBottom: 4 }}>
              <button onClick={() => setActiveCat('all')} style={{ padding: '5px 14px', borderRadius: 20, border: '1.5px solid', borderColor: activeCat === 'all' ? '#C8873A' : 'rgba(0,0,0,0.1)', background: activeCat === 'all' ? '#C8873A' : 'white', color: activeCat === 'all' ? 'white' : '#8B7355', fontWeight: 600, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>Semua</button>
              {categories.map(c => (
                <button key={c.id} onClick={() => setActiveCat(c.id)} style={{ padding: '5px 14px', borderRadius: 20, border: '1.5px solid', borderColor: activeCat === c.id ? '#C8873A' : 'rgba(0,0,0,0.1)', background: activeCat === c.id ? '#C8873A' : 'white', color: activeCat === c.id ? 'white' : '#8B7355', fontWeight: 600, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>{c.emoji} {c.name}</button>
              ))}
            </div>
            {/* Menu Grid */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, alignContent: 'start' }}>
              {filteredMenu.map(m => {
                const qty = inCartCount(m.id)
                return (
                  <div key={m.id} onClick={() => addItem(m)} style={{
                    background: 'white', border: `1.5px solid ${qty > 0 ? '#C8873A' : 'rgba(0,0,0,0.08)'}`,
                    borderRadius: 12, padding: '12px 10px', cursor: 'pointer', position: 'relative',
                    transition: 'all 0.12s', userSelect: 'none'
                  }}>
                    {qty > 0 && (
                      <div style={{ position: 'absolute', top: 8, right: 8, background: '#C8873A', color: 'white', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{qty}</div>
                    )}
                    <div style={{ fontSize: 26, marginBottom: 6 }}>{m.name.includes('Kopi') || m.name.includes('Americano') || m.name.includes('Latte') || m.name.includes('Cappuccino') ? '☕' : m.name.includes('Nasi') ? '🍚' : m.name.includes('Mie') ? '🍜' : m.name.includes('Jus') || m.name.includes('Es') ? '🥤' : m.name.includes('Cake') || m.name.includes('Croissant') ? '🥐' : '🍽️'}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, marginBottom: 4, color: '#1A0F0A' }}>{m.name}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#C8873A' }}>{formatRp(m.price)}</div>
                  </div>
                )
              })}
              {filteredMenu.length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#8B7355', padding: 40, fontSize: 13 }}>Menu tidak ditemukan</div>
              )}
            </div>
          </div>

          {/* ORDER PANEL */}
          <div style={{ width: 300, display: 'flex', flexDirection: 'column', flexShrink: 0, background: 'white', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            {/* Bill selector */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: '#8B7355', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Bill Aktif</div>
              {bills.filter(b => b.status === 'open').length === 0 ? (
                <div style={{ fontSize: 13, color: '#8B7355', textAlign: 'center', padding: '10px 0' }}>
                  Belum ada bill. Klik <strong>+ New Bill</strong>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {bills.filter(b => b.status === 'open').map(b => (
                    <button key={b.id} onClick={() => setActiveBillId(b.id)} style={{
                      padding: '5px 12px', borderRadius: 8, border: '1.5px solid',
                      borderColor: activeBillId === b.id ? '#2C1810' : 'rgba(0,0,0,0.1)',
                      background: activeBillId === b.id ? '#2C1810' : 'white',
                      color: activeBillId === b.id ? 'white' : '#1A0F0A',
                      fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit'
                    }}>
                      {b.label}
                      {b.items.length > 0 && <span style={{ marginLeft: 4, opacity: 0.7 }}>({b.items.length})</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Items */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px' }}>
              {!activeBill ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8B7355', fontSize: 13, gap: 8 }}>
                  <div style={{ fontSize: 32 }}>🧾</div>
                  <div>Pilih atau buat bill baru</div>
                </div>
              ) : activeBill.items.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8B7355', fontSize: 13, gap: 8 }}>
                  <div style={{ fontSize: 32 }}>+</div>
                  <div>Klik menu untuk tambah item</div>
                </div>
              ) : activeBill.items.map(item => (
                <div key={item.menuItemId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: '#8B7355' }}>{formatRp(item.price)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button onClick={() => changeQty(item.menuItemId, -1)} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid rgba(0,0,0,0.12)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>−</button>
                    <span style={{ fontSize: 13, fontWeight: 700, minWidth: 18, textAlign: 'center' }}>{item.quantity}</span>
                    <button onClick={() => changeQty(item.menuItemId, 1)} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid rgba(0,0,0,0.12)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>+</button>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#C8873A', minWidth: 65, textAlign: 'right' }}>{formatRp(item.price * item.quantity)}</div>
                </div>
              ))}
            </div>

            {/* Footer */}
            {activeBill && (
              <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
                <input value={discount} onChange={e => setDiscount(e.target.value)} placeholder="Diskon (Rp atau %)" style={{ width: '100%', padding: '7px 12px', borderRadius: 8, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 13, fontFamily: 'inherit', outline: 'none', marginBottom: 10 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#8B7355', marginBottom: 4 }}>
                  <span>Subtotal</span><span>{formatRp(getSubtotal(activeBill))}</span>
                </div>
                {getDiscountAmount(activeBill) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#E24B4A', marginBottom: 4 }}>
                    <span>Diskon</span><span>-{formatRp(getDiscountAmount(activeBill))}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 800, color: '#1A0F0A', marginBottom: 12 }}>
                  <span>Total</span><span style={{ color: '#C8873A' }}>{formatRp(getTotal(activeBill))}</span>
                </div>
                {/* Pay method */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {(['cash', 'qris', 'transfer'] as const).map(m => (
                    <button key={m} onClick={() => setPayMethod(m)} style={{ flex: 1, padding: '7px 4px', borderRadius: 8, border: '1.5px solid', borderColor: payMethod === m ? '#C8873A' : 'rgba(0,0,0,0.1)', background: payMethod === m ? '#FDF4E9' : 'white', color: payMethod === m ? '#C8873A' : '#8B7355', fontWeight: 600, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {m === 'cash' ? '💵 Tunai' : m === 'qris' ? '📱 QRIS' : '🏦 Transfer'}
                    </button>
                  ))}
                </div>
                <button onClick={openPayment} disabled={activeBill.items.length === 0} style={{ width: '100%', padding: 12, borderRadius: 12, background: '#C8873A', border: 'none', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', opacity: activeBill.items.length === 0 ? 0.5 : 1 }}>
                  Proses Pembayaran
                </button>
                <button onClick={() => deleteBill(activeBill.id)} style={{ width: '100%', padding: 8, borderRadius: 8, background: 'transparent', border: 'none', color: '#E24B4A', fontSize: 12, cursor: 'pointer', marginTop: 6, fontFamily: 'inherit' }}>Hapus Bill</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── BILLS TAB ── */}
      {activeTab === 'bills' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Pending orders from customer page */}
          {pendingOrders.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8B7355', marginBottom: 10 }}>Order Masuk dari Pelanggan</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingOrders.map(o => (
                  <div key={o.id} style={{ background: '#FFF8F0', border: '1.5px solid #C8873A', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#C8873A' }}>Meja {o.table_number}</div>
                      <div style={{ fontSize: 12, color: '#8B7355', marginTop: 2 }}>{o.order_number} · {formatTime(o.created_at)}</div>
                      <div style={{ fontSize: 12, color: '#8B7355', marginTop: 2 }}>Status: <span style={{ color: '#C8873A', fontWeight: 600 }}>{o.status}</span></div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{formatRp(o.total_amount)}</div>
                      <button onClick={() => importOrderToBill(o)} style={{ marginTop: 6, padding: '6px 14px', borderRadius: 8, background: '#C8873A', border: 'none', color: 'white', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Buka di POS →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Open bills */}
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8B7355', marginBottom: 10 }}>Open Bills</div>
          {bills.filter(b => b.status === 'open').length === 0 ? (
            <div style={{ background: 'white', borderRadius: 14, padding: 40, textAlign: 'center', color: '#8B7355', fontSize: 14 }}>Belum ada bill aktif</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {bills.filter(b => b.status === 'open').map(b => (
                <div key={b.id} style={{ background: 'white', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{b.label}</div>
                    <div style={{ fontSize: 12, color: '#8B7355', marginTop: 2 }}>{b.customer || 'Guest'} · {b.items.length} item</div>
                    <div style={{ fontSize: 12, color: '#8B7355', marginTop: 2 }}>{formatTime(b.createdAt.toString())}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{formatRp(getSubtotal(b))}</div>
                    <button onClick={() => { setActiveBillId(b.id); setActiveTab('pos') }} style={{ marginTop: 6, padding: '6px 14px', borderRadius: 8, background: '#2C1810', border: 'none', color: 'white', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Buka →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── COMPLETED TAB ── */}
      {activeTab === 'completed' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8B7355', marginBottom: 10 }}>Transaksi Selesai Hari Ini</div>
          {completedOrders.length === 0 ? (
            <div style={{ background: 'white', borderRadius: 14, padding: 40, textAlign: 'center', color: '#8B7355', fontSize: 14 }}>Belum ada transaksi hari ini</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {completedOrders.map((o: any, i) => (
                <div key={i} style={{ background: 'white', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{o.label}</div>
                    <div style={{ fontSize: 12, color: '#8B7355', marginTop: 2 }}>{o.customer || 'Guest'} · {o.payMethod?.toUpperCase()}</div>
                    <div style={{ fontSize: 12, color: '#8B7355', marginTop: 2 }}>{o.items?.length} item</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#1D9E75' }}>{formatRp(o.total || 0)}</div>
                    <div style={{ fontSize: 11, color: '#8B7355', marginTop: 2 }}>✅ Lunas</div>
                  </div>
                </div>
              ))}
              <div style={{ background: '#FDF4E9', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#8B7355' }}>Total Penjualan Hari Ini</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#C8873A' }}>{formatRp(completedOrders.reduce((s: number, o: any) => s + (o.total || 0), 0))}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* NEW BILL MODAL */}
      {showNewBillModal && (
        <div onClick={e => e.target === e.currentTarget && setShowNewBillModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 28, width: '100%', maxWidth: 380 }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Buat Bill Baru</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Nomor Meja *</label>
              <input value={newBillTable} onChange={e => setNewBillTable(e.target.value)} placeholder="cth: 5 atau Take Away"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
                onKeyDown={e => e.key === 'Enter' && createBill()} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Nama Pelanggan <span style={{ fontWeight: 400, textTransform: 'none' }}>(opsional)</span></label>
              <input value={newBillCustomer} onChange={e => setNewBillCustomer(e.target.value)} placeholder="cth: Budi"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowNewBillModal(false)} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: 'white', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', color: '#8B7355', fontWeight: 600 }}>Batal</button>
              <button onClick={createBill} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#C8873A', color: 'white', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', fontWeight: 700 }}>Buat Bill</button>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {showPayModal && activeBill && (
        <div onClick={e => e.target === e.currentTarget && setShowPayModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 28, width: '100%', maxWidth: 380 }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Pembayaran</div>
            <div style={{ fontSize: 13, color: '#8B7355', marginBottom: 20 }}>{activeBill.label} · {activeBill.customer || 'Guest'}</div>
            <div style={{ textAlign: 'center', marginBottom: 20, background: '#FDF4E9', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ fontSize: 12, color: '#8B7355', marginBottom: 4 }}>Total</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#C8873A' }}>{formatRp(getTotal(activeBill))}</div>
            </div>
            {payMethod === 'cash' && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Uang yang Diterima</label>
                  <input value={cashReceived} onChange={e => setCashReceived(e.target.value)} type="number" placeholder="0"
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 18, fontFamily: 'inherit', outline: 'none', textAlign: 'center' }} />
                </div>
                {cashReceived && parseInt(cashReceived) >= getTotal(activeBill) && (
                  <div style={{ background: '#D1FAE5', borderRadius: 10, padding: 14, textAlign: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: '#065F46' }}>Kembalian</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#065F46' }}>{formatRp(parseInt(cashReceived) - getTotal(activeBill))}</div>
                  </div>
                )}
              </>
            )}
            {payMethod === 'qris' && (
              <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: '#8B7355' }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>📱</div>
                Arahkan kamera ke QRIS. Konfirmasi setelah pelanggan bayar.
              </div>
            )}
            {payMethod === 'transfer' && (
              <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: '#8B7355' }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>🏦</div>
                Cek mutasi rekening. Konfirmasi setelah transfer masuk.
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={() => setShowPayModal(false)} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: 'white', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', color: '#8B7355', fontWeight: 600 }}>Batal</button>
              <button onClick={confirmPayment} style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: '#1D9E75', color: 'white', fontFamily: 'inherit', fontSize: 15, cursor: 'pointer', fontWeight: 700 }}>✓ Konfirmasi Lunas</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#1D9E75', color: 'white', padding: '10px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14, zIndex: 999, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
