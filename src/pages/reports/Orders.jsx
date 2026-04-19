// src/pages/reports/Orders.jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useAuth } from '../../hooks/useAuth'
import Layout from '../../components/Layout'

const STATUS_STYLES = {
  pending:    'bg-amber-100 text-amber-700',
  confirmed:  'bg-blue-100 text-blue-700',
  rejected:   'bg-red-100 text-red-600',
  dispatched: 'bg-purple-100 text-purple-700',
  delivered:  'bg-green-100 text-green-700',
}

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts)
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(ts).toLocaleDateString()
}

export default function Orders() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'company_admin' || profile?.role === 'super_admin' || profile?.role === 'staff'

  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('all')
  const [search, setSearch]   = useState('')

  useEffect(() => {
    if (!profile) return
    fetchOrders()
  }, [profile])

  async function fetchOrders() {
    setLoading(true)
    let q = supabase
      .from('optician_orders')
      .select('*, optician_order_items(id)')
      .order('created_at', { ascending: false })
      .limit(100)

    if (isAdmin) {
      q = q.eq('company_id', profile.company_id)
    } else {
      q = q.eq('optician_id', profile.id)
    }

    const { data } = await q
    setOrders(data || [])
    setLoading(false)
  }

  const statuses = ['all', 'pending', 'confirmed', 'dispatched', 'delivered', 'rejected']
  const filtered = orders
    .filter(o => filter === 'all' || o.status === filter)
    .filter(o => {
      if (!search.trim()) return true
      const q = search.trim().toLowerCase()
      return o.id.slice(0, 8).toLowerCase().includes(q) ||
             (o.optician_name || '').toLowerCase().includes(q)
    })

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6 lg:px-6 lg:py-10">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900 mb-1">
            {isAdmin ? 'Incoming orders' : 'My orders'}
          </h1>
          <p className="text-sm text-slate-500">
            {isAdmin
              ? 'Orders placed by opticians. Confirm, reject, and mark dispatch here.'
              : 'Track your orders and communicate with your supplier here.'}
          </p>
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by order number or optician name…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900" />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
          {statuses.map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize whitespace-nowrap transition-colors ${
                filter === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'
              }`}>
              {s === 'all' ? `All (${orders.length})` : `${s} (${orders.filter(o => o.status === s).length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
            <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Loading orders…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
            <p className="text-3xl mb-3">📦</p>
            <p className="text-slate-700 font-semibold text-sm mb-1">
              {orders.length === 0 ? 'No orders yet' : 'No orders match this filter'}
            </p>
            <p className="text-slate-400 text-xs max-w-xs mx-auto leading-relaxed">
              {orders.length === 0 && !isAdmin
                ? 'Add items to your cart while searching supplier stock and place your first order.'
                : ''}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
            {filtered.map(order => (
              <Link key={order.id} to={`/orders/${order.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {isAdmin ? order.optician_name : `Order #${order.id.slice(0, 8).toUpperCase()}`}
                    </p>
                    <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[order.status]}`}>
                      {order.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {order.optician_order_items?.length || 0} item{order.optician_order_items?.length !== 1 ? 's' : ''}
                    {order.total_amount != null
                      ? ` · ₦${Number(order.total_amount).toLocaleString()}`
                      : ' · Price TBD'}
                    {' · '}{timeAgo(order.created_at)}
                  </p>
                </div>
                <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
