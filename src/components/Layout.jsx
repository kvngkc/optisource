import Sidebar from './Sidebar'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      {/* lg:ml-56 offsets the fixed 224px (w-56) sidebar on desktop */}
      <main className="pt-14 lg:pt-0 lg:ml-56 min-h-screen">
        {children}
      </main>
    </div>
  )
}