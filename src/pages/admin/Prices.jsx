import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import { useAuth } from '../../hooks/useAuth'
import Layout from '../../components/Layout'

const SPH_VALUES = ['Plano', ...Array.from({ length: 80 }, (_, i) => '+' + String((i + 1) * 25).padStart(3, '0')), ...Array.from({ length: 80 }, (_, i) => '-' + String((i + 1) * 25).padStart(3, '0'))]
const CYL_VALUES = ['-', '+000', ...Array.from({ length: 16 }, (_, i) => '-' + String((i + 1) * 25).padStart(3, '0')), ...Array.from({ length: 16 }, (_, i) => '+' + String((i + 1) * 25).padStart(3, '0'))]
const ADD_VALUES  = ['-', ...Array.from({ length: 16 }, (_, i) => '+' + String((i + 1) * 25).padStart(3, '0'))]

export default function Prices() {
  const { profile } = useAuth()
  const [classes, setClasses]   = useState([])
  const [products, setProducts] = useState([])
  const [prices, setPrices]     = useState([])
  const [form, setForm] = useState({
    class_id: '', product_id: '',
    sph: 'Plano', cyl: '-', addition: '-',
    price: '',
  })
  const [loading, setLoading]   = useState(false)
  const [msg, setMsg]           = useState({ type: '', text: '' })
  const [filterProduct, setFP]  = useState('')

  useEffect(() => {
    if (profile?.company_id) { fetchClasses(); fetchPrices() }
  }, [profile])

  useEffect(() => { if (form.class_id) fetchProducts(form.class_id) }, [form.class_id])

  async function fetchClasses() {
    const { data } = await supabase.from('product_classes').select('*').eq('company_id', profile.company_id).order('name')
    setClasses(data || [])
    if (data?.length) setForm(f => ({ ...f, class_id: data[0].id }))
  }

  async function fetchProducts(classId) {
    const { data } = await supabase.from('products').select('*').eq('company_id', profile.company_id).eq('class_id', classId).eq('is_active', true).order('name')
    setProducts(data || [])
    setForm(f => ({ ...f, product_id: data?.[0]?.id || '' }))
  }

  async function fetchPrices() {
    const { data } = await supabase
      .from('product_prices')
      .select('*, products(name, spec_type, product_classes(name))')
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })
    setPrices(data || [])
  }

  function update(field, value) { setForm(f => ({ ...f, [field]: value })) }
  function flash(type, text) { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 4000) }

  const selectedProduct = products.find(p => p.id === form.product_id)
  const specType  = selectedProduct?.spec_type || 'sph_add'
  const isUtility = specType === 'name_only'

  async function savePrice(e) {
    e.preventDefault()
    if (!form.product_id || !form.price) { flash('error', 'Product and price required'); return }
    setLoading(true)

    const payload = {
      company_id: profile.company_id,
      product_id: form.product_id,
      sph:      isUtility ? null : form.sph,
      cyl:      isUtility ? null : (specType === 'sph_add' ? null : form.cyl),
      axis:     null,
      addition: isUtility ? null : (specType === 'sph_cyl' ? null : form.addition),
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

  async function deletePrice(id) {
    await supabase.from('product_prices').delete().eq('id', id)
    fetchPrices()
  }

  const sc = "w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white text-base"
  const filtered = filterProduct ? prices.filter(p => p.product_id === filterProduct) : prices

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6 lg:px-6 lg:py-10">
        <h2 className="text-xl font-bold text-slate-800 mb-1">Prices</h2>
        <p className="text-slate-500 text-sm mb-6">
          Set default prices per product and spec. These auto-fill when recording a sale.
        </p>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
          <h3 className="font-semibold text-slate-700 mb-4">Set price</h3>
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

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Price (₦)</label>
              <input type="number" min="0" required value={form.price}
                onChange={e => update('price', e.target.value)} placeholder="e.g. 5000"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 text-base" />
            </div>

            {msg.text && (
              <div className={`text-sm rounded-xl px-4 py-3 ${msg.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
                {msg.text}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-semibold text-base hover:bg-slate-700 disabled:opacity-50">
              {loading ? 'Saving...' : 'Save price'}
            </button>
          </form>
        </div>

        {/* Price list */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-700 text-sm">{prices.length} prices set</h3>
          <select value={filterProduct} onChange={e => setFP(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none">
            <option value="">All products</option>
            {[...new Map(prices.map(p => [p.product_id, p])).values()].map(p => (
              <option key={p.product_id} value={p.product_id}>{p.products?.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          {filtered.length === 0 && <p className="text-slate-400 text-sm text-center py-8">No prices set yet.</p>}
          {filtered.map(p => {
            const spec = [p.sph, p.cyl, p.addition].filter(v => v && v !== '-').join(' / ') || p.name_key || '—'
            return (
              <div key={p.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800 text-sm">{p.products?.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{spec} · {p.products?.product_classes?.name}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-slate-800">₦{Number(p.price).toLocaleString()}</span>
                  <button onClick={() => deletePrice(p.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Layout>
  )
}