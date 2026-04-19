'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef } from 'react'
import { getLiveOrders, getOrdersByOutlet, updateOrderStatus, confirmPayment } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/client'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import type { Order } from '@/types'

function formatRp(n: number) { return 'Rp ' + n.toLocaleString('id-ID') }
function formatTime(s: string) {
  return new Date(s).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}
function minutesAgo(s: string) {
  return Math.floor((Date.now() - new Date(s).getTime()) / 60000)
}

const STATUS: Record<string, { label: string; bg: string; color: string; next?: string; nextLabel?: string }> = {
  pending:   { label: 'Waiting',    bg: '#FAEEDA', color: '#BA7517', next: 'confirmed', nextLabel: 'Confirm Order' },
  confirmed: { label: 'Confirmed',  bg: '#E6F1FB', color: '#185FA5', next: 'preparing', nextLabel: 'Start Preparing' },
  preparing: { label: 'Preparing',  bg: '#EAF3DE', color: '#3B6D11', next: 'ready',     nextLabel: 'Mark as Ready' },
  ready:     { label: 'Ready',      bg: '#E1F5EE', color: '#0F6E56', next: 'completed', nextLabel: 'Complete Order' },
  completed: { label: 'Completed',  bg: '#F1EFE8', color: '#5F5E5A' },
  cancelled: { label: 'Cancelled',  bg: '#FCEBEB', color: '#A32D2D' },
}

const LIVE = ['pending', 'confirmed', 'preparing', 'ready']

export default function OrdersPage() {
  const [live, setLive] = useState<Order[]>([])
  const [history, setHistory] = useState<Order[]>([])
  const [outletId, setOutletId] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'live' | 'history'>('live')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [histFilter, setHistFilter] = useState('all')
  const [notifStatus, setNotifStatus] = useState<string>('unknown')
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const deferredPromptRef = useRef<any>(null)

  const { subscribe, showLocalNotification, getSubscriptionStatus, isSupported } = usePushNotifications()

  const loadLive = useCallback(async (id: string) => {
    const orders = await getLiveOrders(id)
    setLive(orders)
    return orders
  }, [])

  const loadHistory = useCallback(async (id: string) => {
    const all = await getOrdersByOutlet(id, 40)
    setHistory(all.filter(o => !LIVE.includes(o.status)))
  }, [])

  const refreshNotifStatus = useCallback(async () => {
    if (!isSupported) { setNotifStatus('unsupported'); return }
    const s = await getSubscriptionStatus()
    setNotifStatus(s.permission)
  }, [isSupported, getSubscriptionStatus])

  const handleEnableNotifications = async () => {
    const ok = await subscribe()
    await refreshNotifStatus()
    if (!ok) alert('Could not enable notifications. Please allow notifications for this site in your browser settings.')
  }

  // Play a short audio chime using Web Audio API (no file needed)
  const playChime = useCallback(() => {
    try {
      const ctx = new AudioContext()
      const notes = [880, 1100, 880]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.frequency.value = freq
        osc.type = 'sine'
        gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.12)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.12)
        osc.start(ctx.currentTime + i * 0.12)
        osc.stop(ctx.currentTime + i * 0.12 + 0.15)
      })
    } catch {}
  }, [])

  useEffect(() => {
    const id = localStorage.getItem('fnb_outlet_id')
    if (!id) return
    setOutletId(id)
    refreshNotifStatus()

    Promise.all([getLiveOrders(id), getOrdersByOutlet(id, 40)]).then(([lv, all]) => {
      setLive(lv)
      setHistory(all.filter(o => !LIVE.includes(o.status)))
      setLoading(false)
    })

    // PWA install prompt capture
    const handleInstall = (e: Event) => {
      e.preventDefault()
      deferredPromptRef.current = e
      setShowInstallBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handleInstall)

    // Supabase Realtime
    const sb = createClient()
    const channel = sb.channel(`orders:${id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'orders',
        filter: `outlet_id=eq.${id}`
      }, async (payload) => {
        await loadLive(id)
        loadHistory(id)

        if (payload.eventType === 'INSERT') {
          const o = payload.new as any
          if (LIVE.includes(o.status)) {
            playChime()
            if (Notification.permission === 'granted') {
              await showLocalNotification({
                title: `New Order — Table ${o.table_number}`,
                body: `#${o.order_number} · ${formatRp(o.total_amount)}`,
                orderId: o.id,
                tableNumber: o.table_number,
                orderNumber: o.order_number,
              })
            }
          }
        }
      })
      .subscribe()

    return () => {
      sb.removeChannel(channel)
      window.removeEventListener('beforeinstallprompt', handleInstall)
    }
  }, [loadLive, loadHistory, showLocalNotification, refreshNotifStatus, playChime])

  const handleStatusUpdate = async (order: Order, next: string) => {
    setUpdatingId(order.id)
    if (next === 'completed' && order.payment_status !== 'paid') await confirmPayment(order.id)
    await updateOrderStatus(order.id, next)
    await loadLive(outletId)
    setUpdatingId(null)
  }

  const handleCancel = async (order: Order) => {
    if (!confirm(`Cancel order ${order.order_number}?`)) return
    setUpdatingId(order.id)
    await updateOrderStatus(order.id, 'cancelled')
    await loadLive(outletId)
    setUpdatingId(null)
  }

  const handleInstallPWA = async () => {
    if (!deferredPromptRef.current) return
    deferredPromptRef.current.prompt()
    const { outcome } = await deferredPromptRef.current.userChoice
    if (outcome === 'accepted') setShowInstallBanner(false)
    deferredPromptRef.current = null
  }

  const pendingCount = live.filter(o => o.status === 'pending').length
  const displayedHistory = histFilter === 'all' ? history : history.filter(o => o.status === histFilter)

  if (loading) {
    return (
      <div className="loading-wrap">
        <div className="spinner" />
        <span>Loading orders...</span>
        <style jsx>{`
          .loading-wrap { display:flex; flex-direction:column; align-items:center; gap:12px; padding:60px; color:#8B7355; }
          .spinner { width:32px; height:32px; border:3px solid rgba(0,0,0,0.08); border-top-color:#C8873A; border-radius:50%; animation:spin 0.7s linear infinite; }
          @keyframes spin { to { transform:rotate(360deg); } }
        `}</style>
      </div>
    )
  }

  return (
    <div className="root">

      {/* PWA Install Banner */}
      {showInstallBanner && (
        <div className="install-banner">
          <div className="ib-text">
            <strong>Install as App</strong>
            <span>Get notifications even when browser is in background</span>
          </div>
          <div className="ib-actions">
            <button className="ib-yes" onClick={handleInstallPWA}>Install</button>
            <button className="ib-no" onClick={() => setShowInstallBanner(false)}>Later</button>
          </div>
        </div>
      )}

      {/* Notification Permission Banner */}
      {notifStatus === 'default' && isSupported && (
        <div className="notif-banner">
          <span>🔔</span>
          <span><strong>Enable push notifications</strong> so you never miss an incoming order</span>
          <button className="nb-btn" onClick={handleEnableNotifications}>Enable</button>
        </div>
      )}
      {notifStatus === 'denied' && (
        <div className="notif-banner denied">
          <span>🔕</span>
          <span>Notifications are blocked. Go to browser settings → allow notifications for this site.</span>
        </div>
      )}

      {/* Header */}
      <div className="header">
        <div>
          <h1 className="title">
            Live Orders
            {pendingCount > 0 && <span className="pending-badge">{pendingCount} pending</span>}
          </h1>
          <p className="subtitle">
            <span className="dot" /> Real-time updates
            {notifStatus === 'granted' && <span className="notif-on"> · 🔔 Notifications on</span>}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'live' ? 'active' : ''}`} onClick={() => setTab('live')}>
          Queue {live.length > 0 && <span className="tbadge">{live.length}</span>}
        </button>
        <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          History
        </button>
      </div>

      {/* ══ LIVE QUEUE ══ */}
      {tab === 'live' && (
        live.length === 0 ? (
          <div className="empty-q">
            <div className="eq-icon">✅</div>
            <div className="eq-title">All clear!</div>
            <div className="eq-sub">New orders will appear here automatically</div>
          </div>
        ) : (
          <div className="q-grid">
            {live.map(order => {
              const cfg = STATUS[order.status] ?? STATUS.pending
              const mins = minutesAgo(order.created_at)
              const urgent = mins >= 10 && order.status === 'pending'
              const busy = updatingId === order.id
              return (
                <div key={order.id} className={`ocard ${urgent ? 'urgent' : ''}`}>
                  <div className="oc-head">
                    <span className="oc-num">#{order.order_number}</span>
                    <span className="spill" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                  </div>
                  <div className="oc-meta">
                    <span>🪑 Table {order.table_number}</span>
                    <span>👤 {order.customer?.name ?? 'Guest'}</span>
                  </div>
                  <div className="oc-items">
                    {(order.order_items ?? []).map(item => (
                      <div key={item.id} className="oi-row">
                        <span className="oi-qty">{item.quantity}×</span>
                        <span className="oi-name">{item.item_name}</span>
                        {item.notes && <div className="oi-note">📝 {item.notes}</div>}
                      </div>
                    ))}
                  </div>
                  <div className="oc-foot">
                    <span className="oc-total">{formatRp(order.total_amount)}</span>
                    <span className={`oc-time ${urgent ? 'urgent' : ''}`}>{mins === 0 ? 'Just now' : `${mins}m ago`}</span>
                  </div>
                  {order.notes && <div className="oc-note">📝 {order.notes}</div>}
                  {order.payment_proof_url && order.payment_status === 'unpaid' && (
                    <a href={order.payment_proof_url} target="_blank" rel="noreferrer" className="proof-link">🖼 View payment proof</a>
                  )}
                  <div className="oc-actions">
                    {cfg.next && (
                      <button className="btn-main" disabled={busy} onClick={() => handleStatusUpdate(order, cfg.next!)}>
                        {busy ? '···' : cfg.nextLabel}
                      </button>
                    )}
                    <div className="oc-sec">
                      {order.payment_status === 'unpaid' ? (
                        <button className="btn-pay" onClick={() => confirmPayment(order.id).then(() => loadLive(outletId))}>💳 Paid</button>
                      ) : (
                        <span className="paid-tag">✅ Paid</span>
                      )}
                      <button className="btn-cancel" onClick={() => handleCancel(order)}>Cancel</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ══ HISTORY ══ */}
      {tab === 'history' && (
        <div>
          <div className="hist-filter">
            {['all', 'completed', 'cancelled'].map(s => (
              <button key={s} className={`fchip ${histFilter === s ? 'active' : ''}`} onClick={() => setHistFilter(s)}>
                {s === 'all' ? 'All' : s === 'completed' ? 'Completed' : 'Cancelled'}
              </button>
            ))}
          </div>
          {displayedHistory.length === 0 ? (
            <div className="empty-state">No orders in history yet.</div>
          ) : (
            <div className="hist-list">
              {displayedHistory.map(order => {
                const cfg = STATUS[order.status] ?? STATUS.completed
                return (
                  <div key={order.id} className="hrow">
                    <div className="hl">
                      <div className="h-num">#{order.order_number}</div>
                      <div className="h-meta">Table {order.table_number} · {order.customer?.name ?? 'Guest'} · {formatTime(order.created_at)}</div>
                      <div className="h-items">{(order.order_items ?? []).map(i => `${i.quantity}× ${i.item_name}`).join(', ')}</div>
                    </div>
                    <div className="hr">
                      <div className="h-total">{formatRp(order.total_amount)}</div>
                      <span className="spill sm" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                      <div className="h-pay">{order.payment_status === 'paid' ? '✅ Paid' : '⏳ Unpaid'}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .root { max-width: 960px; }

        /* Banners */
        .install-banner { background: #2C1810; color: white; border-radius: 14px; padding: 14px 16px; display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
        .ib-text { flex: 1; display: flex; flex-direction: column; gap: 2px; font-size: 13px; }
        .ib-text strong { font-size: 14px; }
        .ib-actions { display: flex; gap: 8px; }
        .ib-yes { padding: 8px 16px; background: #C8873A; color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .ib-no { padding: 8px 12px; background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; }

        .notif-banner { background: #FDF4E9; border: 1.5px solid #FAC775; border-radius: 12px; padding: 12px 14px; display: flex; align-items: center; gap: 10px; font-size: 13px; margin-bottom: 16px; flex-wrap: wrap; }
        .notif-banner.denied { background: #FCEBEB; border-color: #F7C1C1; color: #A32D2D; }
        .nb-btn { margin-left: auto; padding: 7px 14px; background: #2C1810; color: white; border: none; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; flex-shrink: 0; }

        /* Header */
        .header { margin-bottom: 16px; }
        .title { font-size: 22px; font-weight: 800; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .pending-badge { font-size: 13px; background: #FAEEDA; color: #BA7517; padding: 3px 10px; border-radius: 20px; font-weight: 700; }
        .subtitle { font-size: 13px; color: #8B7355; margin-top: 4px; display: flex; align-items: center; gap: 6px; }
        .dot { display: inline-block; width: 8px; height: 8px; background: #1D9E75; border-radius: 50%; animation: pulse 2s ease-in-out infinite; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        .notif-on { color: #1D9E75; font-weight: 600; }

        /* Tabs */
        .tabs { display: flex; gap: 4px; background: white; border-radius: 12px; padding: 4px; margin-bottom: 20px; border: 1px solid rgba(0,0,0,0.07); width: fit-content; }
        .tab { padding: 8px 20px; border: none; background: transparent; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; color: #8B7355; display: flex; align-items: center; gap: 8px; }
        .tab.active { background: #2C1810; color: white; }
        .tbadge { background: #E24B4A; color: white; font-size: 11px; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }

        /* Empty */
        .empty-q { background: white; border-radius: 16px; padding: 60px 20px; text-align: center; border: 1px solid rgba(0,0,0,0.07); }
        .eq-icon { font-size: 52px; margin-bottom: 12px; }
        .eq-title { font-size: 18px; font-weight: 800; margin-bottom: 6px; }
        .eq-sub { font-size: 13px; color: #8B7355; }
        .empty-state { background: white; border-radius: 14px; padding: 40px; text-align: center; color: #8B7355; }

        /* Grid — 1 col mobile, 2 tablet, 3 desktop */
        .q-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
        @media (min-width: 560px) { .q-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 860px) { .q-grid { grid-template-columns: repeat(3, 1fr); } }

        /* Order card */
        .ocard { background: white; border-radius: 16px; padding: 16px; border: 2px solid rgba(0,0,0,0.07); display: flex; flex-direction: column; }
        .ocard.urgent { border-color: #F09595; background: #FFFBFB; }

        .oc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .oc-num { font-size: 16px; font-weight: 800; }
        .spill { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; }
        .spill.sm { font-size: 10px; padding: 3px 8px; }

        .oc-meta { display: flex; gap: 10px; font-size: 12px; color: #5F5E5A; margin-bottom: 10px; flex-wrap: wrap; }
        .oc-items { border-top: 1px solid rgba(0,0,0,0.07); padding: 10px 0; margin-bottom: 10px; display: flex; flex-direction: column; gap: 4px; }
        .oi-row { font-size: 13px; display: flex; flex-wrap: wrap; gap: 4px; align-items: baseline; }
        .oi-qty { font-weight: 800; color: #C8873A; min-width: 22px; }
        .oi-note { width: 100%; font-size: 11px; color: #BA7517; background: #FDF4E9; border-radius: 6px; padding: 3px 8px; }

        .oc-foot { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .oc-total { font-size: 16px; font-weight: 800; color: #C8873A; }
        .oc-time { font-size: 12px; color: #8B7355; }
        .oc-time.urgent { color: #E24B4A; font-weight: 700; }

        .oc-note { font-size: 12px; color: #BA7517; background: #FAEEDA; border-radius: 8px; padding: 6px 10px; margin-bottom: 10px; }
        .proof-link { display: block; font-size: 12px; font-weight: 600; color: #185FA5; text-decoration: none; margin-bottom: 10px; }

        .oc-actions { border-top: 1px solid rgba(0,0,0,0.07); padding-top: 12px; display: flex; flex-direction: column; gap: 8px; margin-top: auto; }
        .btn-main { width: 100%; padding: 13px; border-radius: 10px; background: #2C1810; color: white; border: none; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .btn-main:disabled { opacity: 0.5; cursor: not-allowed; }
        .oc-sec { display: flex; gap: 8px; }
        .btn-pay { flex: 1; padding: 9px; border-radius: 10px; background: #EAF3DE; color: #3B6D11; border: 1px solid #C0DD97; font-size: 13px; font-weight: 700; cursor: pointer; }
        .btn-cancel { padding: 9px 12px; border-radius: 10px; background: #FCEBEB; color: #A32D2D; border: 1px solid #F7C1C1; font-size: 13px; font-weight: 700; cursor: pointer; }
        .paid-tag { flex: 1; padding: 9px; border-radius: 10px; background: #EAF3DE; color: #3B6D11; font-size: 12px; font-weight: 700; text-align: center; }

        /* History */
        .hist-filter { display: flex; gap: 8px; margin-bottom: 16px; }
        .fchip { padding: 6px 16px; border-radius: 20px; border: 1.5px solid rgba(0,0,0,0.1); font-size: 13px; font-weight: 600; cursor: pointer; background: white; color: #8B7355; }
        .fchip.active { background: #2C1810; color: white; border-color: #2C1810; }
        .hist-list { display: flex; flex-direction: column; gap: 8px; }
        .hrow { background: white; border-radius: 12px; padding: 14px 16px; display: flex; justify-content: space-between; gap: 12px; border: 1px solid rgba(0,0,0,0.07); }
        .hl { flex: 1; min-width: 0; }
        .h-num { font-size: 14px; font-weight: 800; margin-bottom: 2px; }
        .h-meta { font-size: 12px; color: #8B7355; margin-bottom: 3px; }
        .h-items { font-size: 12px; color: #5F5E5A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .hr { text-align: right; flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
        .h-total { font-size: 15px; font-weight: 800; color: #C8873A; }
        .h-pay { font-size: 11px; color: #5F5E5A; }
      `}</style>
    </div>
  )
}
