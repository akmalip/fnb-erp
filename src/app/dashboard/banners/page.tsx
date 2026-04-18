'use client'

import { useEffect, useState } from 'react'
import { getAllBannersByOutlet, upsertBanner, deleteBanner } from '@/lib/supabase/queries'
import type { OutletBanner } from '@/types'

const TYPES = [
  { value: 'promo',        label: '💸 Promo / Discount' },
  { value: 'event',        label: '🎉 Event' },
  { value: 'info',         label: 'ℹ️ Info' },
  { value: 'announcement', label: '📢 Announcement' },
]
const COLORS = [
  '#C8873A','#2C4A7C','#2C1810','#1D9E75','#D85A30','#3B6D11','#533AB7','#993556'
]
const EMOJIS = ['🎉','💸','☕','🍔','🎶','🔥','⭐','🎁','🛍','🏆','✨','🎊','🥂','🌿','❤️','🎵']

export default function BannersPage() {
  const [banners, setBanners] = useState<OutletBanner[]>([])
  const [outletId, setOutletId] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Partial<OutletBanner> | null>(null)

  useEffect(() => {
    const id = localStorage.getItem('fnb_outlet_id')
    if (!id) return
    setOutletId(id)
    getAllBannersByOutlet(id).then(d => { setBanners(d); setLoading(false) })
  }, [])

  const load = (id: string) => getAllBannersByOutlet(id).then(setBanners)

  const openNew = () => {
    setEditing({ bg_color: '#C8873A', text_color: '#FFFFFF', icon_emoji: '', banner_type: 'promo', is_active: true, sort_order: banners.length })
    setShowForm(true)
  }

  const save = async () => {
    if (!editing?.title) return
    setSaving(true)
    await upsertBanner({ ...editing, outlet_id: outletId } as any)
    await load(outletId)
    setSaving(false); setShowForm(false); setEditing(null)
  }

  const del = async (id: string) => {
    if (!confirm('Delete this banner?')) return
    await deleteBanner(id); setBanners(p => p.filter(b => b.id !== id))
  }

  const toggle = async (b: OutletBanner) => {
    await upsertBanner({ ...b, is_active: !b.is_active })
    setBanners(p => p.map(x => x.id === b.id ? { ...x, is_active: !b.is_active } : x))
  }

  if (loading) return <div style={{ padding: 40, color: '#8B7355', textAlign: 'center' }}>Loading banners...</div>

  return (
    <div>
      <div className="ph">
        <div>
          <h1 className="title">Banners & Promos</h1>
          <p className="sub">Banners appear on the customer order page. Use them for promos, events, or announcements.</p>
        </div>
        <button className="btn-add" onClick={openNew}>+ Add Banner</button>
      </div>

      {banners.length === 0 && (
        <div className="empty"><div style={{ fontSize:40, marginBottom:12 }}>🖼</div>No banners yet. Add your first promo!</div>
      )}

      <div className="grid">
        {banners.map(b => (
          <div key={b.id} className={`bcard ${!b.is_active ? 'off' : ''}`}>
            <div className="bprev" style={{ background: b.bg_color }}>
              {b.icon_emoji && <span className="bicon">{b.icon_emoji}</span>}
              <div>
                <div className="btitle" style={{ color: b.text_color }}>{b.title}</div>
                {b.description && <div className="bdesc" style={{ color: b.text_color }}>{b.description}</div>}
              </div>
            </div>
            <div className="bmeta">
              <div>
                <span className="btype">{TYPES.find(t => t.value === b.banner_type)?.label ?? b.banner_type}</span>
                {!b.is_active && <span className="off-tag"> · Inactive</span>}
              </div>
              <div className="bact">
                <button className="ab toggle" onClick={() => toggle(b)}>{b.is_active ? 'Deactivate' : 'Activate'}</button>
                <button className="ab edit" onClick={() => { setEditing(b); setShowForm(true) }}>Edit</button>
                <button className="ab del" onClick={() => del(b.id)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && editing && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal">
            <div className="mh">
              <h3>{editing.id ? 'Edit Banner' : 'New Banner'}</h3>
              <button className="mclose" onClick={() => setShowForm(false)}>✕</button>
            </div>

            {/* Live preview */}
            <div className="lprev" style={{ background: editing.bg_color ?? '#C8873A' }}>
              {editing.icon_emoji && <span style={{ fontSize:28 }}>{editing.icon_emoji}</span>}
              <div>
                <div style={{ color: editing.text_color ?? '#fff', fontWeight: 700, fontSize: 14 }}>{editing.title || 'Banner Title'}</div>
                <div style={{ color: editing.text_color ?? '#fff', fontSize: 12, opacity: 0.8 }}>{editing.description || 'Short description'}</div>
              </div>
            </div>

            <div className="fg">
              <label className="fl">Type</label>
              <div className="tgrid">
                {TYPES.map(t => (
                  <button key={t.value} className={`tb ${editing.banner_type === t.value ? 'sel' : ''}`}
                    onClick={() => setEditing(p => ({ ...p, banner_type: t.value as any }))}>{t.label}</button>
                ))}
              </div>
            </div>
            <div className="fg">
              <label className="fl">Title *</label>
              <input className="fi" type="text" placeholder="e.g. Happy Hour 2–4 PM"
                value={editing.title ?? ''} onChange={e => setEditing(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="fg">
              <label className="fl">Description <span className="opt">(optional)</span></label>
              <input className="fi" type="text" placeholder="e.g. 20% off all cold drinks"
                value={editing.description ?? ''} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="frow">
              <div className="fg">
                <label className="fl">Background Color</label>
                <div className="cgrid">{COLORS.map(c => (
                  <button key={c} className={`cswatch ${editing.bg_color === c ? 'sel' : ''}`}
                    style={{ background: c }} onClick={() => setEditing(p => ({ ...p, bg_color: c }))} />
                ))}</div>
                <input type="color" className="cpick" value={editing.bg_color ?? '#C8873A'}
                  onChange={e => setEditing(p => ({ ...p, bg_color: e.target.value }))} />
              </div>
              <div className="fg">
                <label className="fl">Icon</label>
                <div className="egrid">{EMOJIS.map(em => (
                  <button key={em} className={`eb ${editing.icon_emoji === em ? 'sel' : ''}`}
                    onClick={() => setEditing(p => ({ ...p, icon_emoji: em }))}>{em}</button>
                ))}</div>
              </div>
            </div>
            <button className="btn-save" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Banner'}</button>
          </div>
        </div>
      )}

      <style jsx>{`
        .ph { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:24px; gap:12px; }
        .title { font-size:22px; font-weight:800; }
        .sub { font-size:13px; color:#8B7355; margin-top:4px; max-width:400px; line-height:1.5; }
        .btn-add { padding:10px 16px; background:#2C1810; color:white; border:none; border-radius:10px; font-size:14px; font-weight:700; cursor:pointer; flex-shrink:0; }
        .empty { background:white; border-radius:14px; padding:48px; text-align:center; color:#8B7355; font-size:14px; }
        .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:14px; }
        .bcard { background:white; border-radius:14px; overflow:hidden; border:1px solid rgba(0,0,0,0.07); }
        .bcard.off { opacity:0.55; }
        .bprev { padding:16px; display:flex; align-items:center; gap:12px; min-height:80px; }
        .bicon { font-size:28px; flex-shrink:0; }
        .btitle { font-size:13px; font-weight:700; line-height:1.3; }
        .bdesc { font-size:11px; opacity:0.8; margin-top:2px; }
        .bmeta { padding:12px 14px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; }
        .btype { font-size:11px; color:#8B7355; }
        .off-tag { font-size:11px; color:#E24B4A; }
        .bact { display:flex; gap:6px; }
        .ab { padding:5px 10px; border-radius:7px; border:1px solid transparent; font-size:12px; font-weight:600; cursor:pointer; }
        .ab.toggle { background:#EAF3DE; color:#3B6D11; border-color:#C0DD97; }
        .ab.edit { background:#E6F1FB; color:#185FA5; border-color:#B5D4F4; }
        .ab.del { background:#FCEBEB; color:#A32D2D; border-color:#F7C1C1; }
        .modal-bg { position:fixed; inset:0; background:rgba(0,0,0,0.45); z-index:100; display:flex; align-items:center; justify-content:center; padding:20px; }
        .modal { background:white; border-radius:16px; width:100%; max-width:520px; padding:24px; max-height:90vh; overflow-y:auto; }
        .mh { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
        .mh h3 { font-size:18px; font-weight:800; }
        .mclose { background:none; border:none; font-size:18px; cursor:pointer; color:#8B7355; }
        .lprev { border-radius:12px; padding:16px; display:flex; align-items:center; gap:12px; margin-bottom:20px; min-height:72px; }
        .fg { margin-bottom:16px; }
        .fl { display:block; font-size:11px; font-weight:700; color:#8B7355; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:8px; }
        .opt { text-transform:none; font-weight:400; }
        .fi { width:100%; padding:10px 12px; border-radius:10px; border:1.5px solid rgba(0,0,0,0.1); font-size:14px; font-family:inherit; outline:none; }
        .fi:focus { border-color:#C8873A; }
        .frow { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        .tgrid { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
        .tb { padding:8px; border-radius:8px; border:1.5px solid rgba(0,0,0,0.1); font-size:12px; font-weight:600; cursor:pointer; background:white; }
        .tb.sel { border-color:#C8873A; background:#FDF4E9; }
        .cgrid { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px; }
        .cswatch { width:28px; height:28px; border-radius:7px; border:2.5px solid transparent; cursor:pointer; }
        .cswatch.sel { border-color:#1A0F0A; transform:scale(1.15); }
        .cpick { width:100%; height:32px; border-radius:8px; border:1px solid rgba(0,0,0,0.1); cursor:pointer; }
        .egrid { display:grid; grid-template-columns:repeat(8,1fr); gap:4px; }
        .eb { padding:4px; border:1.5px solid transparent; border-radius:7px; font-size:16px; cursor:pointer; background:transparent; }
        .eb.sel { border-color:#C8873A; background:#FDF4E9; }
        .btn-save { width:100%; padding:13px; border-radius:12px; background:#2C1810; color:white; border:none; font-size:15px; font-weight:700; font-family:inherit; cursor:pointer; margin-top:8px; }
        .btn-save:disabled { opacity:0.6; }
      `}</style>
    </div>
  )
}
