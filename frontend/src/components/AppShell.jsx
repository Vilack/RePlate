import { NavLink, useNavigate } from 'react-router-dom'
import { BarChart3, Bell, ClipboardList, Leaf, LogOut, Package, Truck, Utensils } from 'lucide-react'

const links = [
  { to: '/dashboard', label: 'Overview', icon: BarChart3 },
  { to: '/food-listings', label: 'Food listings', icon: Utensils },
  { to: '/requests', label: 'Requests', icon: ClipboardList },
  { to: '/deliveries', label: 'Deliveries', icon: Truck },
  { to: '/impact', label: 'Impact & analytics', icon: Package },
]

export default function AppShell({ user, onLogout, title, eyebrow = 'REPLATE WORKSPACE', children, action }) {
  const navigate = useNavigate()
  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'there'
  return <div className="dashboard app-shell">
    <aside className="sidebar">
      <button className="brand brand-button" onClick={() => navigate('/dashboard')}><span className="brand-icon"><Leaf size={20}/></span><span>RePlate</span></button>
      <p className="sidebar-caption">FOOD RECOVERY NETWORK</p>
      <nav aria-label="Main navigation">
        {links.map(({to,label,icon:Icon}) => <NavLink key={to} to={to} className={({isActive}) => `sidebar-link${isActive ? ' active' : ''}`}><Icon size={18}/>{label}</NavLink>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-user"><div className="avatar">{name.slice(0,1).toUpperCase()}</div><div><strong>{name}</strong><small>{user?.email}</small></div></div>
        <button className="logout-button" onClick={onLogout}><LogOut size={17}/> Sign out</button>
      </div>
    </aside>
    <main className="dashboard-main shell-main">
      <header className="workspace-header">
        <div><p className="dashboard-label">{eyebrow}</p><h1>{title}</h1><p>Good food deserves a second chance.</p></div>
        <div className="header-actions">{action}<span className="cloud-pill"><span/> Cloud connected</span><button className="icon-button" title="Open food requests" onClick={() => navigate('/requests')}><Bell size={18}/></button></div>
      </header>
      {children}
      <footer className="workspace-footer">RePlate · Cloud-based food recovery and redistribution</footer>
    </main>
  </div>
}
