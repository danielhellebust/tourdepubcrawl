export type Pub = { name: string; lat: number; lng: number }

export type RouteResponse = {
  pubs: Pub[]
  polyline: [number, number][]
}

export type RouteSummary = {
  id: string
  name: string
  pub_count: number
}

export type RouteDetail = {
  id: string
  name: string
  pubs: Pub[]
  polyline: [number, number][]
}

export type RouteCreateInput = {
  name: string
  pubs: Pub[]
}

export type JoinRouteInput = {
  route_id: string
}

export type MeResponse = {
  email: string
  nickname: string
  route_id?: string | null
  route_name?: string | null
}

export type StateResponse = {
  current_pub: string
  pils_pilot_credit: number
  mood_credit: number
}

export type StatsResponse = {
  user_count: number
  total_liters: number
  beer_kom: string
  liters_per_bar: { bar: string; liters: number }[]
}

export type ChatMessage = {
  nickname: string
  timestamp: string
  message: string
}

export type ChatResponse = {
  messages: ChatMessage[]
}

export type AiResponse = {
  credit_left: number
  output_markdown: string
}

