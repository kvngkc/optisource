// src/pages/reports/StockQuery.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import { useAuth } from '../../hooks/useAuth'
import Layout from '../../components/Layout'

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

export default function StockQuery() {
  const { profile } = useAuth()
  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 lg:px-6 lg:py-10">
        {profile?.role === 'optician'
          ? <OpticianQuery />
          : <StaffQuery profile={profile} />
        }
      </div>
    </Layout>
  )
}

/* ══════════════════════════════════════════
   STAFF / ADMIN — cascading dropdowns
══════════════════════════════════════════ */
function StaffQuery({ profile }) {
  const [classes, setClasses]     = useState([])
  const [products, setProducts]   = useState([])
  const [locations, setLocations] = useState([])
  const [results, setResults]     = useState([])
  const [searched, setSearched]   = useState(false)
  const [loading, setLoading]     = useState(false)

  const [form, setForm] = useState({
    class_id: '',
    product_id: '',
    location_id: 'all',
    sph: 'Plano',
    cyl: '+000',
    axis: '90',
    addition: '+100',
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
    setResults([])
    setSearched(false)
    supabase.from('products').select('*')
      .eq('company_id', profile.company_id)
      .eq('class_id', form.class_id)
      .eq('is_active', true).order('name')
      .then(({ data }) => {
        setProducts(data || [])
        setForm(f => ({ ...f, product_id: data?.[0]?.id || '' }))
      })
  }, [form.class_id])

  useEffect(() => {
    setResults([])
    setSearched(false)
  }, [form.product_id, form.location_id, form.sph, form.cyl, form.axis, form.addition])

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
    setLoading(true)
    setSearched(true)

    const specs = getSpecs()
    let q = supabase.from('stock')
      .select('qty, sph, cyl, axis, addition, name_key, location_id, locations(name, code)')
      .eq('product_id', form.product_id)
      .eq('company_id', profile.company_id)
      .gt('qty', 0)

    if (form.location_id !== 'all') q = q.eq('location_id', form.location_id)
    q = buildStockQuery(q, specs)

    const { data: rows } = await q
    const formatted = (rows || []).map(s => ({
      location: s.locations?.code || '—',
      spec: buildSpec(s),
      qty: s.qty,
    }))
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

          <button
            type="submit"
            disabled={loading || !form.product_id}
            className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
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
                    <span className={`text-base font-bold ${r.qty <= 5 ? 'text-amber-600' : 'text-slate-900'}`}>
                      {r.qty}
                    </span>
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

/* ══════════════════════════════════════════
   OPTICIAN — availability only, cascading dropdowns
   Quantities are never shown to opticians.
══════════════════════════════════════════ */
function OpticianQuery() {
  const [companies, setCompanies]           = useState([])
  const [loadingCompanies, setLoadingCompanies] = useState(true)

  // Cascading state
  const [classes, setClasses]   = useState([])
  const [products, setProducts] = useState([])
  const [results, setResults]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [searched, setSearched] = useState(false)

  const [form, setForm] = useState({
    class_id: '',
    product_id: '',
    sph: 'Plano',
    cyl: '+000',
    axis: '90',
    addition: '+100',
  })

  const selectedProduct = products.find(p => p.id === form.product_id)
  const specType  = selectedProduct?.spec_type || 'sph_add'
  const isUtility = specType === 'name_only'

  // Load opted-in companies on mount
  useEffect(() => {
    supabase.from('companies').select('id, name').eq('optician_access', true)
      .then(({ data }) => {
        setCompanies(data || [])
        setLoadingCompanies(false)
      })
  }, [])

  // Load product classes across all opted-in companies once companies are ready
  useEffect(() => {
    if (!companies.length) return
    const ids = companies.map(c => c.id)
    supabase.from('product_classes').select('*')
      .in('company_id', ids).order('name')
      .then(({ data }) => {
        setClasses(data || [])
        if (data?.length) setForm(f => ({ ...f, class_id: data[0].id }))
      })
  }, [companies])

  // Load products when class changes
  useEffect(() => {
    if (!form.class_id || !companies.length) return
    setResults([])
    setSearched(false)
    const ids = companies.map(c => c.id)
    supabase.from('products').select('id, name, spec_type, company_id')
      .in('company_id', ids)
      .eq('class_id', form.class_id)
      .eq('is_active', true).order('name')
      .then(({ data }) => {
        setProducts(data || [])
        setForm(f => ({ ...f, product_id: data?.[0]?.id || '' }))
      })
  }, [form.class_id])

  // Reset results when any filter changes
  useEffect(() => {
    setResults([])
    setSearched(false)
  }, [form.product_id, form.sph, form.cyl, form.axis, form.addition])

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
    setLoading(true)
    setSearched(true)

    const specs = getSpecs()
    const companyMap = Object.fromEntries(companies.map(c => [c.id, c.name]))

    // Check stock availability for this product+spec (qty > 0)
    let stockQ = supabase.from('stock')
      .select('product_id, company_id')
      .eq('product_id', form.product_id)
      .gt('qty', 0)

    stockQ = buildStockQuery(stockQ, specs)

    const { data: stockRows } = await stockQ
    const inStockCompanies = new Set((stockRows || []).map(s => s.company_id))

    // Get the product's company to show supplier name
    const product = products.find(p => p.id === form.product_id)
    const rows = [{
      product: product?.name || '—',
      company: companyMap[product?.company_id] || '—',
      available: inStockCompanies.has(product?.company_id),
    }]

    setResults(rows)
    setLoading(false)
  }

  if (loadingCompanies) return <div className="text-center py-16 text-slate-400 text-sm">Loading suppliers…</div>

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 mb-1">Stock query</h2>
        <p className="text-slate-500 text-sm">
          {companies.length > 0
            ? `Searching across ${companies.length} supplier${companies.length !== 1 ? 's' : ''}. Quantities are not shown.`
            : 'No suppliers have enabled optician access yet.'
          }
        </p>
      </div>

      {companies.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-10 text-center">
          <p className="text-3xl mb-3">🔒</p>
          <p className="text-amber-800 font-semibold text-sm">No suppliers available yet</p>
          <p className="text-amber-600 text-xs mt-2 max-w-xs mx-auto leading-relaxed">
            Suppliers need to turn on optician access in their Settings before you can query their stock.
          </p>
        </div>
      ) : (
        <>
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

              <button
                type="submit"
                disabled={loading || !form.product_id}
                className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-40"
              >
                {loading ? 'Searching…' : 'Check availability'}
              </button>
            </form>
          </div>

          {searched && !loading && (
            results.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-10">No results found.</p>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-xs text-slate-400">{results.length} result{results.length !== 1 ? 's' : ''}</p>
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
      )}
    </>
  )
}