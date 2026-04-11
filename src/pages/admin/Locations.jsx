import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import { useAuth } from '../../hooks/useAuth'
import Layout from '../../components/Layout'

export default function Locations() {
  const { profile } = useAuth()
  const [locations, setLocations] = useState([])
  const [form, setForm]           = useState({ name: '', code: '' })
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')

  useEffect(() => { fetchLocations() }, [profile])

  async function fetchLocations() {
    if (!profile?.company_id) return
    const { data } = await supabase
      .from('locations')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('created_at')
    setLocations(data || [])
  }

  async function addLocation(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!form.name.trim() || !form.code.trim()) {
      setError('Both name and code are required')
      return
    }
    const code = form.code.trim().toUpperCase().replace(/\s+/g, '')
    setLoading(true)
    const { error: err } = await supabase
      .from('locations')
      .insert({ company_id: profile.company_id, name: form.name.trim(), code })
    if (err) setError(err.message)
    else { setSuccess('Location added successfully'); setForm({ name: '', code: '' }); fetchLocations() }
    setLoading(false)
  }

  async function deleteLocation(id) {
    if (!confirm('Delete this location? This cannot be undone.')) return
    const { error: err } = await supabase.from('locations').delete().eq('id', id)
    if (err) setError(err.message)
    else fetchLocations()
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">Locations</h2>
        <p className="text-slate-500 text-sm mb-8">
          Add your store and shop locations. The code is used internally (e.g. STORE, SHOP1, SHOP2).
        </p>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8">
          <h3 className="font-semibold text-slate-700 mb-4">Add location</h3>
          <form onSubmit={addLocation} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Display name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Main Store"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Code</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. STORE"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <p className="text-xs text-slate-400 mt-1">Uppercase, no spaces</p>
              </div>
            </div>

            {error   && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
            {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">{success}</div>}

            <button
              type="submit"
              disabled={loading}
              className="bg-slate-900 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add location'}
            </button>
          </form>
        </div>

        <div className="space-y-3">
          {locations.length === 0 && (
            <div className="text-center py-12 text-slate-400">No locations yet. Add your first one above.</div>
          )}
          {locations.map(loc => (
            <div key={loc.id} className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800">{loc.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">Code: {loc.code}</p>
              </div>
              <button onClick={() => deleteLocation(loc.id)} className="text-sm text-red-500 hover:text-red-700">
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}