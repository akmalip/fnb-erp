'use client'

import { useEffect, useState } from 'react'
import { getMenuByOutlet, upsertMenuItem, deleteMenuItem, toggleMenuItemAvailability, upsertCategory, deleteCategory } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/client'
import type { MenuItem, MenuCategory } from '@/types'

function formatRp(n: number) { return 'Rp ' + n.toLocaleString('id-ID') }

const EMOJIS = ['☕','🍵','🧃','🍺','🥤','🍽️','🍞','🍳','🥗','🍜','🍕','🍪','🧁','🍰','🎂','🥐','🧇','🫖']

export default function MenuPage() {
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [outletId, setOutletId] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'items' | 'categories'>('items')
  const [showItemForm, setShowItemForm] = useState(false)
  const [showCatForm, setShowCatForm] = useState(false)
  const [editingItem, setEditingItem] = useState<Partial<MenuItem> | null>(null)
  const [editingCat, setEditingCat] = useState<Partial<MenuCategory> | null>(null)
  const [saving, setSaving] = useState(false)
  const [filterCat, setFilterCat] = useState('all')
  const [uploadingImg, setUploadingImg] = useState(false)

  useEffect(() => {
    const id = localStorage.getItem('fnb_outlet_id')
    if (!id) return
    setOutletId(id)
    loadMenu(id)
  }, [])

  const loadMenu = async (id: string) => {
    const menu = await getMenuByOutlet(id)
    setCategories(menu.categories)
    setItems(menu.items)
    setLoading(false)
  }

  const handleSaveItem = async () => {
    if (!editingItem?.name || !editingItem?.price) return
    setSaving(true)
    await upsertMenuItem({ ...editingItem, outlet_id: outletId } as any)
    await loadMenu(outletId)
    setSaving(false)
    setShowItemForm(false)
    setEditingItem(null)
  }

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Hapus menu ini?')) return
    await deleteMenuItem(id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const handleToggleAvail = async (id: string, current: boolean) => {
    await toggleMenuItemAvailability(id, !current)
    setItems(prev => prev.map(i => i.id === id ? { ...i, is_available: !current } : i))
  }

  const handleSaveCat = async () => {
    if (!editingCat?.name) return
    setSaving(true)
    await upsertCategory({ ...editingCat, outlet_id: outletId } as any)
    await loadMenu(outletId)
    setSaving(false)
    setShowCatForm(false)
    setEditingCat(null)
  }

  const handleDeleteCat = async (id: string) => {
    if (!confirm('Hapus kategori ini? Menu di dalamnya tidak ikut terhapus.')) return
    await deleteCategory(id)
    setCategories(prev => prev.filter(c => c.id !== id))
  }

  const handleImageUpload = async (file: File) => {
    setUploadingImg(true)
    const sb = createClient()
    const ext = file.name.split('.').pop()
    const path = `menu-images/${Date.now()}.${ext}`
    const { error } = await sb.storage.from('menu-images').upload(path, file)
    if (!error) {
      const { data } = sb.storage.from('menu-images').getPublicUrl(path)
      setEditingItem(prev => ({ ...prev, image_url: data.publicUrl }))
    }
    setUploadingImg(false)
  }

  const filteredItems = filterCat === 'all' ? items : items.filter(i => i.category_id === filterCat)

  if (loading) return <div style={{ padding: 40, color: '#8B7355', textAlign: 'center' }}>Memuat menu...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Kelola Menu</h1>
          <p className="page-sub">{items.length} item · {categories.length} kategori</p>
        </div>
        <button className="add-btn-primary" onClick={() => { setEditingItem({ is_available: true, is_featured: false, price: 0 }); setShowItemForm(true) }}>
          + Tambah Menu
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'items' ? 'active' : ''}`} onClick={() => setActiveTab('items')}>Menu Items</button>
        <button className={`tab ${activeTab === 'categories' ? 'active' : ''}`} onClick={() => setActiveTab('categories')}>Kategori</button>
      </div>

      {/* ITEMS TAB */}
      {activeTab === 'items' && (
        <div>
          {/* Category filter */}
          <div className="cat-filter">
            <button className={`cat-chip ${filterCat === 'all' ? 'active' : ''}`} onClick={() => setFilterCat('all')}>Semua</button>
            {categories.map(c => (
              <button key={c.id} className={`cat-chip ${filterCat === c.id ? 'active' : ''}`} onClick={() => setFilterCat(c.id)}>
                {c.emoji} {c.name}
              </button>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="empty-state">Belum ada menu. Tambah menu pertamamu!</div>
          )}

          <div className="items-grid">
            {filteredItems.map(item => (
              <div key={item.id} className={`item-card ${!item.is_available ? 'unavail' : ''}`}>
                <div className="item-card-img">
                  {item.image_url
                    ? <img src={item.image_url} alt={item.name} />
                    : <div className="img-placeholder">📷</div>
                  }
                  <div className={`avail-dot ${item.is_available ? 'on' : 'off'}`} title={item.is_available ? 'Tersedia' : 'Habis'} />
                </div>
                <div className="item-card-body">
                  <div className="item-name">{item.name}</div>
                  <div className="item-cat">{categories.find(c => c.id === item.category_id)?.name ?? '–'}</div>
                  <div className="item-price">{formatRp(item.price)}</div>
                  <div className="item-actions">
                    <button className="action-btn edit" onClick={() => { setEditingItem(item); setShowItemForm(true) }}>Edit</button>
                    <button className="action-btn avail" onClick={() => handleToggleAvail(item.id, item.is_available)}>
                      {item.is_available ? 'Set Habis' : 'Set Tersedia'}
                    </button>
                    <button className="action-btn del" onClick={() => handleDeleteItem(item.id)}>Hapus</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CATEGORIES TAB */}
      {activeTab === 'categories' && (
        <div>
          <button className="add-btn-secondary" onClick={() => { setEditingCat({ emoji: '☕', sort_order: 0 }); setShowCatForm(true) }}>
            + Tambah Kategori
          </button>
          <div className="cat-list">
            {categories.map(cat => (
              <div key={cat.id} className="cat-row">
                <div className="cat-row-left">
                  <div className="cat-emoji">{cat.emoji}</div>
                  <div>
                    <div className="cat-name">{cat.name}</div>
                    <div className="cat-count">{items.filter(i => i.category_id === cat.id).length} item</div>
                  </div>
                </div>
                <div className="cat-row-actions">
                  <button className="action-btn edit" onClick={() => { setEditingCat(cat); setShowCatForm(true) }}>Edit</button>
                  <button className="action-btn del" onClick={() => handleDeleteCat(cat.id)}>Hapus</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ITEM FORM MODAL */}
      {showItemForm && editingItem && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowItemForm(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editingItem.id ? 'Edit Menu' : 'Tambah Menu Baru'}</h3>
              <button className="modal-close" onClick={() => setShowItemForm(false)}>✕</button>
            </div>

            {/* Image upload */}
            <label className="img-upload-area">
              {editingItem.image_url
                ? <img src={editingItem.image_url} alt="preview" className="img-preview" />
                : <div className="img-upload-placeholder">{uploadingImg ? 'Mengupload...' : '📷 Upload Foto Menu'}</div>
              }
              <input type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f) }} />
            </label>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nama Menu *</label>
                <input className="form-input" type="text" placeholder="cth: Americano Classico"
                  value={editingItem.name ?? ''} onChange={e => setEditingItem(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Harga (Rp) *</label>
                <input className="form-input" type="number" placeholder="28000"
                  value={editingItem.price ?? ''} onChange={e => setEditingItem(p => ({ ...p, price: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Kategori</label>
              <select className="form-input" value={editingItem.category_id ?? ''}
                onChange={e => setEditingItem(p => ({ ...p, category_id: e.target.value || undefined }))}>
                <option value="">-- Tanpa Kategori --</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Deskripsi Singkat</label>
              <textarea className="form-input" rows={2} placeholder="Tulis deskripsi singkat menu ini..."
                value={editingItem.description ?? ''} onChange={e => setEditingItem(p => ({ ...p, description: e.target.value }))} />
            </div>

            <div className="form-row">
              <label className="toggle-row">
                <input type="checkbox" checked={editingItem.is_available ?? true}
                  onChange={e => setEditingItem(p => ({ ...p, is_available: e.target.checked }))} />
                <span>Tersedia</span>
              </label>
              <label className="toggle-row">
                <input type="checkbox" checked={editingItem.is_featured ?? false}
                  onChange={e => setEditingItem(p => ({ ...p, is_featured: e.target.checked }))} />
                <span>Tampilkan sebagai Unggulan</span>
              </label>
            </div>

            <button className="primary-btn" onClick={handleSaveItem} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Menu'}
            </button>
          </div>
        </div>
      )}

      {/* CATEGORY FORM MODAL */}
      {showCatForm && editingCat && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCatForm(false)}>
          <div className="modal" style={{ maxWidth: 360 }}>
            <div className="modal-header">
              <h3>{editingCat.id ? 'Edit Kategori' : 'Tambah Kategori'}</h3>
              <button className="modal-close" onClick={() => setShowCatForm(false)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Nama Kategori *</label>
              <input className="form-input" type="text" placeholder="cth: Kopi Panas"
                value={editingCat.name ?? ''} onChange={e => setEditingCat(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Emoji / Icon</label>
              <div className="emoji-grid">
                {EMOJIS.map(em => (
                  <button key={em} className={`emoji-btn ${editingCat.emoji === em ? 'selected' : ''}`}
                    onClick={() => setEditingCat(p => ({ ...p, emoji: em }))}>{em}</button>
                ))}
              </div>
            </div>
            <button className="primary-btn" onClick={handleSaveCat} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Kategori'}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
        .page-title { font-size: 22px; font-weight: 800; }
        .page-sub { font-size: 13px; color: #8B7355; margin-top: 2px; }
        .add-btn-primary {
          padding: 10px 16px; background: #2C1810; color: white; border: none; border-radius: 10px;
          font-size: 14px; font-weight: 700; cursor: pointer; white-space: nowrap; flex-shrink: 0;
        }
        .add-btn-secondary {
          padding: 8px 14px; background: white; color: #2C1810; border: 1.5px solid rgba(0,0,0,0.12);
          border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; margin-bottom: 16px;
        }
        .tabs { display: flex; gap: 4px; background: white; border-radius: 12px; padding: 4px; margin-bottom: 20px; border: 1px solid rgba(0,0,0,0.07); }
        .tab { flex: 1; padding: 8px; border: none; background: transparent; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; color: #8B7355; }
        .tab.active { background: #2C1810; color: white; }
        .cat-filter { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 12px; scrollbar-width: none; margin-bottom: 16px; }
        .cat-filter::-webkit-scrollbar { display: none; }
        .cat-chip { flex-shrink: 0; padding: 6px 14px; border-radius: 20px; border: 1.5px solid rgba(0,0,0,0.1); font-size: 13px; font-weight: 500; color: #8B7355; background: white; cursor: pointer; white-space: nowrap; }
        .cat-chip.active { background: #2C1810; color: white; border-color: #2C1810; }
        .empty-state { text-align: center; color: #8B7355; padding: 40px; background: white; border-radius: 14px; }
        .items-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
        .item-card { background: white; border-radius: 14px; overflow: hidden; border: 1px solid rgba(0,0,0,0.07); }
        .item-card.unavail { opacity: 0.55; }
        .item-card-img { height: 120px; position: relative; background: #F4F1ED; }
        .item-card-img img { width: 100%; height: 100%; object-fit: cover; }
        .img-placeholder { display: flex; align-items: center; justify-content: center; height: 100%; font-size: 32px; color: #8B7355; }
        .avail-dot { position: absolute; top: 8px; right: 8px; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white; }
        .avail-dot.on { background: #1D9E75; }
        .avail-dot.off { background: #E24B4A; }
        .item-card-body { padding: 12px; }
        .item-name { font-size: 14px; font-weight: 700; margin-bottom: 2px; }
        .item-cat { font-size: 11px; color: #8B7355; margin-bottom: 4px; }
        .item-price { font-size: 15px; font-weight: 800; color: #C8873A; margin-bottom: 10px; }
        .item-actions { display: flex; gap: 4px; flex-wrap: wrap; }
        .action-btn { padding: 4px 8px; border-radius: 6px; border: 1px solid transparent; font-size: 11px; font-weight: 600; cursor: pointer; }
        .action-btn.edit { background: #E6F1FB; color: #185FA5; border-color: #B5D4F4; }
        .action-btn.avail { background: #EAF3DE; color: #3B6D11; border-color: #C0DD97; }
        .action-btn.del { background: #FCEBEB; color: #A32D2D; border-color: #F7C1C1; }
        .cat-list { display: flex; flex-direction: column; gap: 10px; }
        .cat-row { background: white; border-radius: 12px; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; border: 1px solid rgba(0,0,0,0.07); }
        .cat-row-left { display: flex; align-items: center; gap: 12px; }
        .cat-emoji { font-size: 28px; }
        .cat-name { font-size: 15px; font-weight: 700; }
        .cat-count { font-size: 12px; color: #8B7355; }
        .cat-row-actions { display: flex; gap: 8px; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .modal { background: white; border-radius: 16px; width: 100%; max-width: 520px; padding: 24px; max-height: 90vh; overflow-y: auto; }
        .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .modal-header h3 { font-size: 18px; font-weight: 800; }
        .modal-close { background: none; border: none; font-size: 18px; cursor: pointer; color: #8B7355; }
        .img-upload-area { display: block; height: 160px; border-radius: 12px; border: 2px dashed rgba(0,0,0,0.12); overflow: hidden; cursor: pointer; margin-bottom: 16px; }
        .img-preview { width: 100%; height: 100%; object-fit: cover; }
        .img-upload-placeholder { display: flex; align-items: center; justify-content: center; height: 100%; font-size: 14px; font-weight: 600; color: #8B7355; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .form-group { margin-bottom: 14px; }
        .form-label { display: block; font-size: 11px; font-weight: 700; color: #8B7355; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
        .form-input { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1.5px solid rgba(0,0,0,0.1); font-size: 14px; font-family: inherit; outline: none; background: white; resize: none; }
        .form-input:focus { border-color: #C8873A; }
        .toggle-row { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .emoji-grid { display: grid; grid-template-columns: repeat(9, 1fr); gap: 4px; }
        .emoji-btn { padding: 6px; border: 1.5px solid transparent; border-radius: 8px; font-size: 18px; cursor: pointer; background: transparent; }
        .emoji-btn.selected { border-color: #C8873A; background: #FDF4E9; }
        .primary-btn { width: 100%; padding: 13px; border-radius: 12px; background: #2C1810; color: white; border: none; font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer; margin-top: 8px; }
        .primary-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>
    </div>
  )
}
