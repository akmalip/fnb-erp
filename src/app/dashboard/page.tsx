'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getDashboardStats, getOrdersByOutlet } from '@/lib/supabase/queries'
import type { Order } from '@/types'

function formatRp(n: number) { return 'Rp ' + n.toLocaleString('id-ID') }
function timeAgo(s: string) {
  const d = Math.floor((Date.now() - new Date(s).getTime()) / 1000)
  if (d < 60) return `${d}s ago`
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  return `${Math.floor(d / 3600)}h ago`
}

const STATUS: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Waiting',   color: '#BA7517' },
  confirmed: { label: 'Confirmed', color: '#185FA5' },
  preparing: { label: 'Preparing', color: '#3B6D11' },
  ready:     { label: 'Ready',     color: '#0F6E56' },
  completed: { label: 'Completed', color: '#5F5E5A' },
  cancelled: { label: 'Cancelled', color: '#A32D2D' },
}

export default function DashboardPage() {
  const [stats, setStats] = useState({ revenueToday: 0, ordersToday: 0, totalCustomers: 0, pendingOrders: 0 })
  const [recent, setRecent] = useState<Order[]>([])
  const [outletId, setOutletId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const id = localStorage.getItem('fnb_outlet_id')
    if (!id) return
    setOutletId(id)
    Promise.all([getDashboardStats(id), getOrdersByOutlet(id, 5)]).then(([s, o]) => {
      setStats(s); setRecent(o); setLoading(false)
    })
  }, [])

  if (loading) return <div style={{ padding: 40, color: '#8B7355', textAlign: 'center' }}>Loading...</div>

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div>
      <h1 className="title">Overview</h1>
      <p className="sub">{today}</p>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat">
          <div className="stat-label">Revenue Today</div>
          <div className="stat-val">{formatRp(stats.revenueToday)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Orders Today</div>
          <div className="stat-val">{stats.ordersToday}</div>
        </div>
        <div className={`stat ${stats.pendingOrders > 0 ? 'hl' : ''}`}>
          <div className="stat-label">Pending Orders</div>
          <div className="stat-val">{stats.pendingOrders}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Total Customers</div>
          <div className="stat-val">{stats.totalCustomers.toLocaleString()}</div>
        </div>
      </div>

      {/* Quick actions */}
      <h2 className="section-title">Quick Actions</h2>
      <div className="quick-grid">
        <Link href="/dashboard/orders" className="qcard">
          <span className="qcard-icon">🧾</span>
          <span className="qcard-label">View Order Queue</span>
          {stats.pendingOrders > 0 && <span className="qbadge">{stats.pendingOrders}</span>}
        </Link>
        <Link href="/dashboard/menu" className="qcard">
          <span className="qcard-icon">📋</span>
          <span className="qcard-label">Manage Menu</span>
        </Link>
        <Link href="/dashboard/banners" className="qcard">
          <span className="qcard-icon">🖼</span>
          <span className="qcard-label">Edit Banners</span>
        </Link>
        <Link href="/dashboard/customers" className="qcard">
          <span className="qcard-icon">👥</span>
          <span className="qcard-label">View Customers</span>
        </Link>
      </div>

      {/* Recent orders */}
      <h2 className="section-title">Recent Orders</h2>
      {recent.length === 0 ? (
        <div className="empty">No orders yet today.</div>
      ) : (
        <div className="orders-list">
          {recent.map(o => {
            const st = STATUS[o.status] ?? { label: o.status, color: '#888' }
            return (
              <div key={o.id} className="orow">
                <div className="orow-l">
                  <div className="onum">#{o.order_number}</div>
                  <div className="ometa">Table {o.table_number} · {o.customer?.name ?? 'Guest'} · {timeAgo(o.created_at)}</div>
                </div>
                <div className="orow-r">
                  <div className="oamt">{formatRp(o.total_amount)}</div>
                  <div className="sbadge" style={{ color: st.color, background: st.color + '18' }}>{st.label}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <Link href="/dashboard/orders" className="see-all">View all orders →</Link>

      <style jsx>{`
        .title { font-size: 22px; font-weight: 800; margin-bottom: 4px; }
        .sub { font-size: 13px; color: #8B7355; margin-bottom: 24px; }
        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 28px; }
        .stat { background: white; border-radius: 14px; padding: 16px; border: 1px solid rgba(0,0,0,0.07); }
        .stat.hl { background: #FDF4E9; border-color: #C8873A; }
        .stat-label { font-size: 11px; color: #8B7355; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
        .stat-val { font-size: 22px; font-weight: 800; }
        .section-title { font-size: 15px; font-weight: 700; margin-bottom: 12px; }
        .quick-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 28px; }
        .qcard { background: white; border-radius: 14px; padding: 16px; border: 1px solid rgba(0,0,0,0.07); text-decoration: none; color: inherit; display: flex; flex-direction: column; gap: 8px; position: relative; transition: transform 0.1s; }
        .qcard:active { transform: scale(0.97); }
        .qcard-icon { font-size: 24px; }
        .qcard-label { font-size: 13px; font-weight: 600; }
        .qbadge { position: absolute; top: 12px; right: 12px; background: #E24B4A; color: white; font-size: 11px; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .empty { background: white; border-radius: 14px; padding: 32px; text-align: center; color: #8B7355; font-size: 14px; margin-bottom: 12px; }
        .orders-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
        .orow { background: white; border-radius: 12px; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; border: 1px solid rgba(0,0,0,0.07); gap: 12px; }
        .orow-l { flex: 1; min-width: 0; }
        .onum { font-size: 14px; font-weight: 700; }
        .ometa { font-size: 12px; color: #8B7355; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .orow-r { text-align: right; flex-shrink: 0; }
        .oamt { font-size: 14px; font-weight: 700; }
        .sbadge { display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; margin-top: 4px; }
        .see-all { display: block; text-align: center; color: #C8873A; font-size: 13px; font-weight: 600; text-decoration: none; margin-top: 8px; }
      `}</style>
    </div>
  )
}
