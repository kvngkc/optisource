import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import { useAuth } from '../../hooks/useAuth'
import Layout from '../../components/Layout'

// ── Spec dropdown values ──────────────────────────────────────
const SPH_VALUES = ['Plano',
  ...Array.from({ length: 80 }, (_, i) => '+' + String((i + 1) * 25).padStart(3, '0')),
  ...Array.from({ length: 80 }, (_, i) => '-' + String((i + 1) * 25).padStart(3, '0')),
]
const CYL_VALUES = ['-', '+000',
  ...Array.from({ length: 16 }, (_, i) => '-' + String((i + 1) * 25).padStart(3, '0')),
  ...Array.from({ length: 16 }, (_, i) => '+' + String((i + 1) * 25).padStart(3, '0')),
]
const AXIS_VALUES = ['-', '90', '180']
const ADD_VALUES  = ['-',
  ...Array.from({ length: 16 }, (_, i) => '+' + String((i + 1) * 25).padStart(3, '0')),
]

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

  const gs = compact ? 'w-full px-3 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white text-sm' : SC

  return (
    <div className="space-y-3">
      {showLocation && (
        <div>
          <label className={`block ${compact ? 'text-xs' : 'text-sm'} font-medium text-slate-700 mb-1`}>Location</label>
          <select value={form.location_id} onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))} className={gs}>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
          </select>
        </div>
      )}

      <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
        <div>
          <label className={`block ${compact ? 'text-xs' : 'text-sm'} font-medium text-slate-700 mb-1`}>Product class</label>
          <select value={form.class_id} onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))} className={gs}>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={`block ${compact ? 'text-xs' : 'text-sm'} font-medium text-slate-700 mb-1`}>Product</label>
          <select value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))} className={gs}>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {!isUtility && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={`block ${compact ? 'text-xs' : 'text-sm'} font-medium text-slate-700 mb-1`}>SPH</label>
            <select value={form.sph} onChange={e => setForm(f => ({ ...f, sph: e.target.value }))} className={gs}>
              {SPH_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          {(specType === 'sph_cyl' || specType === 'sph_cyl_axis_add') && (
            <div>
              <label className={`block ${compact ? 'text-xs' : 'text-sm'} font-medium text-slate-700 mb-1`}>CYL</label>
              <select value={form.cyl} onChange={e => setForm(f => ({ ...f, cyl: e.target.value }))} className={gs}>
                {CYL_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}
          {specType === 'sph_cyl_axis_add' && (
            <div>
              <label className={`block ${compact ? 'text-xs' : 'text-sm'} font-medium text-slate-700 mb-1`}>Axis</label>
              <select value={form.axis} onChange={e => setForm(f => ({ ...f, axis: e.target.value }))} className={gs}>
                {AXIS_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}
          {(specType === 'sph_add' || specType === 'sph_cyl_axis_add') && (
            <div>
              <label className={`block ${compact ? 'text-xs' : 'text-sm'} font-medium text-slate-700 mb-1`}>Addition</label>
              <select value={form.addition} onChange={e => setForm(f => ({ ...f, addition: e.target.value }))} className={gs}>
                {ADD_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
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
    sph: 'Plano', cyl: '-', axis: '-', addition: '-', qty: '',
  })
  const [loading, setLoading] = useState(false)
  const [voiding, setVoiding] = useState(null)
  const [msg, setMsg]         = useState({ type: '', text: '' })

  useEffect(() => {
    if (form.class_id) fetchProducts(form.class_id)
  }, [form.class_id])

  useEffect(() => {
    if (classes.length && !form.class_id) setForm(f => ({ ...f, class_id: classes[0].id }))
  }, [classes])

  useEffect(() => {
    if (locations.length && !form.location_id) {
      const pref = profile?.location_id ? locations.find(l => l.id === profile.location_id) : null
      setForm(f => ({ ...f, location_id: pref ? pref.id : locations[0].id }))
    }
  }, [locations])

  useEffect(() => {
    if (profile?.company_id) fetchRecentLogs()
  }, [profile])

  async function fetchProducts(classId) {
    const { data } = await supabase.from('products').select('*')
      .eq('company_id', profile.company_id).eq('class_id', classId)
      .eq('is_active', true).order('name')
    setProducts(data || [])
    setForm(f => ({ ...f, product_id: data?.[0]?.id || '' }))
  }

  async function fetchRecentLogs() {
    const { data } = await supabase.from('transactions')
      .select('*, products(name, spec_type, class_id), locations(name, code)')
      .eq('company_id', profile.company_id)
      .eq('type', 'INVENTORY_ADD')
      .order('created_at', { ascending: false }).limit(10)
    setRecentLogs(data || [])
  }

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
    setForm(f => ({
      ...f,
      class_id: classId || f.class_id,
      product_id: log.product_id,
      location_id: log.location_id,
      sph: log.sph || 'Plano', cyl: log.cyl || '-',
      axis: log.axis || '-', addition: log.addition || '-',
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
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
            <input type="number" min="1" required
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
      <div className="space-y-2">
        {recentLogs.length === 0 && <p className="text-slate-400 text-sm">No entries yet.</p>}
        {recentLogs.map(log => (
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
  const [selForm, setSelForm]           = useState({ class_id: '', product_id: '', sph: 'Plano', cyl: '-', axis: '-', addition: '-' })
  const [stockRows, setStockRows]       = useState([])   // sources with available + moveQty
  const [toRows, setToRows]             = useState([{ _id: Date.now(), location_id: '', qty: '' }])
  const [searching, setSearching]       = useState(false)
  const [loading, setLoading]           = useState(false)
  const [msg, setMsg]                   = useState({ type: '', text: '' })
  const [summary, setSummary]           = useState(null)

  useEffect(() => {
    if (classes.length && !selForm.class_id) setSelForm(f => ({ ...f, class_id: classes[0].id }))
  }, [classes])

  useEffect(() => {
    if (selForm.class_id) fetchProducts(selForm.class_id)
  }, [selForm.class_id])

  async function fetchProducts(classId) {
    const { data } = await supabase.from('products').select('*')
      .eq('company_id', profile.company_id).eq('class_id', classId)
      .eq('is_active', true).order('name')
    setProducts(data || [])
    setSelForm(f => ({ ...f, product_id: data?.[0]?.id || '' }))
  }

  function flash(type, text) { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 5000) }

  const selectedProduct = products.find(p => p.id === selForm.product_id)
  const specType  = selectedProduct?.spec_type || 'sph_add'
  const isUtility = specType === 'name_only'

  function getSpecValues() {
    return {
      sph:      isUtility ? null : selForm.sph,
      cyl:      isUtility ? null : (specType === 'sph_add' ? null : selForm.cyl),
      axis:     isUtility ? null : (specType === 'sph_cyl_axis_add' ? selForm.axis : null),
      addition: isUtility ? null : (specType === 'sph_cyl' ? null : selForm.addition),
      name_key: isUtility ? selectedProduct?.name : null,
    }
  }

  // Auto-load stock whenever product or spec selection changes
  useEffect(() => {
    if (!selForm.product_id) return
    let cancelled = false
    async function loadStock() {
      setSearching(true)
      // Reset move quantities when selection changes
      setStockRows(r => r.map(s => ({ ...s, moveQty: '' })))
      const specs = getSpecValues()
      let q = supabase.from('stock')
        .select('id, qty, location_id, locations(id, name, code)')
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
        available:     s.qty,
        moveQty:       '',
      })))
      setSearching(false)
    }
    loadStock()
    return () => { cancelled = true }
  }, [selForm.product_id, selForm.sph, selForm.cyl, selForm.axis, selForm.addition])

  // totals
  const totalFrom = stockRows.reduce((sum, s) => sum + (parseInt(s.moveQty, 10) || 0), 0)
  const totalTo   = toRows.reduce((sum, r)   => sum + (parseInt(r.qty,     10) || 0), 0)
  const balanced  = totalFrom > 0 && totalFrom === totalTo

  // Auto-sync qty if there is only one destination
  useEffect(() => {
    if (toRows.length === 1 && parseInt(toRows[0].qty || 0, 10) !== totalFrom) {
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
      const qty = parseInt(s.moveQty, 10) || 0
      if (qty < 0)              errors.push(`Negative qty at ${s.location_code}`)
      if (qty > s.available)    errors.push(`${s.location_code} only has ${s.available} units available`)
    }
    const activeFromIds = stockRows.filter(s => parseInt(s.moveQty, 10) > 0).map(s => s.location_id)
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
    const fromNames = stockRows.filter(s => parseInt(s.moveQty, 10) > 0).map(s => s.location_code).join(', ')
    const toNames   = toRows.map(r => locations.find(l => l.id === r.location_id)?.code).join(', ')

    try {
      // ── DEBITS (source locations) ──
      for (const s of stockRows) {
        const qty = parseInt(s.moveQty, 10) || 0
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
        const qty = parseInt(r.qty, 10) || 0
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
        fromLocs: stockRows.filter(s => parseInt(s.moveQty, 10) > 0)
          .map(s => ({ code: s.location_code, qty: parseInt(s.moveQty, 10) })),
        toLocs: toRows.map(r => ({
          code: locations.find(l => l.id === r.location_id)?.code,
          qty: parseInt(r.qty, 10),
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

            {stockRows.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">
                No stock found at any location for this product + spec.
                <br /><span className="text-xs">Have you added stock via Inventory Entry?</span>
              </div>
            ) : (
              <div className="space-y-3">
                {stockRows.map(s => {
                  const qty = parseInt(s.moveQty, 10) || 0
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
                        type="number" min="0" max={s.available}
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
                  <input type="number" min="1"
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

// ── Main Inventory page ───────────────────────────────────────
const TABS = ['Inventory Entry', 'Inventory Transfer']

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
      </div>
    </Layout>
  )
}