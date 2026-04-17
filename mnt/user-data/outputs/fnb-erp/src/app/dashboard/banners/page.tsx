'use client'

import { useEffect, useState } from 'react'
import { getAllBannersByOutlet, upsertBanner, deleteBanner } from '@/lib/supabase/queries'
import type { OutletBanner } from '@/types'

const BANNER_TYPES = [
  { value: 'promo', label: '💸 Promo / Diskon' },
  { value: 'event', label: '🎉 Event / Acara' },
  { value: 'info', label: 'ℹ Info Penting' },
  { value: 'announcement', label: '📢 Pengumuman' },
]

const PRESET_COLORS = [
  { bg: '#C8873A', label: 'Coklat Gold' },
  { bg: '#2C4A7C', label: 'Navy Blue' },
  { bg: '#2C1810', label: 'Dark Brown' },
  { bg: '#1D9E75', label: 'Teal' },
  { bg: '#D85A30', label: 'Coral' },
  { bg: '#3B6D11', label: 'Forest' },
  { bg: '#533AB7', label: 'Purple' },
  { bg: '#993556', label: 'Rose' },
]

const EMOJIS = ['🎉','💸','☕','🍔','🎶','🔥','⭐','🎁','🛍','🏆','✨','🎊','🥂','🌿','❤️','🎵']

export default function BannersPage() {
  const [banners, setBanners] = useState<OutletBanner[]>([])
  const [outletId, setOutletId] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingBanner, setEditingBanner] = useState<Partial<OutletBanner> | null>(null)

  useEffect(() => {
    const id = localStorage.getItem('fnb_outlet_id')
    if (!id) return
    setOutletId(id)
    loadBanners(id)
  }, [])

  const loadBanners = async (id: string) => {
    const data = await getAllBannersByOutlet(id)
    setBanners(data)
    setLoading(false)
  }

  const openNew = () => {
    setEditingBanner({
      bg_color: '#C8873A', text_color: '#FFFFFF',
      icon_emoji: '🎉', banner_type: 'promo', is_active: true, sort_order: banners.length
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!editingBanner?.title) return
    setSaving(true)
    await upsertBanner({ ...editingBanner, outlet_id: outletId } as any)
    await loadBanners(outletId)
    setSaving(false)
    setShowForm(false)
    setEditingBanner(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus banner ini?')) return
    await deleteBanner(id)
    setBanners(prev => prev.filter(b => b.id !== id))
  }

  const handleToggle = async (banner: OutletBanner) => {
    await upsertBanner({ ...banner, is_active: !banner.is_active })
    setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, is_active: !b.is_active } : b))
  }

  if (loading) return <div style={{ padding: 40, color: '#8B7355', textAlign: 'center' }}>Memuat banner...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Banner & Promo</h1>
          <p className="page-sub">Banner tampil di halaman order customer. Bisa untuk promo, event, atau info penting.</p>
        </div>
        <button className="add-btn" onClick={openNew}>+ Tambah Banner</button>
      </div>

      {banners.length === 0 && (
        <div className="empty-state">
          <div style={{ fontSize: 40, marginBottom: 12 }}>🖼</div>
          <div>Belum ada banner. Tambah banner promo atau event pertamamu!</div>
        </div>
      )}

      <div className="banners-grid">
        {banners.map(banner => (
          <div key={banner.id} className={`banner-card-admin ${!banner.is_active ? 'inactive' : ''}`}>
            {/* Preview */}
            <div className="banner-preview" style={{ background: banner.bg_color }}>
              <div className="preview-icon">{banner.icon_emoji}</div>
              <div className="preview-content">
                <div className="preview-title" style={{ color: banner.text_color }}>{banner.title}</div>
                {banner.description && <div className="preview-desc" style={{ color: banner.text_color }}>{banner.description}</div>}
              </div>
            </div>
            {/* Actions */}
            <div className="banner-meta">
              <div>
                <div className="banner-type-badge">{BANNER_TYPES.find(t => t.value === banner.banner_type)?.label ?? banner.banner_type}</div>
                {!banner.is_active && <span className="inactive-badge">Nonaktif</span>}
              </div>
              <div className="banner-actions">
                <button className="action-btn toggle" onClick={() => handleToggle(banner)}>
                  {banner.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
                <button className="action-btn edit" onClick={() => { setEditingBanner(banner); setShowForm(true) }}>Edit</button>
                <button className="action-btn del" onClick={() => handleDelete(banner.id)}>Hapus</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* BANNER FORM MODAL */}
      {showForm && editingBanner && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editingBanner.id ? 'Edit Banner' : 'Tambah Banner Baru'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>

            {/* Live preview */}
            <div className="live-preview" style={{ background: editingBanner.bg_color ?? '#C8873A' }}>
              <div className="preview-icon">{editingBanner.icon_emoji ?? '🎉'}</div>
              <div className="preview-content">
                <div className="preview-title" style={{ color: editingBanner.text_color ?? '#fff' }}>
                  {editingBanner.title || 'Judul Banner'}
                </div>
                <div className="preview-desc" style={{ color: editingBanner.text_color ?? '#fff' }}>
                  {editingBanner.description || 'Deskripsi singkat di sini'}
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Tipe Banner</label>
              <div className="type-grid">
                {BANNER_TYPES.map(t => (
                  <button key={t.value} className={`type-btn ${editingBanner.banner_type === t.value ? 'selected' : ''}`}
                    onClick={() => setEditingBanner(p => ({ ...p, banner_type: t.value as any }))}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Judul Banner *</label>
              <input className="form-input" type="text" placeholder="cth: Happy Hour 14.00–16.00"
                value={editingBanner.title ?? ''} onChange={e => setEditingBanner(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Deskripsi <span className="optional">(opsional)</span></label>
              <input className="form-input" type="text" placeholder="cth: Diskon 20% semua minuman"
                value={editingBanner.description ?? ''} onChange={e => setEditingBanner(p => ({ ...p, description: e.target.value }))} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Warna Background</label>
                <div className="color-grid">
                  {PRESET_COLORS.map(c => (
                    <button key={c.bg} className={`color-btn ${editingBanner.bg_color === c.bg ? 'selected' : ''}`}
                      style={{ background: c.bg }} title={c.label}
                      onClick={() => setEditingBanner(p => ({ ...p, bg_color: c.bg }))} />
                  ))}
                </div>
                <input type="color" className="color-input" value={editingBanner.bg_color ?? '#C8873A'}
                  onChange={e => setEditingBanner(p => ({ ...p, bg_color: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Icon / Emoji</label>
                <div className="emoji-grid">
                  {EMOJIS.map(em => (
                    <button key={em} className={`emoji-btn ${editingBanner.icon_emoji === em ? 'selected' : ''}`}
                      onClick={() => setEditingBanner(p => ({ ...p, icon_emoji: em }))}>{em}</button>
                  ))}
                </div>
              </div>
            </div>

            <button className="primary-btn" onClick={handleSave} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Banner'}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 12px; }
        .page-title { font-size: 22px; font-weight: 800; }
        .page-sub { font-size: 13px; color: #8B7355; margin-top: 4px; max-width: 400px; line-height: 1.5; }
        .add-btn { padding: 10px 16px; background: #2C1810; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; flex-shrink: 0; }
        .empty-state { background: white; border-radius: 14px; padding: 48px; text-align: center; color: #8B7355; font-size: 14px; }
        .banners-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
        .banner-card-admin { background: white; border-radius: 14px; overflow: hidden; border: 1px solid rgba(0,0,0,0.07); }
        .banner-card-admin.inactive { opacity: 0.55; }
        .banner-preview { padding: 16px; display: flex; align-items: center; gap: 12px; min-height: 80px; }
        .preview-icon { font-size: 28px; flex-shrink: 0; }
        .preview-title { font-size: 13px; font-weight: 700; line-height: 1.3; }
        .preview-desc { font-size: 11px; opacity: 0.8; margin-top: 2px; }
        .banner-meta { padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
        .banner-type-badge { font-size: 11px; color: #8B7355; }
        .inactive-badge { font-size: 11px; color: #E24B4A; margin-left: 6px; }
        .banner-actions { display: flex; gap: 6px; }
        .action-btn { padding: 5px 10px; border-radius: 7px; border: 1px solid transparent; font-size: 12px; font-weight: 600; cursor: pointer; }
        .action-btn.toggle { background: #EAF3DE; color: #3B6D11; border-color: #C0DD97; }
        .action-btn.edit { background: #E6F1FB; color: #185FA5; border-color: #B5D4F4; }
        .action-btn.del { background: #FCEBEB; color: #A32D2D; border-color: #F7C1C1; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .modal { background: white; border-radius: 16px; width: 100%; max-width: 520px; padding: 24px; max-height: 90vh; overflow-y: auto; }
        .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .modal-header h3 { font-size: 18px; font-weight: 800; }
        .modal-close { background: none; border: none; font-size: 18px; cursor: pointer; color: #8B7355; }
        .live-preview { border-radius: 12px; padding: 16px; display: flex; align-items: center; gap: 12px; margin-bottom: 20px; min-height: 80px; }
        .form-group { margin-bottom: 16px; }
        .form-label { display: block; font-size: 11px; font-weight: 700; color: #8B7355; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
        .optional { text-transform: none; font-weight: 400; }
        .form-input { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1.5px solid rgba(0,0,0,0.1); font-size: 14px; font-family: inherit; outline: none; }
        .form-input:focus { border-color: #C8873A; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .type-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .type-btn { padding: 8px; border-radius: 8px; border: 1.5px solid rgba(0,0,0,0.1); font-size: 12px; font-weight: 600; cursor: pointer; background: white; color: #1A0F0A; }
        .type-btn.selected { border-color: #C8873A; background: #FDF4E9; }
        .color-grid { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
        .color-btn { width: 28px; height: 28px; border-radius: 7px; border: 2.5px solid transparent; cursor: pointer; }
        .color-btn.selected { border-color: #1A0F0A; transform: scale(1.15); }
        .color-input { width: 100%; height: 32px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.1); cursor: pointer; }
        .emoji-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; }
        .emoji-btn { padding: 4px; border: 1.5px solid transparent; border-radius: 7px; font-size: 16px; cursor: pointer; background: transparent; }
        .emoji-btn.selected { border-color: #C8873A; background: #FDF4E9; }
        .primary-btn { width: 100%; padding: 13px; border-radius: 12px; background: #2C1810; color: white; border: none; font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer; margin-top: 8px; }
        .primary-btn:disabled { opacity: 0.6; }
      `}</style>
    </div>
  )
}
