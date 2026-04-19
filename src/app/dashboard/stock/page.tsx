'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'

function formatRp(n: number) { return 'Rp ' + Math.round(n).toLocaleString('id-ID') }

interface StockItem {
  id: number
  name: string
  unit: string
  current: number
  parLevel: number
  reorderQty: number
  lastPrice: number
  category: string
  lastUpdated: string
}

interface Purchase {
  id: number
  itemId: number
  itemName: string
  qty: number
  price: number
  date: string
  supplier: string
}

const INITIAL_STOCK: StockItem[] = [
  { id: 1, name: 'Beras Hitam', unit: 'kg', current: 8, parLevel: 3, reorderQty: 10, lastPrice: 20000, category: 'Bahan Makanan', lastUpdated: new Date().toLocaleDateString('id-ID') },
  { id: 2, name: 'Ayam Potong', unit: 'kg', current: 2.5, parLevel: 2, reorderQty: 5, lastPrice: 40000, category: 'Protein', lastUpdated: new Date().toLocaleDateString('id-ID') },
  { id: 3, name: 'Kopi Biji', unit: 'kg', current: 0.4, parLevel: 0.5, reorderQty: 2, lastPrice: 120000, category: 'Minuman', lastUpdated: new Date().toLocaleDateString('id-ID') },
  { id: 4, name: 'Susu UHT', unit: 'liter', current: 6, parLevel: 4, reorderQty: 12, lastPrice: 18000, category: 'Minuman', lastUpdated: new Date().toLocaleDateString('id-ID') },
  { id: 5, name: 'Gas LPG 3kg', unit: 'tabung', current: 1, parLevel: 1, reorderQty: 2, lastPrice: 30000, category: 'Operasional', lastUpdated: new Date().toLocaleDateString('id-ID') },
  { id: 6, name: 'Minyak Goreng', unit: 'liter', current: 5, parLevel: 2, reorderQty: 5, lastPrice: 18000, category: 'Bahan Makanan', lastUpdated: new Date().toLocaleDateString('id-ID') },
  { id: 7, name: 'Tepung Bumbu', unit: 'kg', current: 1.5, parLevel: 0.5, reorderQty: 3, lastPrice: 15000, category: 'Bahan Makanan', lastUpdated: new Date().toLocaleDateString('id-ID') },
  { id: 8, name: 'Gula Pasir', unit: 'kg', current: 3, parLevel: 1, reorderQty: 5, lastPrice: 14000, category: 'Bahan Makanan', lastUpdated: new Date().toLocaleDateString('id-ID') },
  { id: 9, name: 'Tisu & Sabun', unit: 'pack', current: 2, parLevel: 1, reorderQty: 3, lastPrice: 25000, category: 'Operasional', lastUpdated: new Date().toLocaleDateString('id-ID') },
]

export default function StockPage() {
  const [stocks, setStocks] = useState<StockItem[]>(INITIAL_STOCK)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [activeTab, setActiveTab] = useState<'stock' | 'purchase' | 'report'>('stock')
  const [filterCat, setFilterCat] = useState('all')
  const [showAddItem, setShowAddItem] = useState(false)
  const [showAddPurchase, setShowAddPurchase] = useState(false)
  const [showAdjust, setShowAdjust] = useState<StockItem | null>(null)
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustNote, setAdjustNote] = useState('')
  const [newItem, setNewItem] = useState({ name: '', unit: 'kg', current: '', parLevel: '', reorderQty: '', lastPrice: '', category: 'Bahan Makanan' })
  const [newPurchase, setNewPurchase] = useState({ itemId: '', qty: '', price: '', supplier: '' })

  const lowStock = stocks.filter(s => s.current <= s.parLevel)
  const categories = ['all', ...new Set(stocks.map(s => s.category))]

  const filteredStocks = filterCat === 'all' ? stocks : stocks.filter(s => s.category === filterCat)

  const getStockStatus = (s: StockItem) => {
    if (s.current <= 0) return { label: 'Habis', color: '#E24B4A', bg: '#FDECEA' }
    if (s.current <= s.parLevel) return { label: 'Hampir Habis', color: '#D97706', bg: '#FEF3CD' }
    return { label: 'Aman', color: '#1D9E75', bg: '#D1FAE5' }
  }

  const adjustStock = () => {
    if (!showAdjust || !adjustQty) return
    const qty = parseFloat(adjustQty)
    setStocks(prev => prev.map(s => s.id === showAdjust.id ? { ...s, current: Math.max(0, s.current + qty), lastUpdated: new Date().toLocaleDateString('id-ID') } : s))
    setShowAdjust(null); setAdjustQty(''); setAdjustNote('')
  }

  const addPurchase = () => {
    const item = stocks.find(s => s.id === parseInt(newPurchase.itemId))
    if (!item || !newPurchase.qty || !newPurchase.price) return
    const qty = parseFloat(newPurchase.qty)
    const price = parseInt(newPurchase.price)
    // Update stock
    setStocks(prev => prev.map(s => s.id === item.id ? { ...s, current: s.current + qty, lastPrice: price, lastUpdated: new Date().toLocaleDateString('id-ID') } : s))
    // Add purchase record
    setPurchases(prev => [{ id: Date.now(), itemId: item.id, itemName: item.name, qty, price, date: new Date().toLocaleDateString('id-ID'), supplier: newPurchase.supplier || '-' }, ...prev])
    setNewPurchase({ itemId: '', qty: '', price: '', supplier: '' })
    setShowAddPurchase(false)
  }

  const addItem = () => {
    if (!newItem.name || !newItem.parLevel) return
    setStocks(prev => [...prev, {
      id: Date.now(), name: newItem.name, unit: newItem.unit,
      current: parseFloat(newItem.current) || 0,
      parLevel: parseFloat(newItem.parLevel),
      reorderQty: parseFloat(newItem.reorderQty) || parseFloat(newItem.parLevel) * 2,
      lastPrice: parseInt(newItem.lastPrice) || 0,
      category: newItem.category,
      lastUpdated: new Date().toLocaleDateString('id-ID')
    }])
    setNewItem({ name: '', unit: 'kg', current: '', parLevel: '', reorderQty: '', lastPrice: '', category: 'Bahan Makanan' })
    setShowAddItem(false)
  }

  const totalInventoryValue = stocks.reduce((s, i) => s + i.current * i.lastPrice, 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Stok & Inventori</h1>
          <p style={{ fontSize: 13, color: '#8B7355' }}>Pantau stok bahan, set batas minimum, catat pembelian</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowAddPurchase(true)} style={{ padding: '8px 16px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', background: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#2C1810' }}>📦 Catat Pembelian</button>
          <button onClick={() => setShowAddItem(true)} style={{ padding: '8px 16px', borderRadius: 10, background: '#C8873A', border: 'none', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>+ Tambah Item</button>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div style={{ background: '#FEF3CD', border: '1px solid #F59E0B', borderRadius: 12, padding: 14, marginBottom: 16, display: 'flex', gap: 10 }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 4 }}>
              {lowStock.length} item perlu segera dibeli
            </div>
            <div style={{ fontSize: 12, color: '#78350F' }}>
              {lowStock.map(s => s.name).join(' · ')}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total Item', value: stocks.length, sub: 'jenis bahan', color: '#2C4A7C' },
          { label: 'Stok Aman', value: stocks.filter(s => s.current > s.parLevel).length, sub: 'item', color: '#1D9E75' },
          { label: 'Hampir Habis', value: lowStock.filter(s => s.current > 0).length, sub: 'item', color: '#D97706' },
          { label: 'Habis', value: stocks.filter(s => s.current <= 0).length, sub: 'item', color: '#E24B4A' },
          { label: 'Nilai Inventori', value: formatRp(totalInventoryValue), sub: 'estimasi', color: '#C8873A', wide: true },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', borderRadius: 12, padding: 14, border: '1px solid rgba(0,0,0,0.07)', gridColumn: (s as any).wide ? 'span 2' : 'span 1' }}>
            <div style={{ fontSize: 11, color: '#8B7355', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: typeof s.value === 'string' ? 18 : 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#8B7355', marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {(['stock', 'purchase'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '7px 16px', borderRadius: 10, border: '1.5px solid', borderColor: activeTab === t ? '#C8873A' : 'rgba(0,0,0,0.1)', background: activeTab === t ? '#FDF4E9' : 'white', color: activeTab === t ? '#C8873A' : '#8B7355', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            {t === 'stock' ? '📦 Daftar Stok' : '🛒 Riwayat Pembelian'}
          </button>
        ))}
      </div>

      {/* ── STOCK LIST ── */}
      {activeTab === 'stock' && (
        <div>
          {/* Category filter */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {categories.map(c => (
              <button key={c} onClick={() => setFilterCat(c)} style={{ padding: '5px 12px', borderRadius: 20, border: '1.5px solid', borderColor: filterCat === c ? '#C8873A' : 'rgba(0,0,0,0.1)', background: filterCat === c ? '#C8873A' : 'white', color: filterCat === c ? 'white' : '#8B7355', fontWeight: 600, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                {c === 'all' ? 'Semua' : c}
              </button>
            ))}
          </div>

          <div style={{ background: 'white', borderRadius: 14, border: '1px solid rgba(0,0,0,0.07)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#FAF7F4' }}>
                  {['Bahan', 'Stok Saat Ini', 'Par Level', 'Status', 'Harga/Unit', 'Update Terakhir', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#8B7355', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStocks.map(s => {
                  const status = getStockStatus(s)
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: '#8B7355' }}>{s.category}</div>
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, fontSize: 15, color: s.current <= s.parLevel ? '#E24B4A' : '#1A0F0A' }}>
                        {s.current} <span style={{ fontSize: 12, fontWeight: 400, color: '#8B7355' }}>{s.unit}</span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#8B7355' }}>{s.parLevel} {s.unit}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: status.bg, color: status.color, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{status.label}</span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#8B7355' }}>{formatRp(s.lastPrice)}</td>
                      <td style={{ padding: '12px 14px', fontSize: 12, color: '#8B7355' }}>{s.lastUpdated}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <button onClick={() => { setShowAdjust(s); setAdjustQty('') }} style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(0,0,0,0.1)', background: 'white', fontSize: 12, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit', color: '#2C1810' }}>Adjust</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PURCHASE HISTORY ── */}
      {activeTab === 'purchase' && (
        <div>
          {purchases.length === 0 ? (
            <div style={{ background: 'white', borderRadius: 14, padding: 48, textAlign: 'center', color: '#8B7355', fontSize: 14, border: '1px solid rgba(0,0,0,0.07)' }}>
              Belum ada riwayat pembelian. Klik <strong>Catat Pembelian</strong> untuk mulai.
            </div>
          ) : (
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid rgba(0,0,0,0.07)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#FAF7F4' }}>
                    {['Tanggal', 'Bahan', 'Jumlah', 'Harga/Unit', 'Total', 'Supplier'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#8B7355', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {purchases.map(p => {
                    const item = stocks.find(s => s.id === p.itemId)
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                        <td style={{ padding: '12px 14px', fontSize: 13, color: '#8B7355' }}>{p.date}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 600 }}>{p.itemName}</td>
                        <td style={{ padding: '12px 14px', fontSize: 13 }}>{p.qty} {item?.unit}</td>
                        <td style={{ padding: '12px 14px', fontSize: 13, color: '#8B7355' }}>{formatRp(p.price)}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#C8873A' }}>{formatRp(p.qty * p.price)}</td>
                        <td style={{ padding: '12px 14px', fontSize: 13, color: '#8B7355' }}>{p.supplier}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ADJUST MODAL */}
      {showAdjust && (
        <div onClick={e => e.target === e.currentTarget && setShowAdjust(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 380 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Adjust Stok</div>
            <div style={{ fontSize: 13, color: '#8B7355', marginBottom: 16 }}>{showAdjust.name} · Saat ini: {showAdjust.current} {showAdjust.unit}</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Perubahan Jumlah</label>
              <input value={adjustQty} onChange={e => setAdjustQty(e.target.value)} type="number" placeholder="+5 untuk tambah, -2 untuk kurangi"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
              {adjustQty && <div style={{ fontSize: 12, color: '#8B7355', marginTop: 4 }}>Hasil: {showAdjust.current + (parseFloat(adjustQty) || 0)} {showAdjust.unit}</div>}
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Keterangan</label>
              <input value={adjustNote} onChange={e => setAdjustNote(e.target.value)} placeholder="cth: Koreksi stok opname"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowAdjust(null)} style={{ flex: 1, padding: 11, borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: 'white', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', color: '#8B7355', fontWeight: 600 }}>Batal</button>
              <button onClick={adjustStock} style={{ flex: 1, padding: 11, borderRadius: 10, border: 'none', background: '#C8873A', color: 'white', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', fontWeight: 700 }}>Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD PURCHASE MODAL */}
      {showAddPurchase && (
        <div onClick={e => e.target === e.currentTarget && setShowAddPurchase(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>Catat Pembelian Bahan</div>
            {[
              { label: 'Bahan', type: 'select', value: newPurchase.itemId, key: 'itemId' },
              { label: 'Jumlah', type: 'number', value: newPurchase.qty, key: 'qty', placeholder: 'cth: 5' },
              { label: 'Harga per Unit (Rp)', type: 'number', value: newPurchase.price, key: 'price', placeholder: 'cth: 40000' },
              { label: 'Supplier', type: 'text', value: newPurchase.supplier, key: 'supplier', placeholder: 'cth: Pasar Induk' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>{f.label}</label>
                {f.type === 'select' ? (
                  <select value={f.value} onChange={e => setNewPurchase(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: 'white' }}>
                    <option value="">Pilih bahan...</option>
                    {stocks.map(s => <option key={s.id} value={s.id}>{s.name} (stok: {s.current} {s.unit})</option>)}
                  </select>
                ) : (
                  <input value={f.value} onChange={e => setNewPurchase(p => ({ ...p, [f.key]: e.target.value }))}
                    type={f.type} placeholder={(f as any).placeholder || ''}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
                )}
              </div>
            ))}
            {newPurchase.qty && newPurchase.price && (
              <div style={{ background: '#FDF4E9', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: '#C8873A', fontWeight: 600 }}>
                Total: {formatRp(parseFloat(newPurchase.qty) * parseInt(newPurchase.price))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowAddPurchase(false)} style={{ flex: 1, padding: 11, borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: 'white', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', color: '#8B7355', fontWeight: 600 }}>Batal</button>
              <button onClick={addPurchase} style={{ flex: 1, padding: 11, borderRadius: 10, border: 'none', background: '#C8873A', color: 'white', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', fontWeight: 700 }}>Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD ITEM MODAL */}
      {showAddItem && (
        <div onClick={e => e.target === e.currentTarget && setShowAddItem(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>Tambah Item Stok</div>
            {[
              { label: 'Nama Bahan *', key: 'name', placeholder: 'cth: Mentega' },
              { label: 'Satuan', key: 'unit', placeholder: 'kg / liter / pcs' },
              { label: 'Stok Awal', key: 'current', placeholder: '0', type: 'number' },
              { label: 'Par Level (minimum) *', key: 'parLevel', placeholder: 'cth: 1', type: 'number' },
              { label: 'Harga per Unit (Rp)', key: 'lastPrice', placeholder: 'cth: 20000', type: 'number' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input value={(newItem as any)[f.key]} onChange={e => setNewItem(p => ({ ...p, [f.key]: e.target.value }))}
                  type={f.type || 'text'} placeholder={f.placeholder}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Kategori</label>
              <select value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: 'white' }}>
                {['Bahan Makanan', 'Protein', 'Minuman', 'Operasional', 'Lainnya'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowAddItem(false)} style={{ flex: 1, padding: 11, borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: 'white', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', color: '#8B7355', fontWeight: 600 }}>Batal</button>
              <button onClick={addItem} style={{ flex: 1, padding: 11, borderRadius: 10, border: 'none', background: '#C8873A', color: 'white', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', fontWeight: 700 }}>Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
