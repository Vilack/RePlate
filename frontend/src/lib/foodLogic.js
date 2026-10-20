export function getWasteRisk(expiryTime, status = 'available') {
  if (['delivered', 'completed', 'cancelled', 'expired'].includes(status)) return { label: status[0].toUpperCase() + status.slice(1), level: 'neutral', hours: null }
  const hours = (new Date(expiryTime).getTime() - Date.now()) / 3600000
  if (!Number.isFinite(hours) || hours < 0) return { label: 'Expired', level: 'high', hours }
  if (hours <= 6) return { label: 'High risk', level: 'high', hours }
  if (hours <= 24) return { label: 'Medium risk', level: 'medium', hours }
  return { label: 'Low risk', level: 'low', hours }
}

export function hoursRemaining(expiryTime) {
  const hours = Math.max(0, Math.ceil((new Date(expiryTime).getTime() - Date.now()) / 3600000))
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} left`
  const days = Math.ceil(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} left`
}

export function formatDate(value) {
  if (!value) return 'Not scheduled'
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

export function friendlyError(error) {
  if (!error) return 'Something went wrong. Please try again.'
  if (error.code === 'PGRST116') return 'The requested record was not found.'
  if (error.code === '23505') return 'This record already exists.'
  if (error.code === '42501') return 'Access denied. Check your role and database security policies.'
  return error.message || 'Something went wrong. Please try again.'
}
