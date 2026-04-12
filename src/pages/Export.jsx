import { useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'

export default function Export() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')

  function getDateRange() {
    const from = dateFrom ? new Date(dateFrom).toISOString() : new Date('2020-01-01').toISOString()
    const to   = dateTo   ? new Date(dateTo + 'T23:59:59').toISOString() : new Date().toISOString()
    return { from, to }
  }

  function toCSV(headers, rows) {
    const escape = v => {
      const s = String(v ?? '')
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }
    return [headers, ...rows.map(r => r.map(escape))].map(r => r.join(',')).join('\n')
  }

  function downloadCSV(filename, csv) {
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  async function exportSales() {
    setLoading('sales')
    const { from, to } = getDateRange()
    const { data } = await supabase
      .from('transactions')
      .select('created_at, products(name), locations(name, code), sph, cyl, axis, addition, name_key, qty, unit_price, total_amount, amount_paid, balance, payment_method, customer_name, notes')
      .eq('company_id', profile.company_id)
      .eq('type', 'SALE')
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false })

    const headers = ['Date','Product','Location','SPH','CYL','Axis','Addition','Qty','Unit Price','Total','Paid','Balance','Payment','Customer','Notes']
    const rows = (data || []).map(t => [
      new Date(t.created_at).toLocaleString(),
      t.products?.name, t.locations?.code,
      t.sph, t.cyl, t.axis, t.addition || t.name_key,
      t.qty, t.unit_price, t.total_amount, t.amount_paid, t.balance,
      t.payment_method, t.customer_name, t.notes
    ])
    downloadCSV(`optisource_sales_${Date.now()}.csv`, toCSV(headers, rows))
    setLoading('')
  }

  async function exportInventory() {
    setLoading('inventory')
    const { from, to } = getDateRange()
    const { data } = await supabase
      .from('transactions')
      .select('created_at, products(name), locations(name, code), sph, cyl, axis, addition, name_key, qty')
      .eq('company_id', profile.company_id)
      .eq('type', 'INVENTORY_ADD')
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false })

    const headers = ['Date','Product','Location','SPH','CYL','Axis','Addition','Qty']
    const rows = (data || []).map(t => [
      new Date(t.created_at).toLocaleString(),
      t.products?.name, t.locations?.code,
      t.sph, t.cyl, t.axis, t.addition || t.name_key, t.qty
    ])
    downloadCSV(`optisource_inventory_${Date.now()}.csv`, toCSV(headers, rows))
    setLoading('')
  }

  async function exportAuditLog() {
    setLoading('audit')
    const { from, to } = getDateRange()
    const { data } = await supabase
      .from('audit_log')
      .select('created_at, action, status, profiles(full_name), details')
      .eq('company_id', profile.company_id)
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false })

    const headers = ['Date','Action','Status','User','Product','Location','Qty','Total']
    const rows = (data || []).map(l => [
      new Date(l.created_at).toLocaleString(),
      l.action, l.status, l.profiles?.full_name,
      l.details?.product, l.details?.location,
      l.details?.qty, l.details?.total_amount
    ])
    downloadCSV(`optisource_auditlog_${Date.now()}.csv`, toCSV(headers, rows))
    setLoading('')
  }

  async function exportDebtors() {
    setLoading('debtors')
    const { data } = await supabase
      .from('debtors')
      .select('created_at, customer_name, total_amount, amount_paid, balance, is_settled, transactions(products(name), locations(code))')
      .eq('company_id', profile.company_id)
      .order('is_settled')
      .order('balance', { ascending: false })

    const headers = ['Date','Customer','Product','Location','Total','Paid','Balance','Settled']
    const rows = (data || []).map(d => [
      new Date(d.created_at).toLocaleDateString(),
      d.customer_name,
      d.transactions?.products?.name,
      d.transactions?.locations?.code,
      d.total_amount, d.amount_paid, d.balance,
      d.is_settled ? 'Yes' : 'No'
    ])
    downloadCSV(`optisource_debtors_${Date.now()}.csv`, toCSV(headers, rows))
    setLoading('')
  }

  const EXPORTS = [
    { key: 'sales',     label: 'Sales',         desc: 'All sales transactions with payment details', fn: exportSales,     color: 'bg-purple-50 border-purple-200' },
    { key: 'inventory', label: 'Inventory adds', desc: 'All stock additions by product and location',  fn: exportInventory, color: 'bg-blue-50 border-blue-200' },
    { key: 'audit',     label: 'Audit log',      desc: 'Complete action history with users',            fn: exportAuditLog,  color: 'bg-slate-50 border-slate-200' },
    { key: 'debtors',   label: 'Debtors',        desc: 'Outstanding and settled balances',             fn: exportDebtors,   color: 'bg-amber-50 border-amber-200' },
  ]

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 lg:px-6 lg:py-10">
        <h2 className="text-xl font-bold text-slate-800 mb-1">Export data</h2>
        <p className="text-slate-500 text-sm mb-6">Download your data as CSV. Opens in Excel or Google Sheets.</p>

        {/* Date range filter */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
          <p className="text-sm font-semibold text-slate-700 mb-3">Date range (optional)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm" />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">Leave blank to export all data</p>
        </div>

        <div className="space-y-3">
          {EXPORTS.map(ex => (
            <div key={ex.key} className={`rounded-2xl border ${ex.color} p-5 flex items-center justify-between`}>
              <div>
                <p className="font-semibold text-slate-800">{ex.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{ex.desc}</p>
              </div>
              <button onClick={ex.fn} disabled={loading === ex.key}
                className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap ml-4">
                {loading === ex.key ? 'Exporting...' : 'Download CSV'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}