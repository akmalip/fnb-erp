'use client'

import { useEffect, useState, useCallback } from 'react'
import { getLiveOrders, getOrdersByOutlet, updateOrderStatus, confirmPayment } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/types'

function formatRp(n: number) { return 'Rp ' + n.toLocaleString('id-ID') }
function formatTime(s: string) {
  return new Date(s).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}
function minutesAgo(s: string) {
  return Math.floor((Date.now() - new Date(s).getTime()) / 60000)
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; next?: string; nextLabel?: string }> = {
  pending:   { label: 'Menunggu',  bg: '#FAEEDA', color: '#BA7517', next: 'confirmed', nextLabel: 'Konfirmasi' },
  confirmed: { label: 'Dikonfirm', bg: '#E6F1FB', color: '#185FA5', next: 'preparing', nextLabel: 'Mulai Proses' },
  preparing: { label: 'Diproses',  bg: '#EAF3DE', color: '#3B6D11', next: 'ready',     nextLabel: 'Siap Diambil' },
  ready:     { label: 'Siap',      bg: '#E1F5EE', color: '#0F6E56', next: 'completed', nextLabel: 'Selesai' },
  completed: { label: 'Selesai',   bg: '#F1EFE8', color: '#5F5E5A' },
  cancelled: { label: 'Batal',     bg: '#FCEBEB', color: '#A32D2D' },
}

const LIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready']

export default function OrdersPage() {
  const [liveOrders, setLiveOrders] = useState<Order[]>([])
  const [historyOrders, setHistoryOrders] = useState<Order[]>([])
  const [outletId, setOutletId] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'live' | 'history'>('live')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [soundEnabled, setSoundEnabled] = useState(true)

  const loadLive = useCallback(async (id: string) => {
    const orders = await getLiveOrders(id)
    setLiveOrders(orders)
  }, [])

  const loadHistory = useCallback(async (id: string) => {
    const orders = await getOrdersByOutlet(id, 30)
    setHistoryOrders(orders.filter(o => !LIVE_STATUSES.includes(o.status)))
  }, [])

  useEffect(() => {
    const id = localStorage.getItem('fnb_outlet_id')
    if (!id) return
    setOutletId(id)

    Promise.all([getLiveOrders(id), getOrdersByOutlet(id, 30)]).then(([live, all]) => {
      setLiveOrders(live)
      setHistoryOrders(all.filter(o => !LIVE_STATUSES.includes(o.status)))
      setLoading(false)
    })

    // Realtime subscription
    const sb = createClient()
    const channel = sb.channel('orders-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `outlet_id=eq.${id}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          // Play sound on new order
          if (soundEnabled) {
            try { new Audio('/sounds/new-order.mp3').play() } catch {}
          }
        }
        // Refresh live orders on any change
        loadLive(id)
        loadHistory(id)
      })
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [loadLive, loadHistory, soundEnabled])

  const handleStatusUpdate = async (order: Order, newStatus: string) => {
    setUpdatingId(order.id)
    if (newStatus === 'completed' && order.payment_status !== 'paid') {
      await confirmPayment(order.id)
    }
    await updateOrderStatus(order.id, newStatus)
    await loadLive(outletId)
    setUpdatingId(null)
    if (selectedOrder?.id === order.id) {
      setSelectedOrder(prev => prev ? { ...prev, status: newStatus as any } : null)
    }
  }

  const handleCancel = async (order: Order) => {
    if (!confirm(`Batalkan pesanan ${order.order_number}?`)) return
    setUpdatingId(order.id)
    await updateOrderStatus(order.id, 'cancelled')
    await loadLive(outletId)
    setUpdatingId(null)
    if (selectedOrder?.id === order.id) setSelectedOrder(null)
  }

  const displayedHistory = filterStatus === 'all'
    ? historyOrders
    : historyOrders.filter(o => o.status === filterStatus)

  const pendingCount = liveOrders.filter(o => o.status === 'pending').length

  if (loading) return <div style={{ padding: 40, color: '#8B7355', textAlign: 'center' }}>Memuat pesanan...</div>

  return (
    <div className="orders-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Pesanan Live
            {pendingCount > 0 && <span className="pending-indicator">{pendingCount} menunggu</span>}
          </h1>
          <p className="page-sub">Realtime — otomatis update saat ada pesanan masuk</p>
        </div>
        <label className="sound-toggle">
          <input type="checkbox" checked={soundEnabled} onChange={e => setSoundEnabled(e.target.checked)} />
          <span>🔔 Notif Suara</span>
        </label>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'live' ? 'active' : ''}`} onClick={() => setActiveTab('live')}>
          Live Queue {liveOrders.length > 0 && <span className="tab-count">{liveOrders.length}</span>}
        </button>
        <button className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          Riwayat
        </button>
      </div>

      {/* ── LIVE QUEUE ── */}
      {activeTab === 'live' && (
        <div>
          {liveOrders.length === 0 ? (
            <div className="empty-live">
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Semua pesanan beres!</div>
              <div style={{ color: '#8B7355', fontSize: 14 }}>Pesanan baru akan muncul di sini secara otomatis</div>
            </div>
          ) : (
            <div className="live-grid">
              {liveOrders.map(order => {
                const conf = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
                const mins = minutesAgo(order.created_at)
                const isUrgent = mins >= 10 && order.status === 'pending'
                return (
                  <div
                    key={order.id}
                    className={`order-card ${isUrgent ? 'urgent' : ''} ${selectedOrder?.id === order.id ? 'selected' : ''}`}
                    onClick={() => setSelectedOrder(order === selectedOrder ? null : order)}
                  >
                    <div className="card-top">
                      <div className="card-order-number">#{order.order_number}</div>
                      <div className="status-pill" style={{ background: conf.bg, color: conf.color }}>{conf.label}</div>
                    </div>
                    <div className="card-meta">
                      <span>🪑 Meja {order.table_number}</span>
                      <span>👤 {order.customer?.name ?? 'Tamu'}</span>
                    </div>
                    <div className="card-items">
                      {(order.order_items ?? []).slice(0, 3).map(item => (
                        <div key={item.id} className="card-item">
                          <span>{item.quantity}× {item.item_name}</span>
                          {item.notes && <span className="item-note">📝 {item.notes}</span>}
                        </div>
                      ))}
                      {(order.order_items?.length ?? 0) > 3 && (
                        <div className="card-item more">+{(order.order_items?.length ?? 0) - 3} item lainnya</div>
                      )}
                    </div>
                    <div className="card-bottom">
                      <div className="card-total">{formatRp(order.total_amount)}</div>
                      <div className={`card-time ${isUrgent ? 'urgent-time' : ''}`}>{mins}m lalu</div>
                    </div>
                    {order.notes && <div className="card-note">📝 {order.notes}</div>}

                    {/* Action buttons */}
                    <div className="card-actions" onClick={e => e.stopPropagation()}>
                      {conf.next && (
                        <button
                          className="action-primary"
                          disabled={updatingId === order.id}
                          onClick={() => handleStatusUpdate(order, conf.next!)}
                        >
                          {updatingId === order.id ? '...' : conf.nextLabel}
                        </button>
                      )}
                      {order.payment_status === 'unpaid' && (
                        <button className="action-pay"
                          onClick={() => confirmPayment(order.id).then(() => loadLive(outletId))}>
                          💳 Konfirmasi Bayar
                        </button>
                      )}
                      <button className="action-cancel" onClick={() => handleCancel(order)}>Batal</button>
                    </div>

                    {/* Payment proof */}
                    {order.payment_proof_url && (
                      <a href={order.payment_proof_url} target="_blank" rel="noreferrer" className="proof-link"
                        onClick={e => e.stopPropagation()}>
                        🖼 Lihat Bukti Bayar
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY ── */}
      {activeTab === 'history' && (
        <div>
          <div className="history-filter">
            {['all', 'completed', 'cancelled'].map(s => (
              <button key={s} className={`filter-chip ${filterStatus === s ? 'active' : ''}`} onClick={() => setFilterStatus(s)}>
                {s === 'all' ? 'Semua' : s === 'completed' ? 'Selesai' : 'Dibatalkan'}
              </button>
            ))}
          </div>

          {displayedHistory.length === 0 ? (
            <div className="empty-state">Belum ada riwayat pesanan.</div>
          ) : (
            <div className="history-list">
              {displayedHistory.map(order => {
                const conf = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.completed
                return (
                  <div key={order.id} className="history-row">
                    <div className="history-left">
                      <div className="history-number">#{order.order_number}</div>
                      <div className="history-detail">
                        Meja {order.table_number} · {order.customer?.name ?? 'Tamu'} · {formatTime(order.created_at)}
                      </div>
                      <div className="history-items">
                        {(order.order_items ?? []).map(i => `${i.quantity}× ${i.item_name}`).join(', ')}
                      </div>
                    </div>
                    <div className="history-right">
                      <div className="history-total">{formatRp(order.total_amount)}</div>
                      <div className="status-pill sm" style={{ background: conf.bg, color: conf.color }}>{conf.label}</div>
                      <div className="history-payment">
                        {order.payment_status === 'paid' ? '✅ Lunas' : '⏳ Belum Bayar'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .orders-page { max-width: 900px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 12px; }
        .page-title { font-size: 22px; font-weight: 800; display: flex; align-items: center; gap: 10px; }
        .pending-indicator { font-size: 13px; background: #FAEEDA; color: #BA7517; padding: 3px 10px; border-radius: 20px; font-weight: 700; }
        .page-sub { font-size: 13px; color: #8B7355; margin-top: 2px; }
        .sound-toggle { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
        .tabs { display: flex; gap: 4px; background: white; border-radius: 12px; padding: 4px; margin-bottom: 20px; border: 1px solid rgba(0,0,0,0.07); width: fit-content; }
        .tab { padding: 8px 20px; border: none; background: transparent; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; color: #8B7355; display: flex; align-items: center; gap: 8px; }
        .tab.active { background: #2C1810; color: white; }
        .tab-count { background: #E24B4A; color: white; font-size: 11px; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .empty-live { background: white; border-radius: 16px; padding: 60px 20px; text-align: center; }
        .live-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
        .order-card {
          background: white; border-radius: 16px; padding: 16px; border: 2px solid rgba(0,0,0,0.07);
          cursor: pointer; transition: border-color 0.15s, transform 0.1s;
        }
        .order-card:hover { border-color: rgba(0,0,0,0.15); }
        .order-card.selected { border-color: #C8873A; }
        .order-card.urgent { border-color: #F7C1C1; background: #FFFAFA; }
        .card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .card-order-number { font-size: 16px; font-weight: 800; }
        .status-pill { font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 20px; }
        .status-pill.sm { font-size: 11px; padding: 3px 8px; }
        .card-meta { display: flex; gap: 12px; font-size: 12px; color: #8B7355; margin-bottom: 10px; }
        .card-items { border-top: 1px solid rgba(0,0,0,0.07); padding-top: 10px; margin-bottom: 10px; display: flex; flex-direction: column; gap: 4px; }
        .card-item { font-size: 13px; font-weight: 500; }
        .card-item.more { color: #8B7355; font-size: 12px; }
        .item-note { display: block; font-size: 11px; color: #BA7517; margin-left: 16px; }
        .card-bottom { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .card-total { font-size: 16px; font-weight: 800; color: #C8873A; }
        .card-time { font-size: 12px; color: #8B7355; }
        .card-time.urgent-time { color: #E24B4A; font-weight: 700; }
        .card-note { font-size: 12px; color: #BA7517; background: #FAEEDA; border-radius: 8px; padding: 6px 10px; margin-bottom: 10px; }
        .card-actions { display: flex; flex-wrap: wrap; gap: 6px; border-top: 1px solid rgba(0,0,0,0.07); padding-top: 12px; }
        .action-primary { flex: 1; padding: 10px; border-radius: 10px; background: #2C1810; color: white; border: none; font-size: 13px; font-weight: 700; cursor: pointer; }
        .action-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .action-pay { padding: 8px 10px; border-radius: 10px; background: #EAF3DE; color: #3B6D11; border: 1px solid #C0DD97; font-size: 12px; font-weight: 700; cursor: pointer; }
        .action-cancel { padding: 8px 10px; border-radius: 10px; background: #FCEBEB; color: #A32D2D; border: 1px solid #F7C1C1; font-size: 12px; font-weight: 700; cursor: pointer; }
        .proof-link { display: block; text-align: center; color: #185FA5; font-size: 12px; font-weight: 600; margin-top: 8px; text-decoration: none; }
        .history-filter { display: flex; gap: 8px; margin-bottom: 16px; }
        .filter-chip { padding: 6px 16px; border-radius: 20px; border: 1.5px solid rgba(0,0,0,0.1); font-size: 13px; font-weight: 600; cursor: pointer; background: white; color: #8B7355; }
        .filter-chip.active { background: #2C1810; color: white; border-color: #2C1810; }
        .empty-state { background: white; border-radius: 14px; padding: 40px; text-align: center; color: #8B7355; }
        .history-list { display: flex; flex-direction: column; gap: 8px; }
        .history-row { background: white; border-radius: 12px; padding: 14px 16px; display: flex; justify-content: space-between; align-items: flex-start; border: 1px solid rgba(0,0,0,0.07); gap: 12px; }
        .history-left { flex: 1; min-width: 0; }
        .history-number { font-size: 14px; font-weight: 800; margin-bottom: 2px; }
        .history-detail { font-size: 12px; color: #8B7355; margin-bottom: 4px; }
        .history-items { font-size: 12px; color: #5F5E5A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .history-right { text-align: right; flex-shrink: 0; }
        .history-total { font-size: 15px; font-weight: 800; color: #C8873A; margin-bottom: 4px; }
        .history-payment { font-size: 11px; color: #5F5E5A; margin-top: 4px; }
      `}</style>
    </div>
  )
}
