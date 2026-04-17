// src/pages/reports/QueryHistory.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import { useAuth } from '../../hooks/useAuth'
import Layout from '../../components/Layout'

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts)
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}

function formatSpec(spec) {
  if (!spec) return '—'
  if (spec.name_key) return spec.name_key
  const parts = []
  if (spec.sph) parts.push(spec.sph)
  if (spec.cyl && spec.cyl !== '-') parts.push(spec.cyl)
  if (spec.axis && spec.axis !== '-') parts.push(`ax${spec.axis}`)
  if (spec.addition && spec.addition !== '-') parts.push(`add${spec.addition}`)
  return parts.join(' / ') || '—'
}

export default function QueryHistory() {
  const { profile } = useAuth()
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('all') // 'all' | 'in_stock' | 'out_of_stock'

  useEffect(() => {
    if (!profile?.company_id) return
    fetchLogs()
  }, [profile])

  async function fetchLogs() {
    setLoading(true)
    const { data, error } = await supabase
      .from('optician_query_log')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('queried_at', { ascending: false })
      .limit(200)
    if (!error) setLogs(data || [])
    setLoading(false)
  }

  const filtered = filter === 'all' ? logs : logs.filter(l => l.result === filter)

  // Aggregate for the mini-stats
  const inStockCount   = logs.filter(l => l.result === 'in_stock').length
  const outStockCount  = logs.filter(l => l.result === 'out_of_stock').length
  const uniqueOpticians = [...new Set(logs.map(l => l.optician_name).filter(Boolean))].length
  const topProducts    = Object.entries(
    logs.reduce((acc, l) => { if (l.product_name) acc[l.product_name] = (acc[l.product_name] || 0) + 1; return acc }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 3)

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6 lg:px-6 lg:py-10">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900 mb-1">Query history</h1>
          <p className="text-sm text-slate-500">
            Every stock check opticians have performed on your catalogue.
          </p>
        </div>

        {/* ── Stats row ── */}
        {!loading && logs.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard label="Total queries" value={logs.length} color="slate" />
            <StatCard label="In stock hits" value={inStockCount} color="green" />
            <StatCard label="Out of stock" value={outStockCount} color="amber" />
            <StatCard label="Unique opticians" value={uniqueOpticians} color="slate" />
          </div>
        )}

        {/* ── Top searched products ── */}
        {!loading && topProducts.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Most searched products</h2>
            <div className="space-y-2">
              {topProducts.map(([name, count]) => (
                <div key={name} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 truncate">{name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-1.5 bg-slate-900 rounded-full"
                      style={{ width: `${Math.max(20, (count / logs.length) * 120)}px` }}
                    />
                    <span className="text-xs font-semibold text-slate-500 w-6 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Filter tabs ── */}
        <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-xl w-fit">
          {[
            { key: 'all',           label: `All (${logs.length})` },
            { key: 'in_stock',      label: `In stock (${inStockCount})` },
            { key: 'out_of_stock',  label: `Out of stock (${outStockCount})` },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filter === f.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ── Table ── */}
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
            <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Loading query history…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
            <p className="text-3xl mb-3">🔍</p>
            <p className="text-slate-700 font-semibold text-sm mb-1">
              {logs.length === 0 ? 'No queries yet' : 'No results for this filter'}
            </p>
            <p className="text-slate-400 text-xs max-w-xs mx-auto leading-relaxed">
              {logs.length === 0
                ? 'Once opticians start searching your stock using your company code, their queries will appear here.'
                : 'Try changing the filter above.'}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Optician</p>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Product</p>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Spec</p>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Result</p>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">When</p>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-100">
              {filtered.map(log => (
                <div
                  key={log.id}
                  className="px-5 py-3.5 flex sm:grid sm:grid-cols-[1fr_1fr_1fr_auto_auto] gap-3 sm:gap-4 items-start sm:items-center"
                >
                  {/* Optician */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {log.optician_name || 'Unknown'}
                    </p>
                  </div>

                  {/* Product */}
                  <div className="min-w-0">
                    <p className="text-sm text-slate-700 truncate">{log.product_name || '—'}</p>
                  </div>

                  {/* Spec */}
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500 font-mono truncate">{formatSpec(log.spec_details)}</p>
                  </div>

                  {/* Result badge */}
                  <div className="flex-shrink-0">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      log.result === 'in_stock'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {log.result === 'in_stock' ? '✓ In stock' : 'Out of stock'}
                    </span>
                  </div>

                  {/* Time */}
                  <div className="flex-shrink-0">
                    <p className="text-xs text-slate-400 whitespace-nowrap">{timeAgo(log.queried_at)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
              <p className="text-xs text-slate-400 text-center">
                Showing {filtered.length} of {logs.length} total queries · Most recent first
              </p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

function StatCard({ label, value, color }) {
  const colorMap = {
    slate: 'text-slate-900',
    green: 'text-green-600',
    amber: 'text-amber-600',
  }
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <p className={`text-2xl font-bold ${colorMap[color] || 'text-slate-900'}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  )
}
