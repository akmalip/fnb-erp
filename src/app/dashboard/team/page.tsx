'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TeamMember {
  id: string; email: string; role: 'owner' | 'manager' | 'kasir' | 'staff'
  name?: string; created_at?: string; user_id?: string
}

const ROLES = [
  { value: 'owner', label: 'Owner', color: '#2C1810', desc: 'Akses penuh semua fitur' },
  { value: 'manager', label: 'Manager', color: '#2C4A7C', desc: 'Semua fitur kecuali settings & keuangan sensitif' },
  { value: 'kasir', label: 'Kasir', color: '#C8873A', desc: 'POS, Live Orders, Menu view' },
  { value: 'staff', label: 'Staff', color: '#6B7280', desc: 'Live Orders view only' },
]

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [outletId, setOutletId] = useState('')
  const [myRole, setMyRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'kasir' | 'staff' | 'manager'>('kasir')
  const [invitePassword, setInvitePassword] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const sb = createClient()

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    const id = localStorage.getItem('fnb_outlet_id') || ''
    const role = localStorage.getItem('fnb_outlet_role') || 'owner'
    setOutletId(id)
    setMyRole(role)
    if (id) loadTeam(id)
  }, [])

  const loadTeam = async (id: string) => {
    setLoading(true)
    const { data } = await sb.from('outlet_users')
      .select('*, user:user_id(email)')
      .eq('outlet_id', id)
    setMembers((data || []).map((m: any) => ({
      id: m.id, email: m.user?.email || m.email || '—',
      role: m.role, name: m.name, created_at: m.created_at, user_id: m.user_id
    })))
    setLoading(false)
  }

  const createAccount = async () => {
    if (!inviteEmail || !invitePassword || !inviteName) return
    setSaving(true)
    try {
      // Create user via Supabase auth (requires service role in production)
      // For now: create via signUp (will send confirmation email)
      const { data, error } = await sb.auth.signUp({
        email: inviteEmail,
        password: invitePassword,
        options: { data: { full_name: inviteName } }
      })

      if (error) { showToast('❌ ' + error.message); setSaving(false); return }
      if (!data.user) { showToast('❌ Gagal buat akun'); setSaving(false); return }

      // Add to outlet_users
      const { error: ouError } = await sb.from('outlet_users').insert({
        outlet_id: outletId,
        user_id: data.user.id,
        role: inviteRole,
        name: inviteName,
        email: inviteEmail
      })

      if (ouError) { showToast('❌ Gagal tambah ke tim: ' + ouError.message); setSaving(false); return }

      showToast('✅ Akun berhasil dibuat! Email konfirmasi dikirim ke ' + inviteEmail)
      setShowInvite(false)
      setInviteEmail(''); setInvitePassword(''); setInviteName(''); setInviteRole('kasir')
      loadTeam(outletId)
    } catch (e) {
      showToast('❌ Error: ' + String(e))
    }
    setSaving(false)
  }

  const updateRole = async (memberId: string, newRole: string) => {
    await sb.from('outlet_users').update({ role: newRole }).eq('id', memberId)
    showToast('✅ Role diupdate')
    loadTeam(outletId)
  }

  const removeMember = async (memberId: string) => {
    if (!confirm('Hapus anggota ini dari tim?')) return
    await sb.from('outlet_users').delete().eq('id', memberId)
    showToast('✅ Anggota dihapus')
    loadTeam(outletId)
  }

  const getRoleStyle = (role: string) => {
    const r = ROLES.find(x => x.value === role)
    return { background: (r?.color || '#6B7280') + '15', color: r?.color || '#6B7280' }
  }

  if (myRole !== 'owner' && myRole !== 'manager') {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#8B7355' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Akses Terbatas</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>Hanya Owner dan Manager yang bisa kelola tim.</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Tim & Akses</h1>
          <p style={{ fontSize: 13, color: '#8B7355' }}>Kelola akun login dan hak akses setiap anggota tim</p>
        </div>
        {myRole === 'owner' && (
          <button onClick={() => setShowInvite(true)}
            style={{ padding: '9px 18px', borderRadius: 10, background: '#C8873A', border: 'none', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Tambah Anggota
          </button>
        )}
      </div>

      {/* Role legend */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 24 }}>
        {ROLES.map(r => (
          <div key={r.value} style={{ background: 'white', borderRadius: 12, padding: '12px 14px', border: `1px solid ${r.color}25` }}>
            <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, ...getRoleStyle(r.value), marginBottom: 6 }}>{r.label}</span>
            <div style={{ fontSize: 12, color: '#8B7355', lineHeight: 1.4 }}>{r.desc}</div>
          </div>
        ))}
      </div>

      {/* Team table */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid rgba(0,0,0,0.07)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#8B7355' }}>Loading...</div>
        ) : members.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#8B7355' }}>Belum ada anggota tim</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr style={{ background: '#FAF7F4' }}>
                {['Nama', 'Email', 'Role', 'Bergabung', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left' as const, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.07em', color: '#8B7355', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F0E8DF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: '#C8873A' }}>
                        {(m.name || m.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: '#8B7355' }}>{m.email}</td>
                  <td style={{ padding: '13px 16px' }}>
                    {myRole === 'owner' && m.role !== 'owner' ? (
                      <select value={m.role} onChange={e => updateRole(m.id, e.target.value)}
                        style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)', fontSize: 12, fontFamily: 'inherit', outline: 'none', background: 'white', fontWeight: 600, cursor: 'pointer', ...getRoleStyle(m.role) }}>
                        {ROLES.filter(r => r.value !== 'owner').map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, ...getRoleStyle(m.role) }}>
                        {ROLES.find(r => r.value === m.role)?.label || m.role}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 12, color: '#8B7355' }}>
                    {m.created_at ? new Date(m.created_at).toLocaleDateString('id-ID') : '—'}
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    {myRole === 'owner' && m.role !== 'owner' && (
                      <button onClick={() => removeMember(m.id)}
                        style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid rgba(224,82,82,0.3)', background: 'white', color: '#E24B4A', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Hapus
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create account modal */}
      {showInvite && (
        <div onClick={e => e.target === e.currentTarget && setShowInvite(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420 }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Tambah Anggota Tim</div>
            <div style={{ fontSize: 13, color: '#8B7355', marginBottom: 20 }}>Buat akun login untuk anggota tim baru</div>

            {[
              { label: 'Nama Lengkap', key: 'name', value: inviteName, setter: setInviteName, placeholder: 'cth: Budi Santoso' },
              { label: 'Email', key: 'email', value: inviteEmail, setter: setInviteEmail, placeholder: 'cth: budi@roemari.com', type: 'email' },
              { label: 'Password', key: 'password', value: invitePassword, setter: setInvitePassword, placeholder: 'Minimal 6 karakter', type: 'password' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase' as const, display: 'block', marginBottom: 5 }}>{f.label}</label>
                <input value={f.value} onChange={e => f.setter(e.target.value)} type={(f as any).type || 'text'} placeholder={f.placeholder}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
              </div>
            ))}

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase' as const, display: 'block', marginBottom: 5 }}>Role</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {ROLES.filter(r => r.value !== 'owner').map(r => (
                  <button key={r.value} onClick={() => setInviteRole(r.value as any)}
                    style={{ padding: '8px', borderRadius: 9, border: '1.5px solid', borderColor: inviteRole === r.value ? r.color : 'rgba(0,0,0,0.1)', background: inviteRole === r.value ? r.color + '15' : 'white', color: inviteRole === r.value ? r.color : '#8B7355', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {r.label}<br/><span style={{ fontSize: 10, fontWeight: 400, opacity: 0.8 }}>{r.desc.split(' ').slice(0,3).join(' ')}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: '#FFF8F0', borderRadius: 10, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: '#8B7355', borderLeft: '3px solid #C8873A' }}>
              💡 Email konfirmasi akan dikirim ke {inviteEmail || 'email anggota'}. Mereka perlu konfirmasi sebelum bisa login.
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowInvite(false)} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: 'white', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', color: '#8B7355', fontWeight: 600 }}>Batal</button>
              <button onClick={createAccount} disabled={saving || !inviteEmail || !invitePassword || !inviteName}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#C8873A', color: 'white', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Membuat...' : 'Buat Akun'}
              </button>
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
