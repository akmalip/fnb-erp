'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

function formatRp(n: number) { return 'Rp ' + Math.round(n).toLocaleString('id-ID') }
function formatTime(s: string) {
  return new Date(s).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
}
function formatDate(d: Date) {
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
}

interface MenuItem { id: string; name: string; price: number; is_available: boolean; category_id: string }
interface Category { id: string; name: string; emoji: string }
interface BillItem { menuItemId: string; name: string; price: number; quantity: number; note: string }
interface Bill {
  id: string
  label: string
  items: BillItem[]
  customer?: string
  createdAt: Date
  status: 'open' | 'paid'
  payMethod: 'cash' | 'qris' | 'transfer'
  discount: number
  fromOrderId?: string
  dbOrderId?: string // supabase order id after placing
}
type PayMethod = 'cash' | 'qris' | 'transfer'

export default function POSPage() {
  const [outletId, setOutletId] = useState('')
  const [outletName, setOutletName] = useState('Roemari')
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [activeBillId, setActiveBillId] = useState<string | null>(null)
  const [activeCat, setActiveCat] = useState('all')
  const [searchQ, setSearchQ] = useState('')
  const [payMethod, setPayMethod] = useState<PayMethod>('cash')
  const [showPayModal, setShowPayModal] = useState(false)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [lastReceipt, setLastReceipt] = useState<any>(null)
  const [cashReceived, setCashReceived] = useState('')
  const [discount, setDiscount] = useState('')
  const [showNewBillModal, setShowNewBillModal] = useState(false)
  const [newBillTable, setNewBillTable] = useState('')
  const [newBillCustomer, setNewBillCustomer] = useState('')
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [toast, setToast] = useState('')
  const [completedOrders, setCompletedOrders] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'pos' | 'bills' | 'completed'>('pos')
  // Receipt settings
  const [receiptHeader, setReceiptHeader] = useState('')
  const [receiptFooter, setReceiptFooter] = useState('Terima kasih sudah mampir! 🙏')
  const [showReceiptSettings, setShowReceiptSettings] = useState(false)
  const [showKOT, setShowKOT] = useState(false)
  const [kotData, setKotData] = useState<any>(null)
  const [kotCounter, setKotCounter] = useState(1)
  const sb = createClient()

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  useEffect(() => {
    const id = localStorage.getItem('fnb_outlet_id') || ''
    const name = localStorage.getItem('fnb_outlet_name') || 'Roemari'
    setOutletId(id)
    setOutletName(name)
    // Load receipt settings
    const savedHeader = localStorage.getItem('receipt_header') || ''
    const savedFooter = localStorage.getItem('receipt_footer') || 'Terima kasih sudah mampir! 🙏'
    setReceiptHeader(savedHeader)
    setReceiptFooter(savedFooter)
    if (id) {
      loadMenu(id)
      loadPendingOrders(id)
      const interval = setInterval(() => loadPendingOrders(id), 8000)
      return () => clearInterval(interval)
    }
  }, [])

  const loadPendingOrders = async (id: string) => {
    const { data } = await sb.from('orders')
      .select('*, order_items(*)')
      .eq('outlet_id', id)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
      .order('created_at', { ascending: false })
    if (data) {
      setPendingOrders(prev => {
        if (data.length > prev.length) {
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
          setToast('🔔 Ada order baru masuk!')
          setTimeout(() => setToast(''), 3000)
        }
        return data
      })
    }
  }

  const loadMenu = async (id: string) => {
    const [catRes, itemRes] = await Promise.all([
      sb.from('menu_categories').select('*').eq('outlet_id', id).eq('is_active', true).order('sort_order'),
      sb.from('menu_items').select('*').eq('outlet_id', id).eq('is_available', true).order('sort_order'),
    ])
    setCategories(catRes.data || [])
    setMenuItems(itemRes.data || [])
  }

  const createBill = () => {
    if (!newBillTable.trim()) return
    const bill: Bill = {
      id: Date.now().toString(),
      label: newBillTable.match(/^\d+$/) ? 'Meja ' + newBillTable : newBillTable,
      items: [], customer: newBillCustomer || 'Guest', createdAt: new Date(),
      status: 'open', payMethod: 'cash', discount: 0
    }
    setBills(prev => [...prev, bill])
    setActiveBillId(bill.id)
    setNewBillTable(''); setNewBillCustomer('')
    setShowNewBillModal(false)
    setActiveTab('pos')
    showToast('✅ Bill ' + bill.label + ' dibuat')
  }

  // FIX 1: Always fetch order_items fresh when importing to ensure data is complete
  const importOrderToBill = async (order: any) => {
    // Check if already imported
    const existing = bills.find(b => b.fromOrderId === order.id)
    if (existing) {
      setActiveBillId(existing.id)
      setActiveTab('pos')
      showToast('Bill sudah ada, dibuka ke kasir')
      return
    }

    // Always fetch order_items fresh from DB - don't rely on joined data from polling
    const { data: fetchedItems } = await sb.from('order_items')
      .select('*')
      .eq('order_id', order.id)
    
    const items = fetchedItems || order.order_items || []
    const billItems: BillItem[] = items.map((i: any) => ({
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
      customer: 'Guest',
      createdAt: new Date(order.created_at),
      status: 'open',
      payMethod: 'qris',
      discount: 0,
      fromOrderId: order.id,
      dbOrderId: order.id
    }
    setBills(prev => [...prev, bill])
    setActiveBillId(bill.id)
    setActiveTab('pos')
    showToast('✅ Order meja ' + order.table_number + ' dibuka — ' + billItems.length + ' item')
  }

  // FIX 3: Create POS order in Supabase so it shows in Live Orders
  const placeOrderToLive = async (bill: Bill): Promise<string | null> => {
    if (!outletId || bill.items.length === 0) return null
    const total = getTotal(bill)
    
    // Generate order number
    const { data: numData } = await sb.rpc('generate_order_number', { p_outlet_id: outletId })
    const orderNum = numData || ('POS-' + Date.now())

    const { data: order, error } = await sb.from('orders').insert({
      outlet_id: outletId,
      order_number: orderNum,
      table_number: bill.label.replace('Meja ', ''),
      subtotal: getSubtotal(bill),
      total_amount: total,
      status: 'pending',
      payment_status: 'unpaid',
      payment_method: bill.payMethod,
      notes: 'Order dari POS Kasir'
    }).select().single()

    if (error || !order) return null

    // Insert order items
    const orderItems = bill.items.map(i => ({
      order_id: order.id,
      menu_item_id: i.menuItemId || null,
      item_name: i.name,
      item_price: i.price,
      quantity: i.quantity,
      subtotal: i.price * i.quantity,
      notes: i.note || null
    }))
    await sb.from('order_items').insert(orderItems)

    return order.id
  }

  const activeBill = bills.find(b => b.id === activeBillId)

  const addItem = (item: MenuItem) => {
    if (!activeBillId) { showToast('⚠️ Pilih atau buat bill dulu'); return }
    setBills(prev => prev.map(b => {
      if (b.id !== activeBillId) return b
      const existing = b.items.find(i => i.menuItemId === item.id)
      if (existing) return { ...b, items: b.items.map(i => i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i) }
      return { ...b, items: [...b.items, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1, note: '' }] }
    }))
  }

  const changeQty = (menuItemId: string, delta: number) => {
    setBills(prev => prev.map(b => {
      if (b.id !== activeBillId) return b
      return { ...b, items: b.items.map(i => i.menuItemId === menuItemId ? { ...i, quantity: i.quantity + delta } : i).filter(i => i.quantity > 0) }
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
    setCashReceived(''); setShowPayModal(true)
  }

  const confirmPayment = async () => {
    if (!activeBill) return
    const total = getTotal(activeBill)
    if (payMethod === 'cash' && (parseInt(cashReceived) || 0) < total) { showToast('⚠️ Uang kurang'); return }

    // FIX 3: Place to Live Orders if not already from customer order
    let dbOrderId = activeBill.dbOrderId || activeBill.fromOrderId || null
    if (!dbOrderId) {
      dbOrderId = await placeOrderToLive({ ...activeBill, payMethod })
    }

    // Update order as paid
    if (dbOrderId) {
      await sb.from('orders').update({
        status: 'completed',
        payment_status: 'paid',
        payment_method: payMethod,
        payment_confirmed_at: new Date().toISOString()
      }).eq('id', dbOrderId)
    }

    const change = payMethod === 'cash' ? (parseInt(cashReceived) || 0) - total : 0
    const receipt = {
      ...activeBill,
      status: 'paid',
      payMethod,
      total,
      discount: getDiscountAmount(activeBill),
      subtotal: getSubtotal(activeBill),
      paidAt: new Date(),
      cashReceived: parseInt(cashReceived) || 0,
      change,
      orderNum: dbOrderId ? dbOrderId.slice(-8).toUpperCase() : Date.now().toString().slice(-6)
    }

    setLastReceipt(receipt)
    setCompletedOrders(prev => [receipt, ...prev])
    setBills(prev => prev.filter(b => b.id !== activeBillId))
    setActiveBillId(null)
    setShowPayModal(false)
    setDiscount('')
    setShowReceiptModal(true) // FIX 4: Auto show receipt
    showToast('✅ Lunas!' + (change > 0 ? ' Kembalian: ' + formatRp(change) : ''))
  }

  const deleteBill = (id: string) => {
    if (!confirm('Hapus bill ini?')) return
    setBills(prev => prev.filter(b => b.id !== id))
    if (activeBillId === id) setActiveBillId(null)
  }

  const saveReceiptSettings = () => {
    localStorage.setItem('receipt_header', receiptHeader)
    localStorage.setItem('receipt_footer', receiptFooter)
    setShowReceiptSettings(false)
    showToast('✅ Pengaturan struk disimpan')
  }

  // FIX 3: Kitchen Order Ticket (KOT) - struk dapur
  const printKOT = (bill: Bill, kotNum: number) => {
    const win = window.open('', '_blank', 'width=320,height=500')
    if (!win) return
    const now = new Date()
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
    win.document.write(`
      <html><head><title>KOT</title>
      <style>
        body { font-family: monospace; font-size: 14px; padding: 12px; max-width: 280px; }
        .center { text-align: center; }
        .big { font-size: 18px; font-weight: bold; }
        .line { border-top: 2px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; font-size: 14px; margin: 4px 0; }
        .item-name { font-size: 15px; font-weight: bold; margin: 6px 0 2px; }
        .note { font-size: 12px; color: #333; margin-left: 12px; font-style: italic; }
        .qty { font-size: 20px; font-weight: bold; }
      </style></head><body>
      <div class="center big">KITCHEN ORDER</div>
      <div class="center" style="font-size:13px">KOT #${String(kotNum).padStart(3,'0')}</div>
      <div class="line"></div>
      <div class="row"><span><b>${bill.label}</b></span><span>${bill.customer || 'Guest'}</span></div>
      <div class="row"><span>Waktu:</span><span>${timeStr}</span></div>
      <div class="line"></div>
      ${bill.items.map(item => `
        <div style="margin: 8px 0; padding-bottom: 6px; border-bottom: 1px dotted #ccc;">
          <div class="row">
            <span class="item-name">${item.name}</span>
            <span class="qty">x${item.quantity}</span>
          </div>
          ${item.note ? `<div class="note">📝 ${item.note}</div>` : ''}
        </div>
      `).join('')}
      <div class="line"></div>
      <div class="center" style="font-size:12px">Total item: ${bill.items.reduce((s,i) => s + i.quantity, 0)} pcs</div>
      </body></html>
    `)
    win.print()
    setKotCounter(prev => prev + 1)
  }

  const openKOT = (bill: Bill) => {
    setKotData(bill)
    setShowKOT(true)
  }

    const printReceipt = () => {
    const win = window.open('', '_blank', 'width=380,height=600')
    if (!win || !lastReceipt) return
    const r = lastReceipt
    win.document.write(`
      <html><head><title>Struk</title>
      <style>
        body { font-family: monospace; font-size: 13px; padding: 20px; max-width: 300px; margin: 0 auto; }
        .center { text-align: center; } .bold { font-weight: bold; } .big { font-size: 16px; }
        .line { border-top: 1px dashed #ccc; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; margin: 3px 0; }
        .total-row { font-weight: bold; font-size: 15px; }
      </style></head><body>
      <div class="center bold big">${outletName}</div>
      ${receiptHeader ? `<div class="center">${receiptHeader}</div>` : ''}
      <div class="line"></div>
      <div class="row"><span>#${r.orderNum}</span><span>${formatDate(r.paidAt)}</span></div>
      <div class="row"><span>${r.label}</span><span>${r.customer || 'Guest'}</span></div>
      <div class="line"></div>
      ${r.items.map((i: any) => `
        <div>${i.name}</div>
        <div class="row"><span>  ${i.quantity} x ${formatRp(i.price)}</span><span>${formatRp(i.quantity * i.price)}</span></div>
      `).join('')}
      <div class="line"></div>
      <div class="row"><span>Subtotal</span><span>${formatRp(r.subtotal)}</span></div>
      ${r.discount > 0 ? `<div class="row"><span>Diskon</span><span>-${formatRp(r.discount)}</span></div>` : ''}
      <div class="row total-row"><span>TOTAL</span><span>${formatRp(r.total)}</span></div>
      <div class="row"><span>${r.payMethod.toUpperCase()}</span><span>${r.cashReceived > 0 ? formatRp(r.cashReceived) : '✓'}</span></div>
      ${r.change > 0 ? `<div class="row"><span>Kembalian</span><span>${formatRp(r.change)}</span></div>` : ''}
      <div class="line"></div>
      <div class="center">${receiptFooter}</div>
      </body></html>
    `)
    win.print()
  }

  const filteredMenu = menuItems.filter(m => {
    const catMatch = activeCat === 'all' || m.category_id === activeCat
    const searchMatch = !searchQ || m.name.toLowerCase().includes(searchQ.toLowerCase())
    return catMatch && searchMatch
  })

  const inCartCount = (id: string) => activeBill?.items.find(i => i.menuItemId === id)?.quantity || 0

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '7px 16px', borderRadius: 10, border: '1.5px solid',
    borderColor: active ? '#C8873A' : 'rgba(0,0,0,0.1)',
    background: active ? '#C8873A' : 'white',
    color: active ? 'white' : '#8B7355',
    fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit'
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 6, paddingBottom: 14, flexShrink: 0, flexWrap: 'wrap' }}>
        {(['pos', 'bills', 'completed'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={tabStyle(activeTab === t)}>
            {t === 'pos' ? '🧾 Kasir' : t === 'bills' ? `📋 Open Bills (${bills.filter(b => b.status === 'open').length})` : `✅ Selesai (${completedOrders.length})`}
            {t === 'pos' && pendingOrders.length > 0 && (
              <span style={{ marginLeft: 6, background: '#E24B4A', color: 'white', borderRadius: 20, padding: '1px 7px', fontSize: 11 }}>{pendingOrders.length}</span>
            )}
          </button>
        ))}
        <button onClick={() => setShowNewBillModal(true)} style={{ marginLeft: 'auto', padding: '7px 16px', borderRadius: 10, background: '#2C1810', border: 'none', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>+ New Bill</button>
        <button onClick={() => setShowReceiptSettings(true)} style={{ padding: '7px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', background: 'white', color: '#8B7355', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>⚙️ Struk</button>
      </div>

      {/* POS TAB */}
      {activeTab === 'pos' && (
        <div style={{ display: 'flex', gap: 14, flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* MENU */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="🔍 Cari menu..."
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit', outline: 'none', marginBottom: 10, background: 'white' }} />
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', flexShrink: 0, paddingBottom: 4 }}>
              {[{ id: 'all', name: 'Semua', emoji: '' }, ...categories].map(c => (
                <button key={c.id} onClick={() => setActiveCat(c.id)} style={{ padding: '5px 14px', borderRadius: 20, border: '1.5px solid', borderColor: activeCat === c.id ? '#C8873A' : 'rgba(0,0,0,0.1)', background: activeCat === c.id ? '#C8873A' : 'white', color: activeCat === c.id ? 'white' : '#8B7355', fontWeight: 600, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                  {c.emoji} {c.name}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, alignContent: 'start' }}>
              {filteredMenu.map(m => {
                const qty = inCartCount(m.id)
                return (
                  <div key={m.id} onClick={() => addItem(m)} style={{ background: 'white', border: `1.5px solid ${qty > 0 ? '#C8873A' : 'rgba(0,0,0,0.08)'}`, borderRadius: 12, padding: '12px 10px', cursor: 'pointer', position: 'relative', userSelect: 'none', transition: 'all 0.1s' }}>
                    {qty > 0 && <div style={{ position: 'absolute', top: 8, right: 8, background: '#C8873A', color: 'white', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{qty}</div>}
                    <div style={{ fontSize: 22, marginBottom: 6 }}>🍽️</div>
                    <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, marginBottom: 4, color: '#1A0F0A' }}>{m.name}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#C8873A' }}>{formatRp(m.price)}</div>
                  </div>
                )
              })}
              {filteredMenu.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#8B7355', padding: 40, fontSize: 13 }}>Menu tidak ditemukan</div>}
            </div>
          </div>

          {/* ORDER PANEL */}
          <div style={{ width: 300, display: 'flex', flexDirection: 'column', flexShrink: 0, background: 'white', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: '#8B7355', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 7 }}>Bill Aktif</div>
              {bills.filter(b => b.status === 'open').length === 0
                ? <div style={{ fontSize: 13, color: '#8B7355', textAlign: 'center', padding: '8px 0' }}>Belum ada bill. Klik <strong>+ New Bill</strong></div>
                : <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const }}>
                    {bills.filter(b => b.status === 'open').map(b => (
                      <button key={b.id} onClick={() => setActiveBillId(b.id)} style={{ padding: '4px 10px', borderRadius: 7, border: '1.5px solid', borderColor: activeBillId === b.id ? '#2C1810' : 'rgba(0,0,0,0.1)', background: activeBillId === b.id ? '#2C1810' : 'white', color: activeBillId === b.id ? 'white' : '#1A0F0A', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {b.label} {b.items.length > 0 && <span style={{ opacity: 0.6 }}>({b.items.length})</span>}
                      </button>
                    ))}
                  </div>
              }
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px' }}>
              {!activeBill
                ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8B7355', fontSize: 13, gap: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 32 }}>🧾</div>
                    <div>Pilih bill atau buat baru</div>
                  </div>
                : activeBill.items.length === 0
                  ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8B7355', fontSize: 13, gap: 8 }}>
                      <div style={{ fontSize: 28 }}>+</div><div>Klik menu untuk tambah item</div>
                    </div>
                  : activeBill.items.map(item => (
                      <div key={item.menuItemId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{item.name}</div>
                          {item.note && <div style={{ fontSize: 11, color: '#8B7355' }}>📝 {item.note}</div>}
                          <div style={{ fontSize: 11.5, color: '#8B7355' }}>{formatRp(item.price)}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button onClick={() => changeQty(item.menuItemId, -1)} style={{ width: 22, height: 22, borderRadius: 5, border: '1px solid rgba(0,0,0,0.12)', background: 'white', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                          <span style={{ fontSize: 13, fontWeight: 700, minWidth: 16, textAlign: 'center' as const }}>{item.quantity}</span>
                          <button onClick={() => changeQty(item.menuItemId, 1)} style={{ width: 22, height: 22, borderRadius: 5, border: '1px solid rgba(0,0,0,0.12)', background: 'white', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        </div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#C8873A', minWidth: 60, textAlign: 'right' as const }}>{formatRp(item.price * item.quantity)}</div>
                      </div>
                    ))
              }
            </div>

            {activeBill && (
              <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
                <input value={discount} onChange={e => setDiscount(e.target.value)} placeholder="Diskon (Rp atau %)"
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 13, fontFamily: 'inherit', outline: 'none', marginBottom: 8 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#8B7355', marginBottom: 3 }}><span>Subtotal</span><span>{formatRp(getSubtotal(activeBill))}</span></div>
                {getDiscountAmount(activeBill) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#E24B4A', marginBottom: 3 }}><span>Diskon</span><span>-{formatRp(getDiscountAmount(activeBill))}</span></div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, marginBottom: 10 }}><span>Total</span><span style={{ color: '#C8873A' }}>{formatRp(getTotal(activeBill))}</span></div>
                <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
                  {(['cash', 'qris', 'transfer'] as const).map(m => (
                    <button key={m} onClick={() => setPayMethod(m)} style={{ flex: 1, padding: '6px 2px', borderRadius: 7, border: '1.5px solid', borderColor: payMethod === m ? '#C8873A' : 'rgba(0,0,0,0.1)', background: payMethod === m ? '#FDF4E9' : 'white', color: payMethod === m ? '#C8873A' : '#8B7355', fontWeight: 600, fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {m === 'cash' ? '💵 Tunai' : m === 'qris' ? '📱 QRIS' : '🏦 Transfer'}
                    </button>
                  ))}
                </div>
                <button onClick={openPayment} disabled={activeBill.items.length === 0}
                  style={{ width: '100%', padding: 11, borderRadius: 11, background: '#C8873A', border: 'none', color: 'white', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', opacity: activeBill.items.length === 0 ? 0.5 : 1, marginBottom: 5 }}>
                  Proses Pembayaran
                </button>
                <button onClick={() => activeBill && printKOT(activeBill, kotCounter)} disabled={activeBill.items.length === 0}
                  style={{ width: '100%', padding: 8, borderRadius: 9, background: '#EFF6FF', border: '1.5px solid #2C4A7C', color: '#2C4A7C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', opacity: activeBill.items.length === 0 ? 0.5 : 1, marginBottom: 5 }}>
                  🧾 Print KOT (Dapur)
                </button>
                <button onClick={() => deleteBill(activeBill.id)}
                  style={{ width: '100%', padding: 6, borderRadius: 7, background: 'transparent', border: 'none', color: '#E24B4A', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Hapus Bill
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BILLS TAB */}
      {activeTab === 'bills' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {pendingOrders.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, color: '#8B7355', marginBottom: 10, letterSpacing: '0.08em' }}>Order Masuk dari Pelanggan</div>
              {pendingOrders.map(o => (
                <div key={o.id} style={{ background: '#FFF8F0', border: '1.5px solid #C8873A', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#C8873A', marginBottom: 2 }}>Meja {o.table_number}</div>
                    <div style={{ fontSize: 12, color: '#8B7355', marginBottom: 4 }}>{o.order_number} · {formatTime(o.created_at)} · <span style={{ fontWeight: 600, color: '#C8873A' }}>{o.status}</span></div>
                    {/* FIX 1: Show item list */}
                    {(o.order_items || []).map((item: any) => (
                      <div key={item.id} style={{ fontSize: 12, color: '#3A2A20', marginBottom: 1 }}>
                        {item.quantity}x {item.item_name} <span style={{ color: '#8B7355' }}>— {formatRp(item.item_price)}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{formatRp(o.total_amount)}</div>
                    <button onClick={() => importOrderToBill(o)}
                      style={{ marginTop: 8, padding: '6px 14px', borderRadius: 8, background: '#C8873A', border: 'none', color: 'white', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Buka di POS →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, color: '#8B7355', marginBottom: 10, letterSpacing: '0.08em' }}>Open Bills</div>
          {bills.filter(b => b.status === 'open').length === 0
            ? <div style={{ background: 'white', borderRadius: 14, padding: 40, textAlign: 'center', color: '#8B7355', border: '1px solid rgba(0,0,0,0.07)' }}>Belum ada bill aktif.<br/><span style={{ fontSize: 12 }}>Buat bill baru atau import dari order pelanggan.</span></div>
            : bills.filter(b => b.status === 'open').map(b => (
                <div key={b.id} style={{ background: 'white', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{b.label}</div>
                    <div style={{ fontSize: 12, color: '#8B7355', marginTop: 2 }}>{b.customer || 'Guest'} · {b.items.length} item · {formatTime(b.createdAt.toString())}</div>
                    <div style={{ fontSize: 12, color: '#3A2A20', marginTop: 4 }}>{b.items.slice(0, 3).map(i => i.quantity + 'x ' + i.name).join(', ')}{b.items.length > 3 ? '...' : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' as const }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{formatRp(getSubtotal(b))}</div>
                    <button onClick={() => { setActiveBillId(b.id); setActiveTab('pos') }}
                      style={{ marginTop: 6, padding: '6px 14px', borderRadius: 8, background: '#2C1810', border: 'none', color: 'white', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Buka →
                    </button>
                  </div>
                </div>
              ))
          }
        </div>
      )}

      {/* COMPLETED TAB */}
      {activeTab === 'completed' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, color: '#8B7355', marginBottom: 12, letterSpacing: '0.08em' }}>Transaksi Selesai Hari Ini</div>
          {completedOrders.length === 0
            ? <div style={{ background: 'white', borderRadius: 14, padding: 40, textAlign: 'center', color: '#8B7355', border: '1px solid rgba(0,0,0,0.07)' }}>Belum ada transaksi</div>
            : <>
                {completedOrders.map((o: any, i: number) => (
                  <div key={i} style={{ background: 'white', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{o.label}</div>
                      <div style={{ fontSize: 12, color: '#8B7355', marginTop: 1 }}>{o.customer || 'Guest'} · {o.payMethod?.toUpperCase()}</div>
                      <div style={{ fontSize: 12, color: '#3A2A20', marginTop: 2 }}>{o.items?.slice(0, 2).map((it: any) => it.quantity + 'x ' + it.name).join(', ')}{o.items?.length > 2 ? '...' : ''}</div>
                    </div>
                    <div style={{ textAlign: 'right' as const }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#1D9E75' }}>{formatRp(o.total || 0)}</div>
                      <div style={{ fontSize: 11, color: '#8B7355', marginTop: 1 }}>✅ Lunas</div>
                      <button onClick={() => { setLastReceipt(o); setShowReceiptModal(true) }}
                        style={{ marginTop: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.1)', background: 'white', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', color: '#8B7355' }}>
                        🖨 Struk
                      </button>
                    </div>
                  </div>
                ))}
                <div style={{ background: '#FDF4E9', borderRadius: 12, padding: 16, textAlign: 'center' as const, border: '1px solid rgba(200,135,58,0.2)' }}>
                  <div style={{ fontSize: 12, color: '#8B7355', marginBottom: 4 }}>Total Hari Ini</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#C8873A' }}>{formatRp(completedOrders.reduce((s: number, o: any) => s + (o.total || 0), 0))}</div>
                  <div style={{ fontSize: 12, color: '#8B7355', marginTop: 4 }}>{completedOrders.length} transaksi</div>
                </div>
              </>
          }
        </div>
      )}

      {/* NEW BILL MODAL */}
      {showNewBillModal && (
        <div onClick={e => e.target === e.currentTarget && setShowNewBillModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 28, width: '100%', maxWidth: 380 }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Buat Bill Baru</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }}>Nomor Meja / Label *</label>
              <input value={newBillTable} onChange={e => setNewBillTable(e.target.value)} placeholder="cth: 5, Take Away, Drive Through"
                onKeyDown={e => e.key === 'Enter' && createBill()}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }}>Nama Pelanggan (opsional)</label>
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
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Pembayaran</div>
            <div style={{ fontSize: 13, color: '#8B7355', marginBottom: 20 }}>{activeBill.label} · {activeBill.customer || 'Guest'} · {activeBill.items.length} item</div>
            <div style={{ textAlign: 'center' as const, marginBottom: 20, background: '#FDF4E9', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ fontSize: 11, color: '#8B7355', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Total</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: '#C8873A' }}>{formatRp(getTotal(activeBill))}</div>
            </div>
            {payMethod === 'cash' && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }}>Uang yang Diterima</label>
                  <input value={cashReceived} onChange={e => setCashReceived(e.target.value)} type="number" placeholder="0"
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 20, fontFamily: 'inherit', outline: 'none', textAlign: 'center' as const }} />
                </div>
                {cashReceived && parseInt(cashReceived) >= getTotal(activeBill) && (
                  <div style={{ background: '#D1FAE5', borderRadius: 10, padding: 14, textAlign: 'center' as const, marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: '#065F46', textTransform: 'uppercase' as const, marginBottom: 2 }}>Kembalian</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#065F46' }}>{formatRp(parseInt(cashReceived) - getTotal(activeBill))}</div>
                  </div>
                )}
              </>
            )}
            {payMethod === 'qris' && <div style={{ textAlign: 'center' as const, padding: '20px 0', fontSize: 14, color: '#8B7355' }}><div style={{ fontSize: 52, marginBottom: 8 }}>📱</div>Arahkan kamera ke QRIS Roemari.<br/><span style={{ fontSize: 12 }}>Konfirmasi setelah pelanggan bayar.</span></div>}
            {payMethod === 'transfer' && <div style={{ textAlign: 'center' as const, padding: '20px 0', fontSize: 14, color: '#8B7355' }}><div style={{ fontSize: 52, marginBottom: 8 }}>🏦</div>Cek mutasi rekening.<br/><span style={{ fontSize: 12 }}>Konfirmasi setelah transfer masuk.</span></div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={() => setShowPayModal(false)} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: 'white', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', color: '#8B7355', fontWeight: 600 }}>Batal</button>
              <button onClick={confirmPayment} style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: '#1D9E75', color: 'white', fontFamily: 'inherit', fontSize: 15, cursor: 'pointer', fontWeight: 700 }}>✓ Konfirmasi Lunas</button>
            </div>
          </div>
        </div>
      )}

      {/* FIX 4: RECEIPT MODAL */}
      {showReceiptModal && lastReceipt && (
        <div onClick={e => e.target === e.currentTarget && setShowReceiptModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 20, width: '100%', maxWidth: 360 }}>
            {/* Receipt preview */}
            <div style={{ background: '#FAFAFA', border: '1px dashed #ccc', borderRadius: 12, padding: '20px 16px', marginBottom: 16, fontFamily: 'monospace', fontSize: 13 }}>
              <div style={{ textAlign: 'center', marginBottom: 10 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{outletName}</div>
                {receiptHeader && <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{receiptHeader}</div>}
              </div>
              <div style={{ borderTop: '1px dashed #ccc', margin: '8px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span>#{lastReceipt.orderNum}</span>
                <span>{formatDate(lastReceipt.paidAt)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                <span>{lastReceipt.label}</span><span>{lastReceipt.customer || 'Guest'}</span>
              </div>
              <div style={{ borderTop: '1px dashed #ccc', margin: '8px 0' }}></div>
              {lastReceipt.items?.map((item: any, i: number) => (
                <div key={i} style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 12 }}>{item.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666' }}>
                    <span>  {item.quantity}x {formatRp(item.price)}</span>
                    <span>{formatRp(item.quantity * item.price)}</span>
                  </div>
                </div>
              ))}
              <div style={{ borderTop: '1px dashed #ccc', margin: '8px 0' }}></div>
              {lastReceipt.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span>Diskon</span><span>-{formatRp(lastReceipt.discount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 14, marginTop: 4 }}>
                <span>TOTAL</span><span>{formatRp(lastReceipt.total)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span>{lastReceipt.payMethod?.toUpperCase()}</span>
                <span>{lastReceipt.cashReceived > 0 ? formatRp(lastReceipt.cashReceived) : '✓'}</span>
              </div>
              {lastReceipt.change > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span>Kembalian</span><span>{formatRp(lastReceipt.change)}</span>
                </div>
              )}
              <div style={{ borderTop: '1px dashed #ccc', margin: '8px 0' }}></div>
              <div style={{ textAlign: 'center', fontSize: 12, color: '#666' }}>{receiptFooter}</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowReceiptModal(false)} style={{ flex: 1, padding: 11, borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: 'white', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', color: '#8B7355', fontWeight: 600 }}>Tutup</button>
              <button onClick={printReceipt} style={{ flex: 1, padding: 11, borderRadius: 10, border: 'none', background: '#2C1810', color: 'white', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', fontWeight: 700 }}>🖨 Print</button>
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT SETTINGS MODAL */}
      {showReceiptSettings && (
        <div onClick={e => e.target === e.currentTarget && setShowReceiptSettings(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 28, width: '100%', maxWidth: 400 }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 20 }}>⚙️ Pengaturan Struk</div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6, letterSpacing: '0.08em' }}>Header Struk</label>
              <input value={receiptHeader} onChange={e => setReceiptHeader(e.target.value)} placeholder="cth: Jl. Contoh No. 1 | 0812-3456-7890"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
              <div style={{ fontSize: 11, color: '#8B7355', marginTop: 4 }}>Tampil di bawah nama outlet (alamat, no telp, dll)</div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6, letterSpacing: '0.08em' }}>Footer Struk</label>
              <input value={receiptFooter} onChange={e => setReceiptFooter(e.target.value)} placeholder="cth: Terima kasih sudah mampir!"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
              <div style={{ fontSize: 11, color: '#8B7355', marginTop: 4 }}>Tampil di bagian bawah struk</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowReceiptSettings(false)} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: 'white', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', color: '#8B7355', fontWeight: 600 }}>Batal</button>
              <button onClick={saveReceiptSettings} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#C8873A', color: 'white', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', fontWeight: 700 }}>Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#1D9E75', color: 'white', padding: '10px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14, zIndex: 999, whiteSpace: 'nowrap' as const, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
