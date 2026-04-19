'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Promo {
  id: string
  name: string
  type: 'percentage' | 'fixed' | 'bogo' | 'happy_hour'
  value: number
  minOrder: number
  startHour?: number
  endHour?: number
  days: number[] // 0=Sun, 1=Mon, ..., 6=Sat
  isActive: boolean
  menuIds: string[] // empty = all menu
  code?: string // optional promo code
  createdAt: string
}

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const TYPE_LABELS = {
  percentage: '% Diskon',
  fixed: 'Diskon Rp',
  bogo: 'Buy 1 Get 1',
  happy_hour: 'Happy Hour'
}

function formatRp(n: number) { return 'Rp ' + Math.round(n).toLocaleString('id-ID') }

export default function PromoPage() {
  const [promos, setPromos] = useState<Promo[]>([])
  const [menuItems, setMenuItems] = useState<any[]>([])
  const [outletId, setOutletId] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editPromo, setEditPromo] = useState<Partial<Promo>>({
    name: '', type: 'percentage', value: 10, minOrder: 0,
    days: [0,1,2,3,4,5,6], isActive: true, menuIds: [], code: ''
  })
  const [toast, setToast] = useState('')
  const sb = createClient()

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    const id = localStorage.getItem('fnb_outlet_id') || ''
    setOutletId(id)
    // Load promos from localStorage for now (no DB table yet)
    const saved = localStorage.getItem(`promos_${id}`)
    if (saved) setPromos(JSON.parse(saved))
    // Load menu for item-specific promos
    if (id) {
      sb.from('menu_items').select('id,name,price').eq('outlet_id', id)
        .then(({ data }) => setMenuItems(data || []))
    }
  }, [])

  const savePromos = (list: Promo[]) => {
    setPromos(list)
    localStorage.setItem(`promos_${outletId}`, JSON.stringify(list))
  }

  const savePromo = () => {
    if (!editPromo.name || !editPromo.type) return
    const promo: Promo = {
      id: (editPromo as any).id || Date.now().toString(),
      name: editPromo.name!,
      type: editPromo.type!,
      value: editPromo.value || 0,
      minOrder: editPromo.minOrder || 0,
      startHour: editPromo.startHour,
      endHour: editPromo.endHour,
      days: editPromo.days || [0,1,2,3,4,5,6],
      isActive: editPromo.isActive ?? true,
      menuIds: editPromo.menuIds || [],
      code: editPromo.code || '',
      createdAt: (editPromo as any).createdAt || new Date().toISOString()
    }
    const existing = promos.findIndex(p => p.id === promo.id)
    const updated = existing >= 0
      ? promos.map((p, i) => i === existing ? promo : p)
      : [...promos, promo]
    savePromos(updated)
    setShowModal(false)
    showToast('✅ Promo disimpan')
  }

  const togglePromo = (id: string) => {
    const updated = promos.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p)
    savePromos(updated)
  }

  const deletePromo = (id: string) => {
    if (!confirm('Hapus promo ini?')) return
    savePromos(promos.filter(p => p.id !== id))
    showToast('Promo dihapus')
  }

  // Check if promo is valid right now
  const isActiveNow = (promo: Promo) => {
    if (!promo.isActive) return false
    const now = new Date()
    const day = now.getDay()
    const hour = now.getHours()
    if (!promo.days.includes(day)) return false
    if (promo.type === 'happy_hour' && promo.startHour !== undefined && promo.endHour !== undefined) {
      if (hour < promo.startHour || hour >= promo.endHour) return false
    }
    return true
  }

  const getPromoDescription = (p: Promo) => {
    if (p.type === 'percentage') return `Diskon ${p.value}%${p.minOrder > 0 ? ` (min. order ${formatRp(p.minOrder)})` : ''}`
    if (p.type === 'fixed') return `Diskon ${formatRp(p.value)}${p.minOrder > 0 ? ` (min. order ${formatRp(p.minOrder)})` : ''}`
    if (p.type === 'bogo') return 'Buy 1 Get 1 Free'
    if (p.type === 'happy_hour') return `Happy Hour ${p.startHour}:00 - ${p.endHour}:00 · Diskon ${p.value}%`
    return ''
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Promo & Diskon Otomatis</h1>
          <p style={{ fontSize: 13, color: '#8B7355' }}>Promo aktif otomatis berlaku saat order pelanggan masuk sesuai kondisi</p>
        </div>
        <button onClick={() => { setEditPromo({ name: '', type: 'percentage', value: 10, minOrder: 0, days: [0,1,2,3,4,5,6], isActive: true, menuIds: [], code: '' }); setShowModal(true) }}
          style={{ padding: '9px 18px', borderRadius: 10, background: '#C8873A', border: 'none', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Buat Promo
        </button>
      </div>

      {/* Active now */}
      {promos.filter(isActiveNow).length > 0 && (
        <div style={{ background: '#D1FAE5', border: '1px solid #1D9E75', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 18 }}>🎉</span>
          <div style={{ fontSize: 13, color: '#065F46', fontWeight: 600 }}>
            {promos.filter(isActiveNow).length} promo aktif sekarang: {promos.filter(isActiveNow).map(p => p.name).join(', ')}
          </div>
        </div>
      )}

      {promos.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 14, padding: 60, textAlign: 'center', color: '#8B7355', border: '1px solid rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏷️</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Belum ada promo</div>
          <div style={{ fontSize: 13 }}>Buat promo pertama untuk menarik lebih banyak pelanggan</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {promos.map(p => (
            <div key={p.id} style={{ background: 'white', border: `1.5px solid ${isActiveNow(p) ? '#1D9E75' : 'rgba(0,0,0,0.08)'}`, borderRadius: 14, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 800, fontSize: 15 }}>{p.name}</span>
                    <span style={{ background: '#F0E8DF', color: '#C8873A', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                      {TYPE_LABELS[p.type]}
                    </span>
                    {isActiveNow(p) && <span style={{ background: '#D1FAE5', color: '#065F46', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>🟢 Aktif Sekarang</span>}
                  </div>
                  <div style={{ fontSize: 13, color: '#3A2A20', marginBottom: 6 }}>{getPromoDescription(p)}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                    {p.days.map(d => (
                      <span key={d} style={{ background: '#FAF7F4', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#8B7355' }}>{DAY_LABELS[d]}</span>
                    ))}
                    {p.code && <span style={{ background: '#EFF6FF', color: '#2C4A7C', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Kode: {p.code}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { setEditPromo({ ...p }); setShowModal(true) }}
                      style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(0,0,0,0.1)', background: 'white', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#8B7355' }}>Edit</button>
                    <button onClick={() => deletePromo(p.id)}
                      style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(224,82,82,0.2)', background: 'white', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#E24B4A' }}>Hapus</button>
                  </div>
                  {/* Toggle */}
                  <div onClick={() => togglePromo(p.id)} style={{ width: 44, height: 24, background: p.isActive ? '#1D9E75' : '#D1D5DB', borderRadius: 20, position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                    <div style={{ position: 'absolute', top: 2, left: p.isActive ? 22 : 2, width: 20, height: 20, background: 'white', borderRadius: '50%', transition: 'left 0.2s' }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Promo Modal */}
      {showModal && (
        <div onClick={e => e.target === e.currentTarget && setShowModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, margin: 'auto' }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 20 }}>
              {(editPromo as any).id ? 'Edit Promo' : 'Buat Promo Baru'}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase' as const, display: 'block', marginBottom: 5 }}>Nama Promo *</label>
              <input value={editPromo.name || ''} onChange={e => setEditPromo(p => ({ ...p, name: e.target.value }))} placeholder="cth: Promo Weekend, Happy Hour Sore"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase' as const, display: 'block', marginBottom: 5 }}>Tipe Promo</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {Object.entries(TYPE_LABELS).map(([key, label]) => (
                  <button key={key} onClick={() => setEditPromo(p => ({ ...p, type: key as any }))}
                    style={{ padding: '8px 12px', borderRadius: 9, border: '1.5px solid', borderColor: editPromo.type === key ? '#C8873A' : 'rgba(0,0,0,0.1)', background: editPromo.type === key ? '#FDF4E9' : 'white', color: editPromo.type === key ? '#C8873A' : '#8B7355', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {(editPromo.type === 'percentage' || editPromo.type === 'happy_hour') && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase' as const, display: 'block', marginBottom: 5 }}>Diskon (%)</label>
                  <input value={editPromo.value || ''} onChange={e => setEditPromo(p => ({ ...p, value: parseInt(e.target.value) || 0 }))} type="number" placeholder="10"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase' as const, display: 'block', marginBottom: 5 }}>Min. Order (Rp)</label>
                  <input value={editPromo.minOrder || ''} onChange={e => setEditPromo(p => ({ ...p, minOrder: parseInt(e.target.value) || 0 }))} type="number" placeholder="0"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
                </div>
              </div>
            )}

            {editPromo.type === 'fixed' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase' as const, display: 'block', marginBottom: 5 }}>Diskon (Rp)</label>
                  <input value={editPromo.value || ''} onChange={e => setEditPromo(p => ({ ...p, value: parseInt(e.target.value) || 0 }))} type="number" placeholder="10000"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase' as const, display: 'block', marginBottom: 5 }}>Min. Order (Rp)</label>
                  <input value={editPromo.minOrder || ''} onChange={e => setEditPromo(p => ({ ...p, minOrder: parseInt(e.target.value) || 0 }))} type="number" placeholder="50000"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
                </div>
              </div>
            )}

            {editPromo.type === 'happy_hour' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase' as const, display: 'block', marginBottom: 5 }}>Jam Mulai</label>
                  <input value={editPromo.startHour ?? ''} onChange={e => setEditPromo(p => ({ ...p, startHour: parseInt(e.target.value) }))} type="number" min="0" max="23" placeholder="14"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase' as const, display: 'block', marginBottom: 5 }}>Jam Selesai</label>
                  <input value={editPromo.endHour ?? ''} onChange={e => setEditPromo(p => ({ ...p, endHour: parseInt(e.target.value) }))} type="number" min="0" max="23" placeholder="17"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
                </div>
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase' as const, display: 'block', marginBottom: 8 }}>Berlaku Hari</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                {DAY_LABELS.map((day, i) => {
                  const active = editPromo.days?.includes(i)
                  return (
                    <button key={i} onClick={() => setEditPromo(p => ({ ...p, days: active ? (p.days || []).filter(d => d !== i) : [...(p.days || []), i] }))}
                      style={{ padding: '5px 12px', borderRadius: 20, border: '1.5px solid', borderColor: active ? '#C8873A' : 'rgba(0,0,0,0.1)', background: active ? '#C8873A' : 'white', color: active ? 'white' : '#8B7355', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {day}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase' as const, display: 'block', marginBottom: 5 }}>Kode Promo (opsional)</label>
              <input value={editPromo.code || ''} onChange={e => setEditPromo(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="cth: WEEKEND20"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
              <div style={{ fontSize: 11, color: '#8B7355', marginTop: 4 }}>Kosongkan jika promo otomatis tanpa kode</div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: 'white', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', color: '#8B7355', fontWeight: 600 }}>Batal</button>
              <button onClick={savePromo} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#C8873A', color: 'white', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', fontWeight: 700 }}>Simpan Promo</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#1D9E75', color: 'white', padding: '10px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14, zIndex: 999, whiteSpace: 'nowrap' as const }}>
          {toast}
        </div>
      )}
    </div>
  )
}
