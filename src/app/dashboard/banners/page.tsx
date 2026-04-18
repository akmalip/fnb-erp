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
const COLORS = ['#C8873A','#2C4A7C','#2C1810','#1D9E75','#D85A30','#3B6D11','#533AB7','#993556','#1A1A1A','#F5F0EB']
const EMOJIS = ['🎉','💸','☕','🍔','🎶','🔥','⭐','🎁','🛍','🏆','✨','🎊','🥂','🌿','❤️','🎵']

type DisplayMode = 'image_only' | 'image_text' | 'text_only'
type BlockType = 'heading' | 'text' | 'image' | 'cta' | 'divider'

interface Block {
  id: string
  type: BlockType
  content?: string
  image_url?: string
  image_caption?: string
  cta_label?: string
  cta_url?: string
  cta_style?: 'primary' | 'outline'
}

interface BannerEditing extends Partial<OutletBanner> {
  display_mode?: DisplayMode
  image_position_x?: number
  image_position_y?: number
  image_zoom?: number
  detail_content?: Block[]
  has_detail_page?: boolean
}

function uid() { return Math.random().toString(36).slice(2, 9) }

function getBgStyle(b: BannerEditing) {
  if (!b.image_url) return {}
  return {
    backgroundImage: `url(${b.image_url})`,
    backgroundSize: `${b.image_zoom ?? 100}%`,
    backgroundPosition: `${b.image_position_x ?? 50}% ${b.image_position_y ?? 50}%`,
    backgroundRepeat: 'no-repeat' as const,
  }
}

export default function BannersPage() {
  const [banners, setBanners] = useState<OutletBanner[]>([])
  const [outletId, setOutletId] = useState('')
  const [outletSlug, setOutletSlug] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [activeTab, setActiveTab] = useState<'basic' | 'detail'>('basic')
  const [saving, setSaving] = useState(false)
  const [imgUploading, setImgUploading] = useState(false)
  const [blockImgUploading, setBlockImgUploading] = useState<string | null>(null)
  const [editing, setEditing] = useState<BannerEditing | null>(null)
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, px: 50, py: 50 })
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = localStorage.getItem('fnb_outlet_id')
    const slug = localStorage.getItem('fnb_outlet_slug') ?? ''
    if (!id) return
    setOutletId(id); setOutletSlug(slug)
    getAllBannersByOutlet(id).then(d => { setBanners(d as any); setLoading(false) })
  }, [])

  const load = (id: string) => getAllBannersByOutlet(id).then(d => setBanners(d as any))

  const openNew = () => {
    setEditing({
      bg_color: '#2C1810', text_color: '#FFFFFF', icon_emoji: '',
      banner_type: 'promo', is_active: true, sort_order: banners.length,
      display_mode: 'image_text',
      image_position_x: 50, image_position_y: 50, image_zoom: 100,
      detail_content: [], has_detail_page: false
    })
    setActiveTab('basic')
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

  const uploadImg = async (file: File, onDone: (url: string) => void) => {
    const sb = createClient()
    const ext = file.name.split('.').pop()
    const path = `banners/${outletId}/${Date.now()}.${ext}`
    const { error } = await sb.storage.from('outlet-assets').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = sb.storage.from('outlet-assets').getPublicUrl(path)
      onDone(data.publicUrl)
    } else {
      alert('Upload failed: ' + error.message)
    }
  }

  const uploadBannerImage = async (file: File) => {
    setImgUploading(true)
    await uploadImg(file, url => setEditing(p => ({ ...p, image_url: url, image_position_x: 50, image_position_y: 50, image_zoom: 100 })))
    setImgUploading(false)
  }

  const uploadBlockImage = async (file: File, blockId: string) => {
    setBlockImgUploading(blockId)
    await uploadImg(file, url => updateBlock(blockId, { image_url: url }))
    setBlockImgUploading(null)
  }

  // Drag to reposition
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!editing?.image_url) return
    isDragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY, px: editing.image_position_x ?? 50, py: editing.image_position_y ?? 50 }
    e.preventDefault()
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !previewRef.current) return
    const rect = previewRef.current.getBoundingClientRect()
    const dx = ((e.clientX - dragStart.current.x) / rect.width) * -100
    const dy = ((e.clientY - dragStart.current.y) / rect.height) * -100
    setEditing(p => ({
      ...p,
      image_position_x: Math.round(Math.max(0, Math.min(100, dragStart.current.px + dx))),
      image_position_y: Math.round(Math.max(0, Math.min(100, dragStart.current.py + dy)))
    }))
  }
  const handleMouseUp = () => { isDragging.current = false }

  // Block editor helpers
  const blocks: Block[] = editing?.detail_content ?? []

  const addBlock = (type: BlockType) => {
    const newBlock: Block = { id: uid(), type, content: '', cta_style: 'primary', cta_label: 'Learn More' }
    setEditing(p => ({ ...p, detail_content: [...(p?.detail_content ?? []), newBlock] }))
  }

  const updateBlock = (id: string, changes: Partial<Block>) => {
    setEditing(p => ({
      ...p,
      detail_content: (p?.detail_content ?? []).map(b => b.id === id ? { ...b, ...changes } : b)
    }))
  }

  const removeBlock = (id: string) => {
    setEditing(p => ({ ...p, detail_content: (p?.detail_content ?? []).filter(b => b.id !== id) }))
  }

  const moveBlock = (id: string, dir: -1 | 1) => {
    const arr = [...(editing?.detail_content ?? [])]
    const i = arr.findIndex(b => b.id === id)
    if (i + dir < 0 || i + dir >= arr.length) return
    ;[arr[i], arr[i + dir]] = [arr[i + dir], arr[i]]
    setEditing(p => ({ ...p, detail_content: arr }))
  }

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
          <p className="sub">Each banner can have its own detail page with full content.</p>
        </div>
        <button className="btn-add" onClick={openNew}>+ Add Banner</button>
      </div>

      {banners.length === 0 && <div className="empty">No banners yet.</div>}

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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="btype">{TYPES.find(t => t.value === b.banner_type)?.label}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(b as any).image_url && <span className="img-tag">Image</span>}
                  {(b as any).has_detail_page && <span className="detail-tag">Has Detail Page</span>}
                  {!b.is_active && <span className="off-tag">Inactive</span>}
                </div>
              </div>
              <div className="bact">
                {(b as any).has_detail_page && outletSlug && (
                  <a className="ab view" href={`/${outletSlug}/promo/${b.id}`} target="_blank" rel="noreferrer">Preview</a>
                )}
                <button className="ab toggle" onClick={() => toggle(b)}>{b.is_active ? 'Deactivate' : 'Activate'}</button>
                <button className="ab edit" onClick={() => {
                  setEditing({ ...b as any, display_mode: getDisplayMode(b), detail_content: (b as any).detail_content ?? [] })
                  setActiveTab('basic')
                  setShowForm(true)
                }}>Edit</button>
                <button className="ab del" onClick={() => del(b.id)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* FORM MODAL */}
      {showForm && editing && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal">
            <div className="mh">
              <h3>{editing.id ? 'Edit Banner' : 'New Banner'}</h3>
              <button className="mclose" onClick={() => { setShowForm(false); setEditing(null) }}>✕</button>
            </div>

            {/* Tab switcher */}
            <div className="modal-tabs">
              <button className={`mtab ${activeTab === 'basic' ? 'active' : ''}`} onClick={() => setActiveTab('basic')}>
                Banner Settings
              </button>
              <button className={`mtab ${activeTab === 'detail' ? 'active' : ''}`} onClick={() => setActiveTab('detail')}>
                Detail Page {blocks.length > 0 && <span className="block-count">{blocks.length}</span>}
              </button>
            </div>

            {/* ── BASIC TAB ── */}
            {activeTab === 'basic' && (
              <div>
                {/* Display mode */}
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
                    <label className="fl">Banner Image <span className="opt">— 1200×600px recommended (2:1)</span></label>
                    {editing.image_url ? (
                      <>
                        <div className="pos-hint">Drag to reposition · Slider to zoom</div>
                        <div ref={previewRef} className="pos-preview" style={{ ...getBgStyle(editing), cursor: isDragging.current ? 'grabbing' : 'grab' }}
                          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
                          onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                          {displayMode === 'image_text' && editing.title && (
                            <div className="prev-overlay">
                              <div style={{ color: editing.text_color ?? '#fff', fontWeight: 700, fontSize: 14 }}>{editing.title}</div>
                            </div>
                          )}
                          <div className="drag-hint">↕ Drag</div>
                        </div>
                        <div className="zoom-row">
                          <span className="zoom-label">Zoom</span>
                          <input type="range" min={100} max={250} step={5} value={editing.image_zoom ?? 100}
                            onChange={e => setEditing(p => ({ ...p, image_zoom: parseInt(e.target.value) }))} className="zoom-slider" />
                          <span className="zoom-val">{editing.image_zoom ?? 100}%</span>
                        </div>
                        <div className="pos-row">
                          <div className="pos-ctrl">
                            <span className="zoom-label">Horizontal</span>
                            <input type="range" min={0} max={100} step={1} value={editing.image_position_x ?? 50}
                              onChange={e => setEditing(p => ({ ...p, image_position_x: parseInt(e.target.value) }))} className="zoom-slider" />
                            <span className="zoom-val">{editing.image_position_x ?? 50}%</span>
                          </div>
                          <div className="pos-ctrl">
                            <span className="zoom-label">Vertical</span>
                            <input type="range" min={0} max={100} step={1} value={editing.image_position_y ?? 50}
                              onChange={e => setEditing(p => ({ ...p, image_position_y: parseInt(e.target.value) }))} className="zoom-slider" />
                            <span className="zoom-val">{editing.image_position_y ?? 50}%</span>
                          </div>
                        </div>
                        <div className="img-actions">
                          <label className="ab edit" style={{ cursor: 'pointer' }}>Replace Image
                            <input type="file" accept="image/*" style={{ display: 'none' }}
                              onChange={e => { const f = e.target.files?.[0]; if (f) uploadBannerImage(f) }} />
                          </label>
                          <button className="ab del" onClick={() => setEditing(p => ({ ...p, image_url: '' }))}>Remove</button>
                          <button className="ab" style={{ background: '#F1EFE8', color: '#5F5E5A', borderColor: '#D3D1C7' }}
                            onClick={() => setEditing(p => ({ ...p, image_position_x: 50, image_position_y: 50, image_zoom: 100 }))}>
                            Reset
                          </button>
                        </div>
                      </>
                    ) : (
                      <label className="upload-area">
                        <div className="upload-empty">
                          <div style={{ fontSize: 28, marginBottom: 6 }}>🖼</div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{imgUploading ? 'Uploading...' : 'Click to upload'}</div>
                          <div style={{ fontSize: 11, color: '#8B7355', marginTop: 4 }}>JPG, PNG, WEBP</div>
                        </div>
                        <input type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={e => { const f = e.target.files?.[0]; if (f) uploadBannerImage(f) }} />
                      </label>
                    )}
                  </div>
                )}

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
              </div>
            )}

            {/* ── DETAIL PAGE TAB ── */}
            {activeTab === 'detail' && (
              <div>
                <div className="detail-toggle">
                  <label className="tog-label">
                    <div className={`tog-sw ${editing.has_detail_page ? 'on' : 'off'}`}
                      onClick={() => setEditing(p => ({ ...p, has_detail_page: !p?.has_detail_page }))}>
                      <div className="tog-thumb" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>Enable Detail Page</div>
                      <div style={{ fontSize: 12, color: '#8B7355' }}>
                        {editing.has_detail_page
                          ? 'Customers can tap this banner to open the detail page'
                          : 'Banner is not tappable — enable to add detail content'}
                      </div>
                    </div>
                  </label>
                </div>

                {editing.has_detail_page && (
                  <>
                    {/* Block list */}
                    <div className="blocks-list">
                      {blocks.length === 0 && (
                        <div className="blocks-empty">No content yet. Add blocks below.</div>
                      )}
                      {blocks.map((block, idx) => (
                        <div key={block.id} className="block-item">
                          <div className="block-header">
                            <span className="block-type-badge">{block.type.toUpperCase()}</span>
                            <div className="block-controls">
                              <button className="bctrl" onClick={() => moveBlock(block.id, -1)} disabled={idx === 0}>↑</button>
                              <button className="bctrl" onClick={() => moveBlock(block.id, 1)} disabled={idx === blocks.length - 1}>↓</button>
                              <button className="bctrl del" onClick={() => removeBlock(block.id)}>✕</button>
                            </div>
                          </div>

                          {block.type === 'heading' && (
                            <input className="fi" type="text" placeholder="Heading text..."
                              value={block.content ?? ''} onChange={e => updateBlock(block.id, { content: e.target.value })} />
                          )}

                          {block.type === 'text' && (
                            <textarea className="fi" rows={4} placeholder="Paragraph text..."
                              value={block.content ?? ''} onChange={e => updateBlock(block.id, { content: e.target.value })} />
                          )}

                          {block.type === 'image' && (
                            <div>
                              {block.image_url ? (
                                <div>
                                  <img src={block.image_url} alt="" style={{ width: '100%', borderRadius: 8, marginBottom: 8 }} />
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <label className="ab edit" style={{ cursor: 'pointer', fontSize: 11 }}>
                                      Replace
                                      <input type="file" accept="image/*" style={{ display: 'none' }}
                                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadBlockImage(f, block.id) }} />
                                    </label>
                                    <button className="ab del" style={{ fontSize: 11 }} onClick={() => updateBlock(block.id, { image_url: '' })}>Remove</button>
                                  </div>
                                </div>
                              ) : (
                                <label className="block-img-upload">
                                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                    {blockImgUploading === block.id ? 'Uploading...' : '+ Upload Image'}
                                  </div>
                                  <input type="file" accept="image/*" style={{ display: 'none' }}
                                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadBlockImage(f, block.id) }} />
                                </label>
                              )}
                              <input className="fi" type="text" placeholder="Caption (optional)"
                                style={{ marginTop: 8 }} value={block.image_caption ?? ''}
                                onChange={e => updateBlock(block.id, { image_caption: e.target.value })} />
                            </div>
                          )}

                          {block.type === 'cta' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <input className="fi" type="text" placeholder="Button label (e.g. Order Now)"
                                value={block.cta_label ?? ''} onChange={e => updateBlock(block.id, { cta_label: e.target.value })} />
                              <input className="fi" type="url" placeholder="Link URL (optional)"
                                value={block.cta_url ?? ''} onChange={e => updateBlock(block.id, { cta_url: e.target.value })} />
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button className={`tb ${block.cta_style !== 'outline' ? 'sel' : ''}`}
                                  onClick={() => updateBlock(block.id, { cta_style: 'primary' })}>Filled</button>
                                <button className={`tb ${block.cta_style === 'outline' ? 'sel' : ''}`}
                                  onClick={() => updateBlock(block.id, { cta_style: 'outline' })}>Outline</button>
                              </div>
                            </div>
                          )}

                          {block.type === 'divider' && (
                            <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)', margin: '8px 0' }} />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Add block buttons */}
                    <div className="add-blocks">
                      <div className="add-blocks-label">Add Block</div>
                      <div className="add-blocks-row">
                        {(['heading','text','image','cta','divider'] as BlockType[]).map(t => (
                          <button key={t} className="add-block-btn" onClick={() => addBlock(t)}>
                            + {t.charAt(0).toUpperCase() + t.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Preview link */}
                    {editing.id && outletSlug && (
                      <div className="preview-link-box">
                        <span style={{ fontSize: 12, color: '#8B7355' }}>Detail page URL:</span>
                        <a href={`/${outletSlug}/promo/${editing.id}`} target="_blank" rel="noreferrer"
                          style={{ fontSize: 12, color: '#185FA5', wordBreak: 'break-all' }}>
                          {outletSlug}/promo/{editing.id}
                        </a>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <button className="btn-save" onClick={save} disabled={saving || imgUploading}>
              {saving ? 'Saving...' : 'Save Banner'}
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
        .img-tag { font-size:10px; color:#185FA5; background:#E6F1FB; padding:2px 6px; border-radius:4px; }
        .detail-tag { font-size:10px; color:#3B6D11; background:#EAF3DE; padding:2px 6px; border-radius:4px; }
        .off-tag { font-size:10px; color:#A32D2D; background:#FCEBEB; padding:2px 6px; border-radius:4px; }
        .bact { display:flex; gap:6px; flex-wrap:wrap; }
        .ab { padding:5px 10px; border-radius:7px; border:1px solid transparent; font-size:12px; font-weight:600; cursor:pointer; text-decoration:none; display:inline-block; }
        .ab.view { background:#F1EFE8; color:#2C1810; border-color:#D3D1C7; }
        .ab.toggle { background:#EAF3DE; color:#3B6D11; border-color:#C0DD97; }
        .ab.edit { background:#E6F1FB; color:#185FA5; border-color:#B5D4F4; }
        .ab.del { background:#FCEBEB; color:#A32D2D; border-color:#F7C1C1; }

        .modal-bg { position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:100; display:flex; align-items:center; justify-content:center; padding:20px; overflow-y:auto; }
        .modal { background:white; border-radius:16px; width:100%; max-width:540px; padding:24px; max-height:92vh; overflow-y:auto; margin:auto; }
        .mh { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
        .mh h3 { font-size:18px; font-weight:800; }
        .mclose { background:none; border:none; font-size:20px; cursor:pointer; color:#8B7355; }

        .modal-tabs { display:flex; gap:0; border:1.5px solid rgba(0,0,0,0.1); border-radius:10px; overflow:hidden; margin-bottom:20px; }
        .mtab { flex:1; padding:10px; border:none; background:white; font-size:13px; font-weight:600; cursor:pointer; color:#8B7355; display:flex; align-items:center; justify-content:center; gap:6px; }
        .mtab.active { background:#2C1810; color:white; }
        .block-count { background:#C8873A; color:white; font-size:10px; width:18px; height:18px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; }

        .mode-row { display:flex; border:1.5px solid rgba(0,0,0,0.1); border-radius:10px; overflow:hidden; }
        .mode-btn { flex:1; padding:9px 6px; border:none; background:white; font-size:12px; font-weight:600; cursor:pointer; color:#8B7355; }
        .mode-btn.sel { background:#2C1810; color:white; }

        .pos-hint { font-size:11px; color:#8B7355; margin-bottom:6px; }
        .pos-preview { width:100%; aspect-ratio:2/1; border-radius:12px; overflow:hidden; border:1px solid rgba(0,0,0,0.1); position:relative; display:flex; align-items:flex-end; margin-bottom:10px; background-repeat:no-repeat; user-select:none; }
        .prev-overlay { width:100%; padding:10px 12px; background:linear-gradient(to top,rgba(0,0,0,0.6) 0%,transparent 100%); }
        .drag-hint { position:absolute; top:8px; right:8px; background:rgba(0,0,0,0.5); color:white; font-size:10px; padding:3px 7px; border-radius:6px; pointer-events:none; }
        .zoom-row { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
        .pos-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px; }
        .pos-ctrl { display:flex; align-items:center; gap:8px; }
        .zoom-label { font-size:11px; font-weight:700; color:#8B7355; white-space:nowrap; min-width:60px; }
        .zoom-slider { flex:1; cursor:pointer; }
        .zoom-val { font-size:11px; color:#8B7355; min-width:36px; text-align:right; }
        .img-actions { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:4px; }
        .upload-area { display:block; width:100%; aspect-ratio:2/1; border:2px dashed rgba(0,0,0,0.12); border-radius:12px; overflow:hidden; cursor:pointer; background:#FAF7F4; }
        .upload-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center; padding:20px; }

        .detail-toggle { background:#FAF7F4; border-radius:12px; padding:14px; margin-bottom:16px; }
        .tog-label { display:flex; align-items:flex-start; gap:12px; cursor:pointer; }
        .tog-sw { width:44px; height:26px; border-radius:13px; padding:3px; cursor:pointer; flex-shrink:0; transition:background 0.2s; }
        .tog-sw.on { background:#1D9E75; } .tog-sw.off { background:#B4B2A9; }
        .tog-thumb { width:20px; height:20px; background:white; border-radius:50%; transition:transform 0.2s; }
        .tog-sw.on .tog-thumb { transform:translateX(18px); }

        .blocks-list { display:flex; flex-direction:column; gap:10px; margin-bottom:16px; min-height:20px; }
        .blocks-empty { text-align:center; padding:20px; color:#8B7355; font-size:13px; background:#FAF7F4; border-radius:10px; }
        .block-item { background:#FAF7F4; border-radius:12px; padding:12px; border:1px solid rgba(0,0,0,0.07); }
        .block-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
        .block-type-badge { font-size:10px; font-weight:800; color:#8B7355; background:rgba(0,0,0,0.07); padding:3px 8px; border-radius:6px; letter-spacing:0.06em; }
        .block-controls { display:flex; gap:4px; }
        .bctrl { width:26px; height:26px; border-radius:6px; border:1px solid rgba(0,0,0,0.1); background:white; font-size:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
        .bctrl:disabled { opacity:0.3; cursor:not-allowed; }
        .bctrl.del { background:#FCEBEB; color:#A32D2D; border-color:#F7C1C1; }
        .block-img-upload { display:block; border:2px dashed rgba(0,0,0,0.12); border-radius:8px; cursor:pointer; background:white; font-size:13px; font-weight:600; color:#8B7355; }

        .add-blocks { margin-bottom:16px; }
        .add-blocks-label { font-size:11px; font-weight:700; color:#8B7355; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:8px; }
        .add-blocks-row { display:flex; gap:6px; flex-wrap:wrap; }
        .add-block-btn { padding:7px 12px; border-radius:8px; border:1.5px solid rgba(0,0,0,0.1); background:white; font-size:12px; font-weight:600; cursor:pointer; color:#2C1810; }
        .add-block-btn:hover { background:#FAF7F4; }

        .preview-link-box { background:#E6F1FB; border-radius:10px; padding:10px 12px; display:flex; flex-direction:column; gap:4px; margin-bottom:16px; }

        .fg { margin-bottom:16px; }
        .fl { display:block; font-size:11px; font-weight:700; color:#8B7355; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:8px; }
        .opt { text-transform:none; font-weight:400; font-size:11px; }
        .fi { width:100%; padding:10px 12px; border-radius:10px; border:1.5px solid rgba(0,0,0,0.1); font-size:14px; font-family:inherit; outline:none; resize:vertical; }
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
        .btn-save { width:100%; padding:14px; border-radius:12px; background:#2C1810; color:white; border:none; font-size:15px; font-weight:700; font-family:inherit; cursor:pointer; margin-top:8px; }
        .btn-save:disabled { opacity:0.6; cursor:not-allowed; }
      `}</style>
    </div>
  )
}
