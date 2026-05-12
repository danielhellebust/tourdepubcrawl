import L from 'leaflet'

const FALLBACK =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#228be6"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6v1H4v-1z"/></svg>`,
  )

/** Circular profile marker for the logged-in user on the map. */
export function createAvatarDivIcon(pictureUrl: string | undefined): L.DivIcon {
  const size = 48
  const url = (pictureUrl && pictureUrl.trim()) || FALLBACK
  const safe = url.replace(/"/g, '&quot;').replace(/</g, '')
  return L.divIcon({
    className: 'tdt-user-avatar-marker',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;border:3px solid #228be6;box-shadow:0 2px 10px rgba(0,0,0,.35);background:#fff"><img src="${safe}" width="${size}" height="${size}" alt="" referrerpolicy="no-referrer" style="object-fit:cover;display:block"/></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}
