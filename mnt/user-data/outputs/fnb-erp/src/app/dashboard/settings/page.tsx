'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getOutletBySlug, updateOutlet } from '@/lib/supabase/queries'
import type { Outlet } from '@/types'

const FONTS = [
  'Plus Jakarta Sans', 'Inter', 'Poppins', 'DM Sans', 'Nunito', 'Lato', 'Raleway'
]

export default function SettingsPage() {
  const [outlet, setOutlet] = useState<Partial<Outlet>>({})
  const [outletId, setOutletId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingQris, setUploadingQris] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [activeSection, setActiveSection] = useState<'brand' | 'qris' | 'operational' | 'qrcode'>('brand')

  useEffect(() => {
    const id = localStorage.getItem('fnb_outlet_id')
    const slug = localStorage.getItem('fnb_outlet_slug')
    if (!id || !slug) return
    setOutletId(id)
    getOutletBySlug(slug).then(o => {
      if (o) { setOutlet(o); setLoading(false) }
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    await updateOutlet(outletId, outlet as Outlet)
    localStorage.setItem('fnb_outlet_name', outlet.name ?? '')
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleQrisUpload = async (file: File) => {
    setUploadingQris(true)
    const sb = createClient()
    const path = `qris/${outletId}/qris.png`
    const { error } = await sb.storage.from('outlet-assets').upload(path, file, { upsert: true, contentType: file.type })
    if (!error) {
      const { data } = sb.storage.from('outlet-assets').getPublicUrl(path)
      const url = data.publicUrl + '?t=' + Date.now()
      setOutlet(prev => ({ ...prev, qris_image_url: url }))
      await updateOutlet(outletId, { qris_image_url: url } as any)
    }
    setUploadingQris(false)
  }

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true)
    const sb = createClient()
    const path = `logos/${outletId}/logo.${file.name.split('.').pop()}`
    const { error } = await sb.storage.from('outlet-assets').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = sb.storage.from('outlet-assets').getPublicUrl(path)
      setOutlet(prev => ({ ...prev, logo_url: data.publicUrl }))
    }
    setUploadingLogo(false)
  }

  const qrValue = outlet.slug
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com'}/${outlet.slug}`
    : ''

  if (loading) return <div style={{ padding: 40, color: '#8B7355', textAlign: 'center' }}>Memuat pengaturan...</div>

  const SECTIONS = [
    { id: 'brand', label: '🎨 Brand Identity' },
    { id: 'qris', label: '💳 QRIS Pembayaran' },
    { id: 'operational', label: '⏰ Operasional' },
    { id: 'qrcode', label: '📱 QR Code Meja' },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pengaturan Outlet</h1>
          <p className="page-sub">Konfigurasi branding, QRIS, dan jam operasional</p>
        </div>
        <button className="save-btn" onClick={handleSave} disabled={saving}>
          {saving ? 'Menyimpan...' : saved ? '✅ Tersimpan' : 'Simpan Semua'}
        </button>
      </div>

      <div className="settings-layout">
        {/* Sidebar nav */}
        <nav className="section-nav">
          {SECTIONS.map(s => (
            <button key={s.id} className={`section-nav-btn ${activeSection === s.id ? 'active' : ''}`}
              onClick={() => setActiveSection(s.id as any)}>
              {s.label}
            </button>
          ))}
        </nav>

        {/* Section content */}
        <div className="section-content">

          {/* ── BRAND ── */}
          {activeSection === 'brand' && (
            <div className="section-card">
              <h2 className="section-title">Brand Identity</h2>
              <p className="section-desc">Sesuaikan tampilan halaman order customer sesuai brand kamu.</p>

              {/* Logo */}
              <div className="form-group">
                <label className="form-label">Logo Outlet</label>
                <div className="logo-row">
                  {outlet.logo_url
                    ? <img src={outlet.logo_url} alt="logo" className="logo-preview" />
                    : <div className="logo-placeholder">{(outlet.name ?? 'X').substring(0,2).toUpperCase()}</div>
                  }
                  <label className="upload-btn">
                    {uploadingLogo ? 'Mengupload...' : 'Ganti Logo'}
                    <input type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f) }} />
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Nama Outlet *</label>
                <input className="form-input" type="text" value={outlet.name ?? ''}
                  onChange={e => setOutlet(p => ({ ...p, name: e.target.value }))} />
              </div>

              <div className="form-group">
                <label className="form-label">Deskripsi Singkat</label>
                <input className="form-input" type="text" placeholder="cth: Coffee shop specialty di jantung Sukabumi"
                  value={outlet.description ?? ''} onChange={e => setOutlet(p => ({ ...p, description: e.target.value }))} />
              </div>

              <div className="form-group">
                <label className="form-label">Alamat</label>
                <input className="form-input" type="text" value={outlet.address ?? ''}
                  onChange={e => setOutlet(p => ({ ...p, address: e.target.value }))} />
              </div>

              {/* Colors */}
              <div className="colors-row">
                <div className="form-group">
                  <label className="form-label">Warna Utama</label>
                  <div className="color-pick-row">
                    <input type="color" className="color-swatch" value={outlet.primary_color ?? '#C8873A'}
                      onChange={e => setOutlet(p => ({ ...p, primary_color: e.target.value }))} />
                    <input className="form-input" type="text" value={outlet.primary_color ?? '#C8873A'}
                      onChange={e => setOutlet(p => ({ ...p, primary_color: e.target.value }))} style={{ flex: 1 }} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Warna Sekunder</label>
                  <div className="color-pick-row">
                    <input type="color" className="color-swatch" value={outlet.secondary_color ?? '#2C1810'}
                      onChange={e => setOutlet(p => ({ ...p, secondary_color: e.target.value }))} />
                    <input className="form-input" type="text" value={outlet.secondary_color ?? '#2C1810'}
                      onChange={e => setOutlet(p => ({ ...p, secondary_color: e.target.value }))} style={{ flex: 1 }} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Warna Aksen</label>
                  <div className="color-pick-row">
                    <input type="color" className="color-swatch" value={outlet.accent_color ?? '#F5E6D3'}
                      onChange={e => setOutlet(p => ({ ...p, accent_color: e.target.value }))} />
                    <input className="form-input" type="text" value={outlet.accent_color ?? '#F5E6D3'}
                      onChange={e => setOutlet(p => ({ ...p, accent_color: e.target.value }))} style={{ flex: 1 }} />
                  </div>
                </div>
              </div>

              {/* Font */}
              <div className="form-group">
                <label className="form-label">Font</label>
                <div className="font-grid">
                  {FONTS.map(f => (
                    <button key={f} className={`font-btn ${outlet.font_choice === f ? 'selected' : ''}`}
                      style={{ fontFamily: f }} onClick={() => setOutlet(p => ({ ...p, font_choice: f }))}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live preview */}
              <div className="brand-preview" style={{ background: outlet.secondary_color ?? '#2C1810' }}>
                <div className="bp-label">Preview Hero Banner:</div>
                <div className="bp-logo" style={{ background: outlet.primary_color ?? '#C8873A' }}>
                  {(outlet.name ?? 'KK').substring(0,2).toUpperCase()}
                </div>
                <div className="bp-name" style={{ fontFamily: outlet.font_choice }}>{outlet.name ?? 'Nama Outlet'}</div>
                <div className="bp-desc">{outlet.description ?? 'Deskripsi outlet kamu'}</div>
              </div>
            </div>
          )}

          {/* ── QRIS ── */}
          {activeSection === 'qris' && (
            <div className="section-card">
              <h2 className="section-title">QRIS Pembayaran</h2>
              <p className="section-desc">Upload gambar QRIS statis kamu. Customer akan scan QRIS ini saat checkout.</p>

              <div className="qris-upload-area">
                {outlet.qris_image_url ? (
                  <div className="qris-preview-wrap">
                    <img src={outlet.qris_image_url} alt="QRIS" className="qris-img" />
                    <label className="change-qris-btn">
                      {uploadingQris ? 'Mengupload...' : '🔄 Ganti QRIS'}
                      <input type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleQrisUpload(f) }} />
                    </label>
                  </div>
                ) : (
                  <label className="qris-upload-empty">
                    <div className="upload-icon">💳</div>
                    <div className="upload-text">{uploadingQris ? 'Mengupload QRIS...' : 'Klik untuk upload gambar QRIS kamu'}</div>
                    <div className="upload-hint">Format JPG/PNG, dari aplikasi bank atau dompet digital</div>
                    <input type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleQrisUpload(f) }} />
                  </label>
                )}
              </div>

              <div className="info-box">
                <div className="info-icon">ℹ</div>
                <div>QRIS statis bisa kamu dapatkan dari aplikasi mobile banking, GoPay, OVO, atau DANA. Tidak ada biaya per transaksi — semua langsung ke rekeningmu.</div>
              </div>
            </div>
          )}

          {/* ── OPERATIONAL ── */}
          {activeSection === 'operational' && (
            <div className="section-card">
              <h2 className="section-title">Pengaturan Operasional</h2>

              <div className="form-group">
                <label className="form-label">No. Telepon / WhatsApp Outlet</label>
                <input className="form-input" type="tel" value={outlet.phone ?? ''}
                  onChange={e => setOutlet(p => ({ ...p, phone: e.target.value }))} />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Jam Buka</label>
                  <input className="form-input" type="time" value={outlet.open_time ?? '07:00'}
                    onChange={e => setOutlet(p => ({ ...p, open_time: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Jam Tutup</label>
                  <input className="form-input" type="time" value={outlet.close_time ?? '22:00'}
                    onChange={e => setOutlet(p => ({ ...p, close_time: e.target.value }))} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Jumlah Meja Maksimum</label>
                <input className="form-input" type="number" min={1} max={200} value={outlet.max_table_number ?? 20}
                  onChange={e => setOutlet(p => ({ ...p, max_table_number: parseInt(e.target.value) || 20 }))} />
                <div className="input-hint">Customer bisa input nomor meja 1 – {outlet.max_table_number ?? 20}</div>
              </div>

              <div className="toggle-group">
                <label className="toggle-row">
                  <div className={`toggle-switch ${outlet.is_open ? 'on' : 'off'}`}
                    onClick={() => setOutlet(p => ({ ...p, is_open: !p.is_open }))}>
                    <div className="toggle-thumb" />
                  </div>
                  <div>
                    <div className="toggle-label">Status Outlet</div>
                    <div className="toggle-sub">{outlet.is_open ? '🟢 Buka — Customer bisa order' : '🔴 Tutup — Halaman order tidak aktif'}</div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* ── QR CODE ── */}
          {activeSection === 'qrcode' && (
            <div className="section-card">
              <h2 className="section-title">QR Code untuk Meja</h2>
              <p className="section-desc">
                Gunakan <strong>1 QR Code ini</strong> untuk semua meja di outletmu. Tempel di setiap meja — customer akan scan dan input nomor mejanya sendiri.
              </p>

              <div className="qr-url-box">
                <div className="qr-url-label">URL Halaman Order:</div>
                <div className="qr-url-value">{qrValue || 'Simpan pengaturan dulu'}</div>
                {qrValue && (
                  <button className="copy-btn" onClick={() => { navigator.clipboard.writeText(qrValue); alert('URL disalin!') }}>
                    📋 Salin URL
                  </button>
                )}
              </div>

              <div className="info-box" style={{ marginTop: 16 }}>
                <div className="info-icon">💡</div>
                <div>
                  <strong>Cara membuat QR Code:</strong><br/>
                  1. Salin URL di atas<br/>
                  2. Buka <a href="https://www.qr-code-generator.com" target="_blank" rel="noreferrer" style={{color: '#185FA5'}}>qr-code-generator.com</a> atau tools serupa<br/>
                  3. Paste URL dan generate<br/>
                  4. Download → Print → Tempel di setiap meja<br/>
                  <strong>Cukup 1 QR untuk semua meja!</strong>
                </div>
              </div>

              <div className="table-eg">
                <div className="table-eg-title">Contoh tulisan di meja:</div>
                <div className="table-eg-card">
                  <div className="table-eg-qr">📱 QR</div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>Scan untuk Pesan</div>
                    <div style={{ fontSize: 13, color: '#8B7355', marginTop: 2 }}>Meja ini: <strong>No. 05</strong></div>
                    <div style={{ fontSize: 11, color: '#B4B2A9', marginTop: 4 }}>Input nomor meja setelah scan</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 12px; }
        .page-title { font-size: 22px; font-weight: 800; }
        .page-sub { font-size: 13px; color: #8B7355; margin-top: 2px; }
        .save-btn { padding: 10px 20px; background: #2C1810; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
        .save-btn:disabled { opacity: 0.6; }
        .settings-layout { display: grid; grid-template-columns: 180px 1fr; gap: 20px; align-items: start; }
        .section-nav { display: flex; flex-direction: column; gap: 2px; background: white; border-radius: 14px; padding: 8px; border: 1px solid rgba(0,0,0,0.07); position: sticky; top: 80px; }
        .section-nav-btn { padding: 10px 12px; border: none; background: transparent; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; text-align: left; color: #8B7355; }
        .section-nav-btn.active { background: #2C1810; color: white; }
        .section-card { background: white; border-radius: 14px; padding: 24px; border: 1px solid rgba(0,0,0,0.07); }
        .section-title { font-size: 18px; font-weight: 800; margin-bottom: 6px; }
        .section-desc { font-size: 13px; color: #8B7355; margin-bottom: 20px; line-height: 1.5; }
        .form-group { margin-bottom: 16px; }
        .form-label { display: block; font-size: 11px; font-weight: 700; color: #8B7355; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
        .form-input { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1.5px solid rgba(0,0,0,0.1); font-size: 14px; font-family: inherit; outline: none; }
        .form-input:focus { border-color: #C8873A; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .input-hint { font-size: 12px; color: #8B7355; margin-top: 4px; }
        .logo-row { display: flex; align-items: center; gap: 16px; }
        .logo-preview { width: 56px; height: 56px; border-radius: 12px; object-fit: cover; border: 2px solid rgba(0,0,0,0.08); }
        .logo-placeholder { width: 56px; height: 56px; border-radius: 12px; background: #2C1810; color: white; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800; }
        .upload-btn { padding: 8px 16px; border-radius: 8px; border: 1.5px solid rgba(0,0,0,0.12); font-size: 13px; font-weight: 600; cursor: pointer; background: white; }
        .colors-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .color-pick-row { display: flex; align-items: center; gap: 8px; }
        .color-swatch { width: 36px; height: 36px; border-radius: 8px; border: 1.5px solid rgba(0,0,0,0.1); cursor: pointer; padding: 0; flex-shrink: 0; }
        .font-grid { display: flex; flex-direction: column; gap: 4px; }
        .font-btn { padding: 10px 14px; border-radius: 8px; border: 1.5px solid rgba(0,0,0,0.1); font-size: 14px; cursor: pointer; background: white; text-align: left; }
        .font-btn.selected { border-color: #C8873A; background: #FDF4E9; }
        .brand-preview { border-radius: 14px; padding: 20px; margin-top: 20px; }
        .bp-label { font-size: 11px; color: rgba(255,255,255,0.4); margin-bottom: 10px; font-weight: 600; }
        .bp-logo { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 800; color: white; margin-bottom: 8px; }
        .bp-name { font-size: 20px; font-weight: 800; color: white; }
        .bp-desc { font-size: 12px; color: rgba(255,255,255,0.55); margin-top: 4px; }
        .qris-upload-area { border-radius: 14px; overflow: hidden; margin-bottom: 20px; }
        .qris-preview-wrap { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 20px; background: #FAF7F4; border-radius: 14px; border: 1px solid rgba(0,0,0,0.08); }
        .qris-img { max-width: 240px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.08); }
        .change-qris-btn { padding: 8px 16px; border-radius: 8px; border: 1.5px solid rgba(0,0,0,0.12); font-size: 13px; font-weight: 600; cursor: pointer; background: white; }
        .qris-upload-empty { display: flex; flex-direction: column; align-items: center; padding: 48px 20px; border: 2px dashed rgba(0,0,0,0.12); border-radius: 14px; cursor: pointer; text-align: center; }
        .upload-icon { font-size: 40px; margin-bottom: 12px; }
        .upload-text { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
        .upload-hint { font-size: 12px; color: #8B7355; }
        .info-box { display: flex; gap: 12px; background: #E6F1FB; border-radius: 12px; padding: 14px 16px; font-size: 13px; color: #185FA5; line-height: 1.6; }
        .info-icon { font-size: 18px; flex-shrink: 0; }
        .toggle-group { border-top: 1px solid rgba(0,0,0,0.07); padding-top: 20px; margin-top: 8px; }
        .toggle-row { display: flex; align-items: center; gap: 16px; cursor: pointer; }
        .toggle-switch { width: 48px; height: 28px; border-radius: 14px; padding: 3px; cursor: pointer; flex-shrink: 0; transition: background 0.2s; }
        .toggle-switch.on { background: #1D9E75; }
        .toggle-switch.off { background: #B4B2A9; }
        .toggle-thumb { width: 22px; height: 22px; background: white; border-radius: 50%; transition: transform 0.2s; }
        .toggle-switch.on .toggle-thumb { transform: translateX(20px); }
        .toggle-label { font-size: 14px; font-weight: 700; }
        .toggle-sub { font-size: 12px; color: #8B7355; margin-top: 2px; }
        .qr-url-box { background: #FAF7F4; border-radius: 12px; padding: 16px; border: 1px solid rgba(0,0,0,0.08); }
        .qr-url-label { font-size: 11px; font-weight: 700; color: #8B7355; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
        .qr-url-value { font-size: 14px; font-weight: 600; color: #185FA5; word-break: break-all; margin-bottom: 10px; }
        .copy-btn { padding: 7px 14px; background: #2C1810; color: white; border: none; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; }
        .table-eg { margin-top: 24px; }
        .table-eg-title { font-size: 13px; font-weight: 700; color: #8B7355; margin-bottom: 10px; }
        .table-eg-card { background: white; border-radius: 12px; border: 2px solid rgba(0,0,0,0.08); padding: 16px; display: flex; gap: 14px; align-items: center; }
        .table-eg-qr { width: 60px; height: 60px; background: #F4F1ED; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }
        @media (max-width: 640px) {
          .settings-layout { grid-template-columns: 1fr; }
          .section-nav { flex-direction: row; flex-wrap: wrap; position: static; }
          .colors-row { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}
