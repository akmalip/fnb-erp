'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/dashboard',           icon: '▤',  label: 'Overview',         group: 'Operasional' },
  { href: '/dashboard/orders',    icon: '🧾', label: 'Live Orders',       group: 'Operasional' },
  { href: '/dashboard/pos',       icon: '🖥', label: 'POS Kasir',         group: 'Operasional' },
  { href: '/dashboard/menu',      icon: '📋', label: 'Menu',              group: 'Operasional' },
  { href: '/dashboard/banners',   icon: '🖼', label: 'Banners & Promos',  group: 'Operasional' },
  { href: '/dashboard/finance',   icon: '💰', label: 'Keuangan',          group: 'Bisnis' },
  { href: '/dashboard/stock',     icon: '📦', label: 'Stok & Inventori',  group: 'Bisnis' },
  { href: '/dashboard/customers', icon: '👥', label: 'Pelanggan',         group: 'Bisnis' },
  { href: '/dashboard/settings',  icon: '⚙',  label: 'Settings',          group: 'Sistem' },
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
    <div className="layout">
      {/* ── Mobile Top Bar ── */}
      <header className="topbar">
        <button className="menu-btn" onClick={() => setSidebarOpen(o => !o)} aria-label="Menu">
          <span /><span /><span />
        </button>
        <span className="topbar-name">{outletName}</span>
        <button className="topbar-logout" onClick={handleLogout}>Sign out</button>
      </header>

      {/* ── Sidebar ── */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sb-header">
          <div className="sb-brand">FNB ERP</div>
          <div className="sb-outlet">{outletName}</div>
        </div>
        <nav className="sb-nav">
          {['Operasional', 'Bisnis', 'Sistem'].map(group => (
            <div key={group}>
              <div className="sb-group-label">{group}</div>
              {NAV.filter(n => n.group === group).map(n => {
                const active = n.href === '/dashboard' ? pathname === n.href : pathname.startsWith(n.href)
                return (
                  <Link key={n.href} href={n.href} className={`nav-item ${active ? 'active' : ''}`}
                    onClick={() => setSidebarOpen(false)}>
                    <span className="nav-icon">{n.icon}</span>
                    <span>{n.label}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
        <button className="sb-logout" onClick={handleLogout}>Sign out</button>
      </aside>

      {/* Overlay */}
      {sidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(false)} />}

      {/* ── Main ── */}
      <main className="main">{children}</main>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; background: #F4F1ED; color: #1A0F0A; }

        .layout { display: flex; flex-direction: column; min-height: 100vh; }

        /* Topbar (mobile only) */
        .topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px; background: white; border-bottom: 1px solid rgba(0,0,0,0.08);
          position: sticky; top: 0; z-index: 40;
        }
        .menu-btn {
          display: flex; flex-direction: column; gap: 5px; background: none; border: none; cursor: pointer; padding: 4px;
        }
        .menu-btn span { display: block; width: 20px; height: 2px; background: #1A0F0A; border-radius: 2px; }
        .topbar-name { font-size: 15px; font-weight: 700; }
        .topbar-logout { background: none; border: 1px solid rgba(0,0,0,0.12); border-radius: 8px; padding: 6px 12px; font-size: 13px; cursor: pointer; color: #8B7355; }

        /* Sidebar */
        .sidebar {
          position: fixed; left: -260px; top: 0; bottom: 0; width: 240px;
          background: #2C1810; z-index: 50; transition: left 0.25s ease;
          display: flex; flex-direction: column; overflow-y: auto;
        }
        .sidebar.open { left: 0; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 49; }

        .sb-header { padding: 24px 20px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .sb-brand { font-size: 11px; font-weight: 800; letter-spacing: 0.15em; color: #C8873A; margin-bottom: 4px; }
        .sb-outlet { font-size: 15px; font-weight: 700; color: white; }

        .sb-nav { flex: 1; padding: 12px; display: flex; flex-direction: column; gap: 2px; }
        .sb-group-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: rgba(255,255,255,0.25); padding: 12px 12px 4px; }
        .nav-item {
          display: flex; align-items: center; gap: 12px; padding: 10px 12px;
          border-radius: 10px; color: rgba(255,255,255,0.55); text-decoration: none;
          font-size: 14px; font-weight: 500; transition: all 0.15s;
        }
        .nav-item:hover { background: rgba(255,255,255,0.07); color: white; }
        .nav-item.active { background: rgba(200,135,58,0.18); color: #C8873A; }
        .nav-icon { font-size: 16px; width: 20px; text-align: center; }
        .sb-logout { margin: 12px 16px 20px; padding: 10px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.35); font-size: 13px; cursor: pointer; }

        .main { flex: 1; padding: 20px 16px 48px; width: 100%; }

        @media (min-width: 768px) {
          .layout { flex-direction: row; }
          .topbar { display: none; }
          .sidebar { position: sticky; left: 0; top: 0; height: 100vh; }
          .overlay { display: none !important; }
          .main { padding: 32px 36px 56px; }
        }
      `}</style>
    </div>
  )
}$
// deploy trigger
