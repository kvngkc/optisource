import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import { useAuth } from '../../hooks/useAuth'
import Layout from '../../components/Layout'

const STATUS_STYLES = {
  SUCCESS:  'bg-green-50 text-green-700',
  REJECTED: 'bg-red-50 text-red-700',
  ERROR:    'bg-red-50 text-red-700',
}

const ACTION_STYLES = {
  INVENTORY_ADD: 'bg-blue-50 text-blue-700',
  SALE:          'bg-purple-50 text-purple-700',
  LOGIN:         'bg-slate-50 text-slate-600',
}

export default function AuditLog() {
  const { profile } = useAuth()
  const [logs, setLogs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [page, setPage]         = useState(0)
  const [hasMore, setHasMore]   = useState(false)
  const PAGE_SIZE = 50

  useEffect(() => {
    if (profile?.company_id) fetchLogs(0)
  }, [profile, filter])

  async function fetchLogs(pageNum) {
    setLoading(true)
    let query = supabase.from('audit_log')
      .select('*, profiles(full_name)')
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)

    if (filter !== 'all') query = query.eq('action', filter)

    const { data } = await query
    if (pageNum === 0) setLogs(data || [])
    else setLogs(prev => [...prev, ...(data || [])])
    setHasMore((data || []).length === PAGE_SIZE)
    setPage(pageNum)
    setLoading(false)
  }

  function loadMore() { fetchLogs(page + 1) }

  const FILTERS = [
    { value: 'all',              label: 'All' },
    { value: 'INVENTORY_ADD',    label: 'Inventory adds' },
    { value: 'SALE',             label: 'Sales' },
    { value: 'SALE_VOID',        label: 'Voids' },
    { value: 'TRANSFER',         label: 'Transfers' },
    { value: 'MIGRATION_IMPORT', label: 'Imports' },
    { value: 'LOGIN',            label: 'Logins' },
  ]

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">Audit log</h2>
        <p className="text-slate-500 text-sm mb-8">Complete record of every action taken in the system.</p>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {FILTERS.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === f.value ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Log table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {loading && logs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">No log entries found.</div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Time</th>
                    <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Action</th>
                    <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Status</th>
                    <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">User</th>
                    <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-5 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${ACTION_STYLES[log.action] || 'bg-slate-50 text-slate-600'}`}>
                          {log.action?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_STYLES[log.status] || 'bg-slate-50 text-slate-600'}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600">
                        {log.profiles?.full_name || '—'}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-400 font-mono max-w-xs">
                        {log.details ? (
                          <span>
                            {log.details.product && <span className="font-semibold text-slate-600">{log.details.product} </span>}
                            {log.details.location && <span>@ {log.details.location} </span>}
                            {log.details.qty && <span>× {log.details.qty} </span>}
                            {log.details.sph && log.details.sph !== '-' && <span>SPH {log.details.sph} </span>}
                            {log.details.addition && log.details.addition !== '-' && <span>ADD {log.details.addition} </span>}
                            {log.details.total_amount && <span>₦{Number(log.details.total_amount).toLocaleString()}</span>}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {hasMore && (
                <div className="px-5 py-4 border-t border-slate-100">
                  <button onClick={loadMore} disabled={loading}
                    className="text-sm text-slate-600 hover:text-slate-900 font-medium disabled:opacity-50">
                    {loading ? 'Loading...' : 'Load more'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}