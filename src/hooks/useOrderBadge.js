// src/hooks/useOrderBadge.js
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export function useOrderBadge(profile) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!profile) return
    fetchCount()

    // Poll every 30 seconds for new orders
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [profile])

  async function fetchCount() {
    if (!profile) return

    if (profile.role === 'optician') {
      // Optician sees count of their orders that have a new company message
      // (orders where the latest message is NOT from them)
      const { count: c } = await supabase
        .from('optician_orders')
        .select('*', { count: 'exact', head: true })
        .eq('optician_id', profile.id)
        .in('status', ['confirmed', 'rejected', 'dispatched'])
      setCount(c || 0)
    } else if (profile.role === 'company_admin' || profile.role === 'super_admin') {
      // Company admin sees count of pending orders
      const { count: c } = await supabase
        .from('optician_orders')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .eq('status', 'pending')
      setCount(c || 0)
    }
  }

  return count
}
