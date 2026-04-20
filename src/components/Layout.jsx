import Sidebar from './Sidebar'
import NetworkMonitor from './NetworkMonitor'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 relative">
      <NetworkMonitor />
      <Sidebar />
      {/* lg:ml-56 offsets the fixed 224px (w-56) sidebar on desktop */}
      <main className="pt-14 lg:pt-0 lg:ml-56 min-h-screen">
        {children}
      </main>
    </div>
  )
}