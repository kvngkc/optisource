import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export function useAuth() {
  const [user, setUser]       = useState(undefined) // undefined = still loading
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user.id)
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    // Listen for auth changes (login, logout, token refresh).
    // The callback must stay synchronous and must not call other Supabase
    // methods directly — doing so can deadlock the client's auth lock and
    // leave every later query (e.g. recording a sale) hanging forever.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUser(session.user)
          // Initial session is handled by getSession(); token refreshes
          // don't change the profile, so skip the redundant refetch.
          if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return
          setTimeout(() => fetchProfile(session.user.id), 0)
        } else {
          setUser(null)
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*, companies(name, slug), locations(name, code)')
      .eq('id', userId)
      .single()
    setProfile(data)
    setLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return { user, profile, loading, signOut }
}