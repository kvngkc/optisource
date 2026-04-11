import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import { useAuth } from '../../hooks/useAuth'
import Layout from '../../components/Layout'

export default function Staff() {
  const { profile } = useAuth()
  const [staff, setStaff]         = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    fetchStaff()
    fetchLocations()
  }, [profile])

  async function fetchStaff() {
    if (!profile?.company_id) return
    const { data } = await supabase
      .from('profiles')
      .select('*, locations(name, code)')
      .eq('company_id', profile.company_id)
      .order('full_name')
    setStaff(data || [])
  }

  async function fetchLocations() {
    if (!profile?.company_id) return
    const { data } = await supabase
      .from('locations')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('name')
    setLocations(data || [])
  }

  async function updateStaffLocation(staffId, locationId) {
    setError('')
    const { error: err } = await supabase
      .from('profiles')
      .update({ location_id: locationId || null })
      .eq('id', staffId)
    if (err) setError(err.message)
    else fetchStaff()
  }

  async function updateStaffRole(staffId, role) {
    setError('')
    const { error: err } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', staffId)
    if (err) setError(err.message)
    else fetchStaff()
  }

  const ROLE_BADGE = {
    company_admin: 'bg-purple-50 text-purple-700',
    staff:         'bg-blue-50 text-blue-700',
    optician:      'bg-teal-50 text-teal-700',
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">Staff</h2>
        <p className="text-slate-500 text-sm mb-8">
          Assign staff to locations and manage roles. Share your company's register link so staff can sign up.
        </p>

        {/* Register link */}
        <div className="bg-slate-900 text-white rounded-2xl p-5 mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-sm">Staff registration link</p>
            <p className="text-slate-400 text-xs mt-1">Share this link with staff — they register and you assign them here</p>
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(window.location.origin + '/register'); alert('Link copied!') }}
            className="bg-white text-slate-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 whitespace-nowrap"
          >
            Copy link
          </button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}

        {/* Staff list */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {staff.length === 0 ? (
            <div className="text-center py-12 text-slate-400">No staff yet.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Name</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Role</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Location</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(s => (
                  <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800 text-sm">{s.full_name}</p>
                    </td>
                    <td className="px-5 py-3">
                      {s.id === profile.id ? (
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${ROLE_BADGE[s.role]}`}>
                          {s.role.replace('_', ' ')}
                        </span>
                      ) : (
                        <select
                          value={s.role}
                          onChange={e => updateStaffRole(s.id, e.target.value)}
                          className="text-sm border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
                        >
                          <option value="company_admin">Company admin</option>
                          <option value="staff">Staff</option>
                          <option value="optician">Optician</option>
                        </select>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={s.location_id || ''}
                        onChange={e => updateStaffLocation(s.id, e.target.value)}
                        className="text-sm border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      >
                        <option value="">Not assigned</option>
                        {locations.map(l => (
                          <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  )
}