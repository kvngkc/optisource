import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../supabase'
import { useAuth } from '../../hooks/useAuth'
import Layout from '../../components/Layout'

const SPEC_LABELS = {
  sph_add:          'SPH + ADD',
  sph_cyl:          'SPH + CYL',
  sph_cyl_axis_add: 'SPH + CYL + AXIS + ADD',
  name_only:        'Name only',
}

const TABS = ['My Products', 'Global Catalogue', 'Import CSV']

export default function Products() {
  const { profile } = useAuth()
  const [tab, setTab]               = useState('My Products')
  const [products, setProducts]     = useState([])
  const [catalogue, setCatalogue]   = useState([])
  const [classes, setClasses]       = useState([])
  const [adopted, setAdopted]       = useState(new Set())
  const [filterClass, setFilter]    = useState('all')
  const [catFilter, setCatFilter]   = useState('all')
  const [form, setForm]             = useState({ name: '', class_id: '', spec_type: 'sph_add' })
  const [loading, setLoading]       = useState(false)
  const [msg, setMsg]               = useState({ type: '', text: '' })
  const [csvRows, setCsvRows]       = useState([])
  const [csvError, setCsvError]     = useState('')
  const fileRef = useRef()

  useEffect(() => {
    if (profile?.company_id) {
      fetchClasses()
      fetchProducts()
      fetchCatalogue()
    }
  }, [profile])

  async function fetchClasses() {
    const { data } = await supabase
      .from('product_classes')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('name')
    setClasses(data || [])
    if (data?.length && !form.class_id) {
      setForm(f => ({ ...f, class_id: data[0].id }))
    }
  }

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select('*, product_classes(name)')
      .eq('company_id', profile.company_id)
      .order('name')
    setProducts(data || [])
    setAdopted(new Set(data?.map(p => p.global_product_id).filter(Boolean)))
  }

  async function fetchCatalogue() {
    const { data } = await supabase
      .from('global_products')
      .select('*')
      .eq('is_active', true)
      .order('class_name')
      .order('name')
    setCatalogue(data || [])
  }

  function flash(type, text) {
    setMsg({ type, text })
    setTimeout(() => setMsg({ type: '', text: '' }), 3000)
  }

  // ── Add custom product ──────────────────────────────────────
  async function addCustomProduct(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.class_id) {
      flash('error', 'Name and class are required')
      return
    }
    setLoading(true)
    const { error } = await supabase.from('products').insert({
      company_id: profile.company_id,
      class_id:   form.class_id,
      name:       form.name.trim(),
      spec_type:  form.spec_type,
    })
    if (error) flash('error', error.message)
    else { flash('success', 'Product added'); setForm(f => ({ ...f, name: '' })); fetchProducts() }
    setLoading(false)
  }

  // ── Adopt from global catalogue ─────────────────────────────
  async function adoptProduct(gp) {
    if (adopted.has(gp.id)) return
    const matchClass = classes.find(c => c.name === gp.class_name)
    if (!matchClass) {
      flash('error', `Class "${gp.class_name}" not found. Add it first in product classes.`)
      return
    }
    const { error } = await supabase.from('products').insert({
      company_id:       profile.company_id,
      class_id:         matchClass.id,
      name:             gp.name,
      spec_type:        gp.spec_type,
      global_product_id: gp.id,
    })
    if (error) flash('error', error.message)
    else { flash('success', `${gp.name} added to your products`); fetchProducts() }
  }

  async function adoptAll() {
    const toAdopt = filteredCat.filter(gp => !adopted.has(gp.id))
    if (!toAdopt.length) { flash('error', 'All shown products already added'); return }
    setLoading(true)
    let added = 0
    for (const gp of toAdopt) {
      const matchClass = classes.find(c => c.name === gp.class_name)
      if (!matchClass) continue
      const { error } = await supabase.from('products').insert({
        company_id:        profile.company_id,
        class_id:          matchClass.id,
        name:              gp.name,
        spec_type:         gp.spec_type,
        global_product_id: gp.id,
      })
      if (!error) added++
    }
    await fetchProducts()
    flash('success', `${added} products added`)
    setLoading(false)
  }

  // ── CSV Import ──────────────────────────────────────────────
  function handleCSVFile(e) {
    setCsvError('')
    setCsvRows([])
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const lines = ev.target.result.split('\n').map(l => l.trim()).filter(Boolean)
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const nameIdx  = headers.indexOf('name')
      const classIdx = headers.indexOf('class')
      const specIdx  = headers.indexOf('spec_type')
      if (nameIdx < 0 || classIdx < 0) {
        setCsvError('CSV must have "name" and "class" columns. spec_type is optional.')
        return
      }
      const rows = []
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim())
        rows.push({
          name:      cols[nameIdx] || '',
          class_name: cols[classIdx] || '',
          spec_type: specIdx >= 0 ? cols[specIdx] : 'sph_add',
        })
      }
      setCsvRows(rows.filter(r => r.name && r.class_name))
    }
    reader.readAsText(file)
  }

  async function importCSV() {
    if (!csvRows.length) return
    setLoading(true)
    let added = 0, skipped = 0
    for (const row of csvRows) {
      const matchClass = classes.find(c => c.name.toLowerCase() === row.class_name.toLowerCase())
      if (!matchClass) { skipped++; continue }
      const { error } = await supabase.from('products').insert({
        company_id: profile.company_id,
        class_id:   matchClass.id,
        name:       row.name,
        spec_type:  row.spec_type,
      })
      if (!error) added++; else skipped++
    }
    await fetchProducts()
    flash('success', `Imported ${added} products. ${skipped > 0 ? skipped + ' skipped (duplicates or unknown class).' : ''}`)
    setCsvRows([])
    setLoading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function toggleActive(p) {
    await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id)
    fetchProducts()
  }

  const classNames = [...new Set(catalogue.map(p => p.class_name))]
  const filteredCat = catFilter === 'all' ? catalogue : catalogue.filter(p => p.class_name === catFilter)
  const filteredMine = filterClass === 'all' ? products : products.filter(p => p.class_id === filterClass)

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">Products</h2>
        <p className="text-slate-500 text-sm mb-6">
          Build your product list from the global catalogue, import via CSV, or add custom products.
        </p>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Flash message */}
        {msg.text && (
          <div className={`mb-4 text-sm rounded-lg px-4 py-3 ${msg.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
            {msg.text}
          </div>
        )}

        {/* ── TAB: My Products ── */}
        {tab === 'My Products' && (
          <>
            {/* Add custom */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
              <h3 className="font-semibold text-slate-700 mb-4">Add custom product</h3>
              <form onSubmit={addCustomProduct} className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                    <input type="text" value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. FUSE PHOTO"
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
                    <select value={form.class_id} onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900">
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Spec type</label>
                    <select value={form.spec_type} onChange={e => setForm(f => ({ ...f, spec_type: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900">
                      {Object.entries(SPEC_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="bg-slate-900 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-slate-700 transition-colors disabled:opacity-50">
                  {loading ? 'Adding...' : 'Add product'}
                </button>
              </form>
            </div>

            {/* Filter + list */}
            <div className="flex gap-2 mb-4 flex-wrap">
              <button onClick={() => setFilter('all')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filterClass === 'all' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                All ({products.length})
              </button>
              {classes.map(c => (
                <button key={c.id} onClick={() => setFilter(c.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filterClass === c.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                  {c.name} ({products.filter(p => p.class_id === c.id).length})
                </button>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {filteredMine.length === 0
                ? <div className="text-center py-12 text-slate-400">No products yet. Add from catalogue or create a custom one.</div>
                : <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Name</th>
                        <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Class</th>
                        <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Spec type</th>
                        <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Status</th>
                        <th className="px-5 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMine.map(p => (
                        <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-5 py-3 font-medium text-slate-800 text-sm">{p.name}</td>
                          <td className="px-5 py-3 text-slate-500 text-sm">{p.product_classes?.name}</td>
                          <td className="px-5 py-3 text-slate-400 text-xs">{SPEC_LABELS[p.spec_type]}</td>
                          <td className="px-5 py-3">
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${p.is_active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                              {p.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button onClick={() => toggleActive(p)} className="text-xs text-slate-400 hover:text-slate-700">
                              {p.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              }
            </div>
          </>
        )}

        {/* ── TAB: Global Catalogue ── */}
        {tab === 'Global Catalogue' && (
          <>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setCatFilter('all')}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${catFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                  All ({catalogue.length})
                </button>
                {classNames.map(cn => (
                  <button key={cn} onClick={() => setCatFilter(cn)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${catFilter === cn ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                    {cn}
                  </button>
                ))}
              </div>
              <button onClick={adoptAll} disabled={loading}
                className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50">
                {loading ? 'Adding...' : `Add all shown (${filteredCat.filter(p => !adopted.has(p.id)).length})`}
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Name</th>
                    <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Class</th>
                    <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Spec type</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCat.map(gp => (
                    <tr key={gp.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-800 text-sm">{gp.name}</td>
                      <td className="px-5 py-3 text-slate-500 text-sm">{gp.class_name}</td>
                      <td className="px-5 py-3 text-slate-400 text-xs">{SPEC_LABELS[gp.spec_type]}</td>
                      <td className="px-5 py-3 text-right">
                        {adopted.has(gp.id)
                          ? <span className="text-xs text-green-600 font-medium">Added</span>
                          : <button onClick={() => adoptProduct(gp)}
                              className="text-xs bg-slate-900 text-white px-3 py-1 rounded-lg hover:bg-slate-700">
                              Add
                            </button>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── TAB: Import CSV ── */}
        {tab === 'Import CSV' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-700 mb-2">CSV format</h3>
              <p className="text-sm text-slate-500 mb-4">
                Your CSV file must have these column headers in row 1. Download the template to get started.
              </p>
              <div className="bg-slate-50 rounded-lg p-4 font-mono text-sm text-slate-600 mb-4">
                name,class,spec_type<br/>
                FUSE PHOTO,Finished Lens,sph_add<br/>
                S/V AR,Finished Lens,sph_cyl<br/>
                Blue Tint,Utilities,name_only
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Valid spec_type values: <code>sph_add</code> · <code>sph_cyl</code> · <code>sph_cyl_axis_add</code> · <code>name_only</code>
              </p>
              <button
                onClick={() => {
                  const csv = 'name,class,spec_type\nFUSE PHOTO,Finished Lens,sph_add\nS/V AR,Finished Lens,sph_cyl\nBlue Tint,Utilities,name_only'
                  const a = document.createElement('a')
                  a.href = 'data:text/csv,' + encodeURIComponent(csv)
                  a.download = 'optisource_products_template.csv'
                  a.click()
                }}
                className="text-sm bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200"
              >
                Download template
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-700 mb-4">Upload file</h3>
              <input ref={fileRef} type="file" accept=".csv" onChange={handleCSVFile}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-900 file:text-white hover:file:bg-slate-700 mb-4" />

              {csvError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{csvError}</div>}

              {csvRows.length > 0 && (
                <>
                  <p className="text-sm text-slate-600 mb-3">{csvRows.length} rows ready to import:</p>
                  <div className="border border-slate-200 rounded-lg overflow-hidden mb-4 max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Name</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Class</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Spec type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvRows.map((r, i) => (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="px-4 py-2 text-slate-800">{r.name}</td>
                            <td className="px-4 py-2 text-slate-500">{r.class_name}</td>
                            <td className="px-4 py-2 text-slate-400 text-xs">{r.spec_type}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button onClick={importCSV} disabled={loading}
                    className="bg-slate-900 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-slate-700 disabled:opacity-50">
                    {loading ? 'Importing...' : `Import ${csvRows.length} products`}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}