import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import { useAuth } from '../../hooks/useAuth'
import Layout from '../../components/Layout'
import OnboardingWizard from '../../components/OnboardingWizard'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts'

function StatCard({ label, value, sub, color = 'text-slate-800' }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-sm text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const { profile } = useAuth()
  const [setupState, setSetupState]     = useState({ locations: 0, products: 0, stock: 0 })
  const [todayStats, setTodayStats]     = useState({ revenue: 0, units: 0, sales: 0, outstanding: 0 })
  const [revenueChart, setRevenueChart] = useState([])
  const [topProducts, setTopProducts]   = useState([])
  const [lowStock, setLowStock]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [period, setPeriod]             = useState('30')
  const [locations, setLocations]       = useState([])
  const [locationFilter, setLocationFilter] = useState('all')

  useEffect(() => {
    if (profile?.company_id) loadAll()
  }, [profile, period, locationFilter])

  async function loadAll() {
    setLoading(true)
    
    // Check onboarding states
    const [ {count: locCount}, {count: prodCount}, {count: stockCount} ] = await Promise.all([
      supabase.from('locations').select('*', { count: 'exact', head: true }).eq('company_id', profile.company_id),
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('company_id', profile.company_id).eq('is_active', true),
      supabase.from('stock').select('*', { count: 'exact', head: true }).eq('company_id', profile.company_id)
    ])
    setSetupState({ locations: locCount || 0, products: prodCount || 0, stock: stockCount || 0 })

    await Promise.all([
      loadTodayStats(),
      loadRevenueChart(),
      loadTopProducts(),
      loadLowStock(),
      fetchLocations(),
    ])
    setLoading(false)
  }

  async function fetchLocations() {
    const { data } = await supabase.from('locations').select('id, name, code').eq('company_id', profile.company_id)
    setLocations(data || [])
  }

  async function loadTodayStats() {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const end   = new Date(); end.setHours(23, 59, 59, 999)

    // Fetch both SALE and SALE_VOID so we can net the values correctly
    const { data: allTxns } = await supabase
      .from('transactions')
      .select('type, qty, total_amount')
      .eq('company_id', profile.company_id)
      .in('type', ['SALE', 'SALE_VOID'])
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())

    const { data: outstanding } = await supabase
      .from('debtors')
      .select('balance')
      .eq('company_id', profile.company_id)
      .eq('is_settled', false)

    // Count each type independently to avoid order-dependency bugs
    const saleRows = (allTxns || []).filter(r => r.type === 'SALE')
    const voidRows = (allTxns || []).filter(r => r.type === 'SALE_VOID')

    const revenue = saleRows.reduce((s, r) => s + (Number(r.total_amount) || 0), 0)
                  - voidRows.reduce((s, r) => s + (Number(r.total_amount) || 0), 0)
    const units   = saleRows.reduce((s, r) => s + (Number(r.qty) || 0), 0)
                  - voidRows.reduce((s, r) => s + (Number(r.qty) || 0), 0)
    const sales   = Math.max(0, saleRows.length - voidRows.length)

    setTodayStats({
      revenue:     Math.max(0, revenue),
      units:       Math.max(0, units),
      sales,
      outstanding: (outstanding || []).reduce((s, r) => s + Number(r.balance), 0),
    })
  }

  async function loadRevenueChart() {
    const daysAgo = new Date()
    daysAgo.setDate(daysAgo.getDate() - Number(period))

    // Include SALE_VOID so the chart reflects net revenue after voids
    let q = supabase
      .from('transactions')
      .select('created_at, type, total_amount, qty')
      .eq('company_id', profile.company_id)
      .in('type', ['SALE', 'SALE_VOID'])
      .gte('created_at', daysAgo.toISOString())
      .order('created_at')

    if (locationFilter !== 'all') q = q.eq('location_id', locationFilter)

    const { data } = await q

    // Group by date, netting voids against sales
    const byDate = {}
    ;(data || []).forEach(t => {
      const date = new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      if (!byDate[date]) byDate[date] = { date, revenue: 0, units: 0 }
      const sign = t.type === 'SALE_VOID' ? -1 : 1
      byDate[date].revenue += sign * (Number(t.total_amount) || 0)
      byDate[date].units   += sign * (Number(t.qty) || 0)
    })

    // Clamp negatives to zero (e.g. if void was recorded on same day as sale)
    const chart = Object.values(byDate).map(d => ({
      ...d,
      revenue: Math.max(0, d.revenue),
      units:   Math.max(0, d.units),
    }))

    setRevenueChart(chart)
  }

  async function loadTopProducts() {
    const daysAgo = new Date()
    daysAgo.setDate(daysAgo.getDate() - Number(period))

    // Include SALE_VOID so voided sales don't inflate top-product rankings
    const { data } = await supabase
      .from('transactions')
      .select('product_id, type, qty, total_amount, products(name)')
      .eq('company_id', profile.company_id)
      .in('type', ['SALE', 'SALE_VOID'])
      .gte('created_at', daysAgo.toISOString())

    const byProduct = {}
    ;(data || []).forEach(t => {
      const name = t.products?.name || t.product_id
      if (!byProduct[name]) byProduct[name] = { name, units: 0, revenue: 0 }
      const sign = t.type === 'SALE_VOID' ? -1 : 1
      byProduct[name].units   += sign * (Number(t.qty) || 0)
      byProduct[name].revenue += sign * (Number(t.total_amount) || 0)
    })

    setTopProducts(
      Object.values(byProduct)
        .filter(p => p.units > 0)  // hide products whose total was zeroed out
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8)
    )
  }

  async function loadLowStock() {
    let query = supabase
      .from('stock')
      .select('qty, sph, addition, name_key, products(name), locations(name, code)')
      .eq('company_id', profile.company_id)
      .gt('qty', 0)
      .lte('qty', 5)
      
    if (locationFilter !== 'all') {
      query = query.eq('location_id', locationFilter)
    }

    const { data } = await query.order('qty').limit(20)

    setLowStock(data || [])
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-6 lg:px-6 lg:py-8">
        {!loading && (setupState.locations === 0 || setupState.products === 0 || setupState.stock === 0) && (
          <OnboardingWizard setupState={setupState} onComplete={loadAll} />
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Dashboard</h2>
            <p className="text-slate-500 text-sm">{profile?.companies?.name}</p>
          </div>
          <select value={period} onChange={e => setPeriod(e.target.value)}
            className="text-sm border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none bg-white">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>

        {/* Today snapshot */}
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Today</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <StatCard label="Revenue" value={`₦${todayStats.revenue.toLocaleString()}`} sub="today" />
          <StatCard label="Units sold" value={todayStats.units} sub="today" />
          <StatCard label="Sales" value={todayStats.sales} sub="transactions" />
          <StatCard
            label="Outstanding"
            value={`₦${todayStats.outstanding.toLocaleString()}`}
            sub="total owed"
            color={todayStats.outstanding > 0 ? 'text-red-600' : 'text-slate-800'}
          />
        </div>

        {/* Revenue chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-5">
          <p className="font-semibold text-slate-700 mb-4 text-sm">Revenue — last {period} days</p>
          {revenueChart.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-300 text-sm">No sales data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueChart} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                  tickFormatter={v => v >= 1000 ? `₦${(v/1000).toFixed(0)}k` : `₦${v}`} />
                <Tooltip formatter={v => [`₦${Number(v).toLocaleString()}`, 'Revenue']}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="revenue" fill="#0f172a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Units chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-5">
          <p className="font-semibold text-slate-700 mb-4 text-sm">Units sold — last {period} days</p>
          {revenueChart.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-slate-300 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={revenueChart} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Line type="monotone" dataKey="units" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Top products */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="font-semibold text-slate-700 mb-4 text-sm">Top products by revenue</p>
            {topProducts.length === 0 ? (
              <p className="text-slate-300 text-sm text-center py-6">No sales data yet</p>
            ) : (
              <div className="space-y-3">
                {topProducts.map((p, i) => {
                  const maxRev = topProducts[0].revenue
                  return (
                    <div key={p.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-700 font-medium truncate max-w-[60%]">{p.name}</span>
                        <span className="text-slate-500 text-xs">{p.units} units · ₦{p.revenue.toLocaleString()}</span>
                      </div>
                      <div className="bg-slate-100 rounded-full h-1.5">
                        <div className="bg-slate-900 h-1.5 rounded-full" style={{ width: `${(p.revenue / maxRev) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Low stock */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col max-h-[400px]">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-slate-700 text-sm">
                Low stock <span className="text-amber-500">({lowStock.length})</span>
              </p>
              <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none bg-white max-w-[120px]">
                <option value="all">All locs</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.code}</option>)}
              </select>
            </div>
            
            {lowStock.length === 0 ? (
              <p className="text-slate-300 text-sm text-center py-6">All products well stocked</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {lowStock.map(s => (
                  <div key={s.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{s.products?.name}</p>
                      <p className="text-xs text-slate-400">
                        {s.locations?.code} · {s.sph || s.name_key || '—'}{s.addition ? '/' + s.addition : ''}
                      </p>
                    </div>
                    <span className={`text-sm font-bold ${s.qty <= 2 ? 'text-red-500' : 'text-amber-500'}`}>
                      {s.qty} left
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}