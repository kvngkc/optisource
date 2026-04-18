// src/pages/reports/StockQuery.jsx
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../supabase'
import { useAuth } from '../../hooks/useAuth'
import Layout from '../../components/Layout'

import { SPH_VALUES, CYL_VALUES, AXIS_VALUES, ADD_VALUES, BASE_VALUES, dbFormatBase } from '../../utils/specs'

function buildStockQuery(base, { sph, cyl, axis, addition, name_key }) {
  let q = base
  sph      === null ? q = q.is('sph', null)      : q = q.eq('sph', sph)
  cyl      === null ? q = q.is('cyl', null)      : q = q.eq('cyl', cyl)
  axis     === null ? q = q.is('axis', null)     : q = q.eq('axis', axis)
  addition === null ? q = q.is('addition', null) : q = q.eq('addition', addition)
  name_key === null ? q = q.is('name_key', null) : q = q.eq('name_key', name_key)
  return q
}

const sc = 'w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white text-base'

// ── localStorage helpers ─────────────────────────────────────
const HISTORY_KEY  = 'optician_code_history'
function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') }
  catch { return [] }
}
function saveHistory(slug, name) {
  const h = getHistory().filter(x => x.slug !== slug)
  localStorage.setItem(HISTORY_KEY, JSON.stringify([{ slug, name }, ...h].slice(0, 10)))
}

// ── Cart helpers (persisted by supplier id) ──────────────────
function cartKey(supplierId) { return `cart_${supplierId}` }
function getCart(supplierId) {
  try { return JSON.parse(localStorage.getItem(cartKey(supplierId)) || '[]') }
  catch { return [] }
}
function saveCart(supplierId, items) {
  localStorage.setItem(cartKey(supplierId), JSON.stringify(items))
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

// ═════════════════════════════════════════════════════════════
//  Main page
// ═════════════════════════════════════════════════════════════
export default function StockQuery() {
  const { profile } = useAuth()
  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 lg:px-6 lg:py-10">
        {profile?.role === 'optician'
          ? <OpticianQuery profile={profile} />
          : <StaffQuery profile={profile} />
        }
      </div>
    </Layout>
  )
}

// ═════════════════════════════════════════════════════════════
//  STAFF / ADMIN query (unchanged)
// ═════════════════════════════════════════════════════════════
function StaffQuery({ profile }) {
  const [classes, setClasses]     = useState([])
  const [products, setProducts]   = useState([])
  const [locations, setLocations] = useState([])
  const [results, setResults]     = useState([])
  const [searched, setSearched]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [form, setForm] = useState({
    class_id: '', product_id: '', location_id: 'all',
    sph: 'Plano', cyl: '+000', axis: '90', addition: '+100',
  })

  const selectedProduct = products.find(p => p.id === form.product_id)
  const specType  = selectedProduct?.spec_type || 'sph_add'
  const isUtility = specType === 'name_only'

  useEffect(() => {
    if (!profile?.company_id) return
    supabase.from('product_classes').select('*').eq('company_id', profile.company_id).order('name')
      .then(({ data }) => { setClasses(data || []); if (data?.length) setForm(f => ({ ...f, class_id: data[0].id })) })
    supabase.from('locations').select('*').eq('company_id', profile.company_id).order('name')
      .then(({ data }) => setLocations(data || []))
  }, [profile])

  useEffect(() => {
    if (!form.class_id) return
    setResults([]); setSearched(false)
    supabase.from('products').select('*').eq('company_id', profile.company_id).eq('class_id', form.class_id).eq('is_active', true).order('name')
      .then(({ data }) => { setProducts(data || []); setForm(f => ({ ...f, product_id: data?.[0]?.id || '' })) })
  }, [form.class_id])

  useEffect(() => { setResults([]); setSearched(false) }, [form.product_id, form.location_id, form.sph, form.cyl, form.axis, form.addition])

  function update(f, v) { setForm(p => ({ ...p, [f]: v })) }
  function getSpecs() {
    if (isUtility) return { sph: null, cyl: null, axis: null, addition: null, name_key: selectedProduct?.name || null }
    return { sph: form.sph, cyl: specType === 'sph_add' ? null : form.cyl, axis: specType === 'sph_cyl_axis_add' ? form.axis : null, addition: specType === 'sph_cyl' ? null : form.addition, name_key: null }
  }

  async function handleSearch(e) {
    e.preventDefault(); if (!form.product_id) return
    setLoading(true); setSearched(true)
    const specs = getSpecs()
    let q = supabase.from('stock').select('qty, sph, cyl, axis, addition, name_key, location_id, locations(name, code)').eq('product_id', form.product_id).eq('company_id', profile.company_id).gt('qty', 0)
    if (form.location_id !== 'all') q = q.eq('location_id', form.location_id)
    q = buildStockQuery(q, specs)
    const { data: rows } = await q
    const formatted = (rows || []).map(s => ({ location: s.locations?.code || '—', spec: buildSpec(s), qty: s.qty }))
    formatted.sort((a, b) => a.location.localeCompare(b.location))
    setResults(formatted); setLoading(false)
  }

  function buildSpec(s) {
    if (s.name_key) return s.name_key
    return [s.sph, s.cyl && s.cyl !== '-' ? s.cyl : '', s.axis && s.axis !== '-' ? 'ax'+s.axis : '', s.addition && s.addition !== '-' ? 'add'+s.addition : ''].filter(Boolean).join(' / ') || '—'
  }

  const totalQty = results.reduce((s, r) => s + r.qty, 0)

  return (
    <>
      <h2 className="text-xl font-bold text-slate-800 mb-1">Stock query</h2>
      <p className="text-slate-500 text-sm mb-6">Browse stock by product class, name, and spec.</p>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
            <select value={form.location_id} onChange={e => update('location_id', e.target.value)} className={sc}>
              <option value="all">All locations</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
            </select></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Product class</label>
            <select value={form.class_id} onChange={e => update('class_id', e.target.value)} className={sc}>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
            <select value={form.product_id} onChange={e => update('product_id', e.target.value)} className={sc}>
              {products.length === 0 ? <option value="">— no products —</option> : products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></div>
          {!isUtility && selectedProduct && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">{specType.startsWith('base_') ? 'Base' : 'SPH'}</label>
                <select value={specType.startsWith('base_') ? form.sph.replace('+', '') : form.sph} onChange={e => update('sph', specType.startsWith('base_') ? dbFormatBase(e.target.value) : e.target.value)} className={sc}>
                  {(specType.startsWith('base_') ? BASE_VALUES : SPH_VALUES).map(v => <option key={v}>{v}</option>)}
                </select></div>
              {(specType === 'sph_cyl' || specType === 'sph_cyl_axis_add') && (
                <div><label className="block text-sm font-medium text-slate-700 mb-1">CYL</label>
                  <select value={form.cyl} onChange={e => update('cyl', e.target.value)} className={sc}>{CYL_VALUES.map(v => <option key={v}>{v}</option>)}</select></div>)}
              {specType === 'sph_cyl_axis_add' && (
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Axis</label>
                  <select value={form.axis} onChange={e => update('axis', e.target.value)} className={sc}>{AXIS_VALUES.map(v => <option key={v}>{v}</option>)}</select></div>)}
              {(specType === 'sph_add' || specType === 'base_add' || specType === 'sph_cyl_axis_add') && (
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Addition</label>
                  <select value={form.addition} onChange={e => update('addition', e.target.value)} className={sc}>{ADD_VALUES.map(v => <option key={v}>{v}</option>)}</select></div>)}
            </div>)}
          <button type="submit" disabled={loading || !form.product_id}
            className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-40">
            {loading ? 'Searching…' : 'Check stock'}
          </button>
        </form>
      </div>
      {searched && !loading && (results.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl px-6 py-10 text-center"><p className="text-slate-400 text-sm">No stock found.</p></div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">{selectedProduct?.name}</p>
            <p className="text-xs text-slate-400">{totalQty} units</p>
          </div>
          <div className="divide-y divide-slate-100">
            {results.map((r, i) => (
              <div key={i} className="px-4 py-3.5 flex items-center justify-between">
                <div><p className="text-sm font-medium text-slate-900">{r.spec}</p><p className="text-xs text-slate-400 mt-0.5">{r.location}</p></div>
                <span className={`text-base font-bold ${r.qty <= 5 ? 'text-amber-600' : 'text-slate-900'}`}>{r.qty}</span>
              </div>))}
          </div>
          {totalQty > 0 && <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex justify-between"><span className="text-sm font-semibold text-slate-700">Total</span><span className="text-sm font-bold text-slate-900">{totalQty}</span></div>}
        </div>))}
    </>
  )
}

// ═════════════════════════════════════════════════════════════
//  OPTICIAN — 3-state + cart
// ═════════════════════════════════════════════════════════════
function OpticianQuery({ profile }) {
  const [screen, setScreen]         = useState('enter')
  const [supplier, setSupplier]     = useState(null)
  const [codeInput, setCodeInput]   = useState('')
  const [history, setHistory]       = useState(getHistory)
  const [connecting, setConnecting] = useState(false)
  const [codeError, setCodeError]   = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const historyRef = useRef(null)

  const [classes, setClasses]   = useState([])
  const [products, setProducts] = useState([])
  const [form, setForm] = useState({ class_id: '', product_id: '', sph: 'Plano', cyl: '+000', axis: '90', addition: '+100' })
  const [results, setResults]   = useState([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [addQty, setAddQty]     = useState(1)

  // ── Cart state ───────────────────────────────────────────────
  const [cart, setCart]         = useState([])
  const [showCart, setShowCart] = useState(false)
  const [placing, setPlacing]   = useState(false)
  const [orderDone, setOrderDone] = useState(null) // order id after success
  const [toast, setToast]       = useState('')

  const selectedProduct = products.find(p => p.id === form.product_id)
  const specType  = selectedProduct?.spec_type || 'sph_add'
  const isUtility = specType === 'name_only'

  // Load cart from storage when supplier connects
  useEffect(() => {
    if (supplier) setCart(getCart(supplier.id))
  }, [supplier])

  // Persist cart
  useEffect(() => {
    if (supplier) saveCart(supplier.id, cart)
  }, [cart, supplier])

  // Close history dropdown on outside click
  useEffect(() => {
    function h(e) { if (historyRef.current && !historyRef.current.contains(e.target)) setShowHistory(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (!supplier) return
    setClasses([]); setProducts([]); setResults([]); setSearched(false)
    supabase.from('product_classes').select('*').eq('company_id', supplier.id).order('name')
      .then(({ data }) => { setClasses(data || []); if (data?.length) setForm(f => ({ ...f, class_id: data[0].id })) })
  }, [supplier])

  useEffect(() => {
    if (!form.class_id || !supplier) return
    setResults([]); setSearched(false)
    supabase.from('products').select('id, name, spec_type, company_id').eq('company_id', supplier.id).eq('class_id', form.class_id).eq('is_active', true).order('name')
      .then(({ data }) => { setProducts(data || []); setForm(f => ({ ...f, product_id: data?.[0]?.id || '' })) })
  }, [form.class_id, supplier])

  useEffect(() => { setResults([]); setSearched(false) }, [form.product_id, form.sph, form.cyl, form.axis, form.addition])

  async function handleConnect(e) {
    e.preventDefault()
    const code = codeInput.trim().toLowerCase()
    if (!code) return
    setConnecting(true); setCodeError('')
    const { data: company, error } = await supabase.from('companies').select('id, name, slug, optician_access').eq('slug', code).maybeSingle()
    if (error || !company) { setCodeError('Company code not found. Please double-check and try again.'); setConnecting(false); return }
    saveHistory(company.slug, company.name); setHistory(getHistory())
    setSupplier({ id: company.id, name: company.name, slug: company.slug })
    setScreen(company.optician_access ? 'search' : 'locked')
    setConnecting(false)
  }

  async function selectFromHistory(entry) {
    setShowHistory(false); setCodeInput(entry.slug); setConnecting(true); setCodeError('')
    const { data: company } = await supabase.from('companies').select('id, name, slug, optician_access').eq('slug', entry.slug).maybeSingle()
    if (!company) { setCodeError(`Could not find "${entry.slug}" — it may have been removed.`); setConnecting(false); return }
    saveHistory(company.slug, company.name); setHistory(getHistory())
    setSupplier({ id: company.id, name: company.name, slug: company.slug })
    setScreen(company.optician_access ? 'search' : 'locked')
    setConnecting(false)
  }

  function getSpecs() {
    if (isUtility) return { sph: null, cyl: null, axis: null, addition: null, name_key: selectedProduct?.name || null }
    return { sph: form.sph, cyl: specType === 'sph_add' ? null : form.cyl, axis: specType === 'sph_cyl_axis_add' ? form.axis : null, addition: specType === 'sph_cyl' ? null : form.addition, name_key: null }
  }

  async function handleSearch(e) {
    e.preventDefault(); if (!form.product_id || !supplier) return
    setLoading(true); setSearched(true)
    const specs = getSpecs()
    let stockQ = supabase.from('stock').select('product_id, company_id').eq('product_id', form.product_id).eq('company_id', supplier.id).gt('qty', 0)
    stockQ = buildStockQuery(stockQ, specs)
    const { data: stockRows } = await stockQ
    const isInStock = (stockRows || []).length > 0
    const res = isInStock ? 'in_stock' : 'out_of_stock'
    setResults([{ product: selectedProduct?.name || '—', available: isInStock, specs }])

    // Log query
    await supabase.from('optician_query_log').insert({
      company_id: supplier.id, optician_id: profile?.id || null,
      optician_name: profile?.full_name || 'Unknown',
      product_name: selectedProduct?.name || null, spec_details: specs, result: res,
    })
    setAddQty(1)
    setLoading(false)
  }

  async function addToCart() {
    if (!results[0]?.available) return
    const specs = results[0].specs

    // Fetch price if available
    let unitPrice = null
    let q = supabase.from('product_prices').select('price').eq('product_id', form.product_id).eq('company_id', supplier.id)
    if (specs.sph      !== null) q = q.eq('sph', specs.sph)           ; else q = q.is('sph', null)
    if (specs.cyl      !== null) q = q.eq('cyl', specs.cyl)           ; else q = q.is('cyl', null)
    if (specs.axis     !== null) q = q.eq('axis', specs.axis)         ; else q = q.is('axis', null)
    if (specs.addition !== null) q = q.eq('addition', specs.addition) ; else q = q.is('addition', null)
    if (specs.name_key !== null) q = q.eq('name_key', specs.name_key) ; else q = q.is('name_key', null)
    
    // First try exact spec matches
    const { data: exactPriceRow } = await q.maybeSingle()
    if (exactPriceRow) {
      unitPrice = exactPriceRow.price
    } else {
      // If exact spec not found, try base (null) price for this product
      const { data: basePriceRow } = await supabase.from('product_prices').select('price')
        .eq('product_id', form.product_id).eq('company_id', supplier.id)
        .is('sph', null).is('cyl', null).is('axis', null).is('addition', null).is('name_key', null)
        .maybeSingle()
      if (basePriceRow) unitPrice = basePriceRow.price
    }

    // Check if same item already in cart and bump qty
    const key = `${form.product_id}||${JSON.stringify(specs)}`
    const existing = cart.find(c => c.key === key)
    if (existing) {
      setCart(prev => prev.map(c => c.key === key ? { ...c, qty: c.qty + Number(addQty), subtotal: unitPrice != null ? (c.qty + Number(addQty)) * unitPrice : null } : c))
    } else {
      setCart(prev => [...prev, {
        key, product_id: form.product_id, product_name: selectedProduct?.name,
        spec_details: specs, qty: Number(addQty),
        unit_price: unitPrice, subtotal: unitPrice != null ? Number(addQty) * unitPrice : null,
      }])
    }
    
    setToast('Added to cart')
    setTimeout(() => setToast(''), 3000)
  }

  function removeFromCart(key) { setCart(prev => prev.filter(c => c.key !== key)) }
  function updateCartQty(key, qty) {
    if (qty < 1) return
    setCart(prev => prev.map(c => c.key === key ? { ...c, qty, subtotal: c.unit_price != null ? qty * c.unit_price : null } : c))
  }

  async function placeOrder() {
    if (!cart.length || !supplier) return
    setPlacing(true)
    const totalKnown = cart.reduce((s, i) => s + (i.subtotal || 0), 0)
    const hasUnpriced = cart.some(i => i.unit_price == null)

    const { data: order, error } = await supabase.from('optician_orders').insert({
      company_id:    supplier.id,
      company_name:  supplier.name,
      optician_id:   profile.id,
      optician_name: profile.full_name,
      status:        'pending',
      total_amount:  hasUnpriced ? (totalKnown > 0 ? totalKnown : null) : totalKnown,
    }).select().single()

    if (error || !order) { alert('Failed to place order. Please try again.'); setPlacing(false); return }

    await supabase.from('optician_order_items').insert(
      cart.map(item => ({
        order_id:     order.id,
        product_id:   item.product_id,
        product_name: item.product_name,
        spec_details: item.spec_details,
        qty:          item.qty,
        unit_price:   item.unit_price,
        subtotal:     item.subtotal,
      }))
    )

    // Auto first message
    await supabase.from('order_messages').insert({
      order_id: order.id, sender_id: profile.id,
      sender_name: profile.full_name, sender_role: 'optician',
      message: `Hi, I've placed an order for ${cart.length} item(s). Please confirm and share payment details. Thank you!`,
    })

    // Clear cart
    saveCart(supplier.id, [])
    setCart([])
    setShowCart(false)
    setOrderDone(order.id)
    setPlacing(false)
  }

  function resetToEntry() { setScreen('enter'); setSupplier(null); setResults([]); setSearched(false); setCodeError(''); setCart([]) }
  function update(f, v) { setForm(p => ({ ...p, [f]: v })) }

  // ── ORDER SUCCESS ────────────────────────────────────────────
  if (orderDone) return (
    <>
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
        <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">Order placed!</h2>
        <p className="text-sm text-slate-500 mb-6">Your order has been sent to {supplier?.name}. They will confirm shortly.</p>
        <div className="flex gap-3 justify-center">
          <a href={`/orders/${orderDone}`} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800">View order</a>
          <button onClick={() => { setOrderDone(null); setResults([]); setSearched(false) }} className="border border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50">Continue searching</button>
        </div>
      </div>
    </>
  )

  // ── SCREEN: CODE ENTRY ───────────────────────────────────────
  if (screen === 'enter') return (
    <>
      <div className="mb-8">
        <h2 className="text-xl font-bold text-slate-800 mb-1">Stock query</h2>
        <p className="text-slate-500 text-sm">Enter a supplier's company code to check their stock and order.</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-800 mb-1">Enter company code</h3>
        <p className="text-xs text-slate-500 mb-5 leading-relaxed">Ask your supplier for their Optisource company code.</p>
        <form onSubmit={handleConnect} className="space-y-4">
          <div className="relative" ref={historyRef}>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Company code</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input id="company-code-input" type="text" value={codeInput}
                  onChange={e => { setCodeInput(e.target.value); setCodeError('') }}
                  onFocus={() => history.length > 0 && setShowHistory(true)}
                  placeholder="e.g. clarity-optical" autoComplete="off"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm font-mono" />
                {history.length > 0 && (
                  <button type="button" onClick={() => setShowHistory(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>)}
              </div>
              <button type="submit" disabled={connecting || !codeInput.trim()}
                className="bg-slate-900 text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50 whitespace-nowrap">
                {connecting ? 'Connecting…' : 'Connect'}
              </button>
            </div>
            {showHistory && history.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
                <p className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100">Recent suppliers</p>
                {history.map(h => (
                  <button key={h.slug} type="button" onClick={() => selectFromHistory(h)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3">
                    <div><p className="text-sm font-medium text-slate-800">{h.name}</p><p className="text-xs text-slate-400 font-mono">{h.slug}</p></div>
                    <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>))}
              </div>)}
          </div>
          {codeError && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{codeError}</div>}
        </form>
        <p className="mt-5 text-xs text-slate-400 leading-relaxed">💡 Quantities are never shown — only availability. You can order directly after checking.</p>
      </div>
    </>
  )

  // ── SCREEN: LOCKED ───────────────────────────────────────────
  if (screen === 'locked') return (
    <>
      <div className="mb-8"><h2 className="text-xl font-bold text-slate-800 mb-1">Stock query</h2><p className="text-slate-500 text-sm">Supplier access check</p></div>
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-10 text-center mb-4">
        <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <h3 className="text-lg font-bold text-amber-900 mb-1">{supplier?.name}</h3>
        <p className="text-amber-700 text-sm font-medium mb-2">Optician access not enabled</p>
        <p className="text-amber-600 text-xs max-w-xs mx-auto leading-relaxed">This supplier has not enabled optician access. Contact them to enable it in their Settings.</p>
      </div>
      <button onClick={resetToEntry} className="w-full border border-slate-200 text-slate-600 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">← Try a different code</button>
    </>
  )

  // ── SCREEN: SEARCH + CART ────────────────────────────────────
  const cartTotal   = cart.reduce((s, i) => s + (i.subtotal || 0), 0)
  const cartUnpriced = cart.some(i => i.unit_price == null)

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-0.5">Stock query</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Querying</span>
            <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-full">{supplier?.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {cart.length > 0 && (
            <button onClick={() => setShowCart(true)}
              className="flex items-center gap-1.5 bg-slate-900 text-white text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-slate-700 transition-colors">
              🛒 {cart.length} item{cart.length !== 1 ? 's' : ''} · {cartTotal > 0 ? `₦${Number(cartTotal).toLocaleString()}${cartUnpriced ? '+' : ''}` : 'TBD'}
            </button>)}
          <button onClick={resetToEntry} className="text-xs text-slate-400 hover:text-slate-700 transition-colors flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
            Change
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-slate-700 text-white px-5 py-3 rounded-full text-sm font-semibold shadow-2xl animate-fade-in pointer-events-none flex items-center gap-2">
          <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {toast}
        </div>
      )}

      {/* Search form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Product class</label>
            <select value={form.class_id} onChange={e => update('class_id', e.target.value)} className={sc}>
              {classes.length === 0 ? <option value="">— no classes —</option> : classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
            <select value={form.product_id} onChange={e => update('product_id', e.target.value)} className={sc}>
              {products.length === 0 ? <option value="">— no products —</option> : products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></div>
          {!isUtility && selectedProduct && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">{specType.startsWith('base_') ? 'Base' : 'SPH'}</label>
                <select value={specType.startsWith('base_') ? form.sph.replace('+', '') : form.sph} onChange={e => update('sph', specType.startsWith('base_') ? dbFormatBase(e.target.value) : e.target.value)} className={sc}>
                  {(specType.startsWith('base_') ? BASE_VALUES : SPH_VALUES).map(v => <option key={v}>{v}</option>)}
                </select></div>
              {(specType === 'sph_cyl' || specType === 'sph_cyl_axis_add') && (<div><label className="block text-sm font-medium text-slate-700 mb-1">CYL</label><select value={form.cyl} onChange={e => update('cyl', e.target.value)} className={sc}>{CYL_VALUES.map(v => <option key={v}>{v}</option>)}</select></div>)}
              {specType === 'sph_cyl_axis_add' && (<div><label className="block text-sm font-medium text-slate-700 mb-1">Axis</label><select value={form.axis} onChange={e => update('axis', e.target.value)} className={sc}>{AXIS_VALUES.map(v => <option key={v}>{v}</option>)}</select></div>)}
              {(specType === 'sph_add' || specType === 'base_add' || specType === 'sph_cyl_axis_add') && (<div><label className="block text-sm font-medium text-slate-700 mb-1">Addition</label><select value={form.addition} onChange={e => update('addition', e.target.value)} className={sc}>{ADD_VALUES.map(v => <option key={v}>{v}</option>)}</select></div>)}
            </div>)}
          <button type="submit" disabled={loading || !form.product_id}
            className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-40">
            {loading ? 'Checking…' : 'Check availability'}
          </button>
        </form>
      </div>

      {/* Result + add to cart */}
      {searched && !loading && results.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-slate-100"><p className="text-xs text-slate-400">Result</p></div>
          {results.map((r, i) => (
            <div key={i} className="px-4 py-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-900 truncate">{r.product}</p><p className="text-xs text-slate-400 mt-0.5">{supplier?.name}</p></div>
                <span className={`flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full ${r.available ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                  {r.available ? '✓ In stock' : 'Out of stock'}
                </span>
              </div>
              {r.available && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden">
                    <button type="button" onClick={() => setAddQty(q => Math.max(1, q - 1))}
                      className="px-3 py-2 text-slate-500 hover:bg-slate-50 text-base font-bold">−</button>
                    <input type="number" min="1" value={addQty} onChange={e => setAddQty(Math.max(1, Number(e.target.value)))}
                      className="w-12 text-center py-2 text-sm font-semibold text-slate-900 focus:outline-none" />
                    <button type="button" onClick={() => setAddQty(q => q + 1)}
                      className="px-3 py-2 text-slate-500 hover:bg-slate-50 text-base font-bold">+</button>
                  </div>
                  <button onClick={addToCart}
                    className="flex-1 bg-slate-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors">
                    Add to cart
                  </button>
                </div>)}
            </div>))}
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50"><p className="text-xs text-slate-400 text-center">Quantities are hidden to protect supplier privacy.</p></div>
        </div>)}

      {/* ── CART MODAL ── */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Your cart</h3>
              <button onClick={() => setShowCart(false)} className="text-slate-400 hover:text-slate-700">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {cart.map(item => (
                <div key={item.key} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{item.product_name}</p>
                    <p className="text-xs text-slate-400 font-mono">{formatSpec(item.spec_details)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.unit_price != null ? `₦${Number(item.unit_price).toLocaleString()} ea.` : 'Price TBD'}</p>
                  </div>
                  <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden flex-shrink-0">
                    <button onClick={() => updateCartQty(item.key, item.qty - 1)} className="px-2 py-1 text-slate-500 hover:bg-slate-50 text-sm">−</button>
                    <span className="px-2 text-sm font-semibold text-slate-900">{item.qty}</span>
                    <button onClick={() => updateCartQty(item.key, item.qty + 1)} className="px-2 py-1 text-slate-500 hover:bg-slate-50 text-sm">+</button>
                  </div>
                  <div className="text-right flex-shrink-0 w-20">
                    <p className="text-sm font-bold text-slate-900">{item.subtotal != null ? `₦${Number(item.subtotal).toLocaleString()}` : '—'}</p>
                    <button onClick={() => removeFromCart(item.key)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                  </div>
                </div>))}
            </div>

            <div className="border-t border-slate-100 px-5 py-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-700">
                  {cartUnpriced ? 'Partial total' : 'Total'}
                </span>
                <span className="text-base font-bold text-slate-900">
                  {cartTotal > 0 ? `₦${Number(cartTotal).toLocaleString()}${cartUnpriced ? '+' : ''}` : 'TBD'}
                </span>
              </div>
              {cartUnpriced && <p className="text-xs text-amber-600">⚠ Some items have no set price — the supplier will confirm the final amount.</p>}
              <button onClick={placeOrder} disabled={placing || cart.length === 0}
                className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50">
                {placing ? 'Placing order…' : `Place order (${cart.length} item${cart.length !== 1 ? 's' : ''})`}
              </button>
            </div>
          </div>
        </div>)}
    </>
  )
}