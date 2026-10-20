import { useEffect, useState } from 'react'
import { ArrowLeft, CalendarClock, PackagePlus } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { supabase } from '../lib/supabaseClient'
import { friendlyError } from '../lib/foodLogic'

export default function CreateFoodListing({ user, onLogout }) {
  const navigate = useNavigate()
  const { listingId } = useParams()
  const isEditing = Boolean(listingId)
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({ title:'', description:'', categoryId:'', quantity:'', quantityUnit:'kg', expiryTime:'', pickupAddress:'', pickupStart:'', pickupEnd:'' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { loadInitial() }, [user?.id, listingId])
  async function loadInitial() {
    const { data: categoryData, error: categoryError } = await supabase.from('food_categories').select('id,name').order('id')
    if (categoryError) { setError(friendlyError(categoryError)); return }
    setCategories(categoryData || [])
    if (!listingId) return
    const { data, error: listingError } = await supabase.from('food_listings').select('*').eq('id', listingId).eq('provider_id', user.id).maybeSingle()
    if (listingError) { setError(friendlyError(listingError)); return }
    if (!data) { setError('Listing not found or you do not have permission to edit it.'); return }
    if (data.status !== 'available' && data.status !== 'draft') { setError('Only available or draft listings can be edited.'); return }
    const localDateTime = value => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0,16) : ''
    setForm({ title:data.title || '', description:data.description || '', categoryId:String(data.category_id), quantity:String(data.quantity), quantityUnit:data.quantity_unit || 'kg', expiryTime:localDateTime(data.expiry_time), pickupAddress:data.pickup_address || '', pickupStart:localDateTime(data.pickup_start_time), pickupEnd:localDateTime(data.pickup_end_time) })
  }
  function update(key, value) { setForm(current => ({...current,[key]:value})) }
  async function handleSubmit(event) {
    event.preventDefault(); setLoading(true); setError('')
    try {
      if (new Date(form.expiryTime).getTime() <= Date.now()) throw new Error('Expiry time must be in the future.')
      if (form.pickupStart && form.pickupEnd && new Date(form.pickupEnd) < new Date(form.pickupStart)) throw new Error('Pickup end must be after pickup start.')
      const payload = { category_id:Number(form.categoryId), title:form.title.trim(), description:form.description.trim() || null, quantity:Number(form.quantity), quantity_unit:form.quantityUnit, expiry_time:new Date(form.expiryTime).toISOString(), pickup_start_time:form.pickupStart ? new Date(form.pickupStart).toISOString() : null, pickup_end_time:form.pickupEnd ? new Date(form.pickupEnd).toISOString() : null, pickup_address:form.pickupAddress.trim() || null }
      if (isEditing) {
        const { error: updateError } = await supabase.from('food_listings').update(payload).eq('id', listingId).eq('provider_id', user.id)
        if (updateError) throw updateError
      } else {
        const { data: provider, error: providerError } = await supabase.from('provider_profiles').select('id').eq('id', user.id).maybeSingle()
        if (providerError) throw providerError
        if (!provider) throw new Error('Your account does not have a provider profile. Sign up using the Food donor / provider role.')
        const { error: insertError } = await supabase.from('food_listings').insert({ ...payload, provider_id:provider.id, status:'available' })
        if (insertError) throw insertError
      }
      navigate('/food-listings', { replace:true })
    } catch (err) { setError(friendlyError(err)) }
    finally { setLoading(false) }
  }
  return <AppShell user={user} onLogout={onLogout} title={isEditing ? 'Edit food listing' : 'Publish surplus food'} eyebrow={isEditing ? 'UPDATE LISTING' : 'NEW FOOD LISTING'}>
    <button className="back-button inline-back" onClick={()=>navigate('/food-listings')}><ArrowLeft size={17}/> Back to listings</button>
    <div className="form-layout"><section className="panel form-panel"><div className="form-title"><span className="empty-icon"><PackagePlus size={25}/></span><div><h2>{isEditing ? 'Update food details' : 'Food details'}</h2><p>Share accurate information so recipients can plan collection.</p></div></div>
      <form onSubmit={handleSubmit} className="form-stack">
        <label className="field-label">Food title<input className="plain-input" value={form.title} onChange={e=>update('title',e.target.value)} placeholder="e.g. Vegetable rice meal packs" maxLength={100} required/></label>
        <label className="field-label">Description<textarea className="plain-input textarea" value={form.description} onChange={e=>update('description',e.target.value)} placeholder="Ingredients, packaging, storage and other relevant details" rows={3} maxLength={1000}/></label>
        <div className="form-row"><label className="field-label">Category<select className="plain-input" value={form.categoryId} onChange={e=>update('categoryId',e.target.value)} required><option value="">Choose category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="field-label">Quantity<div className="quantity-input"><input className="plain-input" type="number" min="0.1" step="0.1" value={form.quantity} onChange={e=>update('quantity',e.target.value)} required/><select className="plain-input unit-select" value={form.quantityUnit} onChange={e=>update('quantityUnit',e.target.value)}><option value="kg">kg</option><option value="litres">litres</option><option value="items">items</option></select></div></label></div>
        <label className="field-label">Expiry date and time<div className="date-input"><CalendarClock size={17}/><input className="plain-input" type="datetime-local" min={new Date(Date.now()+60000).toISOString().slice(0,16)} value={form.expiryTime} onChange={e=>update('expiryTime',e.target.value)} required/></div></label>
        <label className="field-label">Pickup address<input className="plain-input" value={form.pickupAddress} onChange={e=>update('pickupAddress',e.target.value)} placeholder="Street, area, city" maxLength={300}/></label>
        <div className="form-row"><label className="field-label">Pickup window starts (optional)<input className="plain-input" type="datetime-local" value={form.pickupStart} onChange={e=>update('pickupStart',e.target.value)}/></label><label className="field-label">Pickup window ends (optional)<input className="plain-input" type="datetime-local" value={form.pickupEnd} onChange={e=>update('pickupEnd',e.target.value)}/></label></div>
        {error && <div className="error-message" role="alert">{error}</div>}
        <div className="form-actions"><button type="button" className="secondary-button" onClick={()=>navigate('/food-listings')}>Cancel</button><button className="primary-button" type="submit" disabled={loading}>{loading ? 'Saving…' : isEditing ? 'Save changes' : 'Publish listing'}</button></div>
      </form>
    </section><aside className="panel tip-panel"><p className="dashboard-label">GOOD DONATION PRACTICE</p><h3>Keep the details clear</h3><ul><li>Only list food that is safe and suitable for donation.</li><li>Enter a realistic expiry time and collection window.</li><li>Include relevant storage and allergen information in the description.</li><li>Coordinate collection promptly when expiry is approaching.</li></ul><p className="helper-note">RePlate's expiry-risk label is a planning aid only, not a food-safety assessment.</p></aside></div>
  </AppShell>
}
