import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'

const SPH_VALUES = ['', 'Plano', ...Array.from({ length: 80 }, (_, i) => '+' + String((i + 1) * 25).padStart(3, '0')), ...Array.from({ length: 80 }, (_, i) => '-' + String((i + 1) * 25).padStart(3, '0'))]
const CYL_VALUES = ['', '-', '+000', ...Array.from({ length: 16 }, (_, i) => '-' + String((i + 1) * 25).padStart(3, '0')), ...Array.from({ length: 16 }, (_, i) => '+' + String((i + 1) * 25).padStart(3, '0'))]
const ADD_VALUES  = ['', '-', ...Array.from({ length: 16 }, (_, i) => '+' + String((i + 1) * 25).padStart(3, '0'))]

export default function StockQuery() {
  const { profile } = useAuth()
  const [products, setProducts]   = useState([])
  const [classes, setClasses]     = useState([])
  const [locations, setLocations] = useState([])
  const [results, setResults]     = useState([])
  const [searched, setSearched]   = useState(false)
  const [loading, setLoading]     = useState(false)

  const [form, setForm] = useState({
    class_id: '', product_id: '', sph: '', cyl: '', addition: '',
  })

  useEffect(() => {
    if (profile?.company_id) {
      fetchClasses()
      fetchLocations()
    }
  }, [profile])

  useEffect(() => {
    if (form.class_id) fetchProducts(form.class_id)
    else setProducts([])
  }, [form.class_id])

  async function fetchClasses() {
    const { data } = await supabase.from('product_classes').select('*').eq('company_id', profile.company_id).order('name')
    setClasses(data || [])
  }

  async function fetchProducts(classId) {
    const { data } = await supabase.from('products').select('*').eq('company_id', profile.company_id).eq('class_id', classId).eq('is_active', true).order('name')
    setProducts(data || [])
    setForm(f => ({ ...f, product_id: '' }))
  }

  async function fetchLocations() {
    const { data } = await supabase.from('locations').select('*').eq('company_id', profile.company_id).order('name')
    setLocations(data || [])
  }

  function update(field, value) { setForm(f => ({ ...f, [field]: value })) }

  const selectedProduct = products.find(p => p.id === form.product_id)
  const specType  = selectedProduct?.spec_type || 'sph_add'
  const isUtility = specType === 'name_only'

  async function handleSearch(e) {
    e.preventDefault()
    if (!form.product_id) return
    setLoading(true)
    setSearched(true)

    let query = supabase.from('stock')
      .select('*, locations(name, code)')
      .eq('product_id', form.product_id)
      .gt('qty', 0)
      .order('qty', { ascending: false })

    // Filter by spec if provided
    if (!isUtility) {
      if (form.sph)      query = query.eq('sph', form.sph)
      if (form.cyl)      query = query.eq('cyl', form.cyl)
      if (form.addition) query = query.eq('addition', form.addition)
    }

    const { data } = await query
    setResults(data || [])
    setLoading(false)
  }

  function clearSearch() {
    setForm({ class_id: '', product_id: '', sph: '', cyl: '', addition: '' })
    setResults([])
    setSearched(false)
  }

  // Group results by spec for cleaner display
  const groupedResults = results.reduce((acc, row) => {
    const specKey = isUtility
      ? row.name_key || '—'
      : [row.sph, row.cyl, row.axis, row.addition].filter(Boolean).filter(v => v !== '-').join(' / ') || '—'

    if (!acc[specKey]) acc[specKey] = []
    acc[specKey].push(row)
    return acc
  }, {})

  const totalStock = results.reduce((sum, r) => sum + r.qty, 0)

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">Stock query</h2>
        <p className="text-slate-500 text-sm mb-8">
          Search live stock across all your locations. Leave spec fields blank to see all available specs.
        </p>

        {/* Search form */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8">
          <form onSubmit={handleSearch} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Product class</label>
                <select value={form.class_id} onChange={e => update('class_id', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900">
                  <option value="">— Select class —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
                <select value={form.product_id} onChange={e => update('product_id', e.target.value)}
                  disabled={!form.class_id}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-50 disabled:text-slate-400">
                  <option value="">— Select product —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            {selectedProduct && !isUtility && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    SPH <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <select value={form.sph} onChange={e => update('sph', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900">
                    <option value="">Any</option>
                    {SPH_VALUES.filter(Boolean).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                {(specType === 'sph_cyl' || specType === 'sph_cyl_axis_add') && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      CYL <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <select value={form.cyl} onChange={e => update('cyl', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900">
                      <option value="">Any</option>
                      {CYL_VALUES.filter(Boolean).map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                )}
                {(specType === 'sph_add' || specType === 'sph_cyl_axis_add') && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Addition <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <select value={form.addition} onChange={e => update('addition', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900">
                      <option value="">Any</option>
                      {ADD_VALUES.filter(Boolean).map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button type="submit" disabled={!form.product_id || loading}
                className="bg-slate-900 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-slate-700 transition-colors disabled:opacity-50">
                {loading ? 'Searching...' : 'Search stock'}
              </button>
              {searched && (
                <button type="button" onClick={clearSearch}
                  className="bg-slate-100 text-slate-700 px-6 py-2.5 rounded-lg font-medium hover:bg-slate-200 transition-colors">
                  Clear
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Results */}
        {searched && !loading && (
          <>
            {results.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <p className="text-slate-400 text-lg mb-1">No stock found</p>
                <p className="text-slate-300 text-sm">No units available for this product with the selected filters</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-700">
                    {selectedProduct?.name} — {results.length} stock line{results.length !== 1 ? 's' : ''}
                  </h3>
                  <div className="bg-slate-900 text-white px-4 py-1.5 rounded-full text-sm font-semibold">
                    Total: {totalStock} units
                  </div>
                </div>

                {/* Location summary bar */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {locations.map(loc => {
                    const locTotal = results.filter(r => r.location_id === loc.id).reduce((s, r) => s + r.qty, 0)
                    return (
                      <div key={loc.id} className={`rounded-xl border p-4 ${locTotal > 0 ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100'}`}>
                        <p className="text-xs font-semibold text-slate-500 mb-1">{loc.name}</p>
                        <p className={`text-2xl font-bold ${locTotal > 0 ? 'text-slate-800' : 'text-slate-300'}`}>{locTotal}</p>
                        <p className="text-xs text-slate-400">units</p>
                      </div>
                    )
                  })}
                </div>

                {/* Spec breakdown */}
                {Object.keys(groupedResults).length > 1 && (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">By spec</p>
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Spec</th>
                          {locations.map(l => (
                            <th key={l.id} className="text-center text-xs font-semibold text-slate-500 px-4 py-3">{l.code}</th>
                          ))}
                          <th className="text-center text-xs font-semibold text-slate-500 px-4 py-3">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(groupedResults).map(([spec, rows]) => (
                          <tr key={spec} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="px-5 py-3 font-mono text-sm text-slate-700">{spec}</td>
                            {locations.map(l => {
                              const row = rows.find(r => r.location_id === l.id)
                              const qty = row?.qty ?? 0
                              return (
                                <td key={l.id} className={`px-4 py-3 text-center font-semibold text-sm ${qty === 0 ? 'text-slate-200' : qty <= 5 ? 'text-amber-600' : 'text-green-600'}`}>
                                  {qty}
                                </td>
                              )
                            })}
                            <td className="px-4 py-3 text-center font-bold text-sm text-slate-800">
                              {rows.reduce((s, r) => s + r.qty, 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}