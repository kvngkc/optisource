import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import { useAuth } from '../../hooks/useAuth'
import Layout from '../../components/Layout'
import { SPH_VALUES, CYL_VALUES, ADD_VALUES, BASE_VALUES, dbFormatBase } from '../../utils/specs'

export default function Prices() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('exact')

  // Shared state
  const [classes, setClasses]   = useState([])
  const [products, setProducts] = useState([])
  const [filterProduct, setFP]  = useState('')
  const [loading, setLoading]   = useState(false)
  const [msg, setMsg]           = useState({ type: '', text: '' })

  // Exact/Base prices state
  const [prices, setPrices]     = useState([])
  const [form, setForm] = useState({
    class_id: '', product_id: '',
    sph: 'All', cyl: 'All', addition: 'All',
    price: '',
  })

  // Range prices state
  const [ranges, setRanges]     = useState([])
  const [rForm, setRForm] = useState({
    class_id: '', product_id: '',
    sph_min: '', sph_max: '',
    cyl_min: '', cyl_max: '',
    add_min: '', add_max: '',
    price: '',
  })

  useEffect(() => {
    if (profile?.company_id) { fetchClasses(); fetchPrices(); fetchRanges() }
  }, [profile])

  useEffect(() => { if (form.class_id) fetchProducts(form.class_id) }, [form.class_id])
  useEffect(() => { if (rForm.class_id) fetchProductsForRange(rForm.class_id) }, [rForm.class_id])

  async function fetchClasses() {
    const { data } = await supabase.from('product_classes').select('*').eq('company_id', profile.company_id).order('name')
    setClasses(data || [])
    if (data?.length) {
      setForm(f => ({ ...f, class_id: data[0].id }))
      setRForm(f => ({ ...f, class_id: data[0].id }))
    }
  }

  async function fetchProducts(classId) {
    const { data } = await supabase.from('products').select('*').eq('company_id', profile.company_id).eq('class_id', classId).eq('is_active', true).order('name')
    setProducts(data || [])
    setForm(f => ({ ...f, product_id: data?.[0]?.id || '' }))
  }

  async function fetchProductsForRange(classId) {
    const { data } = await supabase.from('products').select('*').eq('company_id', profile.company_id).eq('class_id', classId).eq('is_active', true).order('name')
    setProducts(data || [])
    setRForm(f => ({ ...f, product_id: data?.[0]?.id || '' }))
  }

  async function fetchPrices() {
    const { data } = await supabase.from('product_prices')
      .select('*, products(name, spec_type, product_classes(name))')
      .eq('company_id', profile.company_id).order('created_at', { ascending: false })
    setPrices(data || [])
  }

  async function fetchRanges() {
    const { data } = await supabase.from('product_price_ranges')
      .select('*, products(name, spec_type, product_classes(name))')
      .eq('company_id', profile.company_id).order('created_at', { ascending: false })
    setRanges(data || [])
  }

  function update(field, value) { setForm(f => ({ ...f, [field]: value })) }
  function updateR(field, value) { setRForm(f => ({ ...f, [field]: value })) }
  function flash(type, text) { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 4000) }

  const selectedProduct = products.find(p => p.id === form.product_id)
  const specType  = selectedProduct?.spec_type || 'sph_add'
  const isUtility = specType === 'name_only'
  const usesBase  = specType.startsWith('base_')

  async function savePrice(e) {
    e.preventDefault()
    if (!form.product_id || !form.price) { flash('error', 'Product and price required'); return }
    setLoading(true)
    const getVal = (v, isBase) => v === 'All' ? null : (isBase ? dbFormatBase(v) : v)
    const payload = {
      company_id: profile.company_id,
      product_id: form.product_id,
      sph:      isUtility ? null : getVal(form.sph, usesBase),
      cyl:      isUtility ? null : (specType === 'sph_add' || specType === 'base_add' ? null : getVal(form.cyl, false)),
      axis:     null,
      addition: isUtility ? null : (specType === 'sph_cyl' || specType === 'base_only' ? null : getVal(form.addition, false)),
      name_key: isUtility ? selectedProduct?.name : null,
      price:    Number(form.price),
    }
    const { error } = await supabase.from('product_prices').upsert(payload, {
      onConflict: 'company_id,product_id,sph,cyl,axis,addition,name_key'
    })
    if (error) flash('error', error.message)
    else { flash('success', 'Price saved'); setForm(f => ({ ...f, price: '' })); fetchPrices() }
    setLoading(false)
  }

  async function saveRange(e) {
    e.preventDefault()
    if (!rForm.product_id || !rForm.price) { flash('error', 'Product and price required'); return }
    setLoading(true)
    const toNum = v => v === '' ? null : Number(v)
    const payload = {
      company_id: profile.company_id,
      product_id: rForm.product_id,
      sph_min: toNum(rForm.sph_min), sph_max: toNum(rForm.sph_max),
      cyl_min: toNum(rForm.cyl_min), cyl_max: toNum(rForm.cyl_max),
      add_min: toNum(rForm.add_min), add_max: toNum(rForm.add_max),
      price: Number(rForm.price),
    }
    const { error } = await supabase.from('product_price_ranges').insert(payload)
    if (error) flash('error', error.message)
    else { flash('success', 'Range saved'); setRForm(f => ({ ...f, sph_min: '', sph_max: '', cyl_min: '', cyl_max: '', add_min: '', add_max: '', price: '' })); fetchRanges() }
    setLoading(false)
  }

  async function deletePrice(id) {
    if (!window.confirm('Delete this price?')) return
    const { error } = await supabase.from('product_prices').delete().eq('id', id)
    if (error) flash('error', error.message)
    else { flash('success', 'Price deleted'); fetchPrices() }
  }

  async function deleteRange(id) {
    if (!window.confirm('Delete this range?')) return
    const { error } = await supabase.from('product_price_ranges').delete().eq('id', id)
    if (error) flash('error', error.message)
    else { flash('success', 'Range deleted'); fetchRanges() }
  }

  const sc = "w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white text-base"
  const nc = "w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 text-base"
  const filteredPrices = filterProduct ? prices.filter(p => p.product_id === filterProduct) : prices
  const filteredRanges = filterProduct ? ranges.filter(r => r.product_id === filterProduct) : ranges

  const allProducts = [...new Map([...prices, ...ranges].map(p => [p.product_id, p])).values()]

  function formatRange(r) {
    const parts = []
    if (r.sph_min != null || r.sph_max != null) parts.push(`SPH ${r.sph_min ?? '…'} – ${r.sph_max ?? '…'}`)
    if (r.cyl_min != null || r.cyl_max != null) parts.push(`CYL ${r.cyl_min ?? '…'} – ${r.cyl_max ?? '…'}`)
    if (r.add_min != null || r.add_max != null) parts.push(`ADD ${r.add_min ?? '…'} – ${r.add_max ?? '…'}`)
    return parts.join(' · ') || 'All specs'
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6 lg:px-6 lg:py-10">
        <h2 className="text-xl font-bold text-slate-800 mb-1">Prices</h2>
        <p className="text-slate-500 text-sm mb-6">
          Set exact or range-based prices per product. Lookup priority: Exact → Range → Base fallback.
        </p>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6">
          {[['exact', 'Exact & Base'], ['range', 'Range Pricing']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Exact / Base Tab */}
        {tab === 'exact' && (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
              <h3 className="font-semibold text-slate-700 mb-1">Set exact or base price</h3>
              <p className="text-xs text-slate-400 mb-4">Choose "All specs" to set a base fallback price for the entire product.</p>
              <form onSubmit={savePrice} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
                    <select value={form.class_id} onChange={e => update('class_id', e.target.value)} className={sc}>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
                    <select value={form.product_id} onChange={e => update('product_id', e.target.value)} className={sc}>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>

                {!isUtility && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{usesBase ? 'Base' : 'SPH'}</label>
                      <select value={form.sph} onChange={e => update('sph', e.target.value)} className={sc}>
                        <option value="All">All specs (Base price)</option>
                        {(usesBase ? BASE_VALUES : SPH_VALUES).map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    {(specType === 'sph_cyl' || specType === 'sph_cyl_axis_add') && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">CYL</label>
                        <select value={form.cyl} onChange={e => update('cyl', e.target.value)} className={sc}>
                          <option value="All">All CYL</option>
                          {CYL_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                    )}
                    {(specType === 'sph_add' || specType === 'base_add' || specType === 'sph_cyl_axis_add') && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Addition</label>
                        <select value={form.addition} onChange={e => update('addition', e.target.value)} className={sc}>
                          <option value="All">All Additions</option>
                          {ADD_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Price (₦)</label>
                  <input type="number" min="0" required value={form.price}
                    onChange={e => update('price', e.target.value)} placeholder="e.g. 5000"
                    className={nc} />
                </div>

                {msg.text && (
                  <div className={`text-sm rounded-xl px-4 py-3 ${msg.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
                    {msg.text}
                  </div>
                )}
                <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-semibold text-base hover:bg-slate-700 disabled:opacity-50">
                  {loading ? 'Saving...' : 'Save price'}
                </button>
              </form>
            </div>

            {/* Exact price list */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-700 text-sm">{filteredPrices.length} exact price{filteredPrices.length !== 1 ? 's' : ''}</h3>
              <select value={filterProduct} onChange={e => setFP(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none">
                <option value="">All products</option>
                {allProducts.map(p => <option key={p.product_id} value={p.product_id}>{p.products?.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              {filteredPrices.length === 0 && <p className="text-slate-400 text-sm text-center py-8">No exact prices set yet.</p>}
              {filteredPrices.map(p => {
                const spec = p.sph == null && p.cyl == null && p.addition == null
                  ? <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Base fallback</span>
                  : <span className="text-xs text-slate-400">{[p.sph, p.cyl, p.addition].filter(v => v && v !== '-').join(' / ') || p.name_key || '—'}</span>
                return (
                  <div key={p.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{p.products?.name}</p>
                      <div className="mt-0.5">{spec}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-slate-800">₦{Number(p.price).toLocaleString()}</span>
                      <button onClick={() => deletePrice(p.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Range Pricing Tab */}
        {tab === 'range' && (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
              <h3 className="font-semibold text-slate-700 mb-1">Set range price</h3>
              <p className="text-xs text-slate-400 mb-4">
                Define a price bracket (e.g. SPH 0–400, CYL 0–200 = ₦5,000). Leave any bound blank to mean "no limit".
              </p>
              <form onSubmit={saveRange} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
                    <select value={rForm.class_id} onChange={e => updateR('class_id', e.target.value)} className={sc}>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
                    <select value={rForm.product_id} onChange={e => updateR('product_id', e.target.value)} className={sc}>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">SPH Range</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Min SPH (e.g. 0)</label>
                      <input type="number" value={rForm.sph_min} onChange={e => updateR('sph_min', e.target.value)} placeholder="No min" className={nc} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Max SPH (e.g. 400)</label>
                      <input type="number" value={rForm.sph_max} onChange={e => updateR('sph_max', e.target.value)} placeholder="No max" className={nc} />
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">CYL Range</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Min CYL</label>
                      <input type="number" value={rForm.cyl_min} onChange={e => updateR('cyl_min', e.target.value)} placeholder="No min" className={nc} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Max CYL</label>
                      <input type="number" value={rForm.cyl_max} onChange={e => updateR('cyl_max', e.target.value)} placeholder="No max" className={nc} />
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Addition Range</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Min ADD</label>
                      <input type="number" value={rForm.add_min} onChange={e => updateR('add_min', e.target.value)} placeholder="No min" className={nc} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Max ADD</label>
                      <input type="number" value={rForm.add_max} onChange={e => updateR('add_max', e.target.value)} placeholder="No max" className={nc} />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Price (₦)</label>
                  <input type="number" min="0" required value={rForm.price}
                    onChange={e => updateR('price', e.target.value)} placeholder="e.g. 7000"
                    className={nc} />
                </div>

                {msg.text && (
                  <div className={`text-sm rounded-xl px-4 py-3 ${msg.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
                    {msg.text}
                  </div>
                )}
                <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-semibold text-base hover:bg-slate-700 disabled:opacity-50">
                  {loading ? 'Saving...' : 'Save range'}
                </button>
              </form>
            </div>

            {/* Range list */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-700 text-sm">{filteredRanges.length} range{filteredRanges.length !== 1 ? 's' : ''}</h3>
              <select value={filterProduct} onChange={e => setFP(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none">
                <option value="">All products</option>
                {allProducts.map(p => <option key={p.product_id} value={p.product_id}>{p.products?.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              {filteredRanges.length === 0 && <p className="text-slate-400 text-sm text-center py-8">No ranges set yet.</p>}
              {filteredRanges.map(r => (
                <div key={r.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800 text-sm">{r.products?.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatRange(r)}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-slate-800">₦{Number(r.price).toLocaleString()}</span>
                    <button onClick={() => deleteRange(r.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}