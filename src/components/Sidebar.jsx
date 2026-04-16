import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const NAV = {
  company_admin: [
    {
      group: 'Operations',
      links: [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Inventory', path: '/inventory' },
        { label: 'Sales', path: '/sales' },
        { label: 'Debtors', path: '/debtors' },
      ],
    },
    {
      group: 'Reports',
      links: [
        { label: 'Stock query', path: '/query' },
        { label: 'Audit log', path: '/audit' },
        { label: 'Export', path: '/export' },
      ],
    },
    {
      group: 'Admin',
      links: [
        { label: 'Locations', path: '/admin/locations' },
        { label: 'Products', path: '/admin/products' },
        { label: 'Prices', path: '/admin/prices' },
        { label: 'Staff', path: '/admin/staff' },
        { label: 'Settings', path: '/admin/settings' },
        { label: 'Migrate', path: '/admin/migrate' },
      ],
    },
  ],
  staff: [
    {
      group: 'Operations',
      links: [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Inventory', path: '/inventory' },
        { label: 'Sales', path: '/sales' },
        { label: 'Debtors', path: '/debtors' },
      ],
    },
    {
      group: 'Reports',
      links: [
        { label: 'Stock query', path: '/query' },
      ],
    },
  ],
  optician: [
    {
      group: 'Query',
      links: [
        { label: 'Stock query', path: '/query' },
      ],
    },
  ],
}

function allLinks(role) {
  return (NAV[role] || []).flatMap(g => g.links)
}

function NavGroup({ group, links, location, onClick }) {
  const isActive = links.some(l => l.path === location.pathname)
  const [open, setOpen] = useState(isActive)

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${isActive ? 'text-white' : 'text-slate-500 hover:text-slate-300'
          }`}
      >
        <span>{group}</span>
        <svg
          className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-1 space-y-0.5">
          {links.map(link => (
            <Link
              key={link.path}
              to={link.path}
              onClick={onClick}
              className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${location.pathname === link.path
                  ? 'bg-white text-slate-900'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  const groups = NAV[profile?.role] || []
  const currentLabel = allLinks(profile?.role).find(l => l.path === location.pathname)?.label || 'Menu'

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
            <nav className="flex-1 px-3 py-4 space-y-3 overflow-y-auto">
              {groups.map(g => (
                <NavGroup
                  key={g.group}
                  group={g.group}
                  links={g.links}
                  location={location}
                  onClick={() => setOpen(false)}
                />
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
        <nav className="flex-1 px-3 py-4 space-y-3 overflow-y-auto">
          {groups.map(g => (
            <NavGroup
              key={g.group}
              group={g.group}
              links={g.links}
              location={location}
              onClick={null}
            />
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