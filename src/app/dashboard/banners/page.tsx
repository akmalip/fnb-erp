'use client'

import { useEffect, useState, useRef } from 'react'
import { getAllBannersByOutlet, upsertBanner, deleteBanner } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/client'
import type { OutletBanner } from '@/types'

const TYPES = [
  { value: 'promo',        label: 'Promo / Discount' },
  { value: 'event',        label: 'Event' },
  { value: 'info',         label: 'Info' },
  { value: 'announcement', label: 'Announcement' },
]
const COLORS = [
  '#C8873A','#2C4A7C','#2C1810','#1D9E75','#D85A30','#3B6D11','#533AB7','#993556','#1A1A1A','#F5F0EB'
]
const EMOJIS = ['🎉','💸','☕','🍔','🎶','🔥','⭐','🎁','🛍','🏆','✨','🎊','🥂','🌿','❤️','🎵']

type DisplayMode = 'image_only' | 'image_text' | 'text_only'

interface BannerEditing extends Partial<OutletBanner> {
  display_mode?: DisplayMode
  image_position_x?: number
  image_position_y?: number
  image_zoom?: number
}

function getBgStyle(b: BannerEditing) {
  if (!b.image_url) return {}
  const x = b.image_position_x ?? 50
  const y = b.image_position_y ?? 50
  const zoom = b.image_zoom ?? 100
  return {
    backgroundImage: `url(${b.image_url})`,
    backgroundSize: `${zoom}%`,
    backgroundPosition: `${x}% ${y}%`,
    backgroundRepeat: 'no-repeat',
  }
}

export default function BannersPage() {
  const [banners, setBanners] = useState<OutletBanner[]>([])
  const [outletId, setOutletId] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [imgUploading, setImgUploading] = useState(false)
  const [editing, setEditing] = useState<BannerEditing | null>(null)
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, px: 50, py: 50 })
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = localStorage.getItem('fnb_outlet_id')
    if (!id) return
    setOutletId(id)
    getAllBannersByOutlet(id).then(d => { setBanners(d as any); setLoading(false) })
  }, [])

  const load = (id: string) => getAllBannersByOutlet(id).then(d => setBanners(d as any))

  const openNew = () => {
    setEditing({
      bg_color: '#2C1810', text_color: '#FFFFFF', icon_emoji: '',
      banner_type: 'promo', is_active: true, sort_order: banners.length,
      display_mode: 'image_text',
      image_position_x: 50, image_position_y: 50, image_zoom: 100
    })
    setShowForm(true)
  }

  const save = async () => {
    const mode = editing?.display_mode ?? 'text_only'
    if (mode !== 'image_only' && !editing?.title) { alert('Title is required'); return }
    if (mode === 'image_only' && !editing?.image_url) { alert('Please upload an image'); return }
    setSaving(true)
    const { display_mode, ...bannerData } = editing as any
    const { error } = await upsertBanner({ ...bannerData, outlet_id: outletId } as any)
    if (error) { alert('Error: ' + error.message); setSaving(false); return }
    await load(outletId)
    setSaving(false); setShowForm(false); setEditing(null)
  }

  const del = async (id: string) => {
    if (!confirm('Delete this banner?')) return
    await deleteBanner(id); setBanners(p => p.filter(b => b.id !== id))
  }

  const toggle = async (b: OutletBanner) => {
    await upsertBanner({ ...b, is_active: !b.is_active } as any)
    setBanners(p => p.map(x => x.id === b.id ? { ...x, is_active: !b.is_active } : x))
  }

  const uploadBannerImage = async (file: File) => {
    setImgUploading(true)
    const sb = createClient()
    const ext = file.name.split('.').pop()
    const path = `banners/${outletId}/${Date.now()}.${ext}`
    const { error } = await sb.storage.from('outlet-assets').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = sb.storage.from('outlet-assets').getPublicUrl(path)
      setEditing(p => ({ ...p, image_url: data.publicUrl, image_position_x: 50, image_position_y: 50, image_zoom: 100 }))
    } else {
      alert('Upload failed: ' + error.message)
    }
    setImgUploading(false)
  }

  // Drag to reposition image
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!editing?.image_url) return
    isDragging.current = true
    dragStart.current = {
      x: e.clientX, y: e.clientY,
      px: editing.image_position_x ?? 50,
      py: editing.image_position_y ?? 50
    }
    e.preventDefault()
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !previewRef.current) return
    const rect = previewRef.current.getBoundingClientRect()
    const dx = ((e.clientX - dragStart.current.x) / rect.width) * -100
    const dy = ((e.clientY - dragStart.current.y) / rect.height) * -100
    const newX = Math.max(0, Math.min(100, dragStart.current.px + dx))
    const newY = Math.max(0, Math.min(100, dragStart.current.py + dy))
    setEditing(p => ({ ...p, image_position_x: Math.round(newX), image_position_y: Math.round(newY) }))
  }

  const handleMouseUp = () => { isDragging.current = false }

  const getDisplayMode = (b: OutletBanner): DisplayMode => {
    if ((b as any).image_url && !b.title) return 'image_only'
    if ((b as any).image_url) return 'image_text'
    return 'text_only'
  }

  if (loading) return <div style={{ padding: 40, color: '#8B7355', textAlign: 'center' }}>Loading banners...</div>

  const displayMode: DisplayMode = editing?.display_mode ?? 'image_text'

  return (
    <div>
      <div className="ph">
        <div>
          <h1 className="title">Banners & Promos</h1>
          <p className="sub">Banners appear on the customer order page. Upload an image or use a color background.</p>
        </div>
        <button className="btn-add" onClick={openNew}>+ Add Banner</button>
      </div>

      {banners.length === 0 && <div className="empty">No banners yet. Add your first banner!</div>}

      <div className="grid">
        {banners.map(b => (
          <div key={b.id} className={`bcard ${!b.is_active ? 'off' : ''}`}>
            <div className="bprev-wrap">
              {(b as any).image_url ? (
                <div className="bprev-img" style={getBgStyle(b as any)}>
                  {b.title && (
                    <div className="bprev-overlay">
                      <div className="bprev-title" style={{ color: b.text_color }}>{b.title}</div>
                      {b.description && <div className="bprev-desc" style={{ color: b.text_color }}>{b.description}</div>}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bprev-color" style={{ background: b.bg_color }}>
                  {b.icon_emoji && <span className="bicon">{b.icon_emoji}</span>}
                  <div>
                    <div className="btitle" style={{ color: b.text_color }}>{b.title}</div>
                    {b.description && <div className="bdesc" style={{ color: b.text_color }}>{b.description}</div>}
                  </div>
                </div>
              )}
            </div>
            <div className="bmeta">
              <div>
                <span className="btype">{TYPES.find(t => t.value === b.banner_type)?.label ?? b.banner_type}</span>
                {(b as any).image_url && <span className="img-tag"> · Image</span>}
                {!b.is_active && <span className="off-tag"> · Inactive</span>}
              </div>
              <div className="bact">
                <button className="ab toggle" onClick={() => toggle(b)}>{b.is_active ? 'Deactivate' : 'Activate'}</button>
                <button className="ab edit" onClick={() => { setEditing({ ...b as any, display_mode: getDisplayMode(b) }); setShowForm(true) }}>Edit</button>
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
              <button className="mclose" onClick={() => { setShowForm(false); setEditing(null) }}>✕</button>
            </div>

            {/* Mode */}
            <div className="fg">
              <label className="fl">Display Mode</label>
              <div className="mode-row">
                {([
                  { v: 'image_text', l: 'Image + Text' },
                  { v: 'image_only', l: 'Image Only' },
                  { v: 'text_only',  l: 'Text / Color' },
                ] as {v: DisplayMode, l: string}[]).map(m => (
                  <button key={m.v} className={`mode-btn ${displayMode === m.v ? 'sel' : ''}`}
                    onClick={() => setEditing(p => ({ ...p, display_mode: m.v, ...(m.v === 'image_only' ? { title: '', description: '' } : {}) } as any))}>
                    {m.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Image upload */}
            {(displayMode === 'image_only' || displayMode === 'image_text') && (
              <div className="fg">
                <label className="fl">Banner Image <span className="opt">— recommended 1200×600px (2:1)</span></label>
                {editing.image_url ? (
                  <>
                    {/* Draggable position preview */}
                    <div className="pos-hint">Drag image to reposition · Use slider to zoom</div>
                    <div
                      ref={previewRef}
                      className="pos-preview"
                      style={{ ...getBgStyle(editing), cursor: isDragging.current ? 'grabbing' : 'grab' }}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                    >
                      {displayMode === 'image_text' && editing.title && (
                        <div className="prev-overlay">
                          <div style={{ color: editing.text_color ?? '#fff', fontWeight: 700, fontSize: 14 }}>{editing.title}</div>
                          {editing.description && <div style={{ color: editing.text_color ?? '#fff', fontSize: 12, opacity: 0.85, marginTop: 3 }}>{editing.description}</div>}
                        </div>
                      )}
                      <div className="drag-hint">↕ Drag to reposition</div>
                    </div>

                    {/* Zoom slider */}
                    <div className="zoom-row">
                      <span className="zoom-label">Zoom</span>
                      <input type="range" min={100} max={250} step={5}
                        value={editing.image_zoom ?? 100}
                        onChange={e => setEditing(p => ({ ...p, image_zoom: parseInt(e.target.value) }))}
                        className="zoom-slider" />
                      <span className="zoom-val">{editing.image_zoom ?? 100}%</span>
                    </div>

                    {/* Position fine-tune */}
                    <div className="pos-row">
                      <div className="pos-ctrl">
                        <span className="zoom-label">Horizontal</span>
                        <input type="range" min={0} max={100} step={1}
                          value={editing.image_position_x ?? 50}
                          onChange={e => setEditing(p => ({ ...p, image_position_x: parseInt(e.target.value) }))}
                          className="zoom-slider" />
                        <span className="zoom-val">{editing.image_position_x ?? 50}%</span>
                      </div>
                      <div className="pos-ctrl">
                        <span className="zoom-label">Vertical</span>
                        <input type="range" min={0} max={100} step={1}
                          value={editing.image_position_y ?? 50}
                          onChange={e => setEditing(p => ({ ...p, image_position_y: parseInt(e.target.value) }))}
                          className="zoom-slider" />
                        <span className="zoom-val">{editing.image_position_y ?? 50}%</span>
                      </div>
                    </div>

                    <div className="img-actions">
                      <label className="ab edit" style={{ cursor: 'pointer' }}>
                        Replace Image
                        <input type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={e => { const f = e.target.files?.[0]; if (f) uploadBannerImage(f) }} />
                      </label>
                      <button className="ab del" onClick={() => setEditing(p => ({ ...p, image_url: '' }))}>Remove</button>
                      <button className="ab" style={{ background: '#F1EFE8', color: '#5F5E5A', borderColor: '#D3D1C7' }}
                        onClick={() => setEditing(p => ({ ...p, image_position_x: 50, image_position_y: 50, image_zoom: 100 }))}>
                        Reset Position
                      </button>
                    </div>
                  </>
                ) : (
                  <label className="upload-area">
                    <div className="upload-empty">
                      <div style={{ fontSize: 28, marginBottom: 6 }}>🖼</div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{imgUploading ? 'Uploading...' : 'Click to upload image'}</div>
                      <div style={{ fontSize: 11, color: '#8B7355', marginTop: 4 }}>JPG, PNG, WEBP</div>
                    </div>
                    <input type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadBannerImage(f) }} />
                  </label>
                )}
              </div>
            )}

            {/* Text fields */}
            {displayMode !== 'image_only' && (
              <>
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
              </>
            )}

            {displayMode !== 'image_only' && (
              <div className="fg">
                <label className="fl">Text Color</label>
                <div className="tcolor-row">
                  {['#FFFFFF','#000000','#2C1810','#C8873A','#F5F0EB'].map(c => (
                    <button key={c} className={`tcswatch ${editing.text_color === c ? 'sel' : ''}`}
                      style={{ background: c, border: c === '#FFFFFF' ? '1.5px solid #ccc' : 'none' }}
                      onClick={() => setEditing(p => ({ ...p, text_color: c }))} />
                  ))}
                  <input type="color" value={editing.text_color ?? '#FFFFFF'}
                    onChange={e => setEditing(p => ({ ...p, text_color: e.target.value }))}
                    style={{ width: 32, height: 32, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, cursor: 'pointer', padding: 0 }} />
                </div>
              </div>
            )}

            {displayMode === 'text_only' && (
              <>
                <div className="fg">
                  <label className="fl">Background Color</label>
                  <div className="cgrid">
                    {COLORS.map(c => (
                      <button key={c} className={`cswatch ${editing.bg_color === c ? 'sel' : ''}`}
                        style={{ background: c }} onClick={() => setEditing(p => ({ ...p, bg_color: c }))} />
                    ))}
                  </div>
                  <input type="color" className="cpick" value={editing.bg_color ?? '#2C1810'}
                    onChange={e => setEditing(p => ({ ...p, bg_color: e.target.value }))} />
                </div>
                <div className="fg">
                  <label className="fl">Icon <span className="opt">(optional)</span></label>
                  <div className="egrid">
                    <button className={`eb ${!editing.icon_emoji ? 'sel' : ''}`}
                      onClick={() => setEditing(p => ({ ...p, icon_emoji: '' }))}
                      style={{ fontSize: 11, color: '#8B7355' }}>none</button>
                    {EMOJIS.map(em => (
                      <button key={em} className={`eb ${editing.icon_emoji === em ? 'sel' : ''}`}
                        onClick={() => setEditing(p => ({ ...p, icon_emoji: em }))}>{em}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="fg">
              <label className="fl">Category</label>
              <div className="tgrid">
                {TYPES.map(t => (
                  <button key={t.value} className={`tb ${editing.banner_type === t.value ? 'sel' : ''}`}
                    onClick={() => setEditing(p => ({ ...p, banner_type: t.value as any }))}>{t.label}</button>
                ))}
              </div>
            </div>

            <button className="btn-save" onClick={save} disabled={saving || imgUploading}>
              {imgUploading ? 'Uploading...' : saving ? 'Saving...' : 'Save Banner'}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .ph { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:24px; gap:12px; }
        .title { font-size:22px; font-weight:800; }
        .sub { font-size:13px; color:#8B7355; margin-top:4px; max-width:440px; line-height:1.5; }
        .btn-add { padding:10px 16px; background:#2C1810; color:white; border:none; border-radius:10px; font-size:14px; font-weight:700; cursor:pointer; flex-shrink:0; white-space:nowrap; }
        .empty { background:white; border-radius:14px; padding:48px; text-align:center; color:#8B7355; font-size:14px; }
        .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:14px; }
        .bcard { background:white; border-radius:14px; overflow:hidden; border:1px solid rgba(0,0,0,0.07); }
        .bcard.off { opacity:0.55; }
        .bprev-wrap { width:100%; aspect-ratio:2/1; overflow:hidden; }
        .bprev-img { width:100%; height:100%; background-repeat:no-repeat; position:relative; display:flex; align-items:flex-end; }
        .bprev-overlay { width:100%; padding:10px 12px; background:linear-gradient(to top,rgba(0,0,0,0.6) 0%,transparent 100%); }
        .bprev-title { font-size:13px; font-weight:700; }
        .bprev-desc { font-size:11px; opacity:0.85; margin-top:2px; }
        .bprev-color { width:100%; height:100%; display:flex; align-items:center; gap:10px; padding:14px; }
        .bicon { font-size:24px; flex-shrink:0; }
        .btitle { font-size:13px; font-weight:700; }
        .bdesc { font-size:11px; opacity:0.8; margin-top:2px; }
        .bmeta { padding:10px 14px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; }
        .btype { font-size:11px; color:#8B7355; }
        .img-tag { font-size:11px; color:#185FA5; }
        .off-tag { font-size:11px; color:#E24B4A; }
        .bact { display:flex; gap:6px; }
        .ab { padding:5px 10px; border-radius:7px; border:1px solid transparent; font-size:12px; font-weight:600; cursor:pointer; }
        .ab.toggle { background:#EAF3DE; color:#3B6D11; border-color:#C0DD97; }
        .ab.edit { background:#E6F1FB; color:#185FA5; border-color:#B5D4F4; }
        .ab.del { background:#FCEBEB; color:#A32D2D; border-color:#F7C1C1; }
        .modal-bg { position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:100; display:flex; align-items:center; justify-content:center; padding:20px; }
        .modal { background:white; border-radius:16px; width:100%; max-width:520px; padding:24px; max-height:92vh; overflow-y:auto; margin:auto; }
        .mh { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
        .mh h3 { font-size:18px; font-weight:800; }
        .mclose { background:none; border:none; font-size:20px; cursor:pointer; color:#8B7355; }
        .mode-row { display:flex; border:1.5px solid rgba(0,0,0,0.1); border-radius:10px; overflow:hidden; }
        .mode-btn { flex:1; padding:9px 6px; border:none; background:white; font-size:12px; font-weight:600; cursor:pointer; color:#8B7355; }
        .mode-btn.sel { background:#2C1810; color:white; }
        .pos-hint { font-size:11px; color:#8B7355; margin-bottom:6px; }
        .pos-preview {
          width:100%; aspect-ratio:2/1; border-radius:12px; overflow:hidden;
          border:1px solid rgba(0,0,0,0.1); position:relative;
          display:flex; align-items:flex-end; margin-bottom:10px;
          background-repeat:no-repeat; user-select:none;
        }
        .prev-overlay { width:100%; padding:10px 12px; background:linear-gradient(to top,rgba(0,0,0,0.6) 0%,transparent 100%); }
        .drag-hint { position:absolute; top:8px; right:8px; background:rgba(0,0,0,0.5); color:white; font-size:10px; padding:3px 7px; border-radius:6px; pointer-events:none; }
        .zoom-row { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
        .pos-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px; }
        .pos-ctrl { display:flex; align-items:center; gap:8px; }
        .zoom-label { font-size:11px; font-weight:700; color:#8B7355; white-space:nowrap; min-width:60px; }
        .zoom-slider { flex:1; height:4px; cursor:pointer; }
        .zoom-val { font-size:11px; color:#8B7355; min-width:36px; text-align:right; }
        .img-actions { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:4px; }
        .upload-area { display:block; width:100%; aspect-ratio:2/1; border:2px dashed rgba(0,0,0,0.12); border-radius:12px; overflow:hidden; cursor:pointer; background:#FAF7F4; }
        .upload-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center; padding:20px; }
        .fg { margin-bottom:16px; }
        .fl { display:block; font-size:11px; font-weight:700; color:#8B7355; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:8px; }
        .opt { text-transform:none; font-weight:400; font-size:11px; }
        .fi { width:100%; padding:10px 12px; border-radius:10px; border:1.5px solid rgba(0,0,0,0.1); font-size:14px; font-family:inherit; outline:none; }
        .fi:focus { border-color:#C8873A; }
        .tgrid { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
        .tb { padding:8px; border-radius:8px; border:1.5px solid rgba(0,0,0,0.1); font-size:12px; font-weight:600; cursor:pointer; background:white; }
        .tb.sel { border-color:#C8873A; background:#FDF4E9; }
        .cgrid { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px; }
        .cswatch { width:28px; height:28px; border-radius:7px; cursor:pointer; }
        .cswatch.sel { outline:2.5px solid #1A0F0A; outline-offset:2px; }
        .cpick { width:100%; height:32px; border-radius:8px; border:1px solid rgba(0,0,0,0.1); cursor:pointer; }
        .tcolor-row { display:flex; gap:6px; align-items:center; }
        .tcswatch { width:30px; height:30px; border-radius:50%; cursor:pointer; flex-shrink:0; }
        .tcswatch.sel { outline:2.5px solid #C8873A; outline-offset:2px; }
        .egrid { display:grid; grid-template-columns:repeat(9,1fr); gap:4px; }
        .eb { padding:4px; border:1.5px solid transparent; border-radius:7px; font-size:16px; cursor:pointer; background:transparent; }
        .eb.sel { border-color:#C8873A; background:#FDF4E9; }
        .btn-save { width:100%; padding:14px; border-radius:12px; background:#2C1810; color:white; border:none; font-size:15px; font-weight:700; font-family:inherit; cursor:pointer; margin-top:4px; }
        .btn-save:disabled { opacity:0.6; cursor:not-allowed; }
      `}</style>
    </div>
  )
}
