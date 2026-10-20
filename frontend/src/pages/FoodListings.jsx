
import { useEffect, useState } from 'react'
import {
  Plus,
  Search,
  RefreshCw,
  Package,
  Clock3,
  MapPin,
  Send,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { supabase } from '../lib/supabaseClient'
import { friendlyError, formatDate } from '../lib/foodLogic'

function calculateTimeRemaining(expiryTime, now) {
  const expiry = new Date(expiryTime).getTime()

  if (!expiryTime || Number.isNaN(expiry)) {
    return { label: 'Expiry unavailable', hoursLeft: null, expired: false }
  }

  const hoursLeft = (expiry - now) / (1000 * 60 * 60)

  if (hoursLeft <= 0) {
    return { label: 'Expired', hoursLeft, expired: true }
  }

  if (hoursLeft < 1) {
    const minutesLeft = Math.ceil(hoursLeft * 60)

    return {
      label: `${minutesLeft} ${minutesLeft === 1 ? 'minute' : 'minutes'} left`,
      hoursLeft,
      expired: false,
    }
  }

  if (hoursLeft < 24) {
    const roundedHours = Math.ceil(hoursLeft)

    return {
      label: `${roundedHours} ${roundedHours === 1 ? 'hour' : 'hours'} left`,
      hoursLeft,
      expired: false,
    }
  }

  const daysLeft = Math.ceil(hoursLeft / 24)

  return {
    label: `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`,
    hoursLeft,
    expired: false,
  }
}

// Demonstration thresholds only; this is not a food-safety certification.
function calculateWasteRisk(expiryTime, status, now) {
  const expiry = new Date(expiryTime).getTime()

  if (!expiryTime || Number.isNaN(expiry)) {
    return { label: 'Unknown Risk', level: 'unknown' }
  }

  const hoursLeft = (expiry - now) / (1000 * 60 * 60)

  if (hoursLeft <= 0 || status === 'expired') {
    return { label: 'Expired', level: 'expired' }
  }

  if (hoursLeft <= 48) {
    return { label: 'High Risk', level: 'high' }
  }

  if (hoursLeft <= 96) {
    return { label: 'Medium Risk', level: 'medium' }
  }

  return { label: 'Low Risk', level: 'low' }
}

export default function FoodListings({ user, onLogout }) {
  const navigate = useNavigate()

  const [role, setRole] = useState('provider')
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [requesting, setRequesting] = useState('')
  const [notice, setNotice] = useState('')
  const [deleting, setDeleting] = useState('')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!user?.id) {
      setListings([])
      setLoading(false)
      return
    }

    loadListings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Update countdowns and risk labels every minute.
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now())
    }, 60 * 1000)

    return () => clearInterval(timer)
  }, [])

  async function loadListings() {
    if (!user?.id) return

    setLoading(true)
    setError('')

    try {
      const { data: roleRows, error: roleError } = await supabase
        .from('user_roles')
        .select('roles(name)')
        .eq('user_id', user.id)

      if (roleError) throw roleError

      const currentRole = roleRows?.[0]?.roles?.name || 'provider'
      setRole(currentRole)

      if (currentRole === 'volunteer') {
        setListings([])
        return
      }

      let query = supabase
        .from('food_listings')
        .select(
          '*,food_categories(name),provider_profiles(organization_name,profiles(full_name,city))'
        )
        .order('created_at', { ascending: false })
        .limit(200)

      if (currentRole === 'provider') {
        query = query.eq('provider_id', user.id)
      } else {
        query = query
          .eq('status', 'available')
          .gt('expiry_time', new Date().toISOString())
      }

      const { data, error: listError } = await query

      if (listError) throw listError

      setListings(data || [])
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  async function deleteListing(listing) {
    if (
      !window.confirm(
        `Delete "${listing.title}"? This also removes its pending requests.`
      )
    ) {
      return
    }

    setDeleting(listing.id)
    setError('')
    setNotice('')

    try {
      const { error: deleteError } = await supabase
        .from('food_listings')
        .delete()
        .eq('id', listing.id)
        .eq('provider_id', user.id)

      if (deleteError) throw deleteError

      setListings(current =>
        current.filter(item => item.id !== listing.id)
      )

      setNotice(`Deleted "${listing.title}".`)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setDeleting('')
    }
  }

  async function requestFood(listing) {
    setRequesting(listing.id)
    setError('')
    setNotice('')

    try {
      const { data: ngo, error: ngoError } = await supabase
        .from('ngo_profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (ngoError) throw ngoError

      if (!ngo) {
        throw new Error(
          'Your account is not registered as an NGO. Sign up using the NGO role.'
        )
      }

      const { error: insertError } = await supabase
        .from('food_requests')
        .insert({
          listing_id: listing.id,
          ngo_id: ngo.id,
          requested_quantity: Number(listing.quantity),
          message: 'Requested through RePlate.',
        })

      if (insertError) throw insertError

      setNotice(`Request submitted for "${listing.title}".`)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setRequesting('')
    }
  }

  const visible = listings.filter(item =>
    `${item.title} ${item.description || ''} ${
      item.food_categories?.name || ''
    } ${item.pickup_address || ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      title={
        role === 'provider'
          ? 'Your food listings'
          : 'Available surplus food'
      }
      eyebrow="FOOD RECOVERY"
      action={
        role === 'provider' ? (
          <button
            className="primary-button"
            onClick={() => navigate('/food-listings/create')}
          >
            <Plus size={17} />
            Add listing
          </button>
        ) : null
      }
    >
      <div className="toolbar">
        <label className="search-box">
          <Search size={17} />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search food, category or location…"
          />
        </label>

        <button
          className="secondary-button"
          onClick={loadListings}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="error-message page-alert">{error}</div>
      )}

      {notice && (
        <div className="success-message page-alert">{notice}</div>
      )}

      {loading ? (
        <div className="panel empty-state">
          Loading food listings…
        </div>
      ) : visible.length === 0 ? (
        <div className="panel empty-state">
          <span className="empty-icon">
            <Package size={28} />
          </span>

          <h2>
            {search
              ? 'No matching listings'
              : role === 'provider'
                ? 'No listings yet'
                : role === 'volunteer'
                  ? 'Use Deliveries to find work'
                  : 'No available food right now'}
          </h2>

          <p>
            {role === 'provider'
              ? 'Add surplus food to make it available to your community.'
              : role === 'volunteer'
                ? 'Volunteers can claim unassigned deliveries from the Deliveries page.'
                : 'Check back soon, or clear your search filters.'}
          </p>

          {role === 'provider' && (
            <button
              className="primary-button"
              onClick={() => navigate('/food-listings/create')}
            >
              <Plus size={17} />
              Create listing
            </button>
          )}
        </div>
      ) : (
        <div className="listing-grid">
          {visible.map(item => {
            const risk = calculateWasteRisk(
              item.expiry_time,
              item.status,
              now
            )

            const remaining = calculateTimeRemaining(
              item.expiry_time,
              now
            )

            const provider = item.provider_profiles

            return (
              <article className="listing-card" key={item.id}>
                <div className="listing-card-top">
                  <span className="category-chip">
                    {item.food_categories?.name || 'Food'}
                  </span>

                  <span className={`risk-badge ${risk.level}`}>
                    {risk.label}
                  </span>
                </div>

                <h2>{item.title}</h2>

                <p className="listing-description">
                  {item.description ||
                    'Surplus food available for redistribution.'}
                </p>

                <div className="listing-quantity">
                  <strong>{item.quantity}</strong>
                  <span>{item.quantity_unit}</span>
                </div>

                <div className="listing-meta">
                  <span>
                    <Clock3 size={15} />
                    {remaining.label}
                  </span>

                  <span>
                    <MapPin size={15} />
                    {item.pickup_address ||
                      provider?.profiles?.city ||
                      provider?.organization_name ||
                      'Pickup location to be confirmed'}
                  </span>
                </div>

                <div className="listing-footer">
                  <div>
                    <small>Pickup / expiry</small>
                    <strong>{formatDate(item.expiry_time)}</strong>
                  </div>

                  {role === 'ngo' ? (
                    <button
                      className="primary-button"
                      disabled={
                        requesting === item.id || remaining.expired
                      }
                      onClick={() => requestFood(item)}
                    >
                      <Send size={15} />
                      {requesting === item.id
                        ? 'Requesting…'
                        : remaining.expired
                          ? 'Expired'
                          : 'Request food'}
                    </button>
                  ) : (
                    <span className={`status-badge ${item.status}`}>
                      {item.status.replace('_', ' ')}
                    </span>
                  )}
                </div>

                {role === 'provider' &&
                  ['available', 'draft'].includes(item.status) && (
                    <div className="listing-card-actions">
                      <button
                        className="small-action"
                        onClick={() =>
                          navigate(`/food-listings/${item.id}/edit`)
                        }
                      >
                        <Pencil size={14} />
                        Edit
                      </button>

                      <button
                        className="small-action reject"
                        disabled={deleting === item.id}
                        onClick={() => deleteListing(item)}
                      >
                        <Trash2 size={14} />
                        {deleting === item.id
                          ? 'Deleting…'
                          : 'Delete'}
                      </button>
                    </div>
                  )}
              </article>
            )
          })}
        </div>
      )}

      {role === 'ngo' && (
        <p className="helper-note">
          Risk labels are estimates based on time until expiry. They do
          not certify food safety. Expired food should not be redistributed.
        </p>
      )}
    </AppShell>
  )
}
