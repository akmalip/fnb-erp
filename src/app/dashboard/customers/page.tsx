'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { getCustomersByOutlet } from '@/lib/supabase/queries'

interface CustomerRow {
  id: string; name: string; whatsapp: string; email?: string
  total_visits: number; total_spent: number; last_visited_at: string
  visit_count?: number; total_spent_here?: number; last_visit_at?: string
}

function formatRp(n: number) { return 'Rp ' + n.toLocaleString('id-ID') }
function formatDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'last_visit' | 'visits' | 'spent'>('last_visit')

  useEffect(() => {
    const id = localStorage.getItem('fnb_outlet_id')
    if (!id) return
    getCustomersByOutlet(id).then(d => { setCustomers(d as any); setLoading(false) })
  }, [])

  const filtered = customers
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.whatsapp.includes(search) || (c.email ?? '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'visits') return (b.visit_count ?? b.total_visits) - (a.visit_count ?? a.total_visits)
      if (sort === 'spent') return (b.total_spent_here ?? b.total_spent) - (a.total_spent_here ?? a.total_spent)
      return new Date(b.last_visit_at ?? b.last_visited_at).getTime() - new Date(a.last_visit_at ?? a.last_visited_at).getTime()
    })

  const exportCSV = () => {
    const header = ['Name', 'WhatsApp', 'Email', 'Visits', 'Total Spent', 'Last Visit']
    const rowData = filtered.map(c => [
      c.name,
      c.whatsapp,
      c.email ?? '',
      String(c.visit_count ?? c.total_visits),
      String(c.total_spent_here ?? c.total_spent),
      formatDate(c.last_visit_at ?? c.last_visited_at)
    ])
    const allRows = [header, ...rowData]
    const csv = allRows.map(r => r.map(v => '"' + v + '"').join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'customers.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const loyal = customers.filter(c => (c.visit_count ?? c.total_visits) >= 3).length
  const withEmail = customers.filter(c => c.email).length
  const avgVisits = customers.length
    ? (customers.reduce((s, c) => s + (c.visit_count ?? c.total_visits), 0) / customers.length).toFixed(1)
    : '0'

  if (loading) return <div style={{ padding: 40, color: '#8B7355', textAlign: 'center' }}>Loading customers...</div>

  return (
    <div>
      <div className="ph">
        <div>
          <h1 className="title">Customers</h1>
          <p className="sub">{customers.length} registered customers</p>
        </div>
        <button className="btn-exp" onClick={exportCSV}>Export CSV</button>
      </div>

      <div className="stats">
        <div className="scard"><div className="sv">{customers.length}</div><div className="sl">Total Customers</div></div>
        <div className="scard"><div className="sv">{avgVisits}x</div><div className="sl">Avg. Visits</div></div>
        <div className="scard"><div className="sv">{loyal}</div><div className="sl">Loyal (3+ visits)</div></div>
        <div className="scard"><div className="sv">{withEmail}</div><div className="sl">Have Email</div></div>
      </div>

      <div className="controls">
        <input className="search" type="text" placeholder="Search by name, WhatsApp, or email..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="srt" value={sort} onChange={e => setSort(e.target.value as any)}>
          <option value="last_visit">Last Visit</option>
          <option value="visits">Most Visits</option>
          <option value="spent">Highest Spend</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">{search ? 'No customers match your search.' : 'No customers yet.'}</div>
      ) : (
        <div className="twrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Customer</th><th>WhatsApp</th><th>Email</th><th>Visits</th><th>Spent Here</th><th>Last Visit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const visits = c.visit_count ?? c.total_visits
                const spent = c.total_spent_here ?? c.total_spent
                const last = c.last_visit_at ?? c.last_visited_at
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="ccel">
                        <div className="cav">{c.name.charAt(0).toUpperCase()}</div>
                        <div>
                          <div className="cname">{c.name}</div>
                          {visits >= 5 && <div className="loyal">Loyal</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <a href={'https://wa.me/' + c.whatsapp.replace(/^0/, '62')} target="_blank" rel="noreferrer" className="walink">{c.whatsapp}</a>
                    </td>
                    <td className="ecell">{c.email ?? <span className="nil">-</span>}</td>
                    <td><span className="vcnt">{visits}x</span></td>
                    <td className="scell">{formatRp(spent)}</td>
                    <td className="dcell">{formatDate(last)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <style jsx>{`
        .ph{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;}
        .title{font-size:22px;font-weight:800;}
        .sub{font-size:13px;color:#8B7355;margin-top:2px;}
        .btn-exp{padding:10px 16px;background:white;color:#2C1810;border:1.5px solid rgba(0,0,0,0.12);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;}
        .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;}
        .scard{background:white;border-radius:12px;padding:14px;border:1px solid rgba(0,0,0,0.07);}
        .sv{font-size:22px;font-weight:800;}
        .sl{font-size:11px;color:#8B7355;margin-top:2px;}
        .controls{display:flex;gap:10px;margin-bottom:16px;}
        .search{flex:1;padding:10px 14px;border-radius:10px;border:1.5px solid rgba(0,0,0,0.1);font-size:14px;font-family:inherit;outline:none;}
        .srt{padding:10px 12px;border-radius:10px;border:1.5px solid rgba(0,0,0,0.1);font-size:13px;font-family:inherit;outline:none;background:white;cursor:pointer;}
        .empty{background:white;border-radius:14px;padding:40px;text-align:center;color:#8B7355;font-size:14px;}
        .twrap{background:white;border-radius:14px;overflow:auto;border:1px solid rgba(0,0,0,0.07);}
        .tbl{width:100%;border-collapse:collapse;font-size:13px;}
        .tbl th{padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#8B7355;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid rgba(0,0,0,0.08);white-space:nowrap;}
        .tbl td{padding:12px 16px;border-bottom:1px solid rgba(0,0,0,0.05);vertical-align:middle;}
        .tbl tr:last-child td{border-bottom:none;}
        .tbl tr:hover td{background:#FAF7F4;}
        .ccel{display:flex;align-items:center;gap:10px;}
        .cav{width:34px;height:34px;border-radius:50%;background:#2C1810;color:white;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0;}
        .cname{font-size:14px;font-weight:600;}
        .loyal{font-size:10px;color:#BA7517;font-weight:700;}
        .walink{color:#1D9E75;font-weight:600;text-decoration:none;}
        .ecell{color:#185FA5;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .nil{color:#B4B2A9;}
        .vcnt{font-weight:700;}
        .scell{font-weight:700;color:#C8873A;}
        .dcell{color:#8B7355;white-space:nowrap;}
        @media(max-width:600px){.stats{grid-template-columns:repeat(2,1fr);}}
      `}</style>
    </div>
  )
}
