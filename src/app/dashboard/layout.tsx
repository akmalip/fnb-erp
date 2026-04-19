'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import './dashboard.css'

const NAV = [
  { href: '/dashboard',           icon: '▤',  label: 'Overview',        group: 'Operasional' },
  { href: '/dashboard/orders',    icon: '🧾', label: 'Live Orders',      group: 'Operasional' },
  { href: '/dashboard/pos',       icon: '🖥', label: 'POS Kasir',        group: 'Operasional' },
  { href: '/dashboard/menu',      icon: '📋', label: 'Menu',             group: 'Operasional' },
  { href: '/dashboard/banners',   icon: '🖼', label: 'Banners & Promos', group: 'Operasional' },
  { href: '/dashboard/promos',    icon: '🏷️', label: 'Promo & Diskon',  group: 'Operasional' },
  { href: '/dashboard/finance',   icon: '💰', label: 'Keuangan',         group: 'Bisnis' },
  { href: '/dashboard/stock',     icon: '📦', label: 'Stok & Inventori', group: 'Bisnis' },
  { href: '/dashboard/customers', icon: '👥', label: 'Pelanggan',        group: 'Bisnis' },
  { href: '/dashboard/team',      icon: '👤', label: 'Tim & Akses',      group: 'Sistem' },
  { href: '/dashboard/settings',  icon: '⚙',  label: 'Settings',        group: 'Sistem' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [outletName, setOutletName] = useState('Dashboard')

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/login')
    })
    const cached = localStorage.getItem('fnb_outlet_name')
    if (cached) setOutletName(cached)
  }, [])

  const handleLogout = async () => {
    await createClient().auth.signOut()
    router.push('/login')
  }

  return (
    <div className="db-layout">
      {/* Mobile Top Bar */}
      <header className="db-topbar">
        <button className="db-menu-btn" onClick={() => setSidebarOpen(o => !o)} aria-label="Menu">
          <span /><span /><span />
        </button>
        <span className="db-topbar-name">{outletName}</span>
        <button className="db-topbar-logout" onClick={handleLogout}>Sign out</button>
      </header>

      {/* Sidebar */}
      <aside className={`db-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="db-sb-header">
          <div className="db-sb-brand">FNB ERP</div>
          <div className="db-sb-outlet">{outletName}</div>
        </div>
        <nav className="db-sb-nav">
          {['Operasional', 'Bisnis', 'Sistem'].map(group => (
            <div key={group}>
              <div className="db-sb-group-label">{group}</div>
              {NAV.filter(n => n.group === group).map(n => {
                const active = n.href === '/dashboard' ? pathname === n.href : pathname.startsWith(n.href)
                return (
                  <Link key={n.href} href={n.href} className={`db-nav-item ${active ? 'active' : ''}`}
                    onClick={() => setSidebarOpen(false)}>
                    <span className="db-nav-icon">{n.icon}</span>
                    <span>{n.label}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
        <button className="db-sb-logout" onClick={handleLogout}>Sign out</button>
      </aside>

      {sidebarOpen && <div className="db-overlay" onClick={() => setSidebarOpen(false)} />}

      <main className="db-main">{children}</main>
      <div style={{ position: 'fixed', bottom: 12, right: 16, fontSize: 11, color: 'rgba(0,0,0,0.25)', zIndex: 10, pointerEvents: 'auto' }}>
        Powered by{' '}
        <a href="https://hallogroup.id" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(0,0,0,0.35)', textDecoration: 'none', fontWeight: 600 }}>
          Hallo Group
        </a>
      </div>
    </div>
  )
}
