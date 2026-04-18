'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Outlet, MenuItem, MenuCategory, OutletBanner, CartItem, CustomerSession } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { getBannersByOutlet, getMenuByOutlet, upsertCustomer, createOrder, uploadPaymentProof } from '@/lib/supabase/queries'

// ─── UTILS ───────────────────────────────────────────────────────────────────

function formatRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}

function applyBrandTheme(outlet: Outlet) {
  const root = document.documentElement
  root.style.setProperty('--brand-primary', outlet.primary_color)
  root.style.setProperty('--brand-secondary', outlet.secondary_color)
  root.style.setProperty('--brand-accent', outlet.accent_color)
}

// ─── STEP TYPES ──────────────────────────────────────────────────────────────

type Step = 'menu' | 'table-input' | 'customer-form' | 'checkout' | 'payment' | 'done'

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function OrderPage({ outlet, initialMenu, initialBanners }: {
  outlet: Outlet
  initialMenu: { categories: MenuCategory[], items: MenuItem[] }
  initialBanners: OutletBanner[]
}) {
  const [step, setStep] = useState<Step>('menu')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [cart, setCart] = useState<CartItem[]>([])
  const [tableNumber, setTableNumber] = useState('')
  const [tableError, setTableError] = useState('')
  const [customer, setCustomer] = useState<CustomerSession | null>(null)
  const [customerForm, setCustomerForm] = useState({ name: '', whatsapp: '', email: '' })
  const [customerError, setCustomerError] = useState('')
  const [orderNote, setOrderNote] = useState('')
  const [orderId, setOrderId] = useState<string | null>(null)
  const [orderNumber, setOrderNumber] = useState<string | null>(null)
  const [paymentProof, setPaymentProof] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [pendingItem, setPendingItem] = useState<MenuItem | null>(null)

  const { categories, items } = initialMenu

  // Load customer session from localStorage
  useEffect(() => {
    applyBrandTheme(outlet)
    const saved = localStorage.getItem('fnb_customer')
    if (saved) {
      try { setCustomer(JSON.parse(saved)) } catch {}
    }
  }, [outlet])

  // Cart helpers
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)

  const addToCart = useCallback((item: MenuItem) => {
    // Step 1: ask table number first if not set
    if (!tableNumber) {
      setPendingItem(item)
      setStep('table-input')
      return
    }
    // Step 2: ask customer data if not saved
    if (!customer) {
      setPendingItem(item)
      setStep('customer-form')
      return
    }
    setCart(prev => {
      const existing = prev.find(c => c.menuItemId === item.id)
      if (existing) {
        return prev.map(c => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      }
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1, imageUrl: item.image_url ?? undefined }]
    })
  }, [tableNumber, customer])

  const removeFromCart = (menuItemId: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItemId === menuItemId)
      if (!existing) return prev
      if (existing.quantity <= 1) return prev.filter(c => c.menuItemId !== menuItemId)
      return prev.map(c => c.menuItemId === menuItemId ? { ...c, quantity: c.quantity - 1 } : c)
    })
  }

  // Table number submit
  const submitTable = () => {
    const num = tableNumber.trim()
    if (!num) { setTableError('Nomor meja wajib diisi'); return }
    const numInt = parseInt(num)
    if (isNaN(numInt) || numInt < 1 || numInt > outlet.max_table_number) {
      setTableError(`Nomor meja harus antara 1 – ${outlet.max_table_number}`)
      return
    }
    setTableError('')
    // After table, check customer
    if (!customer) {
      setStep('customer-form')
    } else {
      setStep('menu')
      if (pendingItem) {
        addToCart(pendingItem)
        setPendingItem(null)
      }
    }
  }

  // Customer form submit
  const submitCustomer = async () => {
    const { name, whatsapp } = customerForm
    if (!name.trim()) { setCustomerError('Nama wajib diisi'); return }
    if (!whatsapp.trim() || whatsapp.length < 9) { setCustomerError('No. WhatsApp tidak valid'); return }
    setCustomerError('')
    setSubmitting(true)

    const customerId = await upsertCustomer(name.trim(), whatsapp.trim(), customerForm.email.trim() || undefined, outlet.id)

    const session: CustomerSession = {
      id: customerId ?? undefined,
      name: name.trim(),
      whatsapp: whatsapp.trim(),
      email: customerForm.email.trim() || undefined,
      savedAt: new Date().toISOString()
    }
    localStorage.setItem('fnb_customer', JSON.stringify(session))
    setCustomer(session)
    setSubmitting(false)
    setStep('menu')
    if (pendingItem) {
      // Slight delay to let state settle
      setTimeout(() => {
        setCart(prev => {
          const existing = prev.find(c => c.menuItemId === pendingItem!.id)
          if (existing) return prev.map(c => c.menuItemId === pendingItem!.id ? { ...c, quantity: c.quantity + 1 } : c)
          return [...prev, { menuItemId: pendingItem!.id, name: pendingItem!.name, price: pendingItem!.price, quantity: 1 }]
        })
        setPendingItem(null)
      }, 100)
    }
  }

  // Place order
  const placeOrder = async () => {
    if (cart.length === 0) return
    setSubmitting(true)
    const result = await createOrder({
      outlet_id: outlet.id,
      customer_id: customer?.id,
      table_number: tableNumber,
      items: cart.map(c => ({
        menu_item_id: c.menuItemId,
        item_name: c.name,
        item_price: c.price,
        quantity: c.quantity,
        notes: c.notes
      })),
      notes: orderNote
    })
    setSubmitting(false)
    if (result.error || !result.data) {
      alert('Gagal membuat pesanan. Coba lagi ya!')
      return
    }
    setOrderId(result.data.id)
    setOrderNumber(result.data.order_number)
    setStep('payment')
  }

  // Upload payment proof
  const handleProofUpload = async () => {
    if (!paymentProof || !orderId) return
    setUploading(true)
    const url = await uploadPaymentProof(paymentProof, orderId)
    setUploading(false)
    if (url) {
      setStep('done')
    } else {
      alert('Gagal upload bukti bayar. Coba lagi.')
    }
  }

  // Filter items by category
  const filteredItems = activeCategory === 'all'
    ? items
    : items.filter(i => i.category_id === activeCategory)

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div style={{ '--p': outlet.primary_color, '--s': outlet.secondary_color, '--a': outlet.accent_color } as React.CSSProperties}>

      {/* ── MENU PAGE ── */}
      {step === 'menu' && (
        <div className="menu-page">
          {/* Hero */}
          <div className="hero-banner">
            <div className="table-indicator" onClick={() => setStep('table-input')}>
              {tableNumber
                ? <span>🪑 Meja <strong>{tableNumber}</strong> <span className="edit-hint">ubah</span></span>
                : <span>📍 Pilih Nomor Meja</span>
              }
            </div>
            <div className="outlet-logo-wrap">
              {outlet.logo_url
                ? <img src={outlet.logo_url} alt={outlet.name} className="outlet-logo-img" />
                : <div className="outlet-logo-initials">{outlet.name.substring(0,2).toUpperCase()}</div>
              }
            </div>
            <h1 className="outlet-name">{outlet.name}</h1>
            {outlet.description && <p className="outlet-desc">{outlet.description}</p>}
          </div>

          {/* Banners */}
          {initialBanners.length > 0 && (
            <div className="banner-scroll">
              {initialBanners.map(b => (
                <div key={b.id} className={"banner-card" + ((b as any).has_detail_page ? " tappable" : "")}
                  onClick={() => { if ((b as any).has_detail_page) window.location.href = `/${outlet.slug}/promo/${b.id}` }}>
                  {b.image_url ? (
                    <div className="banner-img" style={{ backgroundImage: `url(${b.image_url})`, backgroundSize: `${(b as any).image_zoom ?? 100}%`, backgroundPosition: `${(b as any).image_position_x ?? 50}% ${(b as any).image_position_y ?? 50}%`, backgroundRepeat: "no-repeat" }}>
                      {b.title && (
                        <div className="banner-img-overlay">
                          <div className="banner-title" style={{ color: b.text_color }}>{b.title}</div>
                          {b.description && <div className="banner-desc" style={{ color: b.text_color }}>{b.description}</div>}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="banner-color" style={{ background: b.bg_color }}>
                      {b.icon_emoji && <div className="banner-icon">{b.icon_emoji}</div>}
                      <div className="banner-text">
                        <div className="banner-title" style={{ color: b.text_color }}>{b.title}</div>
                        {b.description && <div className="banner-desc" style={{ color: b.text_color }}>{b.description}</div>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="divider" />

          {/* Category filter */}
          <div className="cat-scroll">
            <button className={`cat-chip ${activeCategory === 'all' ? 'active' : ''}`} onClick={() => setActiveCategory('all')}>Semua</button>
            {categories.map(c => (
              <button key={c.id} className={`cat-chip ${activeCategory === c.id ? 'active' : ''}`} onClick={() => setActiveCategory(c.id)}>
                {c.emoji} {c.name}
              </button>
            ))}
          </div>

          {/* Menu items */}
          <div className="menu-list">
            {filteredItems.length === 0 && (
              <div className="empty-state">Belum ada menu di kategori ini</div>
            )}
            {filteredItems.map(item => (
              <div key={item.id} className={`menu-card ${!item.is_available ? 'unavailable' : ''}`}>
                <div className="menu-img-wrap">
                  {item.image_url
                    ? <img src={item.image_url} alt={item.name} className="menu-img" />
                    : <div className="menu-img-placeholder">☕</div>
                  }
                  {!item.is_available && <div className="sold-out-overlay">Habis</div>}
                </div>
                <div className="menu-info">
                  <div className="menu-name">{item.name}</div>
                  {item.description && <div className="menu-desc">{item.description}</div>}
                  <div className="menu-bottom">
                    <div className="menu-price">{formatRp(item.price)}</div>
                    {item.is_available && (
                      <button className="add-btn" onClick={() => addToCart(item)} aria-label={`Tambah ${item.name}`}>
                        {cart.find(c => c.menuItemId === item.id)?.quantity
                          ? <span className="add-count">{cart.find(c => c.menuItemId === item.id)?.quantity}</span>
                          : '+'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ height: 100 }} />

          {/* Cart bar */}
          {cartCount > 0 && (
            <div className="cart-bar" onClick={() => setStep('checkout')}>
              <div className="cart-bar-left">
                <div className="cart-badge">{cartCount}</div>
                <span className="cart-bar-label">Lihat Pesanan</span>
              </div>
              <span className="cart-bar-total">{formatRp(cartTotal)}</span>
            </div>
          )}
        </div>
      )}

      {/* ── TABLE INPUT SHEET ── */}
      {step === 'table-input' && (
        <div className="sheet-page">
          <div className="sheet-inner">
            <div className="sheet-icon">🪑</div>
            <h2 className="sheet-title">Kamu di meja berapa?</h2>
            <p className="sheet-sub">Lihat nomor meja yang tertulis di mejamu. Nomor ini akan tercetak di struk pesananmu.</p>
            <input
              className="big-input"
              type="number"
              inputMode="numeric"
              placeholder="cth: 5"
              value={tableNumber}
              min={1}
              max={outlet.max_table_number}
              onChange={e => { setTableNumber(e.target.value); setTableError('') }}
              onKeyDown={e => e.key === 'Enter' && submitTable()}
              autoFocus
            />
            {tableError && <div className="input-error">{tableError}</div>}
            <p className="table-hint">Tersedia meja 1 – {outlet.max_table_number}</p>
            <button className="primary-btn" onClick={submitTable}>Lanjut →</button>
            <button className="ghost-btn" onClick={() => { setStep('menu'); setPendingItem(null) }}>Kembali ke Menu</button>
          </div>
        </div>
      )}

      {/* ── CUSTOMER FORM SHEET ── */}
      {step === 'customer-form' && (
        <div className="sheet-page">
          <div className="sheet-inner">
            <div className="sheet-icon">👋</div>
            <h2 className="sheet-title">Kenalin dulu ya!</h2>
            <p className="sheet-sub">Isi data di bawah untuk lanjut memesan. Cukup sekali, tidak perlu diisi lagi next visit.</p>

            <div className="form-group">
              <label className="form-label">Nama Lengkap *</label>
              <input className="form-input" type="text" placeholder="Nama kamu"
                value={customerForm.name} onChange={e => setCustomerForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">No. WhatsApp *</label>
              <input className="form-input" type="tel" inputMode="numeric" placeholder="08xx-xxxx-xxxx"
                value={customerForm.whatsapp} onChange={e => setCustomerForm(p => ({ ...p, whatsapp: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Email <span className="optional">(opsional)</span></label>
              <input className="form-input" type="email" placeholder="kamu@email.com"
                value={customerForm.email} onChange={e => setCustomerForm(p => ({ ...p, email: e.target.value }))} />
            </div>

            {customerError && <div className="input-error">{customerError}</div>}

            <div className="privacy-note">🔒 Datamu aman. Hanya dipakai untuk notifikasi pesanan & info promo dari {outlet.name}.</div>

            <button className="primary-btn" onClick={submitCustomer} disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Lanjut Pesan →'}
            </button>
            <button className="ghost-btn" onClick={() => { setStep('menu'); setPendingItem(null) }}>Kembali ke Menu</button>
          </div>
        </div>
      )}

      {/* ── CHECKOUT ── */}
      {step === 'checkout' && (
        <div className="sheet-page">
          <div className="sheet-inner">
            <div className="checkout-header">
              <button className="back-btn" onClick={() => setStep('menu')}>← Menu</button>
              <h2 className="sheet-title" style={{ margin: 0 }}>Pesanan Kamu</h2>
            </div>

            <div className="checkout-meta">
              <span>🪑 Meja {tableNumber}</span>
              <span>👤 {customer?.name}</span>
            </div>

            <div className="cart-items-list">
              {cart.map(item => (
                <div key={item.menuItemId} className="cart-item-row">
                  <div className="cart-item-info">
                    <div className="cart-item-name">{item.name}</div>
                    <div className="cart-item-price">{formatRp(item.price)}</div>
                  </div>
                  <div className="qty-controls">
                    <button className="qty-btn" onClick={() => removeFromCart(item.menuItemId)}>−</button>
                    <span className="qty-num">{item.quantity}</span>
                    <button className="qty-btn" onClick={() => {
                      const mi = items.find(i => i.id === item.menuItemId)
                      if (mi) addToCart(mi)
                    }}>+</button>
                  </div>
                  <div className="cart-item-subtotal">{formatRp(item.price * item.quantity)}</div>
                </div>
              ))}
            </div>

            <div className="form-group">
              <label className="form-label">Catatan Pesanan <span className="optional">(opsional)</span></label>
              <textarea className="form-input" rows={2} placeholder="cth: Es batunya dipisah, less sugar..."
                value={orderNote} onChange={e => setOrderNote(e.target.value)} />
            </div>

            <div className="order-total-row">
              <span>Total</span>
              <span className="order-total-amount">{formatRp(cartTotal)}</span>
            </div>

            <button className="primary-btn" onClick={placeOrder} disabled={submitting || cart.length === 0}>
              {submitting ? 'Memproses...' : 'Pesan & Bayar →'}
            </button>
          </div>
        </div>
      )}

      {/* ── PAYMENT ── */}
      {step === 'payment' && (
        <div className="sheet-page">
          <div className="sheet-inner">
            <div className="order-number-badge">#{orderNumber}</div>
            <h2 className="sheet-title">Scan QRIS untuk Bayar</h2>
            <p className="sheet-sub">Total yang harus dibayar:</p>
            <div className="payment-total">{formatRp(cartTotal)}</div>

            {outlet.qris_image_url ? (
              <div className="qris-wrapper">
                <img src={outlet.qris_image_url} alt="QRIS" className="qris-img" />
              </div>
            ) : (
              <div className="qris-placeholder">
                <div className="qris-placeholder-inner">QRIS belum diupload<br />di dashboard admin</div>
              </div>
            )}

            <div className="upload-section">
              <p className="upload-label">Setelah bayar, upload screenshot bukti pembayaranmu:</p>
              <label className="upload-btn">
                {paymentProof ? `✅ ${paymentProof.name}` : '📎 Pilih Foto Bukti Bayar'}
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => setPaymentProof(e.target.files?.[0] ?? null)} />
              </label>
              {paymentProof && (
                <button className="primary-btn" onClick={handleProofUpload} disabled={uploading}>
                  {uploading ? 'Mengirim...' : 'Kirim Bukti Bayar →'}
                </button>
              )}
            </div>

            <div className="payment-note">
              Jika ada kendala pembayaran, hubungi kasir atau tunjukkan layar ini.
            </div>
          </div>
        </div>
      )}

      {/* ── DONE ── */}
      {step === 'done' && (
        <div className="sheet-page">
          <div className="sheet-inner center">
            <div className="done-icon">🎉</div>
            <h2 className="sheet-title">Pesanan Diterima!</h2>
            <div className="done-order-number">#{orderNumber}</div>
            <p className="sheet-sub">Pesanan kamu sedang diproses. Kasir akan mengkonfirmasi pembayaranmu segera. Kamu bisa tetap duduk di meja {tableNumber}.</p>
            <div className="done-meta">
              <div>👤 {customer?.name}</div>
              <div>🪑 Meja {tableNumber}</div>
              <div>💰 {formatRp(cartTotal)}</div>
            </div>
            <button className="primary-btn" onClick={() => {
              setCart([]); setStep('menu'); setOrderId(null); setOrderNumber(null); setPaymentProof(null)
            }}>
              Pesan Lagi
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        :root {
          --brand-primary: ${outlet.primary_color};
          --brand-secondary: ${outlet.secondary_color};
          --brand-accent: ${outlet.accent_color};
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; background: #FAF7F4; color: #1A0F0A; }
        .menu-page { max-width: 430px; margin: 0 auto; min-height: 100vh; }
        .hero-banner {
          padding: 24px 20px 28px;
          background: linear-gradient(160deg, var(--brand-secondary) 0%, color-mix(in srgb, var(--brand-secondary) 70%, var(--brand-primary)) 100%);
          position: relative;
        }
        .table-indicator {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2);
          border-radius: 20px; padding: 6px 14px; font-size: 13px; color: white;
          cursor: pointer; margin-bottom: 16px;
        }
        .edit-hint { font-size: 11px; opacity: 0.65; text-decoration: underline; margin-left: 4px; }
        .outlet-logo-wrap { margin-bottom: 10px; }
        .outlet-logo-img { width: 52px; height: 52px; border-radius: 12px; object-fit: cover; border: 2px solid rgba(255,255,255,0.3); }
        .outlet-logo-initials {
          width: 52px; height: 52px; border-radius: 12px; background: var(--brand-primary);
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; font-weight: 800; color: white; border: 2px solid rgba(255,255,255,0.3);
        }
        .outlet-name { font-size: 24px; font-weight: 800; color: white; line-height: 1.1; }
        .outlet-desc { font-size: 13px; color: rgba(255,255,255,0.6); margin-top: 4px; }
        .banner-scroll { display: flex; gap: 12px; padding: 14px 16px; overflow-x: auto; scrollbar-width: none; }
        .banner-scroll::-webkit-scrollbar { display: none; }
        .banner-card { flex-shrink: 0; width: 280px; border-radius: 12px; overflow: hidden; aspect-ratio: 2/1; } .banner-card.tappable { cursor: pointer; } .banner-card.tappable:active { opacity: 0.9; transform: scale(0.98); transition: transform 0.1s; }
        .banner-img { width: 100%; height: 100%; background-size: cover; background-position: center; position: relative; display: flex; align-items: flex-end; }
        .banner-img-overlay { width: 100%; padding: 10px 12px; background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%); }
        .banner-color { width: 100%; height: 100%; display: flex; align-items: center; gap: 10px; padding: 14px; }
        
        .banner-icon { font-size: 28px; flex-shrink: 0; }
        .banner-title { font-size: 13px; font-weight: 700; line-height: 1.3; }
        .banner-desc { font-size: 11px; margin-top: 2px; opacity: 0.8; }
        .divider { height: 8px; background: var(--brand-accent); }
        .cat-scroll { display: flex; gap: 8px; padding: 12px 16px 10px; overflow-x: auto; scrollbar-width: none; }
        .cat-scroll::-webkit-scrollbar { display: none; }
        .cat-chip {
          flex-shrink: 0; padding: 7px 14px; border-radius: 20px; border: 1.5px solid rgba(0,0,0,0.1);
          font-size: 13px; font-weight: 500; color: #8B7355; background: white; cursor: pointer; white-space: nowrap;
        }
        .cat-chip.active { background: var(--brand-secondary); color: white; border-color: var(--brand-secondary); }
        .menu-list { padding: 8px 16px; display: flex; flex-direction: column; gap: 10px; }
        .menu-card { display: flex; gap: 12px; padding: 12px; background: white; border-radius: 14px; border: 1px solid rgba(0,0,0,0.07); }
        .menu-card.unavailable { opacity: 0.6; }
        .menu-img-wrap { position: relative; flex-shrink: 0; }
        .menu-img { width: 76px; height: 76px; border-radius: 10px; object-fit: cover; }
        .menu-img-placeholder {
          width: 76px; height: 76px; border-radius: 10px; background: var(--brand-accent);
          display: flex; align-items: center; justify-content: center; font-size: 28px;
        }
        .sold-out-overlay {
          position: absolute; inset: 0; background: rgba(0,0,0,0.5); border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; color: white;
        }
        .menu-info { flex: 1; display: flex; flex-direction: column; }
        .menu-name { font-size: 14px; font-weight: 600; }
        .menu-desc { font-size: 12px; color: #8B7355; margin-top: 2px; flex: 1; line-height: 1.4; }
        .menu-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
        .menu-price { font-size: 15px; font-weight: 700; color: var(--brand-primary); }
        .add-btn {
          width: 30px; height: 30px; border-radius: 8px; background: var(--brand-secondary);
          color: white; border: none; font-size: 18px; display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .add-count { font-size: 13px; font-weight: 700; }
        .cart-bar {
          position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
          width: 100%; max-width: 430px; background: var(--brand-secondary); color: white;
          padding: 16px 20px; display: flex; align-items: center; justify-content: space-between;
          border-radius: 20px 20px 0 0; cursor: pointer; z-index: 50;
        }
        .cart-bar-left { display: flex; align-items: center; gap: 10px; }
        .cart-badge {
          width: 26px; height: 26px; border-radius: 8px; background: var(--brand-primary);
          display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700;
        }
        .cart-bar-label { font-size: 14px; font-weight: 600; }
        .cart-bar-total { font-size: 15px; font-weight: 700; color: var(--brand-primary); }
        .empty-state { text-align: center; color: #8B7355; font-size: 14px; padding: 40px 20px; }

        /* SHEETS */
        .sheet-page { max-width: 430px; margin: 0 auto; min-height: 100vh; display: flex; align-items: flex-start; padding-top: 40px; }
        .sheet-inner { width: 100%; padding: 24px 20px 48px; }
        .sheet-inner.center { text-align: center; }
        .sheet-icon { font-size: 40px; margin-bottom: 12px; }
        .sheet-title { font-size: 22px; font-weight: 800; margin-bottom: 8px; }
        .sheet-sub { font-size: 14px; color: #8B7355; line-height: 1.5; margin-bottom: 24px; }
        .big-input {
          width: 100%; padding: 18px; border-radius: 12px; border: 2px solid rgba(0,0,0,0.12);
          font-size: 32px; font-weight: 700; text-align: center; outline: none; background: white;
          margin-bottom: 8px;
        }
        .big-input:focus { border-color: var(--brand-primary); }
        .table-hint { font-size: 12px; color: #8B7355; text-align: center; margin-bottom: 24px; }
        .input-error { font-size: 13px; color: #E24B4A; margin-bottom: 12px; }
        .form-group { margin-bottom: 16px; }
        .form-label { display: block; font-size: 12px; font-weight: 600; color: #8B7355; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
        .optional { font-weight: 400; text-transform: none; font-size: 11px; }
        .form-input {
          width: 100%; padding: 12px 14px; border-radius: 10px; border: 1.5px solid rgba(0,0,0,0.1);
          font-size: 14px; font-family: inherit; color: #1A0F0A; background: white; outline: none; resize: none;
        }
        .form-input:focus { border-color: var(--brand-primary); }
        .privacy-note { font-size: 12px; color: #8B7355; background: var(--brand-accent); border-radius: 8px; padding: 10px 12px; margin-bottom: 20px; line-height: 1.5; }
        .primary-btn {
          width: 100%; padding: 15px; border-radius: 12px; background: var(--brand-secondary); color: white;
          border: none; font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer; margin-bottom: 12px;
        }
        .primary-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .ghost-btn {
          width: 100%; padding: 12px; border-radius: 12px; background: transparent; color: #8B7355;
          border: 1.5px solid rgba(0,0,0,0.12); font-size: 14px; font-family: inherit; cursor: pointer;
        }
        .back-btn { font-size: 14px; color: #8B7355; background: none; border: none; cursor: pointer; padding: 0; }
        .checkout-header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
        .checkout-meta { display: flex; gap: 16px; font-size: 13px; color: #8B7355; margin-bottom: 20px; }
        .cart-items-list { border-top: 1px solid rgba(0,0,0,0.08); margin-bottom: 20px; }
        .cart-item-row { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid rgba(0,0,0,0.06); }
        .cart-item-info { flex: 1; }
        .cart-item-name { font-size: 14px; font-weight: 600; }
        .cart-item-price { font-size: 12px; color: #8B7355; }
        .cart-item-subtotal { font-size: 14px; font-weight: 700; color: var(--brand-primary); min-width: 70px; text-align: right; }
        .qty-controls { display: flex; align-items: center; gap: 8px; }
        .qty-btn { width: 26px; height: 26px; border-radius: 8px; border: 1.5px solid rgba(0,0,0,0.12); background: white; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .qty-num { font-size: 14px; font-weight: 700; min-width: 20px; text-align: center; }
        .order-total-row { display: flex; justify-content: space-between; padding: 14px 0; margin-bottom: 20px; border-top: 2px solid rgba(0,0,0,0.08); }
        .order-total-amount { font-size: 18px; font-weight: 800; color: var(--brand-primary); }
        .order-number-badge { display: inline-block; background: var(--brand-accent); color: var(--brand-secondary); font-size: 13px; font-weight: 700; padding: 4px 12px; border-radius: 20px; margin-bottom: 16px; }
        .payment-total { font-size: 36px; font-weight: 800; color: var(--brand-primary); margin-bottom: 24px; }
        .qris-wrapper { background: white; border-radius: 16px; padding: 16px; border: 2px solid rgba(0,0,0,0.08); margin-bottom: 24px; display: flex; justify-content: center; }
        .qris-img { max-width: 240px; width: 100%; }
        .qris-placeholder { background: #f0f0f0; border-radius: 16px; padding: 48px 24px; margin-bottom: 24px; text-align: center; }
        .qris-placeholder-inner { font-size: 14px; color: #8B7355; }
        .upload-section { margin-bottom: 20px; }
        .upload-label { font-size: 13px; color: #8B7355; margin-bottom: 10px; }
        .upload-btn {
          display: block; width: 100%; padding: 14px; border-radius: 12px;
          border: 2px dashed rgba(0,0,0,0.15); text-align: center; font-size: 14px; font-weight: 600;
          color: var(--brand-secondary); cursor: pointer; margin-bottom: 12px; background: white;
        }
        .payment-note { font-size: 12px; color: #8B7355; text-align: center; line-height: 1.5; }
        .done-icon { font-size: 56px; margin-bottom: 12px; }
        .done-order-number { font-size: 24px; font-weight: 800; color: var(--brand-primary); margin-bottom: 16px; }
        .done-meta { background: var(--brand-accent); border-radius: 12px; padding: 16px; margin: 20px 0; display: flex; flex-direction: column; gap: 8px; font-size: 14px; font-weight: 600; text-align: left; }
      `}</style>
    </div>
  )
}
