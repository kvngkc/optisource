import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'

export default function Dashboard() {
  const { profile } = useAuth()

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">
          Welcome, {profile?.full_name}
        </h2>
        <p className="text-slate-500">
          {profile?.companies?.name} · {profile?.role?.replace('_', ' ')} ·
          Location: {profile?.locations?.name ?? 'Not assigned'}
        </p>

        <div className="grid grid-cols-3 gap-6 mt-10">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <p className="text-sm text-slate-500">Company</p>
            <p className="text-xl font-bold text-slate-800 mt-1">{profile?.companies?.name ?? '—'}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <p className="text-sm text-slate-500">Role</p>
            <p className="text-xl font-bold text-slate-800 mt-1 capitalize">{profile?.role?.replace('_', ' ') ?? '—'}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <p className="text-sm text-slate-500">Location</p>
            <p className="text-xl font-bold text-slate-800 mt-1">{profile?.locations?.name ?? 'Not assigned'}</p>
          </div>
        </div>
      </div>
    </Layout>
  )
}