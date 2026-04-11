import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const NAV = {
  company_admin: [
    { label: 'Dashboard',   path: '/dashboard' },
    { label: 'Locations',   path: '/admin/locations' },
    { label: 'Products',    path: '/admin/products' },
    { label: 'Staff',       path: '/admin/staff' },
    { label: 'Inventory',   path: '/inventory' },
    { label: 'Sales',       path: '/sales' },
    { label: 'Stock query', path: '/query' },
    { label: 'Audit log',   path: '/audit' },
  ],
  staff: [
    { label: 'Dashboard',   path: '/dashboard' },
    { label: 'Inventory',   path: '/inventory' },
    { label: 'Sales',       path: '/sales' },
    { label: 'Stock query', path: '/query' },
  ],
  optician: [
    { label: 'Dashboard',   path: '/dashboard' },
    { label: 'Stock query', path: '/query' },
  ],
}

export default function Sidebar() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const links = NAV[profile?.role] || []

  return (
    <div className="w-56 min-h-screen bg-slate-900 text-white flex flex-col">
      <div className="px-5 py-6 border-b border-slate-700">
        <h1 className="text-xl font-bold">Optisource</h1>
        <p className="text-xs text-slate-400 mt-1 truncate">
          {profile?.companies?.name}
        </p>
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
        <button
          onClick={signOut}
          className="text-xs text-slate-400 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}