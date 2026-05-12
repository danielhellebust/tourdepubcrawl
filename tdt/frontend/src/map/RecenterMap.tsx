import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

/** Pans the map when the user moves to the next pub (or joins a route). */
export function RecenterMap({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 0.35 })
  }, [center[0], center[1], zoom, map])
  return null
}
