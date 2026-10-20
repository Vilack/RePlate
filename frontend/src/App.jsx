import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from './lib/supabaseClient'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import FoodListings from './pages/FoodListings'
import CreateFoodListing from './pages/CreateFoodListing'
import Requests from './pages/Requests'
import Deliveries from './pages/Deliveries'
import Impact from './pages/Impact'

function AppRoutes() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return
      if (error) console.error('Session lookup failed:', error.message)
      setSession(data?.session ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => { mounted = false; subscription.unsubscribe() }
  }, [])
  async function logout() { await supabase.auth.signOut() }
  if (loading) return <div className="loading-screen"><div className="brand-icon">🌱</div><p>Loading RePlate...</p></div>
  const user = session?.user
  const protect = (element) => user ? element : <Navigate to="/login" replace />
  return <Routes>
    <Route path="/" element={user ? <Navigate to="/dashboard" replace/> : <Landing onGetStarted={() => { window.location.href = '/login' }}/>} />
    <Route path="/login" element={user ? <Navigate to="/dashboard" replace/> : <Auth/>} />
    <Route path="/dashboard" element={protect(<Dashboard user={user} onLogout={logout}/>)} />
    <Route path="/food-listings" element={protect(<FoodListings user={user} onLogout={logout}/>)} />
    <Route path="/food-listings/create" element={protect(<CreateFoodListing user={user} onLogout={logout}/>)} />
    <Route path="/food-listings/:listingId/edit" element={protect(<CreateFoodListing user={user} onLogout={logout}/>)} />
    <Route path="/requests" element={protect(<Requests user={user} onLogout={logout}/>)} />
    <Route path="/deliveries" element={protect(<Deliveries user={user} onLogout={logout}/>)} />
    <Route path="/impact" element={protect(<Impact user={user} onLogout={logout}/>)} />
    <Route path="*" element={<Navigate to={user ? '/dashboard' : '/'} replace/>}/>
  </Routes>
}

export default function App() {
  if (!isSupabaseConfigured) return <div className="loading-screen config-screen"><div className="brand-icon">🌱</div><h1>Connect RePlate to Supabase</h1><p>Create <code>frontend/.env</code> from <code>frontend/.env.example</code> and add your Supabase project URL and publishable key.</p><p>Then restart the Vite development server.</p></div>
  return <BrowserRouter><AppRoutes/></BrowserRouter>
}
