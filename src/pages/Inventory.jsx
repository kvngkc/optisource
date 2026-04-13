// src/pages/Inventory.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'

const SPH_VALUES = ['Plano', ...Array.from({ length: 80 }, (_, i) => '+' + String((i + 1) * 25).padStart(3, '0')), ...Array.from({ length: 80 }, (_, i) => '-' + String((i + 1) * 25).padStart(3, '0'))]
const CYL_VALUES = ['-', '+000', ...Array.from({ length: 16 }, (_, i) => '-' + String((i + 1) * 25).padStart(3, '0')), ...Array.from({ length: 16 }, (_, i) => '+' + String((i + 1) * 25).padStart(3, '0'))]
const AXIS_VALUES = ['-', '90', '180']
const ADD_VALUES  = ['-', ...Array.from({ length: 16 }, (_, i) => '+' + String((i + 1) * 25).padStart(3, '0'))]

function buildStockQuery(base, { sph, cyl, axis, addition, name_key }) {
  let q = base
  sph      === null ? q = q.is('sph', null)      : q = q.eq('sph', sph)
  cyl      === null ? q = q.is('cyl', null)      : q = q.eq('cyl', cyl)
  axis     === null ? q = q.is('axis', null)     : q = q.eq('axis', axis)
  addition === null ? q = q.is('addition', null) : q = q.eq('addition', addition)
  name_key === null ? q = q.is('name_key', null) : q = q.eq('name_key', name_key)
  return q
}

export default function Inventory() {
  const { profile } = useAuth()
  const [products, setProducts]     = useState([])
  const [locations, setLocations]   = useState([])
  const [classes, setClasses]       = useState([])
  const [recentLogs, setRecentLogs] = useState([])
  const [form, setForm] = useState({
    class_id: '', product_id: '', location_id: '',
    sph: 'Plano', cyl: '-', axis: '-', addition: '-', qty: '',
  })
  const [loading,  setLoading]  = useState(false)
  const [voiding,  setVoiding]  = useState(null) // transaction id being voided
  const [msg, setMsg]           = useState({ type: '', text: '' })

  useEffect(() => {
    if (profile?.company_id) { fetchClasses(); fetchLocations(); fetchRecentLogs() }
  }, [profile])

  useEffect(() => { if (form.class_id) fetchProducts(form.class_id) }, [form.class_id])

  async function fetchClasses() {
    const { data } = await supabase
      .from('product_classes').select('*')
      .eq('company_id', profile.company_id).order('name')
    setClasses(data || [])
    if (data?.length) setForm(f => ({ ...f, class_id: data[0].id }))
  }
  async function fetchProducts(classId) {
    const { data } = await supabase
      .from('products').select('*')
      .eq('company_id', profile.company_id)
      .eq('class_id', classId)
      .eq('is_active', true).order('name')
    setProducts(data || [])
    setForm(f => ({ ...f, product_id: data?.[0]?.id || '' }))
  }
  async function fetchLocations() {
    const { data } = await supabase
      .from('locations').select('*')
      .eq('company_id', profile.company_id).order('name')
    setLocations(data || [])
    if (profile?.location_id) setForm(f => ({ ...f, location_id: profile.location_id }))
    else if (data?.length)    setForm(f => ({ ...f, location_id: data[0].id }))
  }
  async function fetchRecentLogs() {
    const { data } = await supabase
      .from('transactions')
      .select('*, products(name, spec_type, class_id), locations(name, code)')
      .eq('company_id', profile.company_id)
      .eq('type', 'INVENTORY_ADD')
      .order('created_at', { ascending: false })
      .limit(10)
    setRecentLogs(data || [])
  }

  function update(field, value) { setForm(f => ({ ...f, [field]: value })) }
  function flash(type, text) { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 4000) }

  const selectedProduct = products.find(p => p.id === form.product_id)
  const specType  = selectedProduct?.spec_type || 'sph_add'
  const isUtility = specType === 'name_only'

  function getSpecValues() {
    return {
      sph:      isUtility ? null : form.sph,
      cyl:      isUtility ? null : (specType === 'sph_add' ? null : form.cyl),
      axis:     isUtility ? null : (specType === 'sph_cyl_axis_add' ? form.axis : null),
      addition: isUtility ? null : (specType === 'sph_cyl' ? null : form.addition),
      name_key: isUtility ? selectedProduct?.name : null,
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const qty = Number(form.qty)
    if (!form.product_id || !form.location_id) { flash('error', 'Product and location required'); return }
    if (!qty || qty <= 0) { flash('error', 'Qty must be a positive number'); return }
    setLoading(true)
    const specs = getSpecValues()
    const base  = supabase.from('stock').select('id, qty')
      .eq('product_id', form.product_id).eq('location_id', form.location_id)
    const { data: existing } = await buildStockQuery(base, specs).maybeSingle()
    let stockError
    if (existing) {
      const { error } = await supabase.from('stock')
        .update({ qty: existing.qty + qty, updated_at: new Date() }).eq('id', existing.id)
      stockError = error
    } else {
      const { error } = await supabase.from('stock')
        .insert({ company_id: profile.company_id, product_id: form.product_id, location_id: form.location_id, ...specs, qty })
      stockError = error
    }
    if (stockError) { flash('error', stockError.message); setLoading(false); return }
    await supabase.from('transactions').insert({
      company_id: profile.company_id, type: 'INVENTORY_ADD',
      product_id: form.product_id, location_id: form.location_id,
      ...specs, qty, created_by: profile.id,
    })
    await supabase.from('audit_log').insert({
      company_id: profile.company_id, user_id: profile.id, status: 'SUCCESS',
      action: 'INVENTORY_ADD',
      details: { product: selectedProduct?.name, location: locations.find(l => l.id === form.location_id)?.code, ...specs, qty },
    })
    flash('success', `✓ +${qty} ${selectedProduct?.name} added`)
    // Only reset qty — keep location, product, and specs selected
    setForm(f => ({ ...f, qty: '' }))
    fetchRecentLogs()
    setLoading(false)
  }

  // Pre-fill form from a recent log entry (click to re-use or correct)
  async function prefillFromLog(log) {
    // Switch to the right class first
    const classId = log.products?.class_id
    if (classId && classId !== form.class_id) {
      setForm(f => ({ ...f, class_id: classId }))
      // products will reload via useEffect; wait briefly
      await new Promise(r => setTimeout(r, 300))
    }
    setForm(f => ({
      ...f,
      class_id:    classId    || f.class_id,
      product_id:  log.product_id,
      location_id: log.location_id,
      sph:         log.sph      || 'Plano',
      cyl:         log.cyl      || '-',
      axis:        log.axis     || '-',
      addition:    log.addition || '-',
      qty:         '',
    }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
    flash('info', `Form pre-filled from "${log.products?.name}" — adjust qty and submit.`)
  }

  // Void a recent INVENTORY_ADD entry
  async function handleVoid(log) {
    if (!window.confirm(`Void this entry?\n\n${log.products?.name} +${log.qty} at ${log.locations?.code}\n\nThis will subtract ${log.qty} from stock and cannot be undone.`)) return
    setVoiding(log.id)
    const specs = {
      sph:      log.sph,
      cyl:      log.cyl,
      axis:     log.axis,
      addition: log.addition,
      name_key: log.name_key,
    }
    // Find stock row and reduce qty
    const base = supabase.from('stock').select('id, qty')
      .eq('product_id', log.product_id).eq('location_id', log.location_id)
    const { data: stockRow } = await buildStockQuery(base, specs).maybeSingle()
    if (!stockRow) {
      flash('error', 'Stock row not found — it may have already been adjusted.')
      setVoiding(null)
      return
    }
    const newQty = Math.max(0, stockRow.qty - log.qty)
    const { error: stockErr } = await supabase.from('stock')
      .update({ qty: newQty, updated_at: new Date() }).eq('id', stockRow.id)
    if (stockErr) { flash('error', stockErr.message); setVoiding(null); return }

    // Write a INVENTORY_VOID transaction for the paper trail
    await supabase.from('transactions').insert({
      company_id:   profile.company_id,
      type:         'INVENTORY_VOID',
      product_id:   log.product_id,
      location_id:  log.location_id,
      ...specs,
      qty:          log.qty,
      created_by:   profile.id,
      notes:        `Void of transaction ${log.id}`,
    })
    await supabase.from('audit_log').insert({
      company_id: profile.company_id, user_id: profile.id,
      status: 'SUCCESS', action: 'INVENTORY_VOID',
      details: { voided_transaction: log.id, product: log.products?.name, location: log.locations?.code, qty: log.qty, new_stock_qty: newQty },
    })
    flash('success', `Voided — ${log.qty} removed from ${log.locations?.code} stock.`)
    fetchRecentLogs()
    setVoiding(null)
  }

  function formatSpec(log) {
    const parts = []
    if (log.name_key)  return log.name_key
    if (log.sph)       parts.push(log.sph)
    if (log.cyl && log.cyl !== '-') parts.push(log.cyl)
    if (log.axis && log.axis !== '-') parts.push(`ax${log.axis}`)
    if (log.addition && log.addition !== '-') parts.push(`add${log.addition}`)
    return parts.join(' / ') || '—'
  }

  function timeAgo(ts) {
    const diff = Date.now() - new Date(ts)
    const m = Math.floor(diff / 60000)
    if (m < 1)  return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  const selectClass = "w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white text-base"

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 lg:px-6 lg:py-10">
        <h2 className="text-xl font-bold text-slate-800 mb-1">Inventory entry</h2>
        <p className="text-slate-500 text-sm mb-6">Add stock by location and spec.</p>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
              <select value={form.location_id} onChange={e => update('location_id', e.target.value)} className={selectClass}>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Product class</label>
              <select value={form.class_id} onChange={e => update('class_id', e.target.value)} className={selectClass}>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
              <select value={form.product_id} onChange={e => update('product_id', e.target.value)} className={selectClass}>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {!isUtility && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">SPH</label>
                  <select value={form.sph} onChange={e => update('sph', e.target.value)} className={selectClass}>
                    {SPH_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                {(specType === 'sph_cyl' || specType === 'sph_cyl_axis_add') && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">CYL</label>
                    <select value={form.cyl} onChange={e => update('cyl', e.target.value)} className={selectClass}>
                      {CYL_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                )}
                {specType === 'sph_cyl_axis_add' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Axis</label>
                    <select value={form.axis} onChange={e => update('axis', e.target.value)} className={selectClass}>
                      {AXIS_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                )}
                {(specType === 'sph_add' || specType === 'sph_cyl_axis_add') && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Addition</label>
                    <select value={form.addition} onChange={e => update('addition', e.target.value)} className={selectClass}>
                      {ADD_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
              <input
                type="number" min="1" required
                value={form.qty} onChange={e => update('qty', e.target.value)}
                placeholder="e.g. 50" autoFocus
                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 text-base"
              />
            </div>

            {msg.text && (
              <div className={`text-sm rounded-xl px-4 py-3 ${
                msg.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' :
                msg.type === 'info'  ? 'bg-blue-50 border border-blue-200 text-blue-700' :
                'bg-green-50 border border-green-200 text-green-700'
              }`}>
                {msg.text}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-semibold text-base hover:bg-slate-700 transition-colors disabled:opacity-50">
              {loading ? 'Adding...' : 'Add stock'}
            </button>
          </form>
        </div>

        {/* Recent additions */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-700 text-sm">Recent additions</h3>
          <p className="text-xs text-slate-400">Tap a row to re-use · Void to reverse</p>
        </div>

        <div className="space-y-2">
          {recentLogs.length === 0 && <p className="text-slate-400 text-sm">No entries yet.</p>}
          {recentLogs.map(log => (
            <div
              key={log.id}
              className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between gap-3 hover:border-slate-400 cursor-pointer transition-colors group"
              onClick={() => prefillFromLog(log)}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-800 text-sm truncate">{log.products?.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {log.locations?.code} · {formatSpec(log)}
                  <span className="ml-2 text-slate-300">{timeAgo(log.created_at)}</span>
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-green-600 font-bold text-sm">+{log.qty}</span>
                <button
                  onClick={e => { e.stopPropagation(); handleVoid(log) }}
                  disabled={voiding === log.id}
                  className="text-xs text-slate-300 hover:text-red-500 transition-colors disabled:opacity-40 opacity-0 group-hover:opacity-100"
                >
                  {voiding === log.id ? '…' : 'Void'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-300 text-center mt-6">
          Void removes stock and creates an audit record. Use for incorrect entries only.
        </p>
      </div>
    </Layout>
  )
}