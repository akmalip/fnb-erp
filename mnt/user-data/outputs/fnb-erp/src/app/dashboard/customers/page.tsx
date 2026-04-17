'use client'

import { useEffect, useState } from 'react'
import { getCustomersByOutlet } from '@/lib/supabase/queries'

interface CustomerRow {
  id: string; name: string; whatsapp: string; email?: string
  total_visits: number; total_spent: number; last_visited_at: string
  visit_count?: number; total_spent_here?: number; last_visit_at?: string
}

function formatRp(n: number) { return 'Rp ' + n.toLocaleString('id-ID') }
function formatDate(s: string) {
  return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'last_visit' | 'visits' | 'spent'>('last_visit')

  useEffect(() => {
    const id = localStorage.getItem('fnb_outlet_id')
    if (!id) return
    getCustomersByOutlet(id).then(data => {
      setCustomers(data as any)
      setLoading(false)
    })
  }, [])

  const filtered = customers
    .filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.whatsapp.includes(search) ||
      (c.email ?? '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'visits') return (b.visit_count ?? b.total_visits) - (a.visit_count ?? a.total_visits)
      if (sortBy === 'spent') return (b.total_spent_here ?? b.total_spent) - (a.total_spent_here ?? a.total_spent)
      return new Date(b.last_visit_at ?? b.last_visited_at).getTime() - new Date(a.last_visit_at ?? a.last_visited_at).getTime()
    })

  const handleExportCSV = () => {
    const rows = [
      ['Nama', 'WhatsApp', 'Email', 'Kunjungan', 'Total Belanja', 'Kunjungan Terakhir'],
      ...filtered.map(c => [
        c.name, c.whatsapp, c.email ?? '',
        String(c.visit_count ?? c.total_visits),
        String(c.total_spent_here ?? c.total_spent),
        formatDate(c.last_visit_at ?? c.last_visited_at)
      ])
    ]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'customers.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const totalRevFromCustomers = filtered.reduce((s, c) => s + (c.total_spent_here ?? c.total_spent), 0)
  const avgVisits = filtered.length > 0
    ? (filtered.reduce((s, c) => s + (c.visit_count ?? c.total_visits), 0) / filtered.length).toFixed(1)
    : '0'

  if (loading) return <div style={{ padding: 40, color: '#8B7355', textAlign: 'center' }}>Memuat data customer...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Database Customer</h1>
          <p className="page-sub">{customers.length} customer terdaftar</p>
        </div>
        <button className="export-btn" onClick={handleExportCSV}>⬇ Export CSV</button>
      </div>

      {/* Summary stats */}
      <div className="stats-row">
        <div className="stat-mini">
          <div className="stat-mini-val">{customers.length}</div>
          <div className="stat-mini-label">Total Customer</div>
        </div>
        <div className="stat-mini">
          <div className="stat-mini-val">{avgVisits}x</div>
          <div className="stat-mini-label">Rata-rata Kunjungan</div>
        </div>
        <div className="stat-mini">
          <div className="stat-mini-val">{customers.filter(c => (c.visit_count ?? c.total_visits) >= 3).length}</div>
          <div className="stat-mini-label">Pelanggan Setia (3x+)</div>
        </div>
        <div className="stat-mini">
          <div className="stat-mini-val">{customers.filter(c => c.email).length}</div>
          <div className="stat-mini-label">Punya Email</div>
        </div>
      </div>

      {/* Search & Sort */}
      <div className="controls">
        <input className="search-input" type="text" placeholder="Cari nama, WA, atau email..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
          <option value="last_visit">Kunjungan Terakhir</option>
          <option value="visits">Terbanyak Kunjungan</option>
          <option value="spent">Terbesar Belanja</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          {search ? 'Tidak ada customer yang cocok dengan pencarian.' : 'Belum ada data customer.'}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="cust-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>WhatsApp</th>
                <th>Email</th>
                <th>Kunjungan</th>
                <th>Total Belanja</th>
                <th>Terakhir Visit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const visits = c.visit_count ?? c.total_visits
                const spent = c.total_spent_here ?? c.total_spent
                const lastVisit = c.last_visit_at ?? c.last_visited_at
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="customer-cell">
                        <div className="customer-avatar">{c.name.charAt(0).toUpperCase()}</div>
                        <div>
                          <div className="customer-name">{c.name}</div>
                          {visits >= 5 && <div className="loyal-badge">⭐ Setia</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <a href={`https://wa.me/${c.whatsapp.replace(/^0/, '62')}`} target="_blank" rel="noreferrer" className="wa-link">
                        {c.whatsapp}
                      </a>
                    </td>
                    <td className="email-cell">{c.email ?? <span className="empty-val">–</span>}</td>
                    <td><span className="visit-count">{visits}x</span></td>
                    <td className="spent-cell">{formatRp(spent)}</td>
                    <td className="date-cell">{formatDate(lastVisit)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <style jsx>{`
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
        .page-title { font-size: 22px; font-weight: 800; }
        .page-sub { font-size: 13px; color: #8B7355; margin-top: 2px; }
        .export-btn { padding: 10px 16px; background: white; color: #2C1810; border: 1.5px solid rgba(0,0,0,0.12); border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; }
        .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
        .stat-mini { background: white; border-radius: 12px; padding: 14px; border: 1px solid rgba(0,0,0,0.07); }
        .stat-mini-val { font-size: 22px; font-weight: 800; }
        .stat-mini-label { font-size: 11px; color: #8B7355; margin-top: 2px; }
        .controls { display: flex; gap: 10px; margin-bottom: 16px; }
        .search-input { flex: 1; padding: 10px 14px; border-radius: 10px; border: 1.5px solid rgba(0,0,0,0.1); font-size: 14px; font-family: inherit; outline: none; }
        .search-input:focus { border-color: #C8873A; }
        .sort-select { padding: 10px 12px; border-radius: 10px; border: 1.5px solid rgba(0,0,0,0.1); font-size: 13px; font-family: inherit; outline: none; background: white; cursor: pointer; }
        .empty-state { background: white; border-radius: 14px; padding: 40px; text-align: center; color: #8B7355; font-size: 14px; }
        .table-wrap { background: white; border-radius: 14px; overflow: auto; border: 1px solid rgba(0,0,0,0.07); }
        .cust-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .cust-table th { padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 700; color: #8B7355; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid rgba(0,0,0,0.08); white-space: nowrap; }
        .cust-table td { padding: 12px 16px; border-bottom: 1px solid rgba(0,0,0,0.05); vertical-align: middle; }
        .cust-table tr:last-child td { border-bottom: none; }
        .cust-table tr:hover td { background: #FAF7F4; }
        .customer-cell { display: flex; align-items: center; gap: 10px; }
        .customer-avatar { width: 34px; height: 34px; border-radius: 50%; background: #2C1810; color: white; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; flex-shrink: 0; }
        .customer-name { font-size: 14px; font-weight: 600; }
        .loyal-badge { font-size: 10px; color: #BA7517; font-weight: 700; }
        .wa-link { color: #1D9E75; font-weight: 600; text-decoration: none; }
        .wa-link:hover { text-decoration: underline; }
        .email-cell { color: #185FA5; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .empty-val { color: #B4B2A9; }
        .visit-count { font-weight: 700; }
        .spent-cell { font-weight: 700; color: #C8873A; }
        .date-cell { color: #8B7355; white-space: nowrap; }
        @media (max-width: 600px) { .stats-row { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
    </div>
  )
}
