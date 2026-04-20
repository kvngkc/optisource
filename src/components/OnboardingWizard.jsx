import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../hooks/useAuth'

export default function OnboardingWizard({ setupState, onComplete }) {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const steps = [
    { label: 'Create a location', done: setupState.locations > 0, to: '/admin/locations', desc: 'Where do you hold your physical stock?' },
    { label: 'Add your first product', done: setupState.products > 0, to: '/admin/products', desc: 'Define a product category and name (e.g. Blue Block AR).' },
    { label: 'Upload inventory', done: setupState.stock > 0, to: '/admin/products', desc: 'Go to the CSV Import tab to bulk upload stock levels.' },
  ]

  const percent = Math.round((steps.filter(s => s.done).length / steps.length) * 100)

  async function injectDemoData() {
    if (!window.confirm("This will insert standard demo lenses and a dummy location. Proceed?")) return
    setLoading(true)

    try {
      // 1. Insert Location
      const { data: loc } = await supabase.from('locations').insert({
        company_id: profile.company_id, name: 'Main Store', code: 'MAIN'
      }).select('id').single()

      // 2. Insert Classes
      const { data: classFin } = await supabase.from('product_classes').insert({
        company_id: profile.company_id, name: 'Finished Lenses'
      }).select('id').single()

      const { data: classSemi } = await supabase.from('product_classes').insert({
        company_id: profile.company_id, name: 'Semi-finished (blanks)'
      }).select('id').single()

      // 3. Insert Products
      const { data: prodSv } = await supabase.from('products').insert({
        company_id: profile.company_id, class_id: classFin.id, name: 'HMC Single Vision', spec_type: 'sph_cyl'
      }).select('id').single()

      const { data: prodDtop } = await supabase.from('products').insert({
        company_id: profile.company_id, class_id: classSemi.id, name: 'UC DTOP Bifocal', spec_type: 'base_add'
      }).select('id').single()

      // 4. Insert limited dummy stock
      const stockData = [
        { company_id: profile.company_id, location_id: loc.id, product_id: prodSv.id, sph: 'Plano', cyl: '-025', qty: 10 },
        { company_id: profile.company_id, location_id: loc.id, product_id: prodSv.id, sph: 'Plano', cyl: '-050', qty: 5 },
        { company_id: profile.company_id, location_id: loc.id, product_id: prodDtop.id, sph: '100', addition: '+100', qty: 8 },
        { company_id: profile.company_id, location_id: loc.id, product_id: prodDtop.id, sph: '150', addition: '+200', qty: 2 },
      ]
      await supabase.from('stock').insert(stockData)

      setSuccess(true)
      setTimeout(() => { onComplete() }, 2000)
    } catch (err) {
      alert("Error injecting demo data: " + err.message)
    }
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-8 shadow-sm">
      <div className="bg-slate-900 px-6 py-5 text-white">
        <h2 className="text-xl font-bold mb-1">Welcome to Optisource! 👋</h2>
        <p className="text-slate-400 text-sm">Let's get your B2B inventory configured so you can start fulfilling orders immediately.</p>
        
        <div className="mt-5 flex items-center gap-4">
          <div className="flex-1 bg-slate-800 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${percent}%` }} />
          </div>
          <span className="text-sm font-bold text-blue-400">{percent}% setup</span>
        </div>
      </div>

      <div className="p-6">
        {success ? (
          <div className="text-center py-6">
            <span className="text-4xl">🎉</span>
            <p className="text-slate-800 font-bold mt-2">Demo data successfully loaded!</p>
            <p className="text-slate-500 text-sm">Refreshing dashboard...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-800 uppercase tracking-wide text-xs">Setup Checklist</h3>
              {steps.map((step, i) => (
                <div key={i} className={`flex gap-3 p-3 rounded-xl border ${step.done ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${step.done ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                    {step.done ? '✓' : i + 1}
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold ${step.done ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{step.label}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{step.desc}</p>
                    {!step.done && (
                      <Link to={step.to} className="text-xs font-semibold text-blue-600 hover:text-blue-700 mt-1.5 inline-block">
                        Go to setup →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 flex flex-col justify-center items-center text-center border border-dashed border-slate-200">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-4 text-xl">🚀</div>
              <h3 className="font-bold text-slate-800 mb-1">Want a quick jumpstart?</h3>
              <p className="text-sm text-slate-500 mb-6">We can automatically inject a cleanly configured set of Demo Products (Single Vision & Bifocals) and mock stock levels so you can see how the views populate.</p>
              <button 
                onClick={injectDemoData} 
                disabled={loading || percent > 0} 
                className="bg-white border border-slate-300 text-slate-800 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {loading ? 'Injecting Data...' : percent > 0 ? '(Already configured manually)' : 'Inject Demo Data'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
