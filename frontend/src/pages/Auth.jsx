import { useState } from 'react'
import { ArrowLeft, Leaf, LockKeyhole, Mail, User, Building2, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('provider')
  const [organization, setOrganization] = useState('')
  const [serviceArea, setServiceArea] = useState('')
  const [providerType, setProviderType] = useState('restaurant')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault(); setLoading(true); setError(''); setMessage('')
    try {
      if (isLogin) {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (authError) throw authError
      } else {
        if (role !== 'volunteer' && !organization.trim()) throw new Error('Enter your organization name.')
        const metadata = { full_name: fullName.trim(), role, organization_name: organization.trim(), service_area: serviceArea.trim(), provider_type: providerType }
        const { data, error: authError } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: metadata } })
        if (authError) throw authError
        setMessage(data.session ? 'Account created. Your profile is ready; you can continue to the dashboard.' : 'Account created. Check your email to confirm the address, then sign in. Your profile will be created automatically.')
        setIsLogin(true)
      }
    } catch (err) { setError(err.message || 'Authentication failed.') }
    finally { setLoading(false) }
  }

  return <div className="auth-page auth-page-modern">
    <Link className="back-button auth-back" to="/"><ArrowLeft size={18}/> Back to RePlate</Link>
    <div className="auth-card auth-card-modern">
      <div className="auth-logo"><Leaf size={25}/></div>
      <p className="dashboard-label">FOOD RECOVERY NETWORK</p>
      <h1>{isLogin ? 'Welcome back' : 'Join RePlate'}</h1>
      <p>{isLogin ? 'Sign in to manage your food recovery activity.' : 'Create an account to donate or recover surplus food.'}</p>
      <form onSubmit={handleSubmit} className="form-stack">
        {!isLogin && <>
          <label className="field-label">Full name<div className="input-wrapper"><User size={17}/><input value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Your full name" autoComplete="name" required/></div></label>
          <label className="field-label">Account role<div className="input-wrapper"><select value={role} onChange={e=>setRole(e.target.value)}><option value="provider">Food donor / provider</option><option value="ngo">NGO / food bank</option><option value="volunteer">Delivery volunteer</option></select></div></label>
          {role !== 'volunteer' && <label className="field-label">Organization name<div className="input-wrapper"><Building2 size={17}/><input value={organization} onChange={e=>setOrganization(e.target.value)} placeholder={role === 'ngo' ? 'NGO or food bank name' : 'Restaurant or business name'} required/></div></label>}
          {role === 'provider' && <label className="field-label">Provider type<div className="input-wrapper"><select value={providerType} onChange={e=>setProviderType(e.target.value)}><option value="restaurant">Restaurant</option><option value="hotel">Hotel / caterer</option><option value="bakery">Bakery</option><option value="supermarket">Supermarket</option><option value="other">Other</option></select></div></label>}
          <label className="field-label">Service area / city (optional)<div className="input-wrapper"><MapPin size={17}/><input value={serviceArea} onChange={e=>setServiceArea(e.target.value)} placeholder="e.g. Chennai"/></div></label>
        </>}
        <label className="field-label">Email address<div className="input-wrapper"><Mail size={17}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required/></div></label>
        <label className="field-label">Password<div className="input-wrapper"><LockKeyhole size={17}/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} autoComplete={isLogin ? 'current-password' : 'new-password'} required/></div></label>
        {error && <div className="error-message" role="alert">{error}</div>}{message && <div className="success-message" role="status">{message}</div>}
        <button className="auth-submit" type="submit" disabled={loading}>{loading ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}</button>
      </form>
      <div className="auth-switch">{isLogin ? "Don't have an account?" : 'Already registered?'} <button onClick={()=>{setIsLogin(!isLogin);setError('');setMessage('')}}>{isLogin ? 'Create one' : 'Sign in'}</button></div>
    </div>
  </div>
}
