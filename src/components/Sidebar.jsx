import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const NAV = {
  company_admin: [
    { label: 'Dashboard',   path: '/dashboard' },
    { label: 'Inventory',   path: '/inventory' },
    { label: 'Sales',       path: '/sales' },
    { label: 'Debtors',     path: '/debtors' },
    { label: 'Stock query', path: '/query' },
    { label: 'Audit log',   path: '/audit' },
    { label: 'Export',      path: '/export' },
    { label: 'Locations',   path: '/admin/locations' },
    { label: 'Products',    path: '/admin/products' },
    { label: 'Prices',      path: '/admin/prices' },
    { label: 'Staff',       path: '/admin/staff' },
  ],
  staff: [
    { label: 'Dashboard',   path: '/dashboard',  icon: '▪' },
    { label: 'Inventory',   path: '/inventory',  icon: '▪' },
    { label: 'Sales',       path: '/sales',      icon: '▪' },
    { label: 'Debtors',     path: '/debtors',    icon: '▪' },
    { label: 'Stock query', path: '/query',      icon: '▪' },
  ],
  optician: [
    { label: 'Dashboard',   path: '/dashboard',  icon: '▪' },
    { label: 'Stock query', path: '/query',      icon: '▪' },
  ],
}

export default function Sidebar() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const links = NAV[profile?.role] || []
  const currentLabel = links.find(l => l.path === location.pathname)?.label || 'Menu'

  return (
    <>
      {/* ── MOBILE TOP BAR ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
        <div>
          <p className="font-bold text-base leading-tight">Optisource</p>
          <p className="text-xs text-slate-400 leading-tight">{currentLabel}</p>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className="w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-slate-800"
        >
          <span className={`block w-5 h-0.5 bg-white transition-all ${open ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`block w-5 h-0.5 bg-white transition-all ${open ? 'opacity-0' : ''}`} />
          <span className={`block w-5 h-0.5 bg-white transition-all ${open ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </div>

      {/* ── MOBILE DRAWER ── */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-64 bg-slate-900 text-white flex flex-col h-full shadow-2xl pt-16">
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="text-sm font-semibold text-white truncate">{profile?.companies?.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{profile?.full_name}</p>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {links.map(link => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setOpen(false)}
                  className={`block px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    location.pathname === link.path
                      ? 'bg-white text-slate-900'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="px-4 py-4 border-t border-slate-700">
              <button onClick={signOut} className="text-sm text-slate-400 hover:text-white">
                Sign out
              </button>
            </div>
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setOpen(false)} />
        </div>
      )}

      {/* ── DESKTOP SIDEBAR ── */}
      <div className="hidden lg:flex w-56 min-h-screen bg-slate-900 text-white flex-col flex-shrink-0">
        <div className="px-5 py-6 border-b border-slate-700">
          <h1 className="text-xl font-bold">Optisource</h1>
          <p className="text-xs text-slate-400 mt-1 truncate">{profile?.companies?.name}</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {links.map(link => (
            <Link
              key={link.path}
              to={link.path}
              className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === link.path
                  ? 'bg-white text-slate-900'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-slate-700">
          <p className="text-xs text-slate-400 truncate mb-1">{profile?.full_name}</p>
          <p className="text-xs text-slate-500 capitalize mb-3">{profile?.role?.replace('_', ' ')}</p>
          <button onClick={signOut} className="text-xs text-slate-400 hover:text-white transition-colors">
            Sign out
          </button>
        </div>
      </div>
    </>
  )
}