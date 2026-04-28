import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import { useAuth } from '../../hooks/useAuth'
import Layout from '../../components/Layout'
import { sanitise } from '../../utils/sanitise'

const METHODS = ['Cash', 'POS', 'Transfer']

export default function Debtors() {
  const { profile } = useAuth()
  const [debtors, setDebtors]     = useState([])
  const [selected, setSelected]   = useState(null)
  const [payments, setPayments]   = useState([])
  const [payForm, setPayForm]     = useState({ amount: '', method: 'Cash', notes: '' })
  const [loading, setLoading]     = useState(false)
  const [msg, setMsg]             = useState({ type: '', text: '' })
  const [filter, setFilter]       = useState('outstanding')
  const [search, setSearch]       = useState('')

  useEffect(() => { if (profile?.company_id) fetchDebtors() }, [profile, filter])
  useEffect(() => { if (selected) fetchPayments(selected.id) }, [selected])

  async function fetchDebtors() {
    let query = supabase
      .from('debtors')
      .select('*, transactions!inner(products(name), locations(code), sph, addition, qty, created_at, location_id)')
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })

    if (filter === 'outstanding') query = query.eq('is_settled', false)
    if (filter === 'settled')     query = query.eq('is_settled', true)
    
    if (profile?.role === 'staff' && profile?.location_id) {
      query = query.eq('transactions.location_id', profile.location_id)
    }

    const { data } = await query
    setDebtors(data || [])
  }

  async function fetchPayments(debtorId) {
    const { data } = await supabase
      .from('debtor_payments')
      .select('*, profiles(full_name)')
      .eq('debtor_id', debtorId)
      .order('created_at', { ascending: false })
    setPayments(data || [])
  }

  function flash(type, text) { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 4000) }

  async function recordPayment(e) {
    e.preventDefault()
    const amount = Number(payForm.amount)
    if (!amount || amount <= 0) { flash('error', 'Enter a valid amount'); return }
    if (amount > selected.balance) { flash('error', `Amount exceeds balance of ₦${selected.balance.toLocaleString()}`); return }

    setLoading(true)

    await supabase.from('debtor_payments').insert({
      company_id: profile.company_id,
      debtor_id:  selected.id,
      amount,
      method:     payForm.method,
      notes:      payForm.notes ? sanitise(payForm.notes, 500) : null,
      created_by: profile.id,
    })

    const newPaid    = Number(selected.amount_paid) + amount
    const newBalance = Number(selected.total_amount) - newPaid
    const settled    = newBalance <= 0

    await supabase.from('debtors').update({
      amount_paid: newPaid,
      balance:     Math.max(0, newBalance),
      is_settled:  settled,
      updated_at:  new Date(),
    }).eq('id', selected.id)

    flash('success', settled ? 'Debt fully settled!' : `₦${amount.toLocaleString()} recorded`)
    setPayForm({ amount: '', method: 'Cash', notes: '' })

    await fetchDebtors()
    const updated = await supabase.from('debtors').select('*').eq('id', selected.id).single()
    setSelected(updated.data)
    fetchPayments(selected.id)
    setLoading(false)
  }

  const q = search.trim().toLowerCase()
  const filtered = debtors.filter(d =>
    !q ||
    (d.customer_name || '').toLowerCase().includes(q) ||
    (d.customer_phone || '').toLowerCase().includes(q)
  )
  const totalOutstanding = debtors.filter(d => !d.is_settled).reduce((s, d) => s + Number(d.balance), 0)

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6 lg:px-6 lg:py-10">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-1">Debtors</h2>
            <p className="text-slate-500 text-sm">Track outstanding balances and record payments.</p>
          </div>
          {totalOutstanding > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-right">
              <p className="text-xs text-red-500 font-medium">Total outstanding</p>
              <p className="text-xl font-bold text-red-700">₦{totalOutstanding.toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or phone…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900" />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5">
          {[['outstanding','Outstanding'],['settled','Settled'],['all','All']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === v ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-600'}`}>
              {l}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Debtor list */}
          <div className="space-y-2">
            {filtered.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
                {search ? 'No debtors match your search.' : filter === 'outstanding' ? 'No outstanding balances.' : 'No records found.'}
              </div>
            )}
            {filtered.map(d => (
              <button key={d.id} onClick={() => setSelected(d)}
                className={`w-full text-left bg-white rounded-xl border px-4 py-4 transition-all ${selected?.id === d.id ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-300'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">
                      {d.customer_name} {d.customer_phone && <span className="text-slate-400 font-normal">({d.customer_phone})</span>}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {d.transactions?.products?.name} · {d.transactions?.locations?.code}
                    </p>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {new Date(d.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    {d.is_settled ? (
                      <span className="text-xs bg-green-50 text-green-700 font-semibold px-2 py-1 rounded-full">Settled</span>
                    ) : (
                      <>
                        <p className="text-sm font-bold text-red-600">₦{Number(d.balance).toLocaleString()}</p>
                        <p className="text-xs text-slate-400">of ₦{Number(d.total_amount).toLocaleString()}</p>
                      </>
                    )}
                  </div>
                </div>
                {!d.is_settled && (
                  <div className="mt-3 bg-slate-100 rounded-full h-1.5">
                    <div className="bg-green-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${(Number(d.amount_paid) / Number(d.total_amount)) * 100}%` }} />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Payment panel */}
          {selected && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="mb-4 pb-4 border-b border-slate-100">
                <p className="font-bold text-slate-800">{selected.customer_name}</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  Total: ₦{Number(selected.total_amount).toLocaleString()} ·
                  Paid: ₦{Number(selected.amount_paid).toLocaleString()} ·
                  <span className={selected.is_settled ? 'text-green-600' : 'text-red-600'}> Balance: ₦{Number(selected.balance).toLocaleString()}</span>
                </p>
              </div>

              {/* Payment history */}
              {payments.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-slate-500 mb-2">Payment history</p>
                  <div className="space-y-1.5">
                    {payments.map(p => (
                      <div key={p.id} className="flex justify-between text-sm">
                        <span className="text-slate-600">
                          {p.method} · {new Date(p.created_at).toLocaleDateString()}
                          {p.profiles?.full_name ? ` · ${p.profiles.full_name}` : ''}
                        </span>
                        <span className="font-semibold text-green-600">+₦{Number(p.amount).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!selected.is_settled ? (
                <form onSubmit={recordPayment} className="space-y-3">
                  <p className="text-sm font-semibold text-slate-700">Record payment</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Amount (₦)</label>
                      <input type="number" min="1" required value={payForm.amount}
                        onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                        onWheel={e => e.target.blur()}
                        placeholder={`Max ₦${Number(selected.balance).toLocaleString()}`}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Method</label>
                      <select value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white">
                        {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                  <input type="text" value={payForm.notes}
                    onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Notes (optional)"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />

                  {msg.text && (
                    <div className={`text-xs rounded-lg px-3 py-2 ${msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                      {msg.text}
                    </div>
                  )}

                  <button type="submit" disabled={loading}
                    className="w-full bg-slate-900 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-700 disabled:opacity-50">
                    {loading ? 'Recording...' : 'Record payment'}
                  </button>
                </form>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-green-700 font-semibold text-sm">Fully settled</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}