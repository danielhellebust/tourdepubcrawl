import type { Pub, RouteCreateInput } from './types'

export function validatePub(p: Pub): string[] {
  const errors: string[] = []
  if (!p.name || !p.name.trim()) errors.push('Pub name is required')
  if (!Number.isFinite(p.lat) || p.lat < -90 || p.lat > 90) errors.push('lat must be between -90 and 90')
  if (!Number.isFinite(p.lng) || p.lng < -180 || p.lng > 180) errors.push('lng must be between -180 and 180')
  return errors
}

export function validateRouteCreateInput(input: RouteCreateInput): string[] {
  const errors: string[] = []
  if (!input.name || !input.name.trim()) errors.push('Route name is required')
  if (!input.pubs?.length) errors.push('At least 1 pub is required')
  input.pubs?.forEach((p, idx) => {
    const pubErrors = validatePub(p)
    pubErrors.forEach((e) => errors.push(`Pub #${idx + 1}: ${e}`))
  })
  return errors
}

