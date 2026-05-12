import { Auth0Provider } from '@auth0/auth0-react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import 'leaflet/dist/leaflet.css'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import './map/markers.css'
import App from './App.tsx'
import L from 'leaflet'
import icon2x from 'leaflet/dist/images/marker-icon-2x.png'
import icon from 'leaflet/dist/images/marker-icon.png'
import shadow from 'leaflet/dist/images/marker-shadow.png'

// Fix default marker icons in bundlers (Vite).
L.Icon.Default.mergeOptions({
  iconRetinaUrl: icon2x,
  iconUrl: icon,
  shadowUrl: shadow,
})

const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN
const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID
const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE
const auth0Enabled = Boolean(auth0Domain && auth0ClientId)

const app = (
  <MantineProvider defaultColorScheme="light">
    <Notifications />
    <App />
  </MantineProvider>
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {auth0Enabled ? (
      <Auth0Provider
        domain={auth0Domain!}
        clientId={auth0ClientId!}
        authorizationParams={{
          redirect_uri: window.location.origin,
          ...(auth0Audience ? { audience: auth0Audience } : {}),
        }}
        cacheLocation="localstorage"
      >
        {app}
      </Auth0Provider>
    ) : (
      app
    )}
  </StrictMode>,
)
