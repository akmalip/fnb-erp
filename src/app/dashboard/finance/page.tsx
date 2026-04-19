'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function formatRp(n: number) { return 'Rp ' + Math.round(n).toLocaleString('id-ID') }

export default function FinancePage() {
  const [outletId, setOutletId] = useState('')
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today')
  const [activeSection, setActiveSection] = useState<'overview' | 'pl' | 'cashflow' | 'hpp'>('overview')

  // Manual expense entries
  const [expenses, setExpenses] = useState([
    { id: 1, name: 'Gaji Karyawan', amount: 6000000, category: 'SDM', recurring: true },
    { id: 2, name: 'Sewa Tempat', amount: 3000000, category: 'Operasional', recurring: true },
    { id: 3, name: 'Listrik & Air', amount: 800000, category: 'Operasional', recurring: true },
    { id: 4, name: 'Gas', amount: 300000, category: 'Operasional', recurring: true },
    { id: 5, name: 'Bahan Baku', amount: 4500000, category: 'HPP', recurring: true },
  ])
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [newExp, setNewExp] = useState({ name: '', amount: '', category: 'Operasional' })

  const sb = createClient()

  useEffect(() => {
    const id = localStorage.getItem('fnb_outlet_id') || ''
    setOutletId(id)
    if (id) loadOrders(id)
  }, [period])

  const loadOrders = async (id: string) => {
    setLoading(true)
    let from = new Date()
    if (period === 'today') from.setHours(0, 0, 0, 0)
    else if (period === 'week') from.setDate(from.getDate() - 7)
    else if (period === 'month') from.setDate(1)

    const { data } = await sb.from('orders')
      .select('*, order_items(*)')
      .eq('outlet_id', id)
      .eq('payment_status', 'paid')
      .gte('created_at', from.toISOString())
      .order('created_at', { ascending: false })

    setOrders(data || [])
    setLoading(false)
  }

  const totalRevenue = orders.reduce((s, o) => s + (o.total_amount || 0), 0)
  const totalOrders = orders.length
  const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0
  const totalExpenses = expenses.reduce((s, e) => s + (period === 'today' ? e.amount / 30 : period === 'week' ? e.amount / 4 : e.amount), 0)
  const grossProfit = totalRevenue * 0.68 // ~32% food cost
  const netProfit = grossProfit - (totalExpenses * (period === 'today' ? 1/30 : period === 'week' ? 1/4 : 1))

  const expByCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount
    return acc
  }, {} as Record<string, number>)

  const addExpense = () => {
    if (!newExp.name || !newExp.amount) return
    setExpenses(prev => [...prev, { id: Date.now(), name: newExp.name, amount: parseInt(newExp.amount), category: newExp.category, recurring: true }])
    setNewExp({ name: '', amount: '', category: 'Operasional' })
    setShowAddExpense(false)
  }

  const periodLabel = period === 'today' ? 'Hari Ini' : period === 'week' ? '7 Hari Terakhir' : 'Bulan Ini'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Keuangan</h1>
          <p style={{ fontSize: 13, color: '#8B7355' }}>Overview pendapatan, pengeluaran, dan profitabilitas</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['today', 'week', 'month'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{ padding: '7px 14px', borderRadius: 10, border: '1.5px solid', borderColor: period === p ? '#C8873A' : 'rgba(0,0,0,0.1)', background: period === p ? '#C8873A' : 'white', color: period === p ? 'white' : '#8B7355', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              {p === 'today' ? 'Hari Ini' : p === 'week' ? 'Minggu' : 'Bulan Ini'}
            </button>
          ))}
        </div>
      </div>

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'white', padding: 4, borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', width: 'fit-content' }}>
        {([
          { id: 'overview', label: '📊 Overview' },
          { id: 'pl', label: '📈 Laba Rugi' },
          { id: 'cashflow', label: '💰 Kas' },
          { id: 'hpp', label: '🧮 HPP' },
        ] as const).map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: activeSection === s.id ? '#2C1810' : 'transparent', color: activeSection === s.id ? 'white' : '#8B7355', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {activeSection === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Penjualan', value: formatRp(totalRevenue), sub: `${totalOrders} transaksi`, color: '#1D9E75' },
              { label: 'Rata-rata Order', value: formatRp(avgOrder), sub: 'per transaksi', color: '#C8873A' },
              { label: 'Laba Kotor (est)', value: formatRp(grossProfit), sub: 'food cost ~32%', color: '#2C4A7C' },
              { label: 'Estimasi Laba Bersih', value: formatRp(netProfit), sub: period === 'month' ? 'setelah biaya operasional' : 'estimasi proporsional', color: netProfit > 0 ? '#1D9E75' : '#E24B4A' },
            ].map(s => (
              <div key={s.label} style={{ background: 'white', borderRadius: 14, padding: 18, border: '1px solid rgba(0,0,0,0.07)' }}>
                <div style={{ fontSize: 11, color: '#8B7355', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{s.value}</div>
                <div style={{ fontSize: 12, color: '#8B7355', marginTop: 4 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Revenue by payment method */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ background: 'white', borderRadius: 14, padding: 20, border: '1px solid rgba(0,0,0,0.07)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Pendapatan per Metode Bayar</div>
              {['qris', 'cash', 'transfer'].map(m => {
                const mOrders = orders.filter(o => o.payment_method === m)
                const mTotal = mOrders.reduce((s, o) => s + o.total_amount, 0)
                const pct = totalRevenue > 0 ? Math.round(mTotal / totalRevenue * 100) : 0
                return (
                  <div key={m} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ fontWeight: 500 }}>{m === 'qris' ? '📱 QRIS' : m === 'cash' ? '💵 Tunai' : '🏦 Transfer'}</span>
                      <span style={{ fontWeight: 600 }}>{formatRp(mTotal)} <span style={{ color: '#8B7355', fontSize: 11 }}>({pct}%)</span></span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 3 }}>
                      <div style={{ height: '100%', background: '#C8873A', borderRadius: 3, width: pct + '%', transition: 'width 0.5s' }} />
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ background: 'white', borderRadius: 14, padding: 20, border: '1px solid rgba(0,0,0,0.07)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Biaya Operasional {periodLabel}</div>
              {Object.entries(expByCategory).map(([cat, amt]) => {
                const adj = period === 'today' ? amt/30 : period === 'week' ? amt/4 : amt
                return (
                  <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    <span style={{ color: '#8B7355' }}>{cat}</span>
                    <span style={{ fontWeight: 600, color: '#E24B4A' }}>{formatRp(adj)}</span>
                  </div>
                )
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, marginTop: 8, paddingTop: 8, borderTop: '2px solid rgba(0,0,0,0.1)' }}>
                <span>Total</span>
                <span style={{ color: '#E24B4A' }}>{formatRp(totalExpenses)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── P&L ── */}
      {activeSection === 'pl' && (
        <div>
          <div style={{ background: 'white', borderRadius: 14, padding: 24, border: '1px solid rgba(0,0,0,0.07)', maxWidth: 600 }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 20 }}>Laporan Laba Rugi — {periodLabel}</div>

            {[
              { label: 'PENDAPATAN', items: [
                { name: 'Penjualan Makanan & Minuman', value: totalRevenue, type: 'income' },
              ]},
              { label: 'BIAYA POKOK (HPP)', items: [
                { name: 'Food Cost (~32%)', value: -(totalRevenue * 0.32), type: 'expense' },
              ]},
              { label: 'BIAYA OPERASIONAL', items: expenses.map(e => ({
                name: e.name,
                value: -(period === 'today' ? e.amount/30 : period === 'week' ? e.amount/4 : e.amount),
                type: 'expense' as const
              }))},
            ].map(section => (
              <div key={section.label} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8B7355', padding: '8px 0', borderBottom: '2px solid rgba(0,0,0,0.08)' }}>{section.label}</div>
                {section.items.map(item => (
                  <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.05)', fontSize: 13 }}>
                    <span style={{ color: '#3A2A20' }}>{item.name}</span>
                    <span style={{ fontWeight: 600, color: item.type === 'income' ? '#1D9E75' : '#E24B4A' }}>{item.type === 'income' ? '+' : ''}{formatRp(Math.abs(item.value))}</span>
                  </div>
                ))}
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, padding: '12px 0', borderTop: '2px solid #1A0F0A' }}>
              <span>LABA BERSIH</span>
              <span style={{ color: netProfit > 0 ? '#1D9E75' : '#E24B4A' }}>{netProfit > 0 ? '+' : ''}{formatRp(netProfit)}</span>
            </div>

            {netProfit < 0 && (
              <div style={{ background: '#FDECEA', borderLeft: '3px solid #E24B4A', borderRadius: 8, padding: '12px 14px', marginTop: 12, fontSize: 13, color: '#991B1B' }}>
                ⚠️ Bulan ini merugi. Perlu review biaya operasional atau tingkatkan penjualan.
              </div>
            )}
            {netProfit > 0 && (
              <div style={{ background: '#D1FAE5', borderLeft: '3px solid #1D9E75', borderRadius: 8, padding: '12px 14px', marginTop: 12, fontSize: 13, color: '#065F46' }}>
                ✅ Net margin: {totalRevenue > 0 ? Math.round(netProfit/totalRevenue*100) : 0}% {totalRevenue > 0 && netProfit/totalRevenue > 0.15 ? '— Sehat!' : '— Cukup baik'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CASH FLOW ── */}
      {activeSection === 'cashflow' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Pengeluaran Operasional</div>
            <button onClick={() => setShowAddExpense(true)} style={{ padding: '7px 14px', borderRadius: 10, background: '#C8873A', border: 'none', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>+ Tambah</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {expenses.map(e => (
              <div key={e.id} style={{ background: 'white', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 14, border: '1px solid rgba(0,0,0,0.07)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{e.name}</div>
                  <div style={{ fontSize: 12, color: '#8B7355', marginTop: 2 }}>
                    <span style={{ background: '#F0E8DF', borderRadius: 4, padding: '1px 6px', fontSize: 11 }}>{e.category}</span>
                    {e.recurring && <span style={{ marginLeft: 6, color: '#8B7355' }}>· Bulanan</span>}
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#E24B4A' }}>{formatRp(e.amount)}<span style={{ fontSize: 11, color: '#8B7355', fontWeight: 400 }}>/bln</span></div>
                <button onClick={() => setExpenses(prev => prev.filter(x => x.id !== e.id))} style={{ background: 'none', border: 'none', color: '#E24B4A', cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ background: '#FDF4E9', borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 800 }}>
            <span>Total Biaya/Bulan</span>
            <span style={{ color: '#C8873A' }}>{formatRp(expenses.reduce((s, e) => s + e.amount, 0))}</span>
          </div>
          <div style={{ background: '#EFF6FF', borderRadius: 12, padding: 14, marginTop: 10, fontSize: 13, color: '#1E40AF', lineHeight: 1.6 }}>
            💡 <strong>Break Even Harian:</strong> Kamu perlu penjualan minimal <strong>{formatRp(expenses.reduce((s,e) => s+e.amount, 0) / 30)}</strong> per hari untuk menutup biaya operasional.
          </div>
        </div>
      )}

      {/* ── HPP ── */}
      {activeSection === 'hpp' && (
        <div style={{ maxWidth: 600 }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 24, border: '1px solid rgba(0,0,0,0.07)', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Kalkulator Harga Jual</div>
            <HPPCalculator />
          </div>
          <div style={{ background: '#FFF8F0', borderRadius: 12, padding: 16, border: '1px solid rgba(200,135,58,0.2)', fontSize: 13, lineHeight: 1.7, color: '#3A2A20' }}>
            <strong>📖 Panduan Food Cost Target:</strong><br/>
            🟢 Minuman kopi: <strong>20–25%</strong><br/>
            🟡 Minuman non-kopi: <strong>25–30%</strong><br/>
            🟡 Makanan ringan: <strong>28–32%</strong><br/>
            🔴 Makanan berat: <strong>30–35%</strong><br/>
            <br/>
            Food cost &gt;40% = harga jual perlu dinaikkan atau HPP ditekan.
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddExpense && (
        <div onClick={e => e.target === e.currentTarget && setShowAddExpense(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 380 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>Tambah Pengeluaran</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Nama</label>
              <input value={newExp.name} onChange={e => setNewExp(p => ({ ...p, name: e.target.value }))} placeholder="cth: Gaji Kasir" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Jumlah per Bulan (Rp)</label>
              <input value={newExp.amount} onChange={e => setNewExp(p => ({ ...p, amount: e.target.value }))} type="number" placeholder="0" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Kategori</label>
              <select value={newExp.category} onChange={e => setNewExp(p => ({ ...p, category: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: 'white' }}>
                {['Operasional', 'SDM', 'HPP', 'Marketing', 'Lainnya'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowAddExpense(false)} style={{ flex: 1, padding: 11, borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: 'white', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', color: '#8B7355', fontWeight: 600 }}>Batal</button>
              <button onClick={addExpense} style={{ flex: 1, padding: 11, borderRadius: 10, border: 'none', background: '#C8873A', color: 'white', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', fontWeight: 700 }}>Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function HPPCalculator() {
  const [hpp, setHpp] = useState('')
  const [fc, setFc] = useState('30')
  const [price, setPrice] = useState('')

  const hppNum = parseFloat(hpp) || 0
  const fcNum = parseFloat(fc) || 30
  const priceNum = parseFloat(price) || 0
  const minPrice = hppNum > 0 ? hppNum / (fcNum / 100) : 0
  const actualFC = priceNum > 0 && hppNum > 0 ? (hppNum / priceNum * 100) : 0
  const profit = priceNum > 0 ? priceNum - hppNum : minPrice - hppNum
  const isGood = priceNum > 0 ? actualFC <= fcNum : false

  const formatRp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')

  return (
    <div>
      {[
        { label: 'HPP per Porsi (Rp)', value: hpp, setter: setHpp, placeholder: 'Total biaya bahan' },
        { label: 'Target Food Cost (%)', value: fc, setter: setFc, placeholder: '30' },
        { label: 'Harga Jual Rencana (Rp)', value: price, setter: setPrice, placeholder: 'Opsional' },
      ].map(f => (
        <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <label style={{ fontSize: 13, color: '#8B7355', minWidth: 180, flexShrink: 0 }}>{f.label}</label>
          <input value={f.value} onChange={e => f.setter(e.target.value)} placeholder={f.placeholder} type="number"
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
        </div>
      ))}

      {hppNum > 0 && (
        <div style={{ background: '#FAF7F4', borderRadius: 12, padding: 16, marginTop: 12 }}>
          {[
            { label: 'Harga Minimum', value: formatRp(minPrice), color: '#1D9E75' },
            ...(priceNum > 0 ? [
              { label: 'Food Cost Aktual', value: actualFC.toFixed(1) + '%', color: isGood ? '#1D9E75' : '#E24B4A' },
              { label: 'Profit per Porsi', value: formatRp(priceNum - hppNum), color: '#C8873A' },
              { label: 'Status', value: isGood ? '✅ Harga Bagus' : '⚠️ Food Cost Terlalu Tinggi', color: isGood ? '#1D9E75' : '#E24B4A' },
            ] : []),
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <span style={{ color: '#8B7355' }}>{r.label}</span>
              <span style={{ fontWeight: 700, color: r.color }}>{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
