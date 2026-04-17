import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '../../supabase'
import { useAuth } from '../../hooks/useAuth'

export default function Settings() {
  const { profile } = useAuth()
  const [opticianAccess, setOpticianAccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState({ type: '', text: '' })

  // ── Bank accounts ──
  const [banks, setBanks]           = useState([])
  const [bankForm, setBankForm]     = useState({ bank_name: '', account_number: '', account_name: '' })
  const [savingBank, setSavingBank] = useState(false)

  useEffect(() => {
    if (profile?.company_id) {
      supabase
        .from('companies')
        .select('optician_access, slug, name')
        .eq('id', profile.company_id)
        .single()
        .then(({ data }) => {
          setOpticianAccess(data?.optician_access || false)
          setLoading(false)
        })
      fetchBanks()
    }
  }, [profile])

  async function toggleOpticianAccess() {
    setSaving(true)
    const newVal = !opticianAccess
    const { data, error } = await supabase
      .from('companies')
      .update({ optician_access: newVal })
      .eq('id', profile.company_id)
      .select()
      
    if (error) {
      setMsg({ type: 'error', text: error.message })
    } else if (!data || data.length === 0) {
      setMsg({ type: 'error', text: 'Failed to save: You do not have permission to update this company settings.' })
    } else {
      setOpticianAccess(newVal)
      setMsg({
        type: 'success',
        text: newVal
          ? 'Optician access enabled. Registered opticians can now query your stock availability.'
          : 'Optician access disabled. Your stock is now private.',
      })
      setTimeout(() => setMsg({ type: '', text: '' }), 4000)
    }
    setSaving(false)
  }

  async function copyCode() {
    await navigator.clipboard.writeText(profile?.companies?.slug || '')
    setMsg({ type: 'success', text: 'Company code copied to clipboard.' })
    setTimeout(() => setMsg({ type: '', text: '' }), 2000)
  }

  async function fetchBanks() {
    const { data } = await supabase.from('company_bank_accounts')
      .select('*').eq('company_id', profile.company_id).order('is_primary', { ascending: false })
    setBanks(data || [])
  }

  async function addBank(e) {
    e.preventDefault()
    if (!bankForm.bank_name || !bankForm.account_number || !bankForm.account_name) return
    setSavingBank(true)
    const isPrimary = banks.length === 0
    await supabase.from('company_bank_accounts').insert({
      company_id:     profile.company_id,
      bank_name:      bankForm.bank_name.trim(),
      account_number: bankForm.account_number.trim(),
      account_name:   bankForm.account_name.trim(),
      is_primary:     isPrimary,
    })
    setBankForm({ bank_name: '', account_number: '', account_name: '' })
    await fetchBanks()
    setSavingBank(false)
  }

  async function removeBank(id) {
    await supabase.from('company_bank_accounts').delete().eq('id', id)
    fetchBanks()
  }

  async function setPrimary(id) {
    await supabase.from('company_bank_accounts').update({ is_primary: false }).eq('company_id', profile.company_id)
    await supabase.from('company_bank_accounts').update({ is_primary: true }).eq('id', id)
    fetchBanks()
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-8 text-slate-400 text-sm">Loading…</div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-xl mx-auto px-4 py-6 lg:px-6 lg:py-10">
        <h1 className="text-xl font-bold text-slate-900 mb-1">Settings</h1>
        <p className="text-sm text-slate-500 mb-8">Manage your company preferences.</p>

        {msg.text && (
          <div className={`mb-5 rounded-xl px-4 py-3 text-xs ${
            msg.type === 'error'
              ? 'bg-red-50 border border-red-100 text-red-600'
              : 'bg-green-50 border border-green-100 text-green-700'
          }`}>
            {msg.text}
          </div>
        )}

        {/* Company code */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Company code</h2>
          <p className="text-xs text-slate-500 mb-3">Share with staff when they register to link them to your company.</p>
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-slate-900">
              {profile?.companies?.slug}
            </code>
            <button
              onClick={copyCode}
              className="text-xs text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors px-3 py-2.5 rounded-xl font-medium"
            >
              Copy
            </button>
          </div>
        </div>

        {/* Optician access toggle */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">Optician access</h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Allow registered opticians to search your product availability.
                They will only see <strong>in stock / out of stock</strong> — quantities are never shown.
              </p>
            </div>
            <button
              onClick={toggleOpticianAccess}
              disabled={saving}
              aria-label="Toggle optician access"
              className={`flex-shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:opacity-50 ${
                opticianAccess ? 'bg-slate-900' : 'bg-slate-200'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                opticianAccess ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
          <p className={`mt-3 text-xs font-medium ${opticianAccess ? 'text-green-600' : 'text-slate-400'}`}>
            {opticianAccess
              ? '● Enabled — registered opticians can query your availability'
              : '○ Disabled — your stock is private to your team'}
          </p>
        </div>

        {/* ── Bank accounts ── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mt-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Bank accounts</h2>
          <p className="text-xs text-slate-500 mb-4">Opticians will see these when their order is confirmed so they can make payment.</p>

          {/* Existing accounts */}
          {banks.length > 0 && (
            <div className="space-y-2 mb-5">
              {banks.map(b => (
                <div key={b.id} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{b.account_number}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{b.account_name} · {b.bank_name}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {b.is_primary
                      ? <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">Primary</span>
                      : <button onClick={() => setPrimary(b.id)} className="text-xs text-slate-400 hover:text-slate-700">Set primary</button>}
                    <button onClick={() => removeBank(b.id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add account form */}
          <form onSubmit={addBank} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input type="text" placeholder="Bank name (e.g. GTBank)" value={bankForm.bank_name}
                onChange={e => setBankForm(f => ({ ...f, bank_name: e.target.value }))}
                className="px-3 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
              <input type="text" placeholder="Account number" value={bankForm.account_number}
                onChange={e => setBankForm(f => ({ ...f, account_number: e.target.value }))}
                className="px-3 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
              <input type="text" placeholder="Account name" value={bankForm.account_name}
                onChange={e => setBankForm(f => ({ ...f, account_name: e.target.value }))}
                className="px-3 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
            </div>
            <button type="submit" disabled={savingBank}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors px-4 py-2.5 rounded-xl disabled:opacity-50">
              {savingBank ? 'Adding…' : '+ Add bank account'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  )
}