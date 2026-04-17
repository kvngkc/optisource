import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { supabase } from '../../supabase'
import { useAuth } from '../../hooks/useAuth'

export default function Staff() {
  const { profile } = useAuth()
  const navigate    = useNavigate()

  const [staff,     setStaff]     = useState([])
  const [locations, setLocations] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(null) // userId being saved
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState('')

  useEffect(() => {
    if (profile?.company_id) {
      loadData()
    }
  }, [profile])

  async function loadData() {
    setLoading(true)
    const [staffRes, locRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, email, role, location_id, locations(name)')
        .eq('company_id', profile.company_id)
        .neq('id', profile.id)
        .order('full_name'),
      supabase
        .from('locations')
        .select('id, name, code')
        .eq('company_id', profile.company_id)
        .order('name'),
    ])
    if (!staffRes.error) setStaff(staffRes.data || [])
    if (!locRes.error)   setLocations(locRes.data || [])
    setLoading(false)
  }

  async function assignLocation(userId, locationId) {
    setSaving(userId)
    setError('')
    setSuccess('')
    const val = locationId === '' ? null : locationId
    const { error: err } = await supabase
      .from('profiles')
      .update({ location_id: val })
      .eq('id', userId)
    if (err) {
      setError('Failed to update location: ' + err.message)
    } else {
      setSuccess('Location updated.')
      setStaff(s => s.map(m => m.id === userId ? { ...m, location_id: val } : m))
      setTimeout(() => setSuccess(''), 3000)
    }
    setSaving(null)
  }

  async function changeRole(userId, role) {
    setSaving(userId)
    setError('')
    const { error: err } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId)
    if (err) {
      setError('Failed to update role: ' + err.message)
    } else {
      setStaff(s => s.map(m => m.id === userId ? { ...m, role } : m))
    }
    setSaving(null)
  }

  async function removeMember(userId) {
    if (!window.confirm('Remove this staff member from your company?')) return
    setSaving(userId)
    const { error: err } = await supabase
      .from('profiles')
      .update({ company_id: null, location_id: null, role: 'staff' })
      .eq('id', userId)
    if (err) {
      setError('Failed to remove member: ' + err.message)
    } else {
      setStaff(s => s.filter(m => m.id !== userId))
    }
    setSaving(null)
  }

  const pending = staff.filter(m => m.role === 'staff' && !m.location_id)
  const active  = staff.filter(m => m.location_id || m.role === 'optician')

  const companyCode = profile?.companies?.slug

  return (
    <Layout>
      <div className="p-4 lg:p-8 max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900">Staff</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your team and assign locations.</p>
        </div>

        {/* Company code banner */}
        {companyCode && (
          <div className="bg-slate-900 text-white rounded-2xl px-5 py-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Your company code</p>
              <p className="font-mono text-lg font-bold tracking-wide">{companyCode}</p>
            </div>
            <div className="text-xs text-slate-400 sm:text-right">
              Share this code with staff<br className="hidden sm:block" /> when they register.
            </div>
          </div>
        )}

        {error   && <div className="mb-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600">{error}</div>}
        {success && <div className="mb-4 bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-xs text-green-700">{success}</div>}

        {loading ? (
          <div className="text-center py-16 text-slate-400 text-sm">Loading staff…</div>
        ) : (
          <>
            {/* Pending staff */}
            {pending.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-slate-900">Pending assignment</h2>
                  <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">
                    {pending.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {pending.map(member => (
                    <StaffRow
                      key={member.id}
                      member={member}
                      locations={locations}
                      saving={saving === member.id}
                      onAssignLocation={assignLocation}
                      onChangeRole={changeRole}
                      onRemove={removeMember}
                      isPending
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Active staff */}
            <div>
              <h2 className="text-sm font-semibold text-slate-900 mb-3">
                {active.length > 0 ? 'Active staff' : 'No active staff yet'}
              </h2>
              {active.length > 0 && (
                <div className="space-y-2">
                  {active.map(member => (
                    <StaffRow
                      key={member.id}
                      member={member}
                      locations={locations}
                      saving={saving === member.id}
                      onAssignLocation={assignLocation}
                      onChangeRole={changeRole}
                      onRemove={removeMember}
                    />
                  ))}
                </div>
              )}
            </div>

            {staff.length === 0 && (
              <div className="text-center py-16">
                <p className="text-slate-400 text-sm">No staff members yet.</p>
                <p className="text-slate-400 text-xs mt-1">
                  Share your company code above so staff can register and join.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}

function StaffRow({ member, locations, saving, onAssignLocation, onChangeRole, onRemove, isPending }) {
  return (
    <div className={`bg-white border rounded-2xl px-4 py-4 ${isPending ? 'border-amber-200' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-slate-900">{member.full_name}</p>
            {isPending && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                No location assigned
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            <span className="capitalize">{member.role?.replace('_', ' ')}</span>
            {member.email && <span className="mx-1.5 text-slate-300">·</span>}
            {member.email && <span>{member.email}</span>}
          </p>
        </div>

        <button
          onClick={() => onRemove(member.id)}
          disabled={saving}
          className="text-xs text-slate-400 hover:text-red-500 transition-colors"
        >
          Remove
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mt-3">
        {/* Role selector */}
        <select
          value={member.role}
          onChange={e => onChangeRole(member.id, e.target.value)}
          disabled={saving}
          className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
        >
          <option value="staff">Staff</option>
          <option value="optician">Optician</option>
          <option value="company_admin">Admin</option>
        </select>

        {/* Location selector */}
        <select
          value={member.location_id || ''}
          onChange={e => onAssignLocation(member.id, e.target.value)}
          disabled={saving}
          className={`flex-1 border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white ${
            isPending ? 'border-amber-300' : 'border-slate-200'
          }`}
        >
          <option value="">— No location —</option>
          {locations.map(loc => (
            <option key={loc.id} value={loc.id}>{loc.name} ({loc.code})</option>
          ))}
        </select>
      </div>

      {saving && <p className="text-xs text-slate-400 mt-2">Saving…</p>}
    </div>
  )
}