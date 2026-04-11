import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'

const SPH_VALUES = ['Plano', ...Array.from({ length: 80 }, (_, i) => '+' + String((i + 1) * 25).padStart(3, '0')), ...Array.from({ length: 80 }, (_, i) => '-' + String((i + 1) * 25).padStart(3, '0'))]
const CYL_VALUES = ['-', '+000', ...Array.from({ length: 16 }, (_, i) => '-' + String((i + 1) * 25).padStart(3, '0')), ...Array.from({ length: 16 }, (_, i) => '+' + String((i + 1) * 25).padStart(3, '0'))]
const AXIS_VALUES = ['-', '90', '180']
const ADD_VALUES  = ['-', ...Array.from({ length: 16 }, (_, i) => '+' + String((i + 1) * 25).padStart(3, '0'))]

function buildStockQuery(base, { sph, cyl, axis, addition, name_key }) {
  let q = base
  sph      === null ? q = q.is('sph',      null) : q = q.eq('sph',      sph)
  cyl      === null ? q = q.is('cyl',      null) : q = q.eq('cyl',      cyl)
  axis     === null ? q = q.is('axis',     null) : q = q.eq('axis',     axis)
  addition === null ? q = q.is('addition', null) : q = q.eq('addition', addition)
  name_key === null ? q = q.is('name_key', null) : q = q.eq('name_key', name_key)
  return q
}

export default function Inventory() {
  const { profile } = useAuth()
  const [products, setProducts]     = useState([])
  const [locations, setLocations]   = useState([])
  const [classes, setClasses]       = useState([])
  const [recentLogs, setRecentLogs] = useState([])

  const [form, setForm] = useState({
    class_id: '', product_id: '', location_id: '',
    sph: 'Plano', cyl: '-', axis: '-', addition: '-', qty: '',
  })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]         = useState({ type: '', text: '' })

  useEffect(() => {
    if (profile?.company_id) {
      fetchClasses()
      fetchLocations()
      fetchRecentLogs()
    }
  }, [profile])

  useEffect(() => {
    if (form.class_id) fetchProducts(form.class_id)
  }, [form.class_id])

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

  async function fetchLocations() {
    const { data } = await supabase.from('locations').select('*').eq('company_id', profile.company_id).order('name')
    setLocations(data || [])
    if (profile?.location_id) setForm(f => ({ ...f, location_id: profile.location_id }))
    else if (data?.length) setForm(f => ({ ...f, location_id: data[0].id }))
  }

  async function fetchRecentLogs() {
    const { data } = await supabase
      .from('transactions').select('*, products(name), locations(name, code)')
      .eq('company_id', profile.company_id).eq('type', 'INVENTORY_ADD')
      .order('created_at', { ascending: false }).limit(10)
    setRecentLogs(data || [])
  }

  function update(field, value) { setForm(f => ({ ...f, [field]: value })) }

  function flash(type, text) {
    setMsg({ type, text })
    setTimeout(() => setMsg({ type: '', text: '' }), 4000)
  }

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
    if (!form.product_id || !form.location_id) { flash('error', 'Product and location are required'); return }
    if (!qty || qty <= 0) { flash('error', 'Qty must be a positive number'); return }

    setLoading(true)
    const specs = getSpecValues()

    const baseQuery = supabase.from('stock').select('id, qty')
      .eq('product_id', form.product_id)
      .eq('location_id', form.location_id)

    const { data: existing } = await buildStockQuery(baseQuery, specs).maybeSingle()

    let stockError
    if (existing) {
      const { error } = await supabase.from('stock').update({ qty: existing.qty + qty, updated_at: new Date() }).eq('id', existing.id)
      stockError = error
    } else {
      const { error } = await supabase.from('stock').insert({
        company_id:  profile.company_id,
        product_id:  form.product_id,
        location_id: form.location_id,
        ...specs, qty,
      })
      stockError = error
    }

    if (stockError) { flash('error', stockError.message); setLoading(false); return }

    await supabase.from('transactions').insert({
      company_id: profile.company_id, type: 'INVENTORY_ADD',
      product_id: form.product_id, location_id: form.location_id,
      ...specs, qty, created_by: profile.id,
    })

    await supabase.from('audit_log').insert({
      company_id: profile.company_id, user_id: profile.id,
      status: 'SUCCESS', action: 'INVENTORY_ADD',
      details: { product: selectedProduct?.name, location: locations.find(l => l.id === form.location_id)?.code, ...specs, qty },
    })

    flash('success', `Stock added — ${selectedProduct?.name} +${qty}`)
    setForm(f => ({ ...f, qty: '' }))
    fetchRecentLogs()
    setLoading(false)
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">Inventory entry</h2>
        <p className="text-slate-500 text-sm mb-8">Add stock for a product at a specific location and spec.</p>

        <div className="grid grid-cols-5 gap-8">
          <div className="col-span-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <form onSubmit={handleSubmit} className="space-y-5">

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                  <select value={form.location_id} onChange={e => update('location_id', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900">
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Product class</label>
                  <select value={form.class_id} onChange={e => update('class_id', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900">
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
                  <select value={form.product_id} onChange={e => update('product_id', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900">
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  {selectedProduct && <p className="text-xs text-slate-400 mt-1">Spec type: {selectedProduct.spec_type}</p>}
                </div>

                {!isUtility && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">SPH / Base</label>
                      <select value={form.sph} onChange={e => update('sph', e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900">
                        {SPH_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    {(specType === 'sph_cyl' || specType === 'sph_cyl_axis_add') && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">CYL</label>
                        <select value={form.cyl} onChange={e => update('cyl', e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900">
                          {CYL_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                    )}
                    {specType === 'sph_cyl_axis_add' && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Axis</label>
                        <select value={form.axis} onChange={e => update('axis', e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900">
                          {AXIS_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                    )}
                    {(specType === 'sph_add' || specType === 'sph_cyl_axis_add') && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Addition</label>
                        <select value={form.addition} onChange={e => update('addition', e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900">
                          {ADD_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                  <input type="number" min="1" required value={form.qty}
                    onChange={e => update('qty', e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900" />
                </div>

                {msg.text && (
                  <div className={`text-sm rounded-lg px-4 py-3 ${msg.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
                    {msg.text}
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full bg-slate-900 text-white py-2.5 rounded-lg font-medium hover:bg-slate-700 transition-colors disabled:opacity-50">
                  {loading ? 'Adding stock...' : 'Add stock'}
                </button>
              </form>
            </div>
          </div>

          <div className="col-span-2">
            <h3 className="font-semibold text-slate-700 mb-3 text-sm">Recent additions</h3>
            <div className="space-y-2">
              {recentLogs.length === 0 && <p className="text-slate-400 text-sm">No entries yet.</p>}
              {recentLogs.map(log => (
                <div key={log.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
                  <p className="font-medium text-slate-800 text-sm">{log.products?.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    +{log.qty} · {log.locations?.code} · {log.sph || log.name_key || '—'}
                    {log.addition ? ' / ' + log.addition : ''}
                  </p>
                  <p className="text-xs text-slate-300 mt-0.5">{new Date(log.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}