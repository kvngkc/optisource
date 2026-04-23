import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import { useAuth } from '../../hooks/useAuth'
import Layout from '../../components/Layout'
import { SPH_VALUES, CYL_VALUES, AXIS_VALUES, ADD_VALUES, BASE_VALUES, dbFormatBase } from '../../utils/specs'
import { resolvePrice } from '../../utils/pricing'

const PAYMENT_METHODS = ['Cash', 'POS', 'Transfer', 'NIL']

function buildStockQuery(base, { sph, cyl, axis, addition, name_key }) {
  let q = base
  sph      === null ? q = q.is('sph', null)      : q = q.eq('sph', sph)
  cyl      === null ? q = q.is('cyl', null)      : q = q.eq('cyl', cyl)
  axis     === null ? q = q.is('axis', null)     : q = q.eq('axis', axis)
  addition === null ? q = q.is('addition', null) : q = q.eq('addition', addition)
  name_key === null ? q = q.is('name_key', null) : q = q.eq('name_key', name_key)
  return q
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

export default function Sales() {
  const { profile } = useAuth()
  const [products,       setProducts]       = useState([])
  const [locations,      setLocations]      = useState([])
  const [classes,        setClasses]        = useState([])
  const [recentSales,    setRecentSales]    = useState([])
  const [availableStock, setAvailableStock] = useState(null)
  const [stockLoading,   setStockLoading]   = useState(false)
  const [loading,        setLoading]        = useState(false)
  const [voiding,        setVoiding]        = useState(null) // sale id being voided
  const [msg, setMsg] = useState({ type: '', text: '' })

  const [form, setForm] = useState({
    class_id: '', product_id: '', location_id: '',
    sph: '', cyl: '', axis: '', addition: '',
    qty: '', unit_price: '', amount_paid: '', payment_method: '',
    customer_name: '', customer_phone: '', notes: '',
  })

  useEffect(() => {
    if (profile?.company_id) { fetchClasses(); fetchLocations(); fetchRecentSales() }
  }, [profile])

  useEffect(() => { if (form.class_id) fetchProducts(form.class_id) }, [form.class_id])
  useEffect(() => { if (form.product_id && form.location_id) checkStock() }, [form.product_id, form.location_id, form.sph, form.cyl, form.axis, form.addition])
  useEffect(() => { if (form.product_id) loadDefaultPrice() }, [form.product_id, form.sph, form.cyl, form.addition])

  async function fetchClasses() {
    const { data } = await supabase.from('product_classes').select('*').eq('company_id', profile.company_id).order('name')
    setClasses(data || []) // No auto-select — user must choose explicitly
  }
  async function fetchProducts(classId) {
    const { data } = await supabase.from('products').select('*').eq('company_id', profile.company_id).eq('class_id', classId).eq('is_active', true).order('name')
    setProducts(data || [])
    setForm(f => ({ ...f, product_id: '', sph: '', cyl: '', axis: '', addition: '' }))
  }
  async function fetchLocations() {
    let q = supabase.from('locations').select('*').eq('company_id', profile.company_id).order('name')
    if (profile?.role === 'staff' && profile?.location_id) q = q.eq('id', profile.location_id)
    const { data } = await q
    setLocations(data || [])
    // Staff are auto-assigned; everyone else must pick explicitly
    if (profile?.role === 'staff' && profile?.location_id) setForm(f => ({ ...f, location_id: profile.location_id }))
  }
  async function fetchRecentSales() {
    let q = supabase
      .from('transactions')
      .select('*, products(name), locations(name, code)')
      .eq('company_id', profile.company_id)
      .eq('type', 'SALE')
    
    if (profile?.role === 'staff' && profile?.location_id) {
      q = q.eq('location_id', profile.location_id)
    }
    
    const { data } = await q.order('created_at', { ascending: false }).limit(10)
    setRecentSales(data || [])
  }

  function update(field, value) { setForm(f => ({ ...f, [field]: value })) }
  function flash(type, text)    { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 5000) }

  const selectedProduct = products.find(p => p.id === form.product_id)
  const specType        = selectedProduct?.spec_type || 'sph_add'
  const isUtility       = specType === 'name_only'
  const usesBase        = specType.startsWith('base_')
  const totalAmount     = (Number(form.qty) * Number(form.unit_price)) || 0
  const balance         = totalAmount - (Number(form.amount_paid) || 0)

  // Normalize base sph to unsigned whole-number format before any DB operation
  function normSph(sph, isBase) {
    if (!sph) return sph
    return isBase ? sph.replace(/^\+/, '') : sph
  }

  function getSpecs() {
    return {
      sph:      isUtility ? null : normSph(form.sph, usesBase),
      cyl:      isUtility ? null : (specType === 'sph_add' || usesBase ? null : (form.cyl && form.cyl !== '-' ? form.cyl : null)),
      axis:     isUtility ? null : (specType === 'sph_cyl_axis_add' ? (form.axis && form.axis !== '-' ? form.axis : null) : null),
      addition: isUtility ? null : (specType === 'sph_cyl' || specType === 'base_only' ? null : (form.addition && form.addition !== '-' ? form.addition : null)),
      name_key: isUtility ? selectedProduct?.name : null,
    }
  }

  async function loadDefaultPrice() {
    const sel = products.find(p => p.id === form.product_id)
    if (!sel || sel.spec_type === 'name_only' || !form.sph) return
    const isBase = sel.spec_type.startsWith('base_')
    const specs = {
      sph:      normSph(form.sph, isBase),
      cyl:      sel.spec_type === 'sph_add' || isBase ? null : (form.cyl && form.cyl !== '-' ? form.cyl : null),
      axis:     sel.spec_type === 'sph_cyl_axis_add' ? (form.axis && form.axis !== '-' ? form.axis : null) : null,
      addition: sel.spec_type === 'sph_cyl' || sel.spec_type === 'base_only' ? null : (form.addition && form.addition !== '-' ? form.addition : null),
      name_key: null,
    }
    const price = await resolvePrice(form.product_id, profile.company_id, specs)
    if (price != null) setForm(f => ({ ...f, unit_price: String(price) }))
  }

  async function checkStock() {
    if (!form.product_id || !form.location_id) return
    setStockLoading(true)
    const sel = products.find(p => p.id === form.product_id)
    if (!sel) { setStockLoading(false); return }
    const isBase = sel.spec_type.startsWith('base_')
    const specs = {
      sph:      sel.spec_type === 'name_only' ? null : normSph(form.sph, isBase),
      cyl:      sel.spec_type === 'name_only' || sel.spec_type === 'sph_add' || isBase ? null : (form.cyl && form.cyl !== '-' ? form.cyl : null),
      axis:     sel.spec_type === 'name_only' ? null : (sel.spec_type === 'sph_cyl_axis_add' ? (form.axis && form.axis !== '-' ? form.axis : null) : null),
      addition: sel.spec_type === 'name_only' || sel.spec_type === 'sph_cyl' || sel.spec_type === 'base_only' ? null : (form.addition && form.addition !== '-' ? form.addition : null),
      name_key: sel.spec_type === 'name_only' ? sel.name : null,
    }
    const base = supabase.from('stock').select('qty, allocated_qty').eq('product_id', form.product_id).eq('location_id', form.location_id)
    const { data } = await buildStockQuery(base, specs).maybeSingle()
    setAvailableStock(data ? (data.qty - (data.allocated_qty || 0)) : 0)
    setStockLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const qty = Number(form.qty)
    if (!form.product_id || !form.location_id) { flash('error', 'Product and location required'); return }
    if (!form.payment_method) { flash('error', 'Please select a payment method'); return }
    if (!isUtility) {
      if (!form.sph) { flash('error', `Please select a ${usesBase ? 'Base' : 'SPH'} value`); return }
      const usesAdd = ['sph_add','base_add','sph_cyl_axis_add'].includes(specType)
      if (usesAdd && !form.addition) { flash('error', 'Please select an Addition value'); return }
      const needsCyl = ['sph_cyl','sph_cyl_axis_add'].includes(specType)
      if (needsCyl && !form.cyl) { flash('error', 'Please select a CYL value'); return }
      if (specType === 'sph_cyl_axis_add' && !form.axis) { flash('error', 'Please select an Axis value'); return }
    }
    if (!qty || qty <= 0) { flash('error', 'Qty must be a positive number'); return }
    if (availableStock !== null && qty > availableStock) {
      flash('error', `Oversell blocked — only ${availableStock} available`); return
    }
    setLoading(true)
    const specs = getSpecs()
    const base  = supabase.from('stock').select('id, qty, allocated_qty').eq('product_id', form.product_id).eq('location_id', form.location_id)
    const { data: stockRow } = await buildStockQuery(base, specs).maybeSingle()
    const stockAvailable = stockRow ? (stockRow.qty - (stockRow.allocated_qty || 0)) : 0
    if (!stockRow || stockAvailable < qty) {
      flash('error', `Oversell blocked — only ${stockAvailable} available`)
      setAvailableStock(stockAvailable); setLoading(false); return
    }
    await supabase.from('stock').update({ qty: stockRow.qty - qty, updated_at: new Date() }).eq('id', stockRow.id)
    let customerId = null
    if (form.customer_name || form.customer_phone) {
      const { data: existingCust } = await supabase.from('customers').select('id')
        .eq('company_id', profile.company_id)
        .eq('name', form.customer_name || 'Unknown')
        .eq('phone', form.customer_phone || '')
        .maybeSingle()
        
      if (existingCust) customerId = existingCust.id
      else {
        const { data: newCust, error: custErr } = await supabase.from('customers').insert({
          company_id: profile.company_id, name: form.customer_name || 'Unknown', phone: form.customer_phone || ''
        }).select('id').single()
        if (newCust) customerId = newCust.id
        if (custErr) console.error('Customer insert err:', custErr)
      }
    }

    await supabase.from('transactions').insert({
      company_id: profile.company_id, type: 'SALE',
      product_id: form.product_id, location_id: form.location_id,
      ...specs, qty,
      unit_price:     Number(form.unit_price) || null,
      total_amount:   totalAmount || null,
      amount_paid:    Number(form.amount_paid) || null,
      balance:        balance > 0 ? balance : null,
      payment_method: form.payment_method,
      customer_id:    customerId,
      customer_name:  form.customer_name || null,
      customer_phone: form.customer_phone || null,
      notes:          form.notes || null,
      created_by:     profile.id,
    })
    await supabase.from('audit_log').insert({
      company_id: profile.company_id, user_id: profile.id,
      status: 'SUCCESS', action: 'SALE',
      details: { product: selectedProduct?.name, location: locations.find(l => l.id === form.location_id)?.code, ...specs, qty, total_amount: totalAmount },
    })
    flash('success', `Sale recorded — ${selectedProduct?.name} ×${qty}`)
    setForm(f => ({ ...f, qty: '', amount_paid: '', customer_name: '', customer_phone: '', notes: '' }))
    setAvailableStock(v => v !== null ? v - qty : null)
    fetchRecentSales()
    setLoading(false)
  }

  async function handleVoid(sale) {
    const customerInfo = sale.customer_name ? ` (${sale.customer_name})` : ''
    if (!window.confirm(
      `Void this sale?\n\n${sale.products?.name} ×${sale.qty} at ${sale.locations?.code}${customerInfo}\n\n` +
      `This will return ${sale.qty} unit${sale.qty !== 1 ? 's' : ''} to stock. It cannot be undone.`
    )) return

    setVoiding(sale.id)
    const specs = {
      sph:      sale.sph,
      cyl:      sale.cyl,
      axis:     sale.axis,
      addition: sale.addition,
      name_key: sale.name_key,
    }

    // Return qty to stock
    const base = supabase.from('stock').select('id, qty')
      .eq('product_id', sale.product_id).eq('location_id', sale.location_id)
    const { data: stockRow } = await buildStockQuery(base, specs).maybeSingle()

    if (stockRow) {
      await supabase.from('stock')
        .update({ qty: stockRow.qty + sale.qty, updated_at: new Date() })
        .eq('id', stockRow.id)
    } else {
      // Stock row was deleted or never existed — recreate it
      await supabase.from('stock').insert({
        company_id:  profile.company_id,
        product_id:  sale.product_id,
        location_id: sale.location_id,
        ...specs,
        qty: sale.qty,
      })
    }

    // Write SALE_VOID transaction
    await supabase.from('transactions').insert({
      company_id:  profile.company_id,
      type:        'SALE_VOID',
      product_id:  sale.product_id,
      location_id: sale.location_id,
      ...specs,
      qty:         sale.qty,
      created_by:  profile.id,
      notes:       `Return/void of sale ${sale.id}`,
    })

    await supabase.from('audit_log').insert({
      company_id: profile.company_id, user_id: profile.id,
      status: 'SUCCESS', action: 'SALE_VOID',
      details: {
        voided_sale:    sale.id,
        product:        sale.products?.name,
        location:       sale.locations?.code,
        qty:            sale.qty,
        customer:       sale.customer_name || null,
        refund_amount:  sale.total_amount || null,
      },
    })

    flash('success', `Sale voided — ${sale.qty} unit${sale.qty !== 1 ? 's' : ''} returned to ${sale.locations?.code} stock.`)
    fetchRecentSales()
    setVoiding(null)
  }

  function formatSpec(sale) {
    if (sale.name_key) return sale.name_key
    const parts = []
    if (sale.sph) parts.push(sale.sph)
    if (sale.addition && sale.addition !== '-') parts.push(sale.addition)
    return parts.join(' / ') || '—'
  }

  const sc = "w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white text-base"

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 lg:px-6 lg:py-10">
        <h2 className="text-xl font-bold text-slate-800 mb-1">Sales entry</h2>
        <p className="text-slate-500 text-sm mb-6">Overselling is automatically blocked.</p>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
              <select value={form.location_id} onChange={e => update('location_id', e.target.value)} className={sc}>
                <option value="">— Select location —</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Product class</label>
              <select value={form.class_id} onChange={e => update('class_id', e.target.value)} className={sc}>
                <option value="">— Select class —</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
              <select value={form.product_id} onChange={e => update('product_id', e.target.value)} className={sc}>
                <option value="">— Select product —</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {!isUtility && form.product_id && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{usesBase ? 'Base' : 'SPH'}</label>
                  <select value={form.sph} onChange={e => update('sph', e.target.value)} className={sc}>
                    <option value="">— Select {usesBase ? 'Base' : 'SPH'} —</option>
                    {(usesBase ? BASE_VALUES : SPH_VALUES).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                {(specType === 'sph_cyl' || specType === 'sph_cyl_axis_add') && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">CYL</label>
                    <select value={form.cyl} onChange={e => update('cyl', e.target.value)} className={sc}>
                      <option value="">— Select CYL —</option>
                      {CYL_VALUES.filter(v => v !== '-').map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                )}
                {specType === 'sph_cyl_axis_add' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Axis</label>
                    <select value={form.axis} onChange={e => update('axis', e.target.value)} className={sc}>
                      <option value="">— Select Axis —</option>
                      {AXIS_VALUES.filter(v => v !== '-').map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                )}
                {(specType === 'sph_add' || specType === 'base_add' || specType === 'sph_cyl_axis_add') && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Addition</label>
                    <select value={form.addition} onChange={e => update('addition', e.target.value)} className={sc}>
                      <option value="">— Select Addition —</option>
                      {ADD_VALUES.filter(v => v !== '-').map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Stock indicator */}
            <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
              availableStock === null ? 'bg-slate-50 text-slate-400' :
              availableStock === 0    ? 'bg-red-50 border border-red-200 text-red-700' :
              availableStock <= 5     ? 'bg-amber-50 border border-amber-200 text-amber-700' :
                                        'bg-green-50 border border-green-200 text-green-700'
            }`}>
              {stockLoading         ? 'Checking...' :
               availableStock === null ? 'Select product and location' :
               availableStock === 0    ? 'Out of stock at this location' :
                                         `Available: ${availableStock} units`}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Qty</label>
                <input type="number" min="1" required value={form.qty}
                  onChange={e => update('qty', e.target.value)} placeholder="0"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 text-base" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Unit price (₦)
                  {form.unit_price && <span className="text-xs text-green-600 ml-1">auto-filled</span>}
                </label>
                <input type="number" min="0" value={form.unit_price}
                  onChange={e => update('unit_price', e.target.value)} placeholder="0"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 text-base" />
              </div>
            </div>

            {totalAmount > 0 && (
              <div className="bg-slate-50 rounded-xl px-4 py-3 flex justify-between text-sm">
                <span className="text-slate-500">Total</span>
                <span className="font-bold text-slate-800">₦{totalAmount.toLocaleString()}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount paid (₦)</label>
                <input type="number" min="0" value={form.amount_paid}
                  onChange={e => update('amount_paid', e.target.value)} placeholder="0"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 text-base" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment</label>
                <select value={form.payment_method} onChange={e => update('payment_method', e.target.value)} className={sc}>
                  <option value="">— Select method —</option>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            {balance > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex justify-between text-sm">
                <span className="text-amber-700">Balance owed</span>
                <span className="font-bold text-amber-800">₦{balance.toLocaleString()}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Customer name <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input type="text" value={form.customer_name}
                  onChange={e => update('customer_name', e.target.value)} placeholder="e.g. John Doe"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 text-base" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Customer phone <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input type="text" value={form.customer_phone}
                  onChange={e => update('customer_phone', e.target.value)} placeholder="e.g. 080..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 text-base" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Notes <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea value={form.notes} onChange={e => update('notes', e.target.value)}
                placeholder="Additional notes..." rows={2}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 text-base resize-none" />
            </div>

            {msg.text && (
              <div className={`text-sm rounded-xl px-4 py-3 ${
                msg.type === 'error'
                  ? 'bg-red-50 border border-red-200 text-red-700'
                  : 'bg-green-50 border border-green-200 text-green-700'
              }`}>
                {msg.text}
              </div>
            )}

            <button type="submit" disabled={loading || availableStock === 0}
              className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-semibold text-base hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Recording...' : 'Record sale'}
            </button>
          </form>
        </div>

        {/* Recent sales */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-700 text-sm">Recent sales</h3>
          <p className="text-xs text-slate-400">Hover to void (return to stock)</p>
        </div>

        <div className="space-y-2">
          {recentSales.length === 0 && <p className="text-slate-400 text-sm">No sales yet.</p>}
          {recentSales.map(sale => (
            <div
              key={sale.id}
              className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between gap-3 group"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-800 text-sm truncate">{sale.products?.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {sale.locations?.code} · {formatSpec(sale)}
                  {sale.customer_name && <span> · {sale.customer_name}</span>}
                  <span className="ml-2 text-slate-300">{timeAgo(sale.created_at)}</span>
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <p className="text-red-500 font-bold text-sm">−{sale.qty}</p>
                  {sale.total_amount && (
                    <p className="text-xs text-slate-400">₦{Number(sale.total_amount).toLocaleString()}</p>
                  )}
                </div>
                <button
                  onClick={() => handleVoid(sale)}
                  disabled={voiding === sale.id}
                  title="Void — return to stock"
                  className="text-xs text-slate-300 hover:text-red-500 transition-colors disabled:opacity-40 opacity-0 group-hover:opacity-100 whitespace-nowrap"
                >
                  {voiding === sale.id ? '…' : 'Void'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-300 text-center mt-6">
          Voiding a sale returns the stock and creates an audit record.
        </p>
      </div>
    </Layout>
  )
}