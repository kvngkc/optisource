import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'

export default function Dashboard() {
  const { profile } = useAuth()

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-6 lg:px-6 lg:py-10">
        <h2 className="text-xl lg:text-2xl font-bold text-slate-800 mb-1">
          Welcome, {profile?.full_name}
        </h2>
        <p className="text-slate-500 text-sm mb-6">
          {profile?.companies?.name} · {profile?.role?.replace('_', ' ')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">Company</p>
            <p className="text-lg font-bold text-slate-800 mt-1">{profile?.companies?.name ?? '—'}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">Role</p>
            <p className="text-lg font-bold text-slate-800 mt-1 capitalize">{profile?.role?.replace('_', ' ') ?? '—'}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">Location</p>
            <p className="text-lg font-bold text-slate-800 mt-1">{profile?.locations?.name ?? 'Not assigned'}</p>
          </div>
        </div>
      </div>
    </Layout>
  )
}