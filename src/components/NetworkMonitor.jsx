import { useState, useEffect } from 'react'

export default function NetworkMonitor() {
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    function onOffline() { setOffline(true) }
    function onOnline() { setOffline(false); setSlow(false) }

    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)

    // Monkey patch fetch to detect network lag (requests > 5 seconds)
    const originalFetch = window.fetch
    window.fetch = async function (...args) {
      const timeoutId = setTimeout(() => {
        // If a request takes more than 5s, flag as slow
        if (navigator.onLine) setSlow(true)
      }, 5000)

      try {
        const response = await originalFetch.apply(this, args)
        clearTimeout(timeoutId)
        // Reset slow flag if it completes successfully
        setSlow(false)
        return response
      } catch (err) {
        clearTimeout(timeoutId)
        throw err
      }
    }

    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
      window.fetch = originalFetch
    }
  }, [])

  if (!offline && !slow) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-slate-900 border border-slate-700 shadow-2xl rounded-xl px-5 py-3 text-sm font-medium transition-all duration-300">
      {offline ? (
        <>
          <span className="relative flex h-3 w-3">
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          <span className="text-white">You are offline. Retrying...</span>
        </>
      ) : (
        <>
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
          </span>
          <span className="text-white">Network is slow. Operation may stall.</span>
        </>
      )}
    </div>
  )
}
