import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../supabase'
import { useAuth } from '../../hooks/useAuth'
import Layout from '../../components/Layout'

import { SPH_VALUES, CYL_VALUES, ADD_VALUES, AXIS_VALUES, BASE_VALUES, dbFormatBase } from '../../utils/specs'

// ── Null-safe stock query builder ─────────────────────────────
function buildStockQuery(base, { sph, cyl, axis, addition, name_key }) {
  let q = base
  sph      === null ? q = q.is('sph', null)      : q = q.eq('sph', sph)
  cyl      === null ? q = q.is('cyl', null)      : q = q.eq('cyl', cyl)
  axis     === null ? q = q.is('axis', null)     : q = q.eq('axis', axis)
  addition === null ? q = q.is('addition', null) : q = q.eq('addition', addition)
  name_key === null ? q = q.is('name_key', null) : q = q.eq('name_key', name_key)
  return q
}

// ── Shared select style ───────────────────────────────────────
const SC = 'w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white text-base'

// ── Spec selector (shared between entry + transfer) ───────────
function SpecSelector({ form, setForm, products, classes, showLocation, locations, compact }) {
  const selectedProduct = products.find(p => p.id === form.product_id)
  const specType  = selectedProduct?.spec_type || 'sph_add'
  const isUtility = specType === 'name_only'
  const usesBase  = specType.startsWith('base_')

  const gs = compact ? 'w-full px-3 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white text-sm' : SC
  
  function updateVal(key, val) {
    if (key === 'sph' && usesBase) val = dbFormatBase(val)
    setForm(f => ({ ...f, [key]: val }))
  }

  return (
    <div className="space-y-3">
      {showLocation && (
        <div>
          <label className={`block ${compact ? 'text-xs' : 'text-sm'} font-medium text-slate-700 mb-1`}>Location</label>
          <select value={form.location_id} onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))} className={gs}>
            <option value="">— Select location —</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
          </select>
        </div>
      )}

      <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
        <div>
          <label className={`block ${compact ? 'text-xs' : 'text-sm'} font-medium text-slate-700 mb-1`}>Product class</label>
          <select value={form.class_id} onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))} className={gs}>
            <option value="">— Select class —</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={`block ${compact ? 'text-xs' : 'text-sm'} font-medium text-slate-700 mb-1`}>Product</label>
          <select value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))} className={gs}>
            <option value="">— Select product —</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {!isUtility && form.product_id && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={`block ${compact ? 'text-xs' : 'text-sm'} font-medium text-slate-700 mb-1`}>{usesBase ? 'Base' : 'SPH'}</label>
            <select value={form.sph} onChange={e => updateVal('sph', e.target.value)} className={gs}>
              <option value="">— Select {usesBase ? 'Base' : 'SPH'} —</option>
              {(usesBase ? BASE_VALUES : SPH_VALUES).map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          {(specType === 'sph_cyl' || specType === 'sph_cyl_axis_add') && (
            <div>
              <label className={`block ${compact ? 'text-xs' : 'text-sm'} font-medium text-slate-700 mb-1`}>CYL</label>
              <select value={form.cyl} onChange={e => updateVal('cyl', e.target.value)} className={gs}>
                <option value="">— Select CYL —</option>
                {CYL_VALUES.filter(v => v !== '-').map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}
          {specType === 'sph_cyl_axis_add' && (
            <div>
              <label className={`block ${compact ? 'text-xs' : 'text-sm'} font-medium text-slate-700 mb-1`}>Axis</label>
              <select value={form.axis} onChange={e => updateVal('axis', e.target.value)} className={gs}>
                <option value="">— Select Axis —</option>
                {AXIS_VALUES.filter(v => v !== '-').map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}
          {(specType === 'sph_add' || specType === 'base_add' || specType === 'sph_cyl_axis_add') && (
            <div>
              <label className={`block ${compact ? 'text-xs' : 'text-sm'} font-medium text-slate-700 mb-1`}>Addition</label>
              <select value={form.addition} onChange={e => updateVal('addition', e.target.value)} className={gs}>
                <option value="">— Select Addition —</option>
                {ADD_VALUES.filter(v => v !== '-').map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Inventory Entry tab ───────────────────────────────────────
function InventoryEntryTab({ profile, locations, classes }) {
  const [products, setProducts]     = useState([])
  const [recentLogs, setRecentLogs] = useState([])
  const [form, setForm] = useState({
    class_id: '', product_id: '', location_id: '',
    sph: '', cyl: '', axis: '', addition: '', qty: '',
  })
  const [loading, setLoading] = useState(false)
  const [voiding, setVoiding] = useState(null)
  const [msg, setMsg]         = useState({ type: '', text: '' })
  const [logPage, setLogPage] = useState(0)
  const [dupWarning, setDupWarning] = useState(null) // existing qty at this location/spec

  useEffect(() => {
    if (form.class_id) fetchProducts(form.class_id)
  }, [form.class_id])

  // Reset spec values to sensible defaults whenever product changes
  useEffect(() => {
    if (!form.product_id) return
    const product = products.find(p => p.id === form.product_id)
    if (!product) return
    const isBase = product.spec_type.startsWith('base_')
    // Spec fields start blank — user must explicitly select to prevent human error
    setForm(f => ({ ...f, sph: '', cyl: '', axis: '', addition: '' }))
  }, [form.product_id])

  // ── Duplicate-check: warn if a stock row already exists at this location ─
  useEffect(() => {
    setDupWarning(null)
    if (!form.product_id || !form.location_id) return
    const product = products.find(p => p.id === form.product_id)
    if (!product) return
    const isBase   = product.spec_type.startsWith('base_')
    const isUtil   = product.spec_type === 'name_only'
    const usesCyl  = product.spec_type === 'sph_cyl' || product.spec_type === 'sph_cyl_axis_add'
    const usesAxis = product.spec_type === 'sph_cyl_axis_add'
    const usesAdd  = product.spec_type === 'sph_add' || product.spec_type === 'base_add' || product.spec_type === 'sph_cyl_axis_add'
    const specs = isUtil
      ? { sph: null, cyl: null, axis: null, addition: null, name_key: product.name }
      : {
          sph:      isBase ? ((form.sph || '').replace(/^\+/, '') || null) : (form.sph || null),
          cyl:      usesCyl  ? (form.cyl  && form.cyl  !== '-' ? form.cyl  : null) : null,
          axis:     usesAxis ? (form.axis && form.axis !== '-' ? form.axis : null) : null,
          addition: usesAdd  ? (form.addition && form.addition !== '-' ? form.addition : null) : null,
          name_key: null,
        }
    let cancelled = false
    ;(async () => {
      const base = supabase.from('stock').select('id, qty')
        .eq('product_id', form.product_id).eq('location_id', form.location_id)
      const { data } = await buildStockQuery(base, specs).maybeSingle()
      if (!cancelled) setDupWarning(data ? data.qty : null)
    })()
    return () => { cancelled = true }
  }, [form.product_id, form.location_id, form.sph, form.cyl, form.axis, form.addition])

  useEffect(() => {
    if (profile?.company_id) fetchRecentLogs()
  }, [profile])

  async function fetchProducts(classId) {
    const { data } = await supabase.from('products').select('*')
      .eq('company_id', profile.company_id).eq('class_id', classId)
      .eq('is_active', true).order('name')
    setProducts(data || [])
    setForm(f => ({ ...f, product_id: '' }))
  }

  async function fetchRecentLogs() {
    const { data } = await supabase.from('transactions')
      .select('*, products(name, spec_type, class_id), locations(name, code)')
      .eq('company_id', profile.company_id)
      .eq('type', 'INVENTORY_ADD')
      .order('created_at', { ascending: false }).limit(100)
    setRecentLogs(data || [])
    setLogPage(0)
  }

  function flash(type, text) { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 4000) }

  const selectedProduct = products.find(p => p.id === form.product_id)
  const specType  = selectedProduct?.spec_type || 'sph_add'
  const isUtility = specType === 'name_only'

  function getSpecValues() {
    if (isUtility) return { sph: null, cyl: null, axis: null, addition: null, name_key: selectedProduct?.name }
    const isBase   = specType.startsWith('base_')
    const usesCyl  = specType === 'sph_cyl' || specType === 'sph_cyl_axis_add'
    const usesAxis = specType === 'sph_cyl_axis_add'
    const usesAdd  = specType === 'sph_add' || specType === 'base_add' || specType === 'sph_cyl_axis_add'
    return {
      // Base: always strip leading '+' to enforce unsigned whole-number storage
      sph:      isBase ? ((form.sph || '').replace(/^\+/, '') || null) : (form.sph || null),
      cyl:      usesCyl  ? (form.cyl      && form.cyl      !== '-' ? form.cyl      : null) : null,
      axis:     usesAxis ? (form.axis     && form.axis     !== '-' ? form.axis     : null) : null,
      addition: usesAdd  ? (form.addition && form.addition !== '-' ? form.addition : null) : null,
      name_key: null,
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const qty = parseFloat(form.qty)
    if (!form.product_id || !form.location_id) { flash('error', 'Product and location required'); return }
    // Spec validation — required fields must be explicitly selected
    if (!isUtility) {
      const isBase = specType.startsWith('base_')
      if (!form.sph) { flash('error', `Please select a ${isBase ? 'Base' : 'SPH'} value`); return }
      const usesAdd = ['sph_add','base_add','sph_cyl_axis_add'].includes(specType)
      if (usesAdd && !form.addition) { flash('error', 'Please select an Addition value'); return }
      const needsCyl = ['sph_cyl','sph_cyl_axis_add'].includes(specType)
      if (needsCyl && !form.cyl) { flash('error', 'Please select a CYL value'); return }
      if (specType === 'sph_cyl_axis_add' && !form.axis) { flash('error', 'Please select an Axis value'); return }
    }
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
      company_id: profile.company_id, user_id: profile.id, status: 'SUCCESS', action: 'INVENTORY_ADD',
      details: { product: selectedProduct?.name, location: locations.find(l => l.id === form.location_id)?.code, ...specs, qty },
    })
    flash('success', `✓ +${qty} ${selectedProduct?.name} added`)
    setForm(f => ({ ...f, qty: '' }))
    fetchRecentLogs()
    setLoading(false)
  }

  async function prefillFromLog(log) {
    const classId = log.products?.class_id
    if (classId && classId !== form.class_id) {
      setForm(f => ({ ...f, class_id: classId }))
      await new Promise(r => setTimeout(r, 300))
    }
    const isBaseProduct = log.products?.spec_type?.startsWith('base_')
    setForm(f => ({
      ...f,
      class_id:   classId || f.class_id,
      product_id: log.product_id,
      location_id: log.location_id,
      // Re-use the exact values from the log row the user clicked
      // Normalise base sph (strip legacy '+' if present)
      sph:      isBaseProduct ? (log.sph || '').replace(/^\+/, '') : (log.sph || ''),
      cyl:      (log.cyl      && log.cyl      !== '-') ? log.cyl      : '',
      axis:     (log.axis     && log.axis     !== '-') ? log.axis     : '',
      addition: (log.addition && log.addition !== '-') ? log.addition : '',
      qty: '',
    }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
    flash('info', `Form pre-filled from "${log.products?.name}" — adjust qty and submit.`)
  }

  async function handleVoid(log) {
    if (!window.confirm(`Void this entry?\n\n${log.products?.name} +${log.qty} at ${log.locations?.code}\n\nThis will subtract ${log.qty} from stock.`)) return
    setVoiding(log.id)
    const specs = { sph: log.sph, cyl: log.cyl, axis: log.axis, addition: log.addition, name_key: log.name_key }
    const base = supabase.from('stock').select('id, qty')
      .eq('product_id', log.product_id).eq('location_id', log.location_id)
    const { data: stockRow } = await buildStockQuery(base, specs).maybeSingle()
    if (!stockRow) { flash('error', 'Stock row not found.'); setVoiding(null); return }
    const newQty = Math.max(0, stockRow.qty - log.qty)
    const { error: stockErr } = await supabase.from('stock')
      .update({ qty: newQty, updated_at: new Date() }).eq('id', stockRow.id)
    if (stockErr) { flash('error', stockErr.message); setVoiding(null); return }
    await supabase.from('transactions').insert({
      company_id: profile.company_id, type: 'INVENTORY_VOID',
      product_id: log.product_id, location_id: log.location_id,
      ...specs, qty: log.qty, created_by: profile.id, notes: `Void of transaction ${log.id}`,
    })
    await supabase.from('audit_log').insert({
      company_id: profile.company_id, user_id: profile.id, status: 'SUCCESS', action: 'INVENTORY_VOID',
      details: { voided_transaction: log.id, product: log.products?.name, location: log.locations?.code, qty: log.qty, new_stock_qty: newQty },
    })
    flash('success', `Voided — ${log.qty} removed from ${log.locations?.code}.`)
    fetchRecentLogs()
    setVoiding(null)
  }

  function formatSpec(log) {
    if (log.name_key) return log.name_key
    const parts = []
    if (log.sph) parts.push(log.sph)
    if (log.cyl && log.cyl !== '-') parts.push(log.cyl)
    if (log.axis && log.axis !== '-') parts.push(`ax${log.axis}`)
    if (log.addition && log.addition !== '-') parts.push(`add${log.addition}`)
    return parts.join(' / ') || '—'
  }

  function timeAgo(ts) {
    const diff = Date.now() - new Date(ts)
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <SpecSelector
            form={form} setForm={setForm}
            products={products} classes={classes}
            showLocation locations={locations}
          />

          {/* ── Duplicate-stock warning ── */}
          {dupWarning !== null && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <span className="text-amber-500 text-base flex-shrink-0">⚠</span>
              <p className="text-xs text-amber-800 leading-relaxed">
                <strong>Stock already exists</strong> at this location for these specs&nbsp;—&nbsp;
                current qty: <strong>{dupWarning}</strong>. Submitting will add to the existing row.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
            <input type="number" min="0.5" step="0.5" required
              value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
              placeholder="e.g. 50"
              className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 text-base" />
          </div>

          {msg.text && (
            <div className={`text-sm rounded-xl px-4 py-3 ${
              msg.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' :
              msg.type === 'info'  ? 'bg-blue-50 border border-blue-200 text-blue-700' :
              'bg-green-50 border border-green-200 text-green-700'
            }`}>{msg.text}</div>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-semibold text-base hover:bg-slate-700 transition-colors disabled:opacity-50">
            {loading ? 'Adding...' : 'Add stock'}
          </button>
        </form>
      </div>

      {/* Recent entries */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-700 text-sm">Recent additions</h3>
        <p className="text-xs text-slate-400">Tap a row to re-use · Void to reverse</p>
      </div>
      {recentLogs.length > 0 && (
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate-400">
            {Math.min(logPage * 20 + 1, recentLogs.length)}–{Math.min((logPage + 1) * 20, recentLogs.length)} of {recentLogs.length}
          </p>
          <div className="flex gap-1">
            <button onClick={() => setLogPage(p => Math.max(0, p - 1))} disabled={logPage === 0}
              className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-50">‹ Prev</button>
            <button onClick={() => setLogPage(p => Math.min(Math.ceil(recentLogs.length / 20) - 1, p + 1))} disabled={(logPage + 1) * 20 >= recentLogs.length}
              className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-50">Next ›</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {recentLogs.length === 0 && <p className="text-slate-400 text-sm">No entries yet.</p>}
        {recentLogs.slice(logPage * 20, (logPage + 1) * 20).map(log => (
          <div key={log.id}
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
    </>
  )
}

// ── Inventory Transfer tab ────────────────────────────────────
function InventoryTransferTab({ profile, locations, classes }) {
  const [products, setProducts]         = useState([])
  // Transfer tab — spec fields start blank; user must select before stock loads
  const [selForm, setSelForm] = useState({ class_id: '', product_id: '', sph: '', cyl: '', axis: '', addition: '' })
  const [stockRows, setStockRows]       = useState([])   // sources with available + moveQty
  const [toRows, setToRows]             = useState([{ _id: Date.now(), location_id: '', qty: '' }])
  const [searching, setSearching]       = useState(false)
  const [loading, setLoading]           = useState(false)
  const [msg, setMsg]                   = useState({ type: '', text: '' })
  const [summary, setSummary]           = useState(null)

  useEffect(() => {
    if (selForm.class_id) fetchProducts(selForm.class_id)
  }, [selForm.class_id])

  async function fetchProducts(classId) {
    const { data } = await supabase.from('products').select('*')
      .eq('company_id', profile.company_id).eq('class_id', classId)
      .eq('is_active', true).order('name')
    setProducts(data || [])
    setSelForm(f => ({ ...f, product_id: '' }))
  }

  function flash(type, text) { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 5000) }

  const selectedProduct = products.find(p => p.id === selForm.product_id)
  const specType  = selectedProduct?.spec_type || 'sph_add'
  const isUtility = specType === 'name_only'

  function getSpecValues() {
    if (isUtility) return { sph: null, cyl: null, axis: null, addition: null, name_key: selectedProduct?.name }
    const isBase   = specType.startsWith('base_')
    const usesCyl  = specType === 'sph_cyl' || specType === 'sph_cyl_axis_add'
    const usesAxis = specType === 'sph_cyl_axis_add'
    const usesAdd  = specType === 'sph_add' || specType === 'base_add' || specType === 'sph_cyl_axis_add'
    return {
      // Base: always strip leading '+' to enforce unsigned whole-number storage
      sph:      isBase ? ((selForm.sph || '').replace(/^\+/, '') || null) : (selForm.sph || null),
      cyl:      usesCyl  ? (selForm.cyl      && selForm.cyl      !== '-' ? selForm.cyl      : null) : null,
      axis:     usesAxis ? (selForm.axis     && selForm.axis     !== '-' ? selForm.axis     : null) : null,
      addition: usesAdd  ? (selForm.addition && selForm.addition !== '-' ? selForm.addition : null) : null,
      name_key: null,
    }
  }

  // Auto-load stock whenever product or spec selection changes
  // Guard: only search when all required spec fields are actually selected
  useEffect(() => {
    if (!selForm.product_id) return
    const product = products.find(p => p.id === selForm.product_id)
    if (!product) return
    const st = product.spec_type
    const isBase = st.startsWith('base_')
    const isUtil = st === 'name_only'
    if (!isUtil) {
      if (!selForm.sph) return // required for all non-utility
      const needsAdd = ['sph_add','base_add','sph_cyl_axis_add'].includes(st)
      if (needsAdd && !selForm.addition) return
      const needsCyl = ['sph_cyl','sph_cyl_axis_add'].includes(st)
      if (needsCyl && !selForm.cyl) return
      if (st === 'sph_cyl_axis_add' && !selForm.axis) return
    }
    let cancelled = false
    async function loadStock() {
      setSearching(true)
      // Reset move quantities when selection changes
      setStockRows(r => r.map(s => ({ ...s, moveQty: '' })))
      const specs = getSpecValues()
      let q = supabase.from('stock')
        .select('id, qty, allocated_qty, location_id, locations(id, name, code)')
        .eq('product_id', selForm.product_id)
        .eq('company_id', profile.company_id)
        .gt('qty', 0)
      q = buildStockQuery(q, specs)
      const { data, error } = await q
      if (cancelled) return
      if (error) { flash('error', error.message); setSearching(false); return }
      setStockRows((data || []).map(s => ({
        stock_id:      s.id,
        location_id:   s.location_id,
        location_code: s.locations?.code,
        location_name: s.locations?.name,
        available:     s.qty - (s.allocated_qty || 0),
        moveQty:       '',
      })))
      setSearching(false)
    }
    loadStock()
    return () => { cancelled = true }
  }, [selForm.product_id, selForm.sph, selForm.cyl, selForm.axis, selForm.addition])

  // totals
  const totalFrom = stockRows.reduce((sum, s) => sum + (parseFloat(s.moveQty) || 0), 0)
  const totalTo   = toRows.reduce((sum, r)   => sum + (parseFloat(r.qty)     || 0), 0)
  const balanced  = totalFrom > 0 && totalFrom === totalTo

  // Auto-sync qty if there is only one destination
  useEffect(() => {
    if (toRows.length === 1 && parseFloat(toRows[0].qty || 0) !== totalFrom) {
      setToRows(r => [{ ...r[0], qty: totalFrom ? String(totalFrom) : '' }])
    }
  }, [totalFrom, toRows.length])

  function updateMoveQty(location_id, val) {
    setStockRows(r => r.map(s => s.location_id === location_id ? { ...s, moveQty: val } : s))
  }
  function addToRow() {
    setToRows(r => [...r, { _id: Date.now(), location_id: '', qty: '' }])
  }
  function updateToRow(id, field, val) {
    setToRows(r => r.map(row => row._id === id ? { ...row, [field]: val } : row))
  }
  function removeToRow(id) {
    setToRows(r => r.filter(row => row._id !== id))
  }

  function validate() {
    const errors = []
    for (const s of stockRows) {
      const qty = parseFloat(s.moveQty) || 0
      if (qty < 0)              errors.push(`Negative qty at ${s.location_code}`)
      if (qty > s.available)    errors.push(`${s.location_code} only has ${s.available} units available`)
    }
    const activeFromIds = stockRows.filter(s => (parseFloat(s.moveQty) || 0) > 0).map(s => s.location_id)
    for (const r of toRows) {
      if (!r.location_id)       errors.push('A destination location is not selected')
      if (activeFromIds.includes(r.location_id)) {
        const loc = locations.find(l => l.id === r.location_id)
        errors.push(`${loc?.code} is both a source and destination — pick a different destination`)
      }
    }
    if (!balanced) errors.push(`Total FROM (${totalFrom}) ≠ Total TO (${totalTo}) — they must match`)
    return errors
  }

  async function handleTransfer() {
    const errors = validate()
    if (errors.length) { flash('error', errors[0]); return }
    setLoading(true)
    const specs     = getSpecValues()
    const fromNames = stockRows.filter(s => (parseFloat(s.moveQty) || 0) > 0).map(s => s.location_code).join(', ')
    const toNames   = toRows.map(r => locations.find(l => l.id === r.location_id)?.code).join(', ')

    try {
      // ── DEBITS (source locations) ──
      for (const s of stockRows) {
        const qty = parseFloat(s.moveQty) || 0
        if (qty <= 0) continue
        await supabase.from('stock')
          .update({ qty: s.available - qty, updated_at: new Date() }).eq('id', s.stock_id)
        await supabase.from('transactions').insert({
          company_id: profile.company_id, type: 'STOCK_TRANSFER_OUT',
          product_id: selForm.product_id, location_id: s.location_id,
          ...specs, qty, created_by: profile.id,
          notes: `Transfer to ${toNames}`,
        })
        await supabase.from('audit_log').insert({
          company_id: profile.company_id, user_id: profile.id,
          status: 'SUCCESS', action: 'STOCK_TRANSFER_OUT',
          details: { product: selectedProduct?.name, from: s.location_code, qty, specs },
        })
      }

      // ── CREDITS (destination locations) ──
      for (const r of toRows) {
        const qty = parseFloat(r.qty) || 0
        if (!r.location_id || qty <= 0) continue
        let q = supabase.from('stock').select('id, qty')
          .eq('product_id', selForm.product_id).eq('location_id', r.location_id)
        q = buildStockQuery(q, specs)
        const { data: existing } = await q.maybeSingle()
        if (existing) {
          await supabase.from('stock')
            .update({ qty: existing.qty + qty, updated_at: new Date() }).eq('id', existing.id)
        } else {
          await supabase.from('stock').insert({
            company_id: profile.company_id, product_id: selForm.product_id,
            location_id: r.location_id, ...specs, qty,
          })
        }
        const destCode = locations.find(l => l.id === r.location_id)?.code
        await supabase.from('transactions').insert({
          company_id: profile.company_id, type: 'STOCK_TRANSFER_IN',
          product_id: selForm.product_id, location_id: r.location_id,
          ...specs, qty, created_by: profile.id,
          notes: `Transfer from ${fromNames}`,
        })
        await supabase.from('audit_log').insert({
          company_id: profile.company_id, user_id: profile.id,
          status: 'SUCCESS', action: 'STOCK_TRANSFER_IN',
          details: { product: selectedProduct?.name, to: destCode, qty, specs },
        })
      }

      setSummary({
        product:   selectedProduct?.name,
        totalMoved: totalFrom,
        fromLocs: stockRows.filter(s => (parseFloat(s.moveQty) || 0) > 0)
          .map(s => ({ code: s.location_code, qty: parseFloat(s.moveQty) })),
        toLocs: toRows.map(r => ({
          code: locations.find(l => l.id === r.location_id)?.code,
          qty: parseFloat(r.qty),
        })),
      })
    } catch (e) {
      flash('error', e.message || 'Transfer failed')
    }
    setLoading(false)
  }

  function reset() {
    setStockRows(r => r.map(s => ({ ...s, moveQty: '' })))
    setToRows([{ _id: Date.now(), location_id: '', qty: '' }])
    setSummary(null); setMsg({ type: '', text: '' })
  }

  // ── Done screen ──
  if (summary) return (
    <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
      <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-lg font-bold text-slate-900 mb-1">Transfer complete</h2>
      <p className="text-sm text-slate-500 mb-6">
        <strong>{summary.totalMoved}</strong> units of <strong>{summary.product}</strong> moved successfully.
      </p>

      <div className="flex gap-8 justify-center mb-8">
        <div className="text-left">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">From</p>
          {summary.fromLocs.map((l, i) => (
            <p key={i} className="text-sm font-medium text-slate-900 mb-1">
              {l.code} <span className="text-red-500 font-bold">−{l.qty}</span>
            </p>
          ))}
        </div>
        <div className="text-slate-200 text-3xl self-center font-light">→</div>
        <div className="text-left">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">To</p>
          {summary.toLocs.map((l, i) => (
            <p key={i} className="text-sm font-medium text-slate-900 mb-1">
              {l.code} <span className="text-green-600 font-bold">+{l.qty}</span>
            </p>
          ))}
        </div>
      </div>

      <button onClick={reset}
        className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors">
        New transfer
      </button>
    </div>
  )

  // Derived: are all required spec fields selected for this product?
  const specsComplete = (() => {
    if (!selForm.product_id || !selectedProduct) return false
    const st = selectedProduct.spec_type
    if (st === 'name_only') return true
    if (!selForm.sph) return false
    if (['sph_add','base_add','sph_cyl_axis_add'].includes(st) && !selForm.addition) return false
    if (['sph_cyl','sph_cyl_axis_add'].includes(st) && !selForm.cyl) return false
    if (st === 'sph_cyl_axis_add' && !selForm.axis) return false
    return true
  })()

  return (
    <div className="space-y-5">

      {/* ── Select product ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-700 text-sm">Select product to transfer</h3>
          {searching && <span className="text-xs text-slate-400 animate-pulse">Loading stock…</span>}
        </div>
        <SpecSelector
          form={selForm} setForm={setSelForm}
          products={products} classes={classes}
          showLocation={false} locations={[]}
          compact
        />
      </div>

      {/* ── Transfer panel — always visible once product is selected ── */}
      {selForm.product_id && (
        <>
          {/* FROM */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-800 text-sm">From — source locations</h3>
                <p className="text-xs text-slate-400 mt-0.5">Enter how many units to move from each (leave blank to skip)</p>
              </div>
              {totalFrom > 0 && <span className="text-sm font-bold text-red-500 bg-red-50 px-2 py-1 rounded-lg">−{totalFrom}</span>}
            </div>

            {!specsComplete ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <span className="text-2xl">☝️</span>
                <p className="text-sm font-medium text-slate-600">Select all required spec values above</p>
                <p className="text-xs text-slate-400">Stock locations will appear here once the spec is complete.</p>
              </div>
            ) : searching ? (
              <div className="flex items-center gap-2 py-6 justify-center text-slate-400 text-sm">
                <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                Searching…
              </div>
            ) : stockRows.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">
                No stock found at any location for this product + spec.
                <br /><span className="text-xs">Have you added stock via Inventory Entry?</span>
              </div>
            ) : (
              <div className="space-y-3">
                {stockRows.map(s => {
                  const qty = parseFloat(s.moveQty) || 0
                  const overLimit = qty > s.available
                  return (
                    <div key={s.location_id} className={`flex items-center gap-3 p-3 rounded-xl border ${overLimit ? 'border-red-200 bg-red-50' : 'border-slate-100'}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{s.location_code}
                          <span className="text-slate-400 font-normal ml-1">— {s.location_name}</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Available: <strong className={overLimit ? 'text-red-600' : 'text-slate-700'}>{s.available}</strong> units
                          {overLimit && <span className="text-red-500 ml-2">⚠ Exceeds available</span>}
                        </p>
                      </div>
                      <input
                        type="number" min="0" step="0.5" max={s.available}
                        value={s.moveQty}
                        onChange={e => updateMoveQty(s.location_id, e.target.value)}
                        placeholder="0"
                        className={`w-24 px-3 py-2 rounded-lg border text-right text-slate-900 focus:outline-none focus:ring-2 text-sm ${
                          overLimit ? 'border-red-300 focus:ring-red-400' : 'border-slate-300 focus:ring-slate-900'
                        }`}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* TO */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-800 text-sm">To — destination locations</h3>
                <p className="text-xs text-slate-400 mt-0.5">Add one or more destinations. Quantities must balance with the source total.</p>
              </div>
              {totalTo > 0 && <span className="text-sm font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">+{totalTo}</span>}
            </div>

            <div className="space-y-2 mb-3">
              {toRows.map(r => (
                <div key={r._id} className="flex items-center gap-2">
                  <select value={r.location_id} onChange={e => updateToRow(r._id, 'location_id', e.target.value)}
                    className="flex-1 px-3 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white text-sm">
                    <option value="">Pick destination…</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
                  </select>
                  <input type="number" min="0.5" step="0.5"
                    value={r.qty} onChange={e => updateToRow(r._id, 'qty', e.target.value)}
                    placeholder="Qty"
                    readOnly={toRows.length === 1}
                    className={`w-24 px-3 py-2.5 rounded-xl border text-right text-sm focus:outline-none focus:ring-2 ${
                      toRows.length === 1
                        ? 'bg-slate-50 border-slate-200 text-slate-500 outline-none focus:ring-0'
                        : 'bg-white border-slate-300 text-slate-900 focus:ring-slate-900'
                    }`} />
                  {toRows.length > 1 && (
                    <button onClick={() => removeToRow(r._id)}
                      className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">✕</button>
                  )}
                </div>
              ))}
            </div>

            <button onClick={addToRow}
              className="text-xs text-slate-500 hover:text-slate-900 transition-colors font-medium px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-400">
              + Add destination
            </button>
          </div>

          {/* Balance indicator */}
          <div className={`rounded-xl px-4 py-3 flex items-center gap-3 ${
            balanced ? 'bg-green-50 border border-green-100' :
            totalFrom > 0 ? 'bg-amber-50 border border-amber-100' : 'bg-slate-50 border border-slate-100'
          }`}>
            <span className="text-xl">{balanced ? '✓' : totalFrom > 0 ? '⚠' : '·'}</span>
            <div className="text-xs">
              <p className={`font-semibold ${balanced ? 'text-green-700' : totalFrom > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
                {balanced ? 'Transfer is balanced — ready to confirm'
                  : totalFrom === 0 ? 'Enter quantities above to move'
                  : totalFrom > totalTo
                    ? `${totalFrom - totalTo} units unassigned — add more destinations or increase destination qty`
                    : `Over-assigned by ${totalTo - totalFrom} — reduce destination qty`}
              </p>
              {totalFrom > 0 && (
                <p className={balanced ? 'text-green-600' : 'text-amber-600'}>
                  Moving {totalFrom} from source · Assigning {totalTo} to destination{toRows.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>

          {msg.text && (
            <div className={`text-sm rounded-xl px-4 py-3 ${
              msg.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'
            }`}>{msg.text}</div>
          )}

          <div className="flex gap-3">
            <button onClick={reset}
              className="px-5 py-3 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
              ← Start again
            </button>
            <button onClick={handleTransfer} disabled={!balanced || loading}
              className="flex-1 bg-slate-900 text-white py-3 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-40">
              {loading ? 'Transferring…' : `Confirm transfer of ${totalFrom} units →`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Import Data tab (moved from Products) ────────────────────
const TEMPLATE_GROUPS = [
  {
    group: 'Finished Lenses',
    templates: [
      { id: 'finished_sph_add', label: 'Finished (SPH + ADD)', desc: 'e.g. Bifocal, Photochromic, Progressive', spec_type: 'sph_add', sphKey: 'sph', hasSph: true, hasCyl: false, hasAxis: false, hasAdd: true, isUtility: false, csvCols: ['product_name','location_code','sph','addition','qty'], examples: ['1.56 Bifocal,STORE,+200,+100,50','CR39 Photochromic,SHOP1,Plano,+125,20'] },
      { id: 'single_vision', label: 'Single Vision (SPH + CYL)', desc: 'e.g. S/V AR, CR39 SV, 1.56 SV', spec_type: 'sph_cyl', sphKey: 'sph', hasSph: true, hasCyl: true, hasAxis: false, hasAdd: false, isUtility: false, csvCols: ['product_name','location_code','sph','cyl','qty'], examples: ['CR39 SV AR,STORE,+200,-025,20','1.56 SV,SHOP1,-025,-050,10'] },
    ],
  },
  {
    group: 'Semi-finished Blanks',
    templates: [
      { id: 'semi_base_add', label: 'Blank (Base + ADD)', desc: 'e.g. Bifocal blank, Progressive blank', spec_type: 'base_add', sphKey: 'base', hasSph: true, hasCyl: false, hasAxis: false, hasAdd: true, isUtility: false, csvCols: ['product_name','location_code','base','addition','qty'], examples: ['1.56 Blank Bifocal,STORE,200,+100,12'] },
      { id: 'semi_base_only', label: 'Blank (Base only)', desc: 'e.g. Single vision blank', spec_type: 'base_only', sphKey: 'base', hasSph: true, hasCyl: false, hasAxis: false, hasAdd: false, isUtility: false, csvCols: ['product_name','location_code','base','qty'], examples: ['1.50 Blank SV,STORE,200,10'] },
    ],
  },
  {
    group: 'Order / RX Lenses',
    templates: [
      { id: 'order_full', label: 'Full Spec (SPH + CYL + AXIS + ADD)', desc: 'e.g. Essilor, Hoya HD, Zeiss', spec_type: 'sph_cyl_axis_add', sphKey: 'sph', hasSph: true, hasCyl: true, hasAxis: true, hasAdd: true, isUtility: false, csvCols: ['product_name','location_code','sph','cyl','axis','addition','qty'], examples: ['Essilor Varilux,STORE,+200,-050,90,+200,5'] },
    ],
  },
  {
    group: 'Utilities / Sundries',
    templates: [
      { id: 'utilities', label: 'Utilities (Name only)', desc: 'e.g. Blue Tint, Cleaning Kit', spec_type: 'name_only', sphKey: null, hasSph: false, hasCyl: false, hasAxis: false, hasAdd: false, isUtility: true, csvCols: ['product_name','location_code','qty'], examples: ['Blue Tint,STORE,15'] },
    ],
  },
]
const ALL_IMPORT_TEMPLATES = TEMPLATE_GROUPS.flatMap(g => g.templates)

function buildImportStockQuery(base, { sph, cyl, axis, addition, name_key }) {
  let q = base
  sph      === null ? q = q.is('sph', null)      : q = q.eq('sph', sph)
  cyl      === null ? q = q.is('cyl', null)      : q = q.eq('cyl', cyl)
  axis     === null ? q = q.is('axis', null)     : q = q.eq('axis', axis)
  addition === null ? q = q.is('addition', null) : q = q.eq('addition', addition)
  name_key === null ? q = q.is('name_key', null) : q = q.eq('name_key', name_key)
  return q
}

function buildImportSpecs(row, tpl) {
  if (tpl.isUtility) return { sph: null, cyl: null, axis: null, addition: null, name_key: (row.product_name || '').trim() || null }
  let sphVal = (row[tpl.sphKey] || '').trim() || null
  // Base templates: strip leading '+' so '+200' and '200' both normalise to '200'
  if (tpl.sphKey === 'base' && sphVal) sphVal = sphVal.replace(/^\+/, '')
  return {
    sph: sphVal,
    cyl: tpl.hasCyl ? ((row.cyl && row.cyl !== '-') ? row.cyl.trim() : null) : null,
    axis: tpl.hasAxis ? ((row.axis && row.axis !== '-') ? row.axis.trim() : null) : null,
    addition: tpl.hasAdd ? ((row.addition && row.addition !== '-') ? row.addition.trim() : null) : null,
    name_key: null,
  }
}

function parseImportCSV(text) {
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').trim().split('\n')
  if (lines.length < 2) return []
  function parseLine(line) { const r=[]; let c='',inQ=false; for(let i=0;i<line.length;i++){const ch=line[i]; if(ch==='"'){if(inQ&&line[i+1]==='"'){c+='"';i++}else inQ=!inQ}else if(ch===','&&!inQ){r.push(c.trim());c=''}else{c+=ch}} r.push(c.trim()); return r }
  const headers = parseLine(lines[0]).map(h=>h.toLowerCase().replace(/"/g,'').trim())
  return lines.slice(1).map(line => { const v=parseLine(line); const row={}; headers.forEach((h,i)=>{row[h]=v[i]||''}); return row }).filter(row=>Object.values(row).some(v=>v!==''))
}

function downloadImportTemplate(tpl) {
  const csv = [tpl.csvCols.join(','), ...tpl.examples].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `optisource_${tpl.id}_template.csv`; a.click()
  URL.revokeObjectURL(url)
}

async function runInventoryImport(validatedRows, importMode, profile) {
  const ready = validatedRows.filter(r => r.status === 'ready')
  let imported = 0, failed = 0
  for (const row of ready) {
    try {
      let q = buildImportStockQuery(supabase.from('stock').select('id, qty').eq('product_id', row.product.id).eq('location_id', row.location.id), row.specs)
      const { data: existing } = await q.maybeSingle()
      if (existing) {
        const newQty = importMode === 'add' ? existing.qty + Number(row.qty) : Number(row.qty)
        await supabase.from('stock').update({ qty: newQty, updated_at: new Date() }).eq('id', existing.id)
      } else {
        await supabase.from('stock').insert({ company_id: profile.company_id, product_id: row.product.id, location_id: row.location.id, ...row.specs, qty: Number(row.qty) })
      }
      await supabase.from('transactions').insert({ company_id: profile.company_id, type: 'INVENTORY_ADD', product_id: row.product.id, location_id: row.location.id, ...row.specs, qty: row.qty, created_by: profile.id, notes: 'Stock import' })
      imported++
    } catch { failed++ }
  }
  await supabase.from('audit_log').insert({ company_id: profile.company_id, user_id: profile.id, status: 'SUCCESS', action: 'MIGRATION_IMPORT', details: { imported, failed, mode: importMode } })
  return { imported, failed, skipped: validatedRows.filter(r => r.status === 'error').length }
}

function ImportDataTab({ profile }) {
  const [products, setProducts]   = useState([])
  const [classes, setClasses]     = useState([])
  const [classId, setClassId]     = useState('')
  const [productId, setProductId] = useState('')
  const [step, setStep]           = useState('pick')   // 'pick' | 'upload' | 'preview' | 'done'
  const [validatedRows, setValidatedRows] = useState([])
  const [importMode, setImportMode]       = useState('add')
  const [dragging, setDragging]   = useState(false)
  const [fileError, setFileError] = useState('')
  const [importing, setImporting] = useState(false)
  const [summary, setSummary]     = useState(null)
  const fileRef = useRef()

  const [overrideTplId, setOverrideTplId] = useState('')

  useEffect(() => {
    if (profile?.company_id) {
      supabase.from('product_classes').select('*').eq('company_id', profile.company_id).order('name')
        .then(({ data }) => { setClasses(data || []); if (data?.length) setClassId(data[0].id) })
    }
  }, [profile])

  useEffect(() => {
    if (classId) {
      supabase.from('products').select('id, name, spec_type').eq('company_id', profile.company_id).eq('class_id', classId).eq('is_active', true).order('name')
        .then(({ data }) => { setProducts(data || []); setProductId(data?.[0]?.id || '') })
    }
  }, [classId])

  useEffect(() => { setOverrideTplId('') }, [productId])

  const selectedProduct = products.find(p => p.id === productId)
  
  // Derive the default template from the product's spec_type
  const defaultTemplate = selectedProduct
    ? ALL_IMPORT_TEMPLATES.find(t => t.spec_type === selectedProduct.spec_type) || ALL_IMPORT_TEMPLATES[0]
    : null
    
  const template = overrideTplId 
    ? ALL_IMPORT_TEMPLATES.find(t => t.id === overrideTplId) || defaultTemplate 
    : defaultTemplate

  // Template CSV cols without product_name (it's captured via dropdown)
  const csvCols = template ? template.csvCols.filter(c => c !== 'product_name') : []

  async function validateRows(rows) {
    const { data: locs } = await supabase.from('locations').select('id, name, code').eq('company_id', profile.company_id)
    const locationMap = Object.fromEntries((locs || []).map(l => [l.code.toLowerCase().trim(), l]))
    return rows.map((row, i) => {
      const locationCode = (row.location_code || '').trim()
      const qty = parseFloat(row.qty)
      const location = locationMap[locationCode.toLowerCase()]
      const errors = []
      if (!locationCode) errors.push('Missing location'); else if (!location) errors.push(`Location "${locationCode}" not found`)
      if (isNaN(qty) || qty <= 0) errors.push('Qty must be positive')
      return {
        rowNum: i + 2, ...row,
        location_code: locationCode,
        product: selectedProduct,
        location,
        qty: isNaN(qty) ? 0 : qty,
        specs: buildImportSpecs({ ...row, product_name: selectedProduct.name }, template),
        errors,
        status: errors.length ? 'error' : 'ready',
      }
    })
  }

  async function processFile(file) {
    if (!file) return
    if (!file.name.match(/\.(csv|txt)$/i)) { setFileError('Please upload a .csv file.'); return }
    setFileError('')
    const text = await file.text()
    const rows = parseImportCSV(text)
    if (!rows.length) { setFileError('File appears empty.'); return }
    const normalized = rows.map(row => {
      const r = { ...row }
      if (template.sphKey === 'base' && !r.base && r.sph) r.base = r.sph
      return r
    })
    const validated = await validateRows(normalized)
    setValidatedRows(validated); setStep('preview')
  }

  async function handleImport() {
    setImporting(true)
    const result = await runInventoryImport(validatedRows, importMode, profile)
    setSummary(result); setImporting(false); setStep('done')
  }

  function reset() {
    setStep('pick'); setValidatedRows([]); setFileError(''); setSummary(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const readyRows  = validatedRows.filter(r => r.status === 'ready')
  const errorRows  = validatedRows.filter(r => r.status === 'error')

  if (importing) return (
    <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
      <div className="w-10 h-10 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-sm font-semibold text-slate-900">Importing stock…</p>
      <p className="text-xs text-slate-400 mt-1">Do not close this tab</p>
    </div>
  )

  if (step === 'done' && summary) return (
    <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
      <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
      </div>
      <h2 className="text-lg font-bold text-slate-900 mb-1">Import complete</h2>
      <p className="text-sm text-slate-500 mb-4">Product: <strong>{selectedProduct?.name}</strong></p>
      <div className="grid grid-cols-3 gap-3 mb-7 max-w-xs mx-auto">
        <div className="bg-green-50 rounded-xl p-3 text-center"><p className="text-xl font-bold text-green-700">{summary.imported}</p><p className="text-xs text-green-600">Imported</p></div>
        <div className={`rounded-xl p-3 text-center ${summary.failed ? 'bg-red-50' : 'bg-slate-50'}`}><p className={`text-xl font-bold ${summary.failed ? 'text-red-600' : 'text-slate-300'}`}>{summary.failed}</p><p className={`text-xs ${summary.failed ? 'text-red-500' : 'text-slate-300'}`}>Failed</p></div>
        <div className="bg-slate-50 rounded-xl p-3 text-center"><p className="text-xl font-bold text-slate-400">{summary.skipped}</p><p className="text-xs text-slate-400">Skipped</p></div>
      </div>
      <button onClick={reset} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors">Import another batch</button>
    </div>
  )

  if (step === 'preview') return (
    <div className="space-y-4">
      <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="text-xl">📦</span>
        <div>
          <p className="text-sm font-semibold text-slate-900">{selectedProduct?.name}</p>
          <p className="text-xs text-slate-400">{template?.label}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl p-4 text-center border bg-slate-50 border-slate-100"><p className="text-2xl font-bold text-slate-700">{validatedRows.length}</p><p className="text-xs text-slate-400 mt-0.5">Total rows</p></div>
        <div className="rounded-xl p-4 text-center border bg-green-50 border-green-100"><p className="text-2xl font-bold text-green-600">{readyRows.length}</p><p className="text-xs text-green-500 mt-0.5">Ready</p></div>
        <div className={`rounded-xl p-4 text-center border ${errorRows.length ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}><p className={`text-2xl font-bold ${errorRows.length ? 'text-red-600' : 'text-slate-300'}`}>{errorRows.length}</p><p className={`text-xs mt-0.5 ${errorRows.length ? 'text-red-500' : 'text-slate-300'}`}>Will skip</p></div>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto" style={{maxHeight:'22rem',overflowY:'auto'}}>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="px-3 py-2.5 text-left text-slate-500 font-medium">#</th>
                <th className="px-3 py-2.5 text-left text-slate-500 font-medium">Loc</th>
                <th className="px-3 py-2.5 text-right text-slate-500 font-medium">Qty</th>
                <th className="px-3 py-2.5 text-left text-slate-500 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {validatedRows.map((row, i) => (
                <tr key={i} className={`border-t border-slate-100 ${row.status === 'error' ? 'bg-red-50' : 'hover:bg-slate-50'}`}>
                  <td className="px-3 py-2.5 text-slate-400">{row.rowNum}</td>
                  <td className="px-3 py-2.5 text-slate-600">{row.location_code || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-slate-900">{row.qty || '—'}</td>
                  <td className="px-3 py-2.5">{row.status === 'error' ? <span className="text-red-500">{row.errors[0]}</span> : <span className="text-green-600 font-medium">Ready</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[{v:'add',l:'Add to existing'},{v:'replace',l:'Replace stock'}].map(o => (
          <button key={o.v} onClick={() => setImportMode(o.v)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${importMode === o.v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{o.l}</button>
        ))}
      </div>
      <div className="flex gap-3">
        <button onClick={() => setStep('upload')} className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">← Re-upload</button>
        {readyRows.length > 0 && <button onClick={handleImport} className="flex-1 bg-slate-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800">Import {readyRows.length} row{readyRows.length !== 1 ? 's' : ''}{errorRows.length > 0 && <span className="text-slate-400 font-normal ml-1">· {errorRows.length} skipped</span>}</button>}
      </div>
    </div>
  )

  // Upload step
  if (step === 'upload') return (
    <div className="space-y-4">
      <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">📦</span>
          <div>
            <p className="text-sm font-semibold text-slate-900">{selectedProduct?.name}</p>
            <p className="text-xs text-slate-400">{template?.label}</p>
          </div>
        </div>
        <button onClick={() => setStep('pick')} className="text-xs text-slate-400 hover:text-slate-700">← Change</button>
      </div>

      <div className="bg-slate-900 text-white rounded-2xl p-5 flex items-start gap-4">
        <span className="text-2xl flex-shrink-0 mt-0.5">📄</span>
        <div>
          <p className="text-sm font-semibold mb-1">Download the template for {template?.label}</p>
          <p className="text-xs text-slate-400 mb-3 leading-relaxed">Fill in your stock data. The product is already selected — only location and spec columns are needed.</p>
          <button onClick={() => {
            const cols = csvCols
            const ex = template?.examples?.map(e => {
              // Strip product_name from example rows
              const parts = e.split(',')
              const pidx = template.csvCols.indexOf('product_name')
              if (pidx >= 0) parts.splice(pidx, 1)
              return parts.join(',')
            }) || []
            const csv = [cols.join(','), ...ex].join('\n')
            const blob = new Blob([csv], { type: 'text/csv' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = `optisource_${selectedProduct?.name?.replace(/\s+/g,'_')}_import.csv`; a.click()
            URL.revokeObjectURL(url)
          }} className="text-xs bg-white text-slate-900 px-4 py-2 rounded-lg font-semibold hover:bg-slate-100">Download template CSV</button>
        </div>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files?.[0]) }}
        onClick={() => fileRef.current?.click()}
        className={`bg-white border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${dragging ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-400'}`}
      >
        <p className="text-4xl mb-3">📂</p>
        <p className="text-sm font-semibold text-slate-900 mb-1">{dragging ? 'Drop to upload' : 'Upload your filled CSV'}</p>
        <p className="text-xs text-slate-400">click or drag and drop · .csv files only</p>
        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={e => processFile(e.target.files?.[0])} />
      </div>
      {fileError && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600">{fileError}</div>}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <p className="text-xs font-semibold text-slate-700 mb-3">Expected columns</p>
        <div className="flex flex-wrap gap-2">{csvCols.map(col => (<code key={col} className="bg-slate-100 px-2 py-1 rounded-lg font-mono text-xs text-slate-700">{col}</code>))}</div>
      </div>
    </div>
  )

  // Step 0 — pick product
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-slate-700 mb-1">Step 1 — Select a product to import stock into</p>
        <p className="text-xs text-slate-400">The import template will automatically match the product's spec type.</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Product class</label>
          <select value={classId} onChange={e => setClassId(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white text-base">
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
          <select value={productId} onChange={e => setProductId(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white text-base">
            {products.length === 0 ? <option value="">— no products —</option> : products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {selectedProduct && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Import template</p>
              <span className="text-green-600 text-sm font-bold">✓</span>
            </div>
            <select
              value={template?.id || ''}
              onChange={e => setOverrideTplId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white font-medium text-slate-800 mb-1"
            >
              <optgroup label="Auto-selected (Recommended)">
                {defaultTemplate && <option value={defaultTemplate.id}>{defaultTemplate.label}</option>}
              </optgroup>
              <optgroup label="Other templates">
                {ALL_IMPORT_TEMPLATES.filter(t => t.id !== defaultTemplate?.id).map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </optgroup>
            </select>
            <p className="text-xs text-slate-400 pl-1">{template?.desc}</p>
          </div>
        )}
        <button
          onClick={() => setStep('upload')}
          disabled={!selectedProduct}
          className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-semibold text-base hover:bg-slate-700 transition-colors disabled:opacity-40"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}

// ── Main Inventory page ───────────────────────────────────────
const TABS = ['Inventory Entry', 'Inventory Transfer', 'Import Data']

export default function Inventory() {
  const { profile } = useAuth()
  const [tab, setTab]           = useState('Inventory Entry')
  const [locations, setLocations] = useState([])
  const [classes, setClasses]     = useState([])

  useEffect(() => {
    if (profile?.company_id) { fetchLocations(); fetchClasses() }
  }, [profile])

  async function fetchLocations() {
    const { data } = await supabase.from('locations').select('*')
      .eq('company_id', profile.company_id).order('name')
    setLocations(data || [])
  }

  async function fetchClasses() {
    const { data } = await supabase.from('product_classes').select('*')
      .eq('company_id', profile.company_id).order('name')
    setClasses(data || [])
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 lg:px-6 lg:py-10">
        <h2 className="text-xl font-bold text-slate-800 mb-1">Inventory</h2>
        <p className="text-slate-500 text-sm mb-6">Add stock or move stock between locations.</p>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'Inventory Entry' && (
          <InventoryEntryTab profile={profile} locations={locations} classes={classes} />
        )}
        {tab === 'Inventory Transfer' && (
          <InventoryTransferTab profile={profile} locations={locations} classes={classes} />
        )}
        {tab === 'Import Data' && (
          <ImportDataTab profile={profile} />
        )}
      </div>
    </Layout>
  )
}