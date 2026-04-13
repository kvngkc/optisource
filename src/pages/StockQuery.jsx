import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'

const SPH_OPTIONS = ['Any', 'Plano',
  ...Array.from({ length: 80 }, (_, i) => '+' + String((i + 1) * 25).padStart(3, '0')),
  ...Array.from({ length: 80 }, (_, i) => '-' + String((i + 1) * 25).padStart(3, '0')),
]
const ADD_OPTIONS = ['Any',
  ...Array.from({ length: 16 }, (_, i) => '+' + String((i + 1) * 25).padStart(3, '0')),
]

export default function StockQuery() {
  const { profile } = useAuth()
  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6 lg:px-6 lg:py-10">
        {profile?.role === 'optician'
          ? <OpticianQuery />
          : <StaffQuery profile={profile} />
        }
      </div>
    </Layout>
  )
}

/* ═══════════════════════════════════════
   OPTICIAN VIEW — availability only
═══════════════════════════════════════ */
function OpticianQuery() {
  const [companies,        setCompanies]        = useState([])
  const [loadingCompanies, setLoadingCompanies] = useState(true)
  const [search,  setSearch]  = useState('')
  const [sph,     setSph]     = useState('Any')
  const [addition, setAdd]    = useState('Any')
  const [results,  setResults] = useState([])
  const [loading,  setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    supabase
      .from('companies')
      .select('id, name')
      .eq('optician_access', true)
      .then(({ data }) => {
        setCompanies(data || [])
        setLoadingCompanies(false)
      })
  }, [])

  async function handleSearch(e) {
    e.preventDefault()
    if (!search.trim() || !companies.length) return
    setLoading(true)
    setSearched(true)

    const companyIds = companies.map(c => c.id)
    const companyMap = Object.fromEntries(companies.map(c => [c.id, c.name]))

    // Step 1: find matching products
    const { data: products } = await supabase
      .from('products')
      .select('id, name, spec_type, company_id')
      .in('company_id', companyIds)
      .eq('is_active', true)
      .ilike('name', `%${search.trim()}%`)
      .limit(60)

    if (!products?.length) {
      setResults([])
      setLoading(false)
      return
    }

    // Step 2: check stock availability (no quantities returned)
    let stockQ = supabase
      .from('stock')
      .select('product_id')
      .in('product_id', products.map(p => p.id))
      .gt('qty', 0)

    if (sph !== 'Any') stockQ = stockQ.eq('sph', sph)
    if (addition !== 'Any') stockQ = stockQ.eq('addition', addition)

    const { data: stockRows } = await stockQ
    const inStockIds = new Set((stockRows || []).map(s => s.product_id))

    const rows = products.map(p => ({
      product:   p.name,
      company:   companyMap[p.company_id] || '—',
      available: inStockIds.has(p.id),
    }))

    // Available first
    rows.sort((a, b) => (b.available ? 1 : 0) - (a.available ? 1 : 0))
    setResults(rows)
    setLoading(false)
  }

  const selectCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"

  if (loadingCompanies) {
    return <div className="text-center py-16 text-slate-400 text-sm">Loading suppliers…</div>
  }

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
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Product name</label>
                <input
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="e.g. 1.56 Bifocal, CR39 SV…"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">SPH</label>
                  <select value={sph} onChange={e => setSph(e.target.value)} className={selectCls}>
                    {SPH_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Addition</label>
                  <select value={addition} onChange={e => setAdd(e.target.value)} className={selectCls}>
                    {ADD_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <button
                type="submit" disabled={loading || !search.trim()}
                className="w-full bg-slate-900 text-white py-3 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-40"
              >
                {loading ? 'Searching…' : 'Search'}
              </button>
            </form>
          </div>

          {searched && !loading && (
            <>
              {results.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-10">No products found for "{search}".</p>
              ) : (
                <>
                  <p className="text-xs text-slate-400 mb-3">{results.length} result{results.length !== 1 ? 's' : ''}</p>
                  <div className="space-y-2">
                    {results.map((r, i) => (
                      <div key={i} className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{r.product}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{r.company}</p>
                        </div>
                        <span className={`flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full ${
                          r.available
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-400'
                        }`}>
                          {r.available ? '✓ In stock' : 'Out of stock'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-300 text-center mt-5">
                    Stock quantities are hidden to protect supplier privacy.
                  </p>
                </>
              )}
            </>
          )}
        </>
      )}
    </>
  )
}

/* ═══════════════════════════════════════
   STAFF / ADMIN VIEW — full quantities
═══════════════════════════════════════ */
function StaffQuery({ profile }) {
  const [search,     setSearch]     = useState('')
  const [sph,        setSph]        = useState('Any')
  const [addition,   setAdd]        = useState('Any')
  const [locationId, setLocationId] = useState('all')
  const [locations,  setLocations]  = useState([])
  const [results,    setResults]    = useState([])
  const [loading,    setLoading]    = useState(false)
  const [searched,   setSearched]   = useState(false)

  useEffect(() => {
    if (profile?.company_id) {
      supabase
        .from('locations').select('*')
        .eq('company_id', profile.company_id).order('name')
        .then(({ data }) => setLocations(data || []))
    }
  }, [profile])

  async function handleSearch(e) {
    e.preventDefault()
    if (!search.trim()) return
    setLoading(true)
    setSearched(true)

    const { data: products } = await supabase
      .from('products')
      .select('id, name')
      .eq('company_id', profile.company_id)
      .eq('is_active', true)
      .ilike('name', `%${search.trim()}%`)

    if (!products?.length) {
      setResults([])
      setLoading(false)
      return
    }

    let stockQ = supabase
      .from('stock')
      .select('qty, sph, cyl, axis, addition, name_key, product_id, location_id, locations(name, code)')
      .in('product_id', products.map(p => p.id))
      .eq('company_id', profile.company_id)
      .gt('qty', 0)

    if (locationId !== 'all') stockQ = stockQ.eq('location_id', locationId)
    if (sph !== 'Any')        stockQ = stockQ.eq('sph', sph)
    if (addition !== 'Any')   stockQ = stockQ.eq('addition', addition)

    const { data: stockRows } = await stockQ
    const productMap = Object.fromEntries(products.map(p => [p.id, p]))

    const rows = (stockRows || []).map(s => ({
      product:  productMap[s.product_id]?.name || '—',
      location: s.locations?.code || '—',
      spec:     buildSpec(s),
      qty:      s.qty,
    }))
    rows.sort((a, b) => a.product.localeCompare(b.product) || a.location.localeCompare(b.location))
    setResults(rows)
    setLoading(false)
  }

  function buildSpec(s) {
    if (s.name_key) return s.name_key
    const parts = []
    if (s.sph) parts.push(s.sph)
    if (s.cyl && s.cyl !== '-') parts.push(s.cyl)
    if (s.axis && s.axis !== '-') parts.push(`ax${s.axis}`)
    if (s.addition && s.addition !== '-') parts.push(`add${s.addition}`)
    return parts.join(' / ') || '—'
  }

  const selectCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"

  return (
    <>
      <h2 className="text-xl font-bold text-slate-800 mb-1">Stock query</h2>
      <p className="text-slate-500 text-sm mb-6">Search current stock levels by product and spec.</p>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Product name</label>
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="e.g. 1.56 Bifocal…"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">SPH</label>
              <select value={sph} onChange={e => setSph(e.target.value)} className={selectCls}>
                {SPH_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Addition</label>
              <select value={addition} onChange={e => setAdd(e.target.value)} className={selectCls}>
                {ADD_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Location</label>
            <select value={locationId} onChange={e => setLocationId(e.target.value)} className={selectCls}>
              <option value="all">All locations</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
            </select>
          </div>
          <button
            type="submit" disabled={loading || !search.trim()}
            className="w-full bg-slate-900 text-white py-3 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            {loading ? 'Searching…' : 'Search stock'}
          </button>
        </form>
      </div>

      {searched && !loading && (
        <>
          {results.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-10">No in-stock results found.</p>
          ) : (
            <>
              <p className="text-xs text-slate-400 mb-3">{results.length} result{results.length !== 1 ? 's' : ''}</p>
              <div className="space-y-2">
                {results.map((r, i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">{r.product}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{r.location} · {r.spec}</p>
                    </div>
                    <span className="text-slate-900 font-bold text-sm ml-4">{r.qty}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}