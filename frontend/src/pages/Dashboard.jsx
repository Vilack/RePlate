import { useEffect, useState } from 'react'
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, HeartHandshake, Package, Plus, Truck, Utensils } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { supabase } from '../lib/supabaseClient'
import { getWasteRisk, hoursRemaining } from '../lib/foodLogic'

export default function Dashboard({ user, onLogout }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState('provider')
  const [stats, setStats] = useState({ listings: 0, requests: 0, deliveries: 0, savedKg: 0, meals: 0, risk: 0 })
  const [riskItems, setRiskItems] = useState([])
  const [error, setError] = useState('')

  useEffect(() => { load(); /* user identity changes should refresh dashboard */ }, [user?.id])
  async function load() {
    setLoading(true); setError('')
    try {
      const { data: roleRows, error: roleError } = await supabase.from('user_roles').select('roles(name)').eq('user_id', user.id)
      if (roleError) throw roleError
      const currentRole = roleRows?.[0]?.roles?.name || 'provider'
      setRole(currentRole)
      const [listingResult, requestResult, deliveryResult, impactResult] = await Promise.all([
        supabase.from('food_listings').select('id,title,quantity,quantity_unit,expiry_time,status,created_at').order('created_at', { ascending: false }).limit(100),
        supabase.from('food_requests').select('id,status'),
        supabase.from('deliveries').select('id,status'),
        supabase.from('impact_records').select('food_saved_kg,meals_served,beneficiaries_count,co2_saved_kg'),
      ])
      for (const result of [listingResult, requestResult, deliveryResult, impactResult]) if (result.error) throw result.error
      const listings = listingResult.data || []
      const impacts = impactResult.data || []
      setStats({ listings: listings.length, requests: (requestResult.data || []).filter(x => x.status === 'pending').length, deliveries: (deliveryResult.data || []).filter(x => !['delivered','cancelled'].includes(x.status)).length, savedKg: impacts.reduce((sum, x) => sum + Number(x.food_saved_kg || 0), 0), meals: impacts.reduce((sum, x) => sum + Number(x.meals_served || 0), 0), risk: listings.filter(x => getWasteRisk(x.expiry_time, x.status).level === 'high' || getWasteRisk(x.expiry_time, x.status).level === 'medium').length })
      setRiskItems(listings.filter(x => ['available','reserved'].includes(x.status) && getWasteRisk(x.expiry_time, x.status).level !== 'low').slice(0, 4))
    } catch (err) { setError(err.message || 'Could not load dashboard data.') }
    finally { setLoading(false) }
  }
  const cards = [
    { label: 'Food listings', value: stats.listings, icon: Utensils, note: 'Recent accessible listings' },
    { label: 'Pending requests', value: stats.requests, icon: HeartHandshake, note: 'Requests awaiting a response' },
    { label: 'Active deliveries', value: stats.deliveries, icon: Truck, note: 'Not yet delivered or cancelled' },
    { label: 'Food rescued (kg)', value: stats.savedKg.toFixed(1), icon: Package, note: 'Recorded in fulfilled impact records' },
  ]
  return <AppShell user={user} onLogout={onLogout} title={`Welcome, ${user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there'}`} eyebrow={`${role.toUpperCase()} DASHBOARD`} action={<button className="primary-button" onClick={()=>navigate('/food-listings/create')}><Plus size={17}/> Add food</button>}>
    {error && <div className="error-message page-alert">{error}<button className="text-button" onClick={load}>Retry</button></div>}
    <section className="stat-grid stat-grid-modern">{cards.map(({label,value,icon:Icon,note})=><article className="stat-card stat-card-modern" key={label}><div className="stat-card-top"><span>{label}</span><span className="stat-icon"><Icon size={19}/></span></div><strong>{loading ? '—' : value}</strong><small>{note}</small></article>)}</section>
    <div className="content-grid">
      <section className="panel"><div className="panel-heading"><div><p className="dashboard-label">PREDICTIVE MONITORING</p><h2>Food at expiry risk</h2><p>Rule-based risk estimate from the listing expiry time.</p></div><button className="text-button" onClick={()=>navigate('/food-listings')}>View listings <ArrowRight size={15}/></button></div>
        {loading ? <p className="muted">Loading risk indicators…</p> : riskItems.length === 0 ? <div className="empty-inline"><CheckCircle2 size={24}/><div><strong>No urgent items detected</strong><p>Listings with expiry within 24 hours will appear here.</p></div></div> : <div className="risk-list">{riskItems.map(item=>{const risk=getWasteRisk(item.expiry_time,item.status);return <div className="risk-row" key={item.id}><span className={`risk-dot ${risk.level}`}/><div className="risk-main"><strong>{item.title}</strong><small>{item.quantity} {item.quantity_unit} · {hoursRemaining(item.expiry_time)}</small></div><span className={`risk-badge ${risk.level}`}>{risk.label}</span></div>})}</div>}
      </section>
      <section className="panel quick-panel"><p className="dashboard-label">QUICK ACTIONS</p><h2>Keep food moving</h2><button className="quick-action" onClick={()=>navigate('/food-listings')}><span className="quick-icon"><Utensils size={18}/></span><span><strong>Browse food listings</strong><small>Find or manage available surplus</small></span><ArrowRight size={16}/></button><button className="quick-action" onClick={()=>navigate('/requests')}><span className="quick-icon"><HeartHandshake size={18}/></span><span><strong>Manage requests</strong><small>Review requests and responses</small></span><ArrowRight size={16}/></button><button className="quick-action" onClick={()=>navigate('/deliveries')}><span className="quick-icon"><Truck size={18}/></span><span><strong>Track deliveries</strong><small>Follow pickup and handover status</small></span><ArrowRight size={16}/></button><div className="notice-box"><Activity size={18}/><p><strong>Prediction note</strong><br/>Risk is based on time to expiry, not food-safety inspection or a trained ML model.</p></div></section>
    </div>
    <section className="impact-strip"><div><span className="impact-strip-icon"><AlertTriangle size={19}/></span><div><strong>{stats.risk} listings need attention</strong><p>Medium/high expiry risk among recent accessible listings.</p></div></div><button className="secondary-button" onClick={()=>navigate('/impact')}>View impact report</button></section>
  </AppShell>
}
