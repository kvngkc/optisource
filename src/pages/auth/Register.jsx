import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

const ACCOUNT_TYPES = [
  {
    id: 'company_admin',
    label: 'Company Admin',
    description: 'Register your optical business and manage inventory, staff, and sales.',
    icon: '🏢',
  },
  {
    id: 'staff',
    label: 'Staff',
    description: 'Join your company using a code from your admin. Manage inventory and sales.',
    icon: '👤',
  },
  {
    id: 'optician',
    label: 'Optician',
    description: 'Query available lens stock across suppliers. No company required.',
    icon: '🔍',
  },
]

export default function Register() {
  const navigate = useNavigate()
  const [step, setStep]               = useState('select') // 'select' | 'form' | 'done'
  const [accountType, setAccountType] = useState(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [doneMsg, setDoneMsg]         = useState('')

  const [form, setForm] = useState({
    fullName:        '',
    email:           '',
    password:        '',
    confirmPassword: '',
    companyName:     '',
    companyCode:     '',
  })

  function field(key) {
    return e => setForm(f => ({ ...f, [key]: e.target.value }))
  }

  function selectType(type) {
    setAccountType(type)
    setError('')
    setStep('form')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.fullName.trim())  return setError('Full name is required.')
    if (!form.email.trim())     return setError('Email is required.')
    if (form.password.length < 6) return setError('Password must be at least 6 characters.')
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.')

    setLoading(true)
    try {
      if (accountType === 'company_admin') await registerCompanyAdmin()
      else if (accountType === 'staff')    await registerStaff()
      else                                 await registerOptician()
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  /* ── COMPANY ADMIN ── */
  async function registerCompanyAdmin() {
    if (!form.companyName.trim()) throw new Error('Company name is required.')

    const slug = form.companyName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    // Check slug not taken
    const { data: existing } = await supabase
      .from('companies')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (existing) throw new Error('A company with a similar name already exists. Try a more specific name.')

    // Auth sign-up
    const { data: auth, error: authErr } = await supabase.auth.signUp({
      email:    form.email.trim(),
      password: form.password,
      options:  { data: { full_name: form.fullName.trim() } },
    })
    if (authErr) throw authErr

    const userId = auth.user?.id
    if (!userId) throw new Error('Sign-up failed — no user returned.')

    // Create company
    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .insert({ name: form.companyName.trim(), slug })
      .select()
      .single()
    if (companyErr) throw companyErr

    // Write profile
    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert({
        id:         userId,
        full_name:  form.fullName.trim(),
        email:      form.email.trim(),
        role:       'company_admin',
        company_id: company.id,
      })
    if (profileErr) throw profileErr

    // If Supabase returned a session, go straight to dashboard
    if (auth.session) {
      navigate('/dashboard')
    } else {
      setDoneMsg(`Account created! Your company code is "${slug}". Check your email to confirm your account, then log in.`)
      setStep('done')
    }
  }

  /* ── STAFF ── */
  async function registerStaff() {
    const code = form.companyCode.trim().toLowerCase()
    if (!code) throw new Error('Company code is required. Ask your admin.')

    // Resolve company by slug
    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .select('id, name')
      .eq('slug', code)
      .maybeSingle()
    if (companyErr) throw companyErr
    if (!company)   throw new Error(`No company found with code "${code}". Check with your admin.`)

    // Auth sign-up
    const { data: auth, error: authErr } = await supabase.auth.signUp({
      email:    form.email.trim(),
      password: form.password,
      options:  { data: { full_name: form.fullName.trim() } },
    })
    if (authErr) throw authErr

    const userId = auth.user?.id
    if (!userId) throw new Error('Sign-up failed — no user returned.')

    // Write profile — location_id null until admin assigns
    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert({
        id:          userId,
        full_name:   form.fullName.trim(),
        email:       form.email.trim(),
        role:        'staff',
        company_id:  company.id,
        location_id: null,
      })
    if (profileErr) throw profileErr

    if (auth.session) {
      navigate('/dashboard')
    } else {
      setDoneMsg(`Account created and linked to ${company.name}! Check your email to confirm, then log in. Your admin will assign your location.`)
      setStep('done')
    }
  }

  /* ── OPTICIAN ── */
  async function registerOptician() {
    const { data: auth, error: authErr } = await supabase.auth.signUp({
      email:    form.email.trim(),
      password: form.password,
      options:  { data: { full_name: form.fullName.trim() } },
    })
    if (authErr) throw authErr

    const userId = auth.user?.id
    if (!userId) throw new Error('Sign-up failed — no user returned.')

    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert({
        id:        userId,
        full_name: form.fullName.trim(),
        email:     form.email.trim(),
        role:      'optician',
      })
    if (profileErr) throw profileErr

    if (auth.session) {
      navigate('/dashboard')
    } else {
      setDoneMsg('Account created! Check your email to confirm, then log in.')
      setStep('done')
    }
  }

  /* ── RENDER ── */
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Optisource</h1>
          <p className="text-slate-500 text-sm mt-1">Create your account</p>
        </div>

        {/* ── STEP 1: Select account type ── */}
        {step === 'select' && (
          <div className="space-y-3">
            {ACCOUNT_TYPES.map(type => (
              <button
                key={type.id}
                onClick={() => selectType(type.id)}
                className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 flex items-start gap-4 text-left hover:border-slate-900 hover:shadow-sm transition-all group"
              >
                <span className="text-2xl mt-0.5">{type.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm group-hover:text-slate-900">{type.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{type.description}</p>
                </div>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-900 mt-1 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}

            <p className="text-center text-sm text-slate-500 pt-2">
              Already have an account?{' '}
              <Link to="/login" className="text-slate-900 font-medium hover:underline">Sign in</Link>
            </p>
          </div>
        )}

        {/* ── STEP 2: Registration form ── */}
        {step === 'form' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => { setStep('select'); setError('') }}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <p className="font-semibold text-slate-900 text-sm">
                  {ACCOUNT_TYPES.find(t => t.id === accountType)?.label}
                </p>
                <p className="text-xs text-slate-400">Fill in your details below</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Full name */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Full name</label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={field('fullName')}
                  placeholder="Ada Okonkwo"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Email address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={field('email')}
                  placeholder="ada@example.com"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  required
                />
              </div>

              {/* Company name — company_admin only */}
              {accountType === 'company_admin' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Company name</label>
                  <input
                    type="text"
                    value={form.companyName}
                    onChange={field('companyName')}
                    placeholder="Clarity Optical Ltd"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    required
                  />
                  {form.companyName && (
                    <p className="text-xs text-slate-400 mt-1.5">
                      Your company code will be{' '}
                      <span className="font-mono font-medium text-slate-700">
                        {form.companyName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}
                      </span>
                      {' '}— share this with your staff.
                    </p>
                  )}
                </div>
              )}

              {/* Company code — staff only */}
              {accountType === 'staff' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Company code</label>
                  <input
                    type="text"
                    value={form.companyCode}
                    onChange={field('companyCode')}
                    placeholder="clarity-optical-ltd"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    required
                  />
                  <p className="text-xs text-slate-400 mt-1.5">Ask your company admin for this code.</p>
                </div>
              )}

              {/* Optician info banner */}
              {accountType === 'optician' && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                  <p className="text-xs text-blue-700 leading-relaxed">
                    As an optician you can search available lens products across all companies.
                    Stock quantities are hidden for privacy.
                  </p>
                </div>
              )}

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={field('password')}
                  placeholder="Min. 6 characters"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  required
                />
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Confirm password</label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={field('confirmPassword')}
                  placeholder="Repeat password"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  required
                />
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </form>

            <p className="text-center text-xs text-slate-400 mt-4">
              Already have an account?{' '}
              <Link to="/login" className="text-slate-900 font-medium hover:underline">Sign in</Link>
            </p>
          </div>
        )}

        {/* ── STEP 3: Done (email confirmation required) ── */}
        {step === 'done' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center">
            <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Account created</h2>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">{doneMsg}</p>
            <Link
              to="/login"
              className="inline-block bg-slate-900 text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              Go to login
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}