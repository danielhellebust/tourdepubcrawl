import type {
  AiResponse,
  ChatResponse,
  JoinRouteInput,
  MeResponse,
  RouteCreateInput,
  RouteDetail,
  RouteResponse,
  RouteSummary,
  StatsResponse,
  StateResponse,
} from './types'

const DEFAULT_EMAIL = 'demo@tdt.local'
const USER_KEY = 'tdt.userEmail'
const API_BASE = 'http://127.0.0.1:5004' // Vite proxy handles /api → backend

/** When set (e.g. Auth0), API calls use this identity for `X-User-Email`. */
let resolveIdentity: (() => string | null | undefined) | null = null

export function setApiUserIdentity(resolver: (() => string | null | undefined) | null) {
  resolveIdentity = resolver
}

export function getUserEmail(): string {
  if (resolveIdentity) {
    const id = resolveIdentity()
    if (id && String(id).trim()) return String(id).trim()
  }
  const existing = localStorage.getItem(USER_KEY)
  if (existing) return existing
  localStorage.setItem(USER_KEY, DEFAULT_EMAIL)
  return DEFAULT_EMAIL
}

export function setUserEmail(email: string) {
  localStorage.setItem(USER_KEY, email)
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Email': getUserEmail(),
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const message = text || `Request failed: ${res.status}`
    const err = new Error(message) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return (await res.json()) as T
}

export const api = {
  health: () => apiFetch<{ status: string }>('/api/health'),
  route: () => apiFetch<RouteResponse>('/api/route'),
  routes: () => apiFetch<RouteSummary[]>('/api/routes'),
  routesDetail: () => apiFetch<RouteDetail[]>('/api/routes/detail'),
  routesCreate: (body: RouteCreateInput) => apiFetch<RouteDetail>('/api/routes', { method: 'POST', body: JSON.stringify(body) }),
  routesJoin: (body: JoinRouteInput) => apiFetch<{ ok: true; route_id: string; route_name: string; current_pub: string }>('/api/routes/join', {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  me: () => apiFetch<MeResponse>('/api/me'),
  meUpdate: (nickname: string) => apiFetch<MeResponse>('/api/me', { method: 'PUT', body: JSON.stringify({ nickname }) }),
  state: () => apiFetch<StateResponse>('/api/state'),
  next: () => apiFetch<{ current_pub: string }>('/api/state/next', { method: 'POST' }),
  reset: () => apiFetch<{ current_pub: string }>('/api/state/reset', { method: 'POST' }),
  stats: () => apiFetch<StatsResponse>('/api/stats'),
  chat: () => apiFetch<ChatResponse>('/api/chat'),
  chatPost: (message: string) => apiFetch('/api/chat', { method: 'POST', body: JSON.stringify({ message }) }),
  drink: (type: 'beer' | 'wine' | 'shot', volume: number) =>
    apiFetch('/api/events/drink', { method: 'POST', body: JSON.stringify({ type, volume }) }),
  mood: (value: 'happy' | 'normal' | 'dizzy' | 'drunk') =>
    apiFetch('/api/events/mood', { method: 'POST', body: JSON.stringify({ value }) }),
  quiz: (pub: string, question: string, answer: string) =>
    apiFetch<{ ok: boolean }>('/api/events/quiz', { method: 'POST', body: JSON.stringify({ pub, question, answer }) }),
  pilsPilot: (query: string) => apiFetch<AiResponse>('/api/ai/pils-pilot', { method: 'POST', body: JSON.stringify({ query }) }),
  moodReport: () => apiFetch<AiResponse>('/api/ai/mood-report', { method: 'POST' }),
}