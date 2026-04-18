'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getOutletBySlug, updateOutlet } from '@/lib/supabase/queries'
import type { Outlet } from '@/types'

const FONTS = ['Plus Jakarta Sans','Inter','Poppins','DM Sans','Nunito','Raleway','Lato']

type Section = 'brand' | 'qris' | 'ops' | 'qrcode'
const SECTIONS: { id: Section; label: string }[] = [
  { id: 'brand',  label: '🎨 Brand Identity' },
  { id: 'qris',   label: '💳 QRIS Payment' },
  { id: 'ops',    label: '⏰ Operations' },
  { id: 'qrcode', label: '📱 QR Code' },
]

export default function SettingsPage() {
  const [outlet, setOutlet] = useState<Partial<Outlet>>({})
  const [outletId, setOutletId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [section, setSection] = useState<Section>('brand')
  const [uploadingQris, setUploadingQris] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingHeader, setUploadingHeader] = useState(false)
  const headerDragging = useRef(false)
  const headerDragStart = useRef({ x: 0, y: 0, px: 50, py: 50 })
  const headerPreviewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = localStorage.getItem('fnb_outlet_id')
    const slug = localStorage.getItem('fnb_outlet_slug')
    if (!id || !slug) return
    setOutletId(id)
    getOutletBySlug(slug).then(o => { if (o) { setOutlet(o); setLoading(false) } })
  }, [])

  const save = async () => {
    setSaving(true)
    await updateOutlet(outletId, outlet as Outlet)
    localStorage.setItem('fnb_outlet_name', outlet.name ?? '')
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  const uploadQris = async (file: File) => {
    setUploadingQris(true)
    const sb = createClient()
    const path = `qris/${outletId}/qris.png`
    const { error } = await sb.storage.from('outlet-assets').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = sb.storage.from('outlet-assets').getPublicUrl(path)
      const url = data.publicUrl + '?t=' + Date.now()
      setOutlet(p => ({ ...p, qris_image_url: url }))
      await updateOutlet(outletId, { qris_image_url: url } as any)
    }
    setUploadingQris(false)
  }

  const uploadLogo = async (file: File) => {
    setUploadingLogo(true)
    const sb = createClient()
    const path = `logos/${outletId}/logo.${file.name.split('.').pop()}`
    const { error } = await sb.storage.from('outlet-assets').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = sb.storage.from('outlet-assets').getPublicUrl(path)
      setOutlet(p => ({ ...p, logo_url: data.publicUrl }))
    }
    setUploadingLogo(false)
  }

  const uploadHeader = async (file: File) => {
    setUploadingHeader(true)
    const sb = createClient()
    const ext = file.name.split('.').pop()
    const path = `headers/${outletId}/header.${ext}`
    const { error } = await sb.storage.from('outlet-assets').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = sb.storage.from('outlet-assets').getPublicUrl(path)
      setOutlet(p => ({ ...p, header_image_url: data.publicUrl, header_use_photo: true } as any))
    }
    setUploadingHeader(false)
  }

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (!(outlet as any).header_image_url) return
    headerDragging.current = true
    headerDragStart.current = {
      x: e.clientX, y: e.clientY,
      px: (outlet as any).header_position_x ?? 50,
      py: (outlet as any).header_position_y ?? 50
    }
    e.preventDefault()
  }

  const handleHeaderMouseMove = (e: React.MouseEvent) => {
    if (!headerDragging.current || !headerPreviewRef.current) return
    const rect = headerPreviewRef.current.getBoundingClientRect()
    const dx = ((e.clientX - headerDragStart.current.x) / rect.width) * -100
    const dy = ((e.clientY - headerDragStart.current.y) / rect.height) * -100
    const newX = Math.max(0, Math.min(100, headerDragStart.current.px + dx))
    const newY = Math.max(0, Math.min(100, headerDragStart.current.py + dy))
    setOutlet(p => ({ ...p, header_position_x: Math.round(newX), header_position_y: Math.round(newY) } as any))
  }

  const handleHeaderMouseUp = () => { headerDragging.current = false }

  const qrUrl = outlet.slug
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com'}/${outlet.slug}`
    : ''

  if (loading) return <div style={{ padding: 40, color: '#8B7355', textAlign: 'center' }}>Loading settings...</div>

  return (
    <div>
      <div className="ph">
        <div>
          <h1 className="title">Settings</h1>
          <p className="sub">Configure your outlet brand, payment, and operations</p>
        </div>
        <button className="btn-save" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : saved ? '✅ Saved' : 'Save All'}
        </button>
      </div>

      <div className="layout">
        <nav className="snav">
          {SECTIONS.map(s => (
            <button key={s.id} className={`snb ${section === s.id ? 'active' : ''}`} onClick={() => setSection(s.id)}>
              {s.label}
            </button>
          ))}
        </nav>

        <div className="scard">

          {/* ── BRAND ── */}
          {section === 'brand' && (
            <>
              <h2 className="sh">Brand Identity</h2>
              <p className="sd">Customize how your order page looks to customers.</p>

              <div className="fg">
                <label className="fl">Outlet Logo</label>
                <div className="logo-row">
                  {outlet.logo_url
                    ? <img src={outlet.logo_url} alt="logo" className="limg" />
                    : <div className="lph">{(outlet.name ?? 'X').substring(0,2).toUpperCase()}</div>
                  }
                  <label className="ubtn">
                    {uploadingLogo ? 'Uploading...' : 'Change Logo'}
                    <input type="file" accept="image/*" style={{ display:'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f) }} />
                  </label>
                </div>
              </div>

              <div className="fg">
                <label className="fl">Outlet Name *</label>
                <input className="fi" type="text" value={outlet.name ?? ''} onChange={e => setOutlet(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="fg">
                <label className="fl">Header Background</label>
                <div style={{ display: "flex", border: "1.5px solid rgba(0,0,0,0.1)", borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
                  <button onClick={() => setOutlet(p => ({ ...p, header_use_photo: false } as any))}
                    style={{ flex: 1, padding: "9px 6px", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                      background: !(outlet as any).header_use_photo ? "#2C1810" : "white",
                      color: !(outlet as any).header_use_photo ? "white" : "#8B7355" }}>
                    Brand Color
                  </button>
                  <button onClick={() => setOutlet(p => ({ ...p, header_use_photo: true } as any))}
                    style={{ flex: 1, padding: "9px 6px", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                      background: (outlet as any).header_use_photo ? "#2C1810" : "white",
                      color: (outlet as any).header_use_photo ? "white" : "#8B7355" }}>
                    Photo
                  </button>
                </div>
                {(outlet as any).header_use_photo ? (
                  (outlet as any).header_image_url ? (
                    <div>
                      <div style={{ fontSize: 11, color: "#8B7355", marginBottom: 6 }}>Drag to reposition · Slider to zoom</div>
                      <div
                        ref={headerPreviewRef}
                        onMouseDown={handleHeaderMouseDown}
                        onMouseMove={handleHeaderMouseMove}
                        onMouseUp={handleHeaderMouseUp}
                        onMouseLeave={handleHeaderMouseUp}
                        style={{
                          width: "100%", aspectRatio: "3/1", borderRadius: 10, overflow: "hidden",
                          marginBottom: 10, border: "1px solid rgba(0,0,0,0.08)",
                          backgroundImage: `url(${(outlet as any).header_image_url})`,
                          backgroundSize: `${(outlet as any).header_zoom ?? 100}%`,
                          backgroundPosition: `${(outlet as any).header_position_x ?? 50}% ${(outlet as any).header_position_y ?? 50}%`,
                          backgroundRepeat: "no-repeat",
                          cursor: headerDragging.current ? "grabbing" : "grab",
                          userSelect: "none",
                          position: "relative"
                        }}>
                        <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.5)", color: "white", fontSize: 10, padding: "3px 7px", borderRadius: 6, pointerEvents: "none" }}>↕ Drag</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#8B7355", minWidth: 40 }}>Zoom</span>
                        <input type="range" min={100} max={250} step={5}
                          value={(outlet as any).header_zoom ?? 100}
                          onChange={e => setOutlet(p => ({ ...p, header_zoom: parseInt(e.target.value) } as any))}
                          style={{ flex: 1, cursor: "pointer" }} />
                        <span style={{ fontSize: 11, color: "#8B7355", minWidth: 36, textAlign: "right" }}>{(outlet as any).header_zoom ?? 100}%</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#8B7355", minWidth: 52 }}>Horizontal</span>
                          <input type="range" min={0} max={100} step={1}
                            value={(outlet as any).header_position_x ?? 50}
                            onChange={e => setOutlet(p => ({ ...p, header_position_x: parseInt(e.target.value) } as any))}
                            style={{ flex: 1, cursor: "pointer" }} />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#8B7355", minWidth: 40 }}>Vertical</span>
                          <input type="range" min={0} max={100} step={1}
                            value={(outlet as any).header_position_y ?? 50}
                            onChange={e => setOutlet(p => ({ ...p, header_position_y: parseInt(e.target.value) } as any))}
                            style={{ flex: 1, cursor: "pointer" }} />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <label className="ubtn" style={{ cursor: "pointer" }}>
                          {uploadingHeader ? "Uploading..." : "Replace Photo"}
                          <input type="file" accept="image/*" style={{ display: "none" }}
                            onChange={e => { const f = e.target.files?.[0]; if (f) uploadHeader(f) }} />
                        </label>
                        <button className="ubtn" onClick={() => setOutlet(p => ({ ...p, header_image_url: "", header_use_photo: false, header_zoom: 100, header_position_x: 50, header_position_y: 50 } as any))}>
                          Remove
                        </button>
                        <button className="ubtn" onClick={() => setOutlet(p => ({ ...p, header_zoom: 100, header_position_x: 50, header_position_y: 50 } as any))}>
                          Reset
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center",
                      width: "100%", aspectRatio: "3/1", border: "2px dashed rgba(0,0,0,0.12)",
                      borderRadius: 10, cursor: "pointer", background: "#FAF7F4", textAlign: "center" as const }}>
                      <div style={{ fontSize: 28, marginBottom: 6 }}>🖼</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{uploadingHeader ? "Uploading..." : "Upload Header Photo"}</div>
                      <div style={{ fontSize: 11, color: "#8B7355", marginTop: 4 }}>Recommended: 1440×480px (3:1)</div>
                      <input type="file" accept="image/*" style={{ display: "none" }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadHeader(f) }} />
                    </label>
                  )
                ) : (
                  <div style={{ fontSize: 12, color: "#8B7355", padding: "8px 0" }}>
                    Header will use your brand color as gradient background.
                  </div>
                )}
              </div>

                            <div className="fg">
                <label className="fl">Tagline / Description</label>
                <input className="fi" type="text" placeholder="e.g. Specialty coffee in the heart of Sukabumi"
                  value={outlet.description ?? ''} onChange={e => setOutlet(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="fg">
                <label className="fl">Address</label>
                <input className="fi" type="text" value={outlet.address ?? ''} onChange={e => setOutlet(p => ({ ...p, address: e.target.value }))} />
              </div>

              <div className="crows">
                {[
                  { key: 'primary_color', label: 'Primary Color' },
                  { key: 'secondary_color', label: 'Secondary Color' },
                  { key: 'accent_color', label: 'Accent Color' },
                ].map(({ key, label }) => (
                  <div key={key} className="fg">
                    <label className="fl">{label}</label>
                    <div className="cprow">
                      <input type="color" className="csw" value={(outlet as any)[key] ?? '#C8873A'} onChange={e => setOutlet(p => ({ ...p, [key]: e.target.value }))} />
                      <input className="fi" type="text" value={(outlet as any)[key] ?? ''} onChange={e => setOutlet(p => ({ ...p, [key]: e.target.value }))} style={{ flex:1 }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="fg">
                <label className="fl">Font</label>
                <div className="fgrid">
                  {FONTS.map(f => (
                    <button key={f} className={`fb ${outlet.font_choice === f ? 'sel' : ''}`} style={{ fontFamily: f }}
                      onClick={() => setOutlet(p => ({ ...p, font_choice: f }))}>{f}</button>
                  ))}
                </div>
              </div>

              {/* Live preview */}
              <div className="prev" style={{ background: outlet.secondary_color ?? '#2C1810' }}>
                <div className="prev-label">Preview</div>
                <div className="prev-logo" style={{ background: outlet.primary_color ?? '#C8873A' }}>
                  {(outlet.name ?? 'KK').substring(0,2).toUpperCase()}
                </div>
                <div className="prev-name" style={{ fontFamily: outlet.font_choice }}>{outlet.name ?? 'Outlet Name'}</div>
                <div className="prev-desc">{outlet.description ?? 'Your outlet tagline here'}</div>
              </div>
            </>
          )}

          {/* ── QRIS ── */}
          {section === 'qris' && (
            <>
              <h2 className="sh">QRIS Payment</h2>
              <p className="sd">Upload your static QRIS image. Customers will scan this during checkout. No per-transaction fee — funds go directly to your account.</p>
              <div className="qarea">
                {outlet.qris_image_url ? (
                  <div className="qprev">
                    <img src={outlet.qris_image_url} alt="QRIS" className="qimg" />
                    <label className="ubtn">{uploadingQris ? 'Uploading...' : '🔄 Replace QRIS'}<input type="file" accept="image/*" style={{ display:'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadQris(f) }} /></label>
                  </div>
                ) : (
                  <label className="qempty">
                    <div style={{ fontSize:40, marginBottom:12 }}>💳</div>
                    <div style={{ fontSize:14, fontWeight:600, marginBottom:4 }}>{uploadingQris ? 'Uploading...' : 'Click to upload your QRIS image'}</div>
                    <div style={{ fontSize:12, color:'#8B7355' }}>Get your static QRIS from GoPay, OVO, DANA, or your bank app</div>
                    <input type="file" accept="image/*" style={{ display:'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadQris(f) }} />
                  </label>
                )}
              </div>
              <div className="ibox">
                <div>ℹ️</div>
                <div>Static QRIS lets customers pay with any Indonesian e-wallet or bank app. No third-party payment gateway needed — zero per-transaction fee.</div>
              </div>
            </>
          )}

          {/* ── OPERATIONS ── */}
          {section === 'ops' && (
            <>
              <h2 className="sh">Operations</h2>
              <div className="fg">
                <label className="fl">Outlet Phone / WhatsApp</label>
                <input className="fi" type="tel" value={outlet.phone ?? ''} onChange={e => setOutlet(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="frow">
                <div className="fg">
                  <label className="fl">Opening Time</label>
                  <input className="fi" type="time" value={outlet.open_time ?? '07:00'} onChange={e => setOutlet(p => ({ ...p, open_time: e.target.value }))} />
                </div>
                <div className="fg">
                  <label className="fl">Closing Time</label>
                  <input className="fi" type="time" value={outlet.close_time ?? '22:00'} onChange={e => setOutlet(p => ({ ...p, close_time: e.target.value }))} />
                </div>
              </div>
              <div className="fg">
                <label className="fl">Max Table Number</label>
                <input className="fi" type="number" min={1} max={200} value={outlet.max_table_number ?? 20} onChange={e => setOutlet(p => ({ ...p, max_table_number: parseInt(e.target.value) || 20 }))} />
                <div className="hint">Customers can enter table numbers 1 – {outlet.max_table_number ?? 20}</div>
              </div>
              <div className="tog-wrap">
                <div className={`tsw ${outlet.is_open ? 'on' : 'off'}`} onClick={() => setOutlet(p => ({ ...p, is_open: !p.is_open }))}>
                  <div className="tthumb" />
                </div>
                <div>
                  <div className="tlabel">Outlet Status</div>
                  <div className="tsub">{outlet.is_open ? '🟢 Open — customers can order' : '🔴 Closed — order page is hidden'}</div>
                </div>
              </div>
            </>
          )}

          {/* ── QR CODE ── */}
          {section === 'qrcode' && (
            <>
              <h2 className="sh">QR Code for Tables</h2>
              <p className="sd">Use <strong>one QR Code</strong> for all tables. Print and place it at each table — customers scan it and type in their table number themselves.</p>
              <div className="urlbox">
                <div className="ul">Order Page URL</div>
                <div className="uv">{qrUrl || 'Save settings first'}</div>
                {qrUrl && <button className="cpbtn" onClick={() => { navigator.clipboard.writeText(qrUrl); alert('URL copied!') }}>📋 Copy URL</button>}
              </div>
              <div className="ibox" style={{ marginTop:16 }}>
                <div>💡</div>
                <div>
                  <strong>How to create the QR Code:</strong><br/>
                  1. Copy the URL above<br/>
                  2. Go to <a href="https://qr.io" target="_blank" rel="noreferrer" style={{ color:'#185FA5' }}>qr.io</a> or any QR generator<br/>
                  3. Paste the URL and generate<br/>
                  4. Download → Print → Laminate → Place on each table<br/>
                  <strong>One QR serves all tables!</strong>
                </div>
              </div>
              <div className="teg">
                <div className="tegl">Example table signage:</div>
                <div className="tegc">
                  <div className="tegqr">📱</div>
                  <div>
                    <div style={{ fontWeight:800, fontSize:16 }}>Scan to Order</div>
                    <div style={{ fontSize:13, color:'#8B7355', marginTop:2 }}>This table: <strong>No. 05</strong></div>
                    <div style={{ fontSize:11, color:'#B4B2A9', marginTop:4 }}>Enter table number after scanning</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .ph { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:24px; gap:12px; }
        .title { font-size:22px; font-weight:800; }
        .sub { font-size:13px; color:#8B7355; margin-top:2px; }
        .btn-save { padding:10px 20px; background:#2C1810; color:white; border:none; border-radius:10px; font-size:14px; font-weight:700; cursor:pointer; white-space:nowrap; flex-shrink:0; }
        .btn-save:disabled { opacity:0.6; }
        .layout { display:grid; grid-template-columns:180px 1fr; gap:20px; align-items:start; }
        .snav { display:flex; flex-direction:column; gap:2px; background:white; border-radius:14px; padding:8px; border:1px solid rgba(0,0,0,0.07); position:sticky; top:80px; }
        .snb { padding:10px 12px; border:none; background:transparent; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; text-align:left; color:#8B7355; }
        .snb.active { background:#2C1810; color:white; }
        .scard { background:white; border-radius:14px; padding:24px; border:1px solid rgba(0,0,0,0.07); }
        .sh { font-size:18px; font-weight:800; margin-bottom:6px; }
        .sd { font-size:13px; color:#8B7355; margin-bottom:20px; line-height:1.5; }
        .fg { margin-bottom:16px; }
        .fl { display:block; font-size:11px; font-weight:700; color:#8B7355; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px; }
        .fi { width:100%; padding:10px 12px; border-radius:10px; border:1.5px solid rgba(0,0,0,0.1); font-size:14px; font-family:inherit; outline:none; }
        .fi:focus { border-color:#C8873A; }
        .hint { font-size:12px; color:#8B7355; margin-top:4px; }
        .frow { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .logo-row { display:flex; align-items:center; gap:16px; }
        .limg { width:56px; height:56px; border-radius:12px; object-fit:cover; border:2px solid rgba(0,0,0,0.08); }
        .lph { width:56px; height:56px; border-radius:12px; background:#2C1810; color:white; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:800; }
        .ubtn { padding:8px 16px; border-radius:8px; border:1.5px solid rgba(0,0,0,0.12); font-size:13px; font-weight:600; cursor:pointer; background:white; }
        .crows { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
        .cprow { display:flex; align-items:center; gap:8px; }
        .csw { width:36px; height:36px; border-radius:8px; border:1.5px solid rgba(0,0,0,0.1); cursor:pointer; padding:0; flex-shrink:0; }
        .fgrid { display:flex; flex-direction:column; gap:4px; }
        .fb { padding:10px 14px; border-radius:8px; border:1.5px solid rgba(0,0,0,0.1); font-size:14px; cursor:pointer; background:white; text-align:left; }
        .fb.sel { border-color:#C8873A; background:#FDF4E9; }
        .prev { border-radius:14px; padding:20px; margin-top:20px; }
        .prev-label { font-size:11px; color:rgba(255,255,255,0.35); margin-bottom:10px; font-weight:600; }
        .prev-logo { width:44px; height:44px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:800; color:white; margin-bottom:8px; }
        .prev-name { font-size:20px; font-weight:800; color:white; }
        .prev-desc { font-size:12px; color:rgba(255,255,255,0.5); margin-top:4px; }
        .qarea { border-radius:14px; overflow:hidden; margin-bottom:20px; }
        .qprev { display:flex; flex-direction:column; align-items:center; gap:14px; padding:20px; background:#FAF7F4; border-radius:14px; border:1px solid rgba(0,0,0,0.08); }
        .qimg { max-width:240px; border-radius:12px; border:1px solid rgba(0,0,0,0.08); }
        .qempty { display:flex; flex-direction:column; align-items:center; padding:48px 20px; border:2px dashed rgba(0,0,0,0.12); border-radius:14px; cursor:pointer; text-align:center; }
        .ibox { display:flex; gap:12px; background:#E6F1FB; border-radius:12px; padding:14px 16px; font-size:13px; color:#185FA5; line-height:1.6; }
        .tog-wrap { display:flex; align-items:center; gap:16px; border-top:1px solid rgba(0,0,0,0.07); padding-top:20px; margin-top:8px; }
        .tsw { width:48px; height:28px; border-radius:14px; padding:3px; cursor:pointer; flex-shrink:0; transition:background 0.2s; }
        .tsw.on { background:#1D9E75; } .tsw.off { background:#B4B2A9; }
        .tthumb { width:22px; height:22px; background:white; border-radius:50%; transition:transform 0.2s; }
        .tsw.on .tthumb { transform:translateX(20px); }
        .tlabel { font-size:14px; font-weight:700; }
        .tsub { font-size:12px; color:#8B7355; margin-top:2px; }
        .urlbox { background:#FAF7F4; border-radius:12px; padding:16px; border:1px solid rgba(0,0,0,0.08); }
        .ul { font-size:11px; font-weight:700; color:#8B7355; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px; }
        .uv { font-size:14px; font-weight:600; color:#185FA5; word-break:break-all; margin-bottom:10px; }
        .cpbtn { padding:7px 14px; background:#2C1810; color:white; border:none; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; }
        .teg { margin-top:24px; }
        .tegl { font-size:13px; font-weight:700; color:#8B7355; margin-bottom:10px; }
        .tegc { background:white; border-radius:12px; border:2px solid rgba(0,0,0,0.08); padding:16px; display:flex; gap:14px; align-items:center; }
        .tegqr { width:60px; height:60px; background:#F4F1ED; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:24px; flex-shrink:0; }
        @media (max-width:640px) {
          .layout { grid-template-columns:1fr; }
          .snav { flex-direction:row; flex-wrap:wrap; position:static; }
          .crows { grid-template-columns:1fr; }
        }
      `}</style>
    </div>
  )
}
