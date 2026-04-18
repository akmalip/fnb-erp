'use client'

import { useEffect, useState } from 'react'
import { getMenuByOutlet, upsertMenuItem, deleteMenuItem, toggleMenuItemAvailability, upsertCategory, deleteCategory } from '../../../../lib/supabase/queries'
import { createClient } from '../../../../lib/supabase/client'
import type { MenuItem, MenuCategory } from '../../../../types'

function formatRp(n: number) { return 'Rp ' + n.toLocaleString('id-ID') }

const EMOJIS = ['☕','🍵','🧃','🍺','🥤','🍽️','🍞','🍳','🥗','🍜','🍕','🍪','🧁','🍰','🥐','🧇','🫖','🍔']

export default function MenuPage() {
  const [cats, setCats] = useState<MenuCategory[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [outletId, setOutletId] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'items' | 'categories'>('items')
  const [showItemForm, setShowItemForm] = useState(false)
  const [showCatForm, setShowCatForm] = useState(false)
  const [editItem, setEditItem] = useState<Partial<MenuItem> | null>(null)
  const [editCat, setEditCat] = useState<Partial<MenuCategory> | null>(null)
  const [saving, setSaving] = useState(false)
  const [catFilter, setCatFilter] = useState('all')
  const [imgUploading, setImgUploading] = useState(false)

  useEffect(() => {
    const id = localStorage.getItem('fnb_outlet_id')
    if (!id) return
    setOutletId(id)
    load(id)
  }, [])

  const load = async (id: string) => {
    const m = await getMenuByOutlet(id)
    setCats(m.categories); setItems(m.items); setLoading(false)
  }

  const saveItem = async () => {
    if (!editItem?.name || !editItem?.price) return
    setSaving(true)
    await upsertMenuItem({ ...editItem, outlet_id: outletId } as any)
    await load(outletId)
    setSaving(false); setShowItemForm(false); setEditItem(null)
  }

  const delItem = async (id: string) => {
    if (!confirm('Delete this menu item?')) return
    await deleteMenuItem(id); setItems(p => p.filter(i => i.id !== id))
  }

  const toggleAvail = async (id: string, cur: boolean) => {
    await toggleMenuItemAvailability(id, !cur)
    setItems(p => p.map(i => i.id === id ? { ...i, is_available: !cur } : i))
  }

  const saveCat = async () => {
    if (!editCat?.name) return
    setSaving(true)
    await upsertCategory({ ...editCat, outlet_id: outletId } as any)
    await load(outletId)
    setSaving(false); setShowCatForm(false); setEditCat(null)
  }

  const delCat = async (id: string) => {
    if (!confirm('Delete this category? Items inside will not be deleted.')) return
    await deleteCategory(id); setCats(p => p.filter(c => c.id !== id))
  }

  const uploadImg = async (file: File) => {
    setImgUploading(true)
    const sb = createClient()
    const path = `menu-images/${Date.now()}.${file.name.split('.').pop()}`
    const { error } = await sb.storage.from('menu-images').upload(path, file)
    if (!error) {
      const { data } = sb.storage.from('menu-images').getPublicUrl(path)
      setEditItem(p => ({ ...p, image_url: data.publicUrl }))
    }
    setImgUploading(false)
  }

  const filtered = catFilter === 'all' ? items : items.filter(i => i.category_id === catFilter)

  if (loading) return <div style={{ padding: 40, color: '#8B7355', textAlign: 'center' }}>Loading menu...</div>

  return (
    <div>
      <div className="ph">
        <div>
          <h1 className="title">Menu</h1>
          <p className="sub">{items.length} items · {cats.length} categories</p>
        </div>
        <button className="btn-add" onClick={() => { setEditItem({ is_available: true, is_featured: false, price: 0 }); setShowItemForm(true) }}>
          + Add Item
        </button>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'items' ? 'active' : ''}`} onClick={() => setTab('items')}>Menu Items</button>
        <button className={`tab ${tab === 'categories' ? 'active' : ''}`} onClick={() => setTab('categories')}>Categories</button>
      </div>

      {tab === 'items' && (
        <>
          <div className="cat-bar">
            <button className={`cc ${catFilter === 'all' ? 'active' : ''}`} onClick={() => setCatFilter('all')}>All</button>
            {cats.map(c => (
              <button key={c.id} className={`cc ${catFilter === c.id ? 'active' : ''}`} onClick={() => setCatFilter(c.id)}>
                {c.emoji} {c.name}
              </button>
            ))}
          </div>
          {filtered.length === 0 && <div className="empty">No items in this category yet.</div>}
          <div className="igrid">
            {filtered.map(item => (
              <div key={item.id} className={`icard ${!item.is_available ? 'off' : ''}`}>
                <div className="iimg">
                  {item.image_url ? <img src={item.image_url} alt={item.name} /> : <div className="iph">📷</div>}
                  <div className={`adot ${item.is_available ? 'on' : 'off'}`} />
                </div>
                <div className="ibody">
                  <div className="iname">{item.name}</div>
                  <div className="icat">{cats.find(c => c.id === item.category_id)?.name ?? '—'}</div>
                  <div className="iprice">{formatRp(item.price)}</div>
                  <div className="iact">
                    <button className="ab edit" onClick={() => { setEditItem(item); setShowItemForm(true) }}>Edit</button>
                    <button className="ab avail" onClick={() => toggleAvail(item.id, item.is_available)}>
                      {item.is_available ? 'Set Out' : 'Set Available'}
                    </button>
                    <button className="ab del" onClick={() => delItem(item.id)}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'categories' && (
        <>
          <button className="btn-sec" onClick={() => { setEditCat({ emoji: '☕', sort_order: cats.length }); setShowCatForm(true) }}>
            + Add Category
          </button>
          <div className="cat-list">
            {cats.map(cat => (
              <div key={cat.id} className="crow">
                <div className="cr-l">
                  <div className="cemoji">{cat.emoji}</div>
                  <div>
                    <div className="cname">{cat.name}</div>
                    <div className="ccnt">{items.filter(i => i.category_id === cat.id).length} items</div>
                  </div>
                </div>
                <div className="cr-r">
                  <button className="ab edit" onClick={() => { setEditCat(cat); setShowCatForm(true) }}>Edit</button>
                  <button className="ab del" onClick={() => delCat(cat.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Item Form Modal ── */}
      {showItemForm && editItem && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowItemForm(false)}>
          <div className="modal">
            <div className="mh">
              <h3>{editItem.id ? 'Edit Item' : 'Add Menu Item'}</h3>
              <button className="mclose" onClick={() => setShowItemForm(false)}>✕</button>
            </div>
            <label className="img-area">
              {editItem.image_url
                ? <img src={editItem.image_url} alt="preview" className="img-preview" />
                : <div className="img-empty">{imgUploading ? 'Uploading...' : '📷 Upload Photo'}</div>
              }
              <input type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadImg(f) }} />
            </label>
            <div className="frow">
              <div className="fg">
                <label className="fl">Item Name *</label>
                <input className="fi" type="text" placeholder="e.g. Americano Classic"
                  value={editItem.name ?? ''} onChange={e => setEditItem(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="fg">
                <label className="fl">Price (Rp) *</label>
                <input className="fi" type="number" placeholder="28000"
                  value={editItem.price ?? ''} onChange={e => setEditItem(p => ({ ...p, price: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="fg">
              <label className="fl">Category</label>
              <select className="fi" value={editItem.category_id ?? ''}
                onChange={e => setEditItem(p => ({ ...p, category_id: e.target.value || undefined }))}>
                <option value="">— No Category —</option>
                {cats.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
              </select>
            </div>
            <div className="fg">
              <label className="fl">Short Description</label>
              <textarea className="fi" rows={2} placeholder="Brief description of this item..."
                value={editItem.description ?? ''} onChange={e => setEditItem(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="frow">
              <label className="tog">
                <input type="checkbox" checked={editItem.is_available ?? true}
                  onChange={e => setEditItem(p => ({ ...p, is_available: e.target.checked }))} />
                <span>Available</span>
              </label>
              <label className="tog">
                <input type="checkbox" checked={editItem.is_featured ?? false}
                  onChange={e => setEditItem(p => ({ ...p, is_featured: e.target.checked }))} />
                <span>Featured</span>
              </label>
            </div>
            <button className="btn-save" onClick={saveItem} disabled={saving}>{saving ? 'Saving...' : 'Save Item'}</button>
          </div>
        </div>
      )}

      {/* ── Category Form Modal ── */}
      {showCatForm && editCat && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowCatForm(false)}>
          <div className="modal" style={{ maxWidth: 360 }}>
            <div className="mh">
              <h3>{editCat.id ? 'Edit Category' : 'Add Category'}</h3>
              <button className="mclose" onClick={() => setShowCatForm(false)}>✕</button>
            </div>
            <div className="fg">
              <label className="fl">Category Name *</label>
              <input className="fi" type="text" placeholder="e.g. Hot Coffee"
                value={editCat.name ?? ''} onChange={e => setEditCat(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="fg">
              <label className="fl">Icon</label>
              <div className="egrid">
                {EMOJIS.map(em => (
                  <button key={em} className={`eb ${editCat.emoji === em ? 'sel' : ''}`}
                    onClick={() => setEditCat(p => ({ ...p, emoji: em }))}>{em}</button>
                ))}
              </div>
            </div>
            <button className="btn-save" onClick={saveCat} disabled={saving}>{saving ? 'Saving...' : 'Save Category'}</button>
          </div>
        </div>
      )}

      <style jsx>{`
        .ph { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px; }
        .title { font-size:22px; font-weight:800; }
        .sub { font-size:13px; color:#8B7355; margin-top:2px; }
        .btn-add { padding:10px 16px; background:#2C1810; color:white; border:none; border-radius:10px; font-size:14px; font-weight:700; cursor:pointer; white-space:nowrap; }
        .btn-sec { padding:8px 14px; background:white; color:#2C1810; border:1.5px solid rgba(0,0,0,0.12); border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; margin-bottom:16px; }
        .tabs { display:flex; gap:4px; background:white; border-radius:12px; padding:4px; margin-bottom:20px; border:1px solid rgba(0,0,0,0.07); }
        .tab { flex:1; padding:8px; border:none; background:transparent; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; color:#8B7355; }
        .tab.active { background:#2C1810; color:white; }
        .cat-bar { display:flex; gap:8px; overflow-x:auto; padding-bottom:12px; scrollbar-width:none; margin-bottom:16px; }
        .cat-bar::-webkit-scrollbar { display:none; }
        .cc { flex-shrink:0; padding:6px 14px; border-radius:20px; border:1.5px solid rgba(0,0,0,0.1); font-size:13px; font-weight:500; color:#8B7355; background:white; cursor:pointer; white-space:nowrap; }
        .cc.active { background:#2C1810; color:white; border-color:#2C1810; }
        .empty { text-align:center; color:#8B7355; padding:40px; background:white; border-radius:14px; }
        .igrid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:12px; }
        .icard { background:white; border-radius:14px; overflow:hidden; border:1px solid rgba(0,0,0,0.07); }
        .icard.off { opacity:0.55; }
        .iimg { height:120px; position:relative; background:#F4F1ED; }
        .iimg img { width:100%; height:100%; object-fit:cover; }
        .iph { display:flex; align-items:center; justify-content:center; height:100%; font-size:32px; color:#8B7355; }
        .adot { position:absolute; top:8px; right:8px; width:10px; height:10px; border-radius:50%; border:2px solid white; }
        .adot.on { background:#1D9E75; } .adot.off { background:#E24B4A; }
        .ibody { padding:12px; }
        .iname { font-size:14px; font-weight:700; margin-bottom:2px; }
        .icat { font-size:11px; color:#8B7355; margin-bottom:4px; }
        .iprice { font-size:15px; font-weight:800; color:#C8873A; margin-bottom:10px; }
        .iact { display:flex; gap:4px; flex-wrap:wrap; }
        .ab { padding:4px 8px; border-radius:6px; border:1px solid transparent; font-size:11px; font-weight:600; cursor:pointer; }
        .ab.edit { background:#E6F1FB; color:#185FA5; border-color:#B5D4F4; }
        .ab.avail { background:#EAF3DE; color:#3B6D11; border-color:#C0DD97; }
        .ab.del { background:#FCEBEB; color:#A32D2D; border-color:#F7C1C1; }
        .cat-list { display:flex; flex-direction:column; gap:10px; }
        .crow { background:white; border-radius:12px; padding:14px 16px; display:flex; align-items:center; justify-content:space-between; border:1px solid rgba(0,0,0,0.07); }
        .cr-l { display:flex; align-items:center; gap:12px; }
        .cemoji { font-size:28px; }
        .cname { font-size:15px; font-weight:700; }
        .ccnt { font-size:12px; color:#8B7355; }
        .cr-r { display:flex; gap:8px; }
        .modal-bg { position:fixed; inset:0; background:rgba(0,0,0,0.45); z-index:100; display:flex; align-items:center; justify-content:center; padding:20px; }
        .modal { background:white; border-radius:16px; width:100%; max-width:520px; padding:24px; max-height:90vh; overflow-y:auto; }
        .mh { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
        .mh h3 { font-size:18px; font-weight:800; }
        .mclose { background:none; border:none; font-size:18px; cursor:pointer; color:#8B7355; }
        .img-area { display:block; height:160px; border-radius:12px; border:2px dashed rgba(0,0,0,0.12); overflow:hidden; cursor:pointer; margin-bottom:16px; }
        .img-preview { width:100%; height:100%; object-fit:cover; }
        .img-empty { display:flex; align-items:center; justify-content:center; height:100%; font-size:14px; font-weight:600; color:#8B7355; }
        .frow { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .fg { margin-bottom:14px; }
        .fl { display:block; font-size:11px; font-weight:700; color:#8B7355; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px; }
        .fi { width:100%; padding:10px 12px; border-radius:10px; border:1.5px solid rgba(0,0,0,0.1); font-size:14px; font-family:inherit; outline:none; background:white; resize:none; }
        .fi:focus { border-color:#C8873A; }
        .tog { display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; cursor:pointer; }
        .egrid { display:grid; grid-template-columns:repeat(9,1fr); gap:4px; }
        .eb { padding:6px; border:1.5px solid transparent; border-radius:8px; font-size:18px; cursor:pointer; background:transparent; }
        .eb.sel { border-color:#C8873A; background:#FDF4E9; }
        .btn-save { width:100%; padding:13px; border-radius:12px; background:#2C1810; color:white; border:none; font-size:15px; font-weight:700; font-family:inherit; cursor:pointer; margin-top:8px; }
        .btn-save:disabled { opacity:0.6; cursor:not-allowed; }
      `}</style>
    </div>
  )
}
