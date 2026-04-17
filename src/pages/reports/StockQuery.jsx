// src/pages/reports/StockQuery.jsx
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../supabase'
import { useAuth } from '../../hooks/useAuth'
import Layout from '../../components/Layout'

// ── Spec values ───────────────────────────────────────────────
const SPH_VALUES = ['Plano',
  ...Array.from({ length: 80 }, (_, i) => '+' + String((i + 1) * 25).padStart(3, '0')),
  ...Array.from({ length: 80 }, (_, i) => '-' + String((i + 1) * 25).padStart(3, '0')),
]
const CYL_VALUES = ['+000',
  ...Array.from({ length: 16 }, (_, i) => '-' + String((i + 1) * 25).padStart(3, '0')),
  ...Array.from({ length: 16 }, (_, i) => '+' + String((i + 1) * 25).padStart(3, '0')),
]
const AXIS_VALUES = ['90', '180']
const ADD_VALUES = Array.from({ length: 16 }, (_, i) => '+' + String((i + 1) * 25).padStart(3, '0'))

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

// ── localStorage helpers ──────────────────────────────────────
const HISTORY_KEY = 'optician_code_history' // [{ slug, name }]

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') }
  catch { return [] }
}
function saveHistory(slug, name) {
  const history = getHistory().filter(h => h.slug !== slug)
  localStorage.setItem(HISTORY_KEY, JSON.stringify([{ slug, name }, ...history].slice(0, 10)))
}

// ══════════════════════════════════════════════════════════════
//  Main page router
// ══════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════
//  STAFF / ADMIN — cascading dropdowns (unchanged logic)
// ══════════════════════════════════════════════════════════════
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
    supabase.from('product_classes').select('*')
      .eq('company_id', profile.company_id).order('name')
      .then(({ data }) => {
        setClasses(data || [])
        if (data?.length) setForm(f => ({ ...f, class_id: data[0].id }))
      })
    supabase.from('locations').select('*')
      .eq('company_id', profile.company_id).order('name')
      .then(({ data }) => setLocations(data || []))
  }, [profile])

  useEffect(() => {
    if (!form.class_id) return
    setResults([]); setSearched(false)
    supabase.from('products').select('*')
      .eq('company_id', profile.company_id).eq('class_id', form.class_id)
      .eq('is_active', true).order('name')
      .then(({ data }) => {
        setProducts(data || [])
        setForm(f => ({ ...f, product_id: data?.[0]?.id || '' }))
      })
  }, [form.class_id])

  useEffect(() => { setResults([]); setSearched(false) },
    [form.product_id, form.location_id, form.sph, form.cyl, form.axis, form.addition])

  function update(field, value) { setForm(f => ({ ...f, [field]: value })) }

  function getSpecs() {
    if (isUtility) return { sph: null, cyl: null, axis: null, addition: null, name_key: selectedProduct?.name || null }
    return {
      sph:      form.sph,
      cyl:      specType === 'sph_add' ? null : form.cyl,
      axis:     specType === 'sph_cyl_axis_add' ? form.axis : null,
      addition: specType === 'sph_cyl' ? null : form.addition,
      name_key: null,
    }
  }

  async function handleSearch(e) {
    e.preventDefault()
    if (!form.product_id) return
    setLoading(true); setSearched(true)
    const specs = getSpecs()
    let q = supabase.from('stock')
      .select('qty, sph, cyl, axis, addition, name_key, location_id, locations(name, code)')
      .eq('product_id', form.product_id).eq('company_id', profile.company_id).gt('qty', 0)
    if (form.location_id !== 'all') q = q.eq('location_id', form.location_id)
    q = buildStockQuery(q, specs)
    const { data: rows } = await q
    const formatted = (rows || []).map(s => ({ location: s.locations?.code || '—', spec: buildSpec(s), qty: s.qty }))
    formatted.sort((a, b) => a.location.localeCompare(b.location))
    setResults(formatted)
    setLoading(false)
  }

  function buildSpec(s) {
    if (s.name_key) return s.name_key
    const parts = []
    if (s.sph) parts.push(s.sph)
    if (s.cyl && s.cyl !== '-') parts.push(s.cyl)
    if (s.axis && s.axis !== '-') parts.push('ax' + s.axis)
    if (s.addition && s.addition !== '-') parts.push('add' + s.addition)
    return parts.join(' / ') || '—'
  }

  const totalQty = results.reduce((sum, r) => sum + r.qty, 0)

  return (
    <>
      <h2 className="text-xl font-bold text-slate-800 mb-1">Stock query</h2>
      <p className="text-slate-500 text-sm mb-6">Browse stock by product class, name, and spec.</p>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
            <select value={form.location_id} onChange={e => update('location_id', e.target.value)} className={sc}>
              <option value="all">All locations</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Product class</label>
            <select value={form.class_id} onChange={e => update('class_id', e.target.value)} className={sc}>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
            <select value={form.product_id} onChange={e => update('product_id', e.target.value)} className={sc}>
              {products.length === 0
                ? <option value="">— no products —</option>
                : products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)
              }
            </select>
          </div>
          {!isUtility && selectedProduct && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">SPH</label>
                <select value={form.sph} onChange={e => update('sph', e.target.value)} className={sc}>
                  {SPH_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              {(specType === 'sph_cyl' || specType === 'sph_cyl_axis_add') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">CYL</label>
                  <select value={form.cyl} onChange={e => update('cyl', e.target.value)} className={sc}>
                    {CYL_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              )}
              {specType === 'sph_cyl_axis_add' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Axis</label>
                  <select value={form.axis} onChange={e => update('axis', e.target.value)} className={sc}>
                    {AXIS_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              )}
              {(specType === 'sph_add' || specType === 'sph_cyl_axis_add') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Addition</label>
                  <select value={form.addition} onChange={e => update('addition', e.target.value)} className={sc}>
                    {ADD_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}
          <button type="submit" disabled={loading || !form.product_id}
            className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-40">
            {loading ? 'Searching…' : 'Check stock'}
          </button>
        </form>
      </div>

      {searched && !loading && (
        <>
          {results.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl px-6 py-10 text-center">
              <p className="text-slate-400 text-sm">No stock found for this selection.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">{selectedProduct?.name}</p>
                <p className="text-xs text-slate-400">{totalQty} total units across {results.length} row{results.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="divide-y divide-slate-100">
                {results.map((r, i) => (
                  <div key={i} className="px-4 py-3.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{r.spec}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{r.location}</p>
                    </div>
                    <span className={`text-base font-bold ${r.qty <= 5 ? 'text-amber-600' : 'text-slate-900'}`}>{r.qty}</span>
                  </div>
                ))}
              </div>
              {totalQty > 0 && (
                <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex justify-between">
                  <span className="text-sm font-semibold text-slate-700">Total</span>
                  <span className="text-sm font-bold text-slate-900">{totalQty}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  )
}

// ══════════════════════════════════════════════════════════════
//  OPTICIAN — 3-state flow
//    'enter'  → code entry screen
//    'locked' → supplier found but access disabled
//    'search' → supplier ready, search form visible
// ══════════════════════════════════════════════════════════════
function OpticianQuery({ profile }) {
  // ── Supplier state ──────────────────────────────────────────
  const [screen, setScreen]       = useState('enter') // 'enter' | 'locked' | 'search'
  const [supplier, setSupplier]   = useState(null)    // { id, name, slug }
  const [codeInput, setCodeInput] = useState('')
  const [history, setHistory]     = useState(getHistory)
  const [connecting, setConnecting] = useState(false)
  const [codeError, setCodeError]   = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const historyRef = useRef(null)

  // ── Search form state ────────────────────────────────────────
  const [classes, setClasses]   = useState([])
  const [products, setProducts] = useState([])
  const [form, setForm] = useState({
    class_id: '', product_id: '',
    sph: 'Plano', cyl: '+000', axis: '90', addition: '+100',
  })
  const [results, setResults]   = useState([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading]   = useState(false)

  const selectedProduct = products.find(p => p.id === form.product_id)
  const specType  = selectedProduct?.spec_type || 'sph_add'
  const isUtility = specType === 'name_only'

  // Close history dropdown when clicking outside
  useEffect(() => {
    function handle(e) {
      if (historyRef.current && !historyRef.current.contains(e.target)) setShowHistory(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Load classes when supplier connects
  useEffect(() => {
    if (!supplier) return
    setClasses([]); setProducts([]); setResults([]); setSearched(false)
    supabase.from('product_classes').select('*')
      .eq('company_id', supplier.id).order('name')
      .then(({ data }) => {
        setClasses(data || [])
        if (data?.length) setForm(f => ({ ...f, class_id: data[0].id }))
      })
  }, [supplier])

  // Load products when class changes
  useEffect(() => {
    if (!form.class_id || !supplier) return
    setResults([]); setSearched(false)
    supabase.from('products').select('id, name, spec_type, company_id')
      .eq('company_id', supplier.id).eq('class_id', form.class_id)
      .eq('is_active', true).order('name')
      .then(({ data }) => {
        setProducts(data || [])
        setForm(f => ({ ...f, product_id: data?.[0]?.id || '' }))
      })
  }, [form.class_id, supplier])

  useEffect(() => { setResults([]); setSearched(false) },
    [form.product_id, form.sph, form.cyl, form.axis, form.addition])

  // ── Connect to supplier ──────────────────────────────────────
  async function handleConnect(e) {
    e.preventDefault()
    const code = codeInput.trim().toLowerCase()
    if (!code) return
    setConnecting(true)
    setCodeError('')

    const { data: company, error } = await supabase
      .from('companies')
      .select('id, name, slug, optician_access')
      .eq('slug', code)
      .maybeSingle()

    if (error || !company) {
      setCodeError('Company code not found. Please double-check and try again.')
      setConnecting(false)
      return
    }

    // Save to history regardless of access (so optician remembers the code)
    const newEntry = { slug: company.slug, name: company.name }
    saveHistory(company.slug, company.name)
    setHistory(getHistory())

    setSupplier({ id: company.id, name: company.name, slug: company.slug })

    if (!company.optician_access) {
      setScreen('locked')
    } else {
      setScreen('search')
    }
    setConnecting(false)
  }

  // ── Quick-select from history ────────────────────────────────
  async function selectFromHistory(entry) {
    setShowHistory(false)
    setCodeInput(entry.slug)
    setConnecting(true)
    setCodeError('')

    const { data: company } = await supabase
      .from('companies')
      .select('id, name, slug, optician_access')
      .eq('slug', entry.slug)
      .maybeSingle()

    if (!company) {
      setCodeError(`Could not find "${entry.slug}" — it may have been removed.`)
      setConnecting(false)
      return
    }

    saveHistory(company.slug, company.name)
    setHistory(getHistory())
    setSupplier({ id: company.id, name: company.name, slug: company.slug })
    setScreen(company.optician_access ? 'search' : 'locked')
    setConnecting(false)
  }

  // ── Search ───────────────────────────────────────────────────
  function getSpecs() {
    if (isUtility) return { sph: null, cyl: null, axis: null, addition: null, name_key: selectedProduct?.name || null }
    return {
      sph:      form.sph,
      cyl:      specType === 'sph_add' ? null : form.cyl,
      axis:     specType === 'sph_cyl_axis_add' ? form.axis : null,
      addition: specType === 'sph_cyl' ? null : form.addition,
      name_key: null,
    }
  }

  async function handleSearch(e) {
    e.preventDefault()
    if (!form.product_id || !supplier) return
    setLoading(true); setSearched(true)

    const specs = getSpecs()

    let stockQ = supabase.from('stock')
      .select('product_id, company_id')
      .eq('product_id', form.product_id)
      .eq('company_id', supplier.id)
      .gt('qty', 0)
    stockQ = buildStockQuery(stockQ, specs)
    const { data: stockRows } = await stockQ

    const isInStock = (stockRows || []).length > 0
    const result = isInStock ? 'in_stock' : 'out_of_stock'

    setResults([{
      product: selectedProduct?.name || '—',
      company: supplier.name,
      available: isInStock,
    }])

    // ── Log the query ──────────────────────────────────────────
    await supabase.from('optician_query_log').insert({
      company_id:    supplier.id,
      optician_id:   profile?.id || null,
      optician_name: profile?.full_name || 'Unknown',
      product_name:  selectedProduct?.name || null,
      spec_details:  specs,
      result,
    })

    setLoading(false)
  }

  function update(field, value) { setForm(f => ({ ...f, [field]: value })) }

  function resetToEntry() {
    setScreen('enter')
    setSupplier(null)
    setResults([])
    setSearched(false)
    setCodeError('')
  }

  // ════════════════════════════════════════════════════════════
  //  Screen: CODE ENTRY
  // ════════════════════════════════════════════════════════════
  if (screen === 'enter') return (
    <>
      <div className="mb-8">
        <h2 className="text-xl font-bold text-slate-800 mb-1">Stock query</h2>
        <p className="text-slate-500 text-sm">Enter a supplier's company code to check their stock availability.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-800 mb-1">Enter company code</h3>
        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
          Ask your supplier for their Optisource company code. Only suppliers who have enabled optician access can be queried.
        </p>

        <form onSubmit={handleConnect} className="space-y-4">
          {/* Input + history dropdown */}
          <div className="relative" ref={historyRef}>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Company code</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="company-code-input"
                  type="text"
                  value={codeInput}
                  onChange={e => { setCodeInput(e.target.value); setCodeError('') }}
                  onFocus={() => history.length > 0 && setShowHistory(true)}
                  placeholder="e.g. clarity-optical"
                  autoComplete="off"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm font-mono"
                />
                {/* History dropdown trigger */}
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowHistory(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                    title="Recent codes"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={connecting || !codeInput.trim()}
                className="bg-slate-900 text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {connecting ? 'Connecting…' : 'Connect'}
              </button>
            </div>

            {/* History dropdown */}
            {showHistory && history.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
                <p className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100">Recent suppliers</p>
                {history.map(h => (
                  <button
                    key={h.slug}
                    type="button"
                    onClick={() => selectFromHistory(h)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">{h.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{h.slug}</p>
                    </div>
                    <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {codeError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {codeError}
            </div>
          )}
        </form>

        {/* Hint */}
        <p className="mt-5 text-xs text-slate-400 leading-relaxed">
          💡 Suppliers share their code from their Settings page. Quantities are never shown — you'll only see whether an item is in stock.
        </p>
      </div>
    </>
  )

  // ════════════════════════════════════════════════════════════
  //  Screen: LOCKED (supplier found but access disabled)
  // ════════════════════════════════════════════════════════════
  if (screen === 'locked') return (
    <>
      <div className="mb-8">
        <h2 className="text-xl font-bold text-slate-800 mb-1">Stock query</h2>
        <p className="text-slate-500 text-sm">Supplier access check</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-10 text-center mb-4">
        <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-amber-900 mb-1">{supplier?.name}</h3>
        <p className="text-amber-700 text-sm font-medium mb-2">Optician access not enabled</p>
        <p className="text-amber-600 text-xs max-w-xs mx-auto leading-relaxed">
          This supplier is registered on Optisource but has not yet turned on optician access. 
          Contact them directly and ask them to enable it in their Settings.
        </p>
      </div>

      <button
        onClick={resetToEntry}
        className="w-full border border-slate-200 text-slate-600 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
      >
        ← Try a different code
      </button>
    </>
  )

  // ════════════════════════════════════════════════════════════
  //  Screen: SEARCH FORM
  // ════════════════════════════════════════════════════════════
  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-0.5">Stock query</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Querying</span>
            <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-full">
              {supplier?.name}
            </span>
          </div>
        </div>
        <button
          onClick={resetToEntry}
          className="text-xs text-slate-400 hover:text-slate-700 transition-colors flex items-center gap-1 mt-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Change supplier
        </button>
      </div>

      {/* Search form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Product class</label>
            <select value={form.class_id} onChange={e => update('class_id', e.target.value)} className={sc}>
              {classes.length === 0
                ? <option value="">— no classes —</option>
                : classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
              }
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
            <select value={form.product_id} onChange={e => update('product_id', e.target.value)} className={sc}>
              {products.length === 0
                ? <option value="">— no products —</option>
                : products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)
              }
            </select>
          </div>

          {!isUtility && selectedProduct && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">SPH</label>
                <select value={form.sph} onChange={e => update('sph', e.target.value)} className={sc}>
                  {SPH_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              {(specType === 'sph_cyl' || specType === 'sph_cyl_axis_add') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">CYL</label>
                  <select value={form.cyl} onChange={e => update('cyl', e.target.value)} className={sc}>
                    {CYL_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              )}
              {specType === 'sph_cyl_axis_add' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Axis</label>
                  <select value={form.axis} onChange={e => update('axis', e.target.value)} className={sc}>
                    {AXIS_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              )}
              {(specType === 'sph_add' || specType === 'sph_cyl_axis_add') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Addition</label>
                  <select value={form.addition} onChange={e => update('addition', e.target.value)} className={sc}>
                    {ADD_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          <button type="submit" disabled={loading || !form.product_id}
            className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-40">
            {loading ? 'Checking…' : 'Check availability'}
          </button>
        </form>
      </div>

      {/* Results */}
      {searched && !loading && (
        results.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-10">No results found.</p>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-xs text-slate-400">Result</p>
            </div>
            <div className="divide-y divide-slate-100">
              {results.map((r, i) => (
                <div key={i} className="px-4 py-3.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{r.product}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{r.company}</p>
                  </div>
                  <span className={`flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full ${
                    r.available ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {r.available ? '✓ In stock' : 'Out of stock'}
                  </span>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
              <p className="text-xs text-slate-400 text-center">Quantities are hidden to protect supplier privacy.</p>
            </div>
          </div>
        )
      )}
    </>
  )
}