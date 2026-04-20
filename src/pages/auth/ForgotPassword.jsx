import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../supabase'

export default function ForgotPassword() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]         = useState({ type: '', text: '' })

  async function handleReset(e) {
    e.preventDefault()
    setLoading(true)
    setMsg({ type: '', text: '' })

    // Redirect straight to our reset page
    const resetUrl = `${window.location.origin}/reset-password`

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: resetUrl,
    })

    if (error) {
      setMsg({ type: 'error', text: error.message })
    } else {
      setMsg({ type: 'success', text: 'Reset link sent! Check your email inbox.' })
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Optisource</h1>
          <p className="text-slate-500 mt-1">Reset your password</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <p className="text-sm text-slate-600 mb-6 text-center leading-relaxed">
            Enter the email address tied to your account and we'll send you a secure link to choose a new password.
          </p>

          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>

            {msg.text && (
              <div className={`text-sm rounded-lg px-4 py-3 border ${
                msg.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'
              }`}>
                {msg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || msg.type === 'success'}
              className="w-full bg-slate-900 text-white py-2.5 rounded-lg font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending link...' : 'Send reset link'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          <Link to="/login" className="text-slate-900 font-medium hover:underline">
            ← Back to login
          </Link>
        </p>

      </div>
    </div>
  )
}
