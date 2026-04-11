import { useState } from 'react'
import { supabase } from '../supabase'
import { useNavigate, Link } from 'react-router-dom'

export default function Register() {
  const [form, setForm]       = useState({ full_name: '', email: '', password: '', confirm: '', company_name: '', role: 'staff' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleRegister(e) {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirm) {
      setError('Passwords do not match')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (form.role === 'company_admin' && !form.company_name.trim()) {
      setError('Company name is required for admin accounts')
      return
    }

    setLoading(true)

    // Step 1: create the auth user
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email:    form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          role:      form.role,
        }
      }
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // Step 2: if company_admin, create company via RPC after user exists
    if (form.role === 'company_admin') {
      const slug = form.company_name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')

      const { error: rpcError } = await supabase.rpc('create_company_and_admin', {
        company_name: form.company_name.trim(),
        company_slug: slug,
        user_id:      signUpData.user.id,
        user_name:    form.full_name.trim(),
      })

      if (rpcError) {
        setError('Account created but company setup failed: ' + rpcError.message)
        setLoading(false)
        return
      }
    }

    navigate('/login?registered=true')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Optisource</h1>
          <p className="text-slate-500 mt-1">Create your account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <form onSubmit={handleRegister} className="space-y-5">

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
              <input
                type="text" required
                autoComplete="off"
                value={form.full_name}
                onChange={e => update('full_name', e.target.value)}
                placeholder="Your full name"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email" required
                autoComplete="off"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Account type</label>
              <select
                value={form.role}
                onChange={e => update('role', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="company_admin">Company admin — setting up my business</option>
                <option value="staff">Staff — joining my company's account</option>
                <option value="optician">Optician — querying stock across businesses</option>
              </select>
            </div>

            {form.role === 'company_admin' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company name</label>
                <input
                  type="text"
                  autoComplete="off"
                  value={form.company_name}
                  onChange={e => update('company_name', e.target.value)}
                  placeholder="e.g. McDave Optical"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>
            )}

            {form.role === 'staff' && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
                Your company admin will assign you to a location after you register.
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password" required
                value={form.password}
                onChange={e => update('password', e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirm password</label>
              <input
                type="password" required
                value={form.confirm}
                onChange={e => update('confirm', e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-2.5 rounded-lg font-medium hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>

          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-slate-900 font-medium hover:underline">
            Sign in
          </Link>
        </p>

      </div>
    </div>
  )
}