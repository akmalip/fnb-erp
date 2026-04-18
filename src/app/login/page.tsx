'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const sb = createClient()

    const { data, error: authError } = await sb.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      // Step 1: get outlet_id from outlet_users
      const { data: ouData, error: ouError } = await sb
        .from('outlet_users')
        .select('outlet_id, role')
        .eq('user_id', data.user.id)
        .not('outlet_id', 'is', null)
        .limit(1)

      if (ouError || !ouData || ouData.length === 0) {
        setError('No outlet found for this account. Please contact admin.')
        setLoading(false)
        return
      }

      const outletId = ouData[0].outlet_id

      // Step 2: get outlet details
      const { data: outlet, error: outletError } = await sb
        .from('outlets')
        .select('id, slug, name')
        .eq('id', outletId)
        .single()

      if (outlet) {
        localStorage.setItem('fnb_outlet_id', outlet.id)
        localStorage.setItem('fnb_outlet_slug', outlet.slug)
        localStorage.setItem('fnb_outlet_name', outlet.name)
      }

      router.push('/dashboard')
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF7F4', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380, background: 'white', borderRadius: 20, padding: 32, border: '1px solid rgba(0,0,0,0.08)' }}>
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.15em', color: '#C8873A', marginBottom: 6 }}>FNB ERP</div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Sign In</h1>
          <p style={{ fontSize: 13, color: '#8B7355', marginTop: 4 }}>Dashboard access for outlet owners</p>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
              placeholder="owner@yourcafe.com" />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Password</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
              placeholder="••••••••" />
          </div>
          {error && <div style={{ fontSize: 13, color: '#E24B4A', marginBottom: 14, background: '#FCEBEB', borderRadius: 8, padding: '8px 12px' }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: 14, borderRadius: 12, background: '#2C1810', color: 'white', border: 'none', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily: 'inherit' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
