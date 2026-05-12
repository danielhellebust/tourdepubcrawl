import { useAuth0 } from '@auth0/auth0-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AppShell,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Container,
  Group,
  Loader,
  Progress,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip } from 'react-leaflet'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import { api, getUserEmail, setApiUserIdentity, setUserEmail } from './api/client'
import { createAvatarDivIcon } from './map/avatarIcon'
import { RecenterMap } from './map/RecenterMap'
import { validateRouteCreateInput } from './api/schema'
import type { Pub, RouteCreateInput, RouteDetail, RouteResponse, StatsResponse, StateResponse } from './api/types'
import { formatTs } from './utils/format'

// Import the GPX file as a static asset URL
import golarGpxUrl from './assets/TourDePubCrawl.gpx?url'

const PROGRESS_STEPS = [10, 15, 21, 26, 32, 37, 42, 48, 55, 62, 70, 75, 82, 100]

const JOKES_MILD = [
  'Bli itj nå fæst uten skinnvæst',
  'Bli itj nå fin uten mokkasin',
  'Bli itj nå fart uten bart',
  'Bli itj nå barsk uten karsk',
]

// Custom questions per pub
const QUIZ_QUESTIONS: Record<string, string> = {
  'Postkontoret': 'Who is most likely to accidentally "Reply All" to a company-wide email?',
  'Bydelskroa': 'Who secretly judges everyone else’s lunch choices?',
  'Grønland Boulebar': 'Who is most likely to over-engineer a simple Excel spreadsheet until it completely crashes their laptop?',
  'Enerhaugen Cafe': 'Who is most likely to fall asleep during a 4-hour HAZID meeting but pretend they were just "deep in thought"?',
  'Eagle pub': 'Who is most likely to declare tonight’s pub crawl a "massive commercial success" despite going way over schedule and budget?',
  'Oslo Mekaniske Verksted': 'Who talks a big game about their extreme skiing trips but actually spends the entire weekend at the afterski?',
  "Teddy's Softbar": 'Who has the most questionable browser search history?',
  'Südøst Restaurant': 'Who is most likely to drop their phone in the toilet tonight?',
  'Café Sara': 'Who schedules all their friday morning meetings to ensure they get a kanelbolle?',
  'Crow bar & Bryggeri': 'Who is most likely to wake up tomorrow with a ......?',
  'Café Fiasco': 'Who is most likely to be the actual reason this pub crawl turns into a complete fiasco?'
}
const DEFAULT_QUESTION = 'Hvem i teamet er kveldens MVP?'

function pubLatLng(p: Pub): [number, number] {
  return [p.lat, p.lng]
}

const DEMO_FALLBACK_EMAIL = 'demo@tdt.local'

type AppCoreProps = {
  apiIdentityKey: string
  displayEmail: string
  pictureUrl?: string | null
  headerActions: ReactNode
}

type QuizStat = {
  pub: string
  question: string
  answers: { answer: string; count: number }[]
}

function AppCore({ apiIdentityKey, displayEmail, pictureUrl, headerActions }: AppCoreProps) {
  const [activeTab, setActiveTab] = useState<string | null>('Kart')

  const [route, setRoute] = useState<RouteResponse | null>(null)
  const [routes, setRoutes] = useState<RouteDetail[]>([])
  const [state, setState] = useState<StateResponse | null>(null)
  const [stats, setStats] = useState<StatsResponse | null>(null)

  const [chat, setChat] = useState<{ nickname: string; timestamp: string; message: string }[]>([])
  const [chatDraft, setChatDraft] = useState('')

  const [nickname, setNickname] = useState<string>('')
  const [nicknameDraft, setNicknameDraft] = useState<string>('')
  const [routeId, setRouteId] = useState<string>('')
  const [routeJoinDraft, setRouteJoinDraft] = useState<string>('')

  const [routeCreate, setRouteCreate] = useState<RouteCreateInput>({
    name: '',
    pubs: [{ name: '', lat: 0, lng: 0 }],
  })

  const [pilsQuery, setPilsQuery] = useState('')
  const [pilsOut, setPilsOut] = useState<string>('')
  const [pilsCredit, setPilsCredit] = useState<number | null>(null)

  const [moodOut, setMoodOut] = useState<string>('')
  const [moodCredit, setMoodCredit] = useState<number | null>(null)

  // Quiz state
  const [quizAnswer, setQuizAnswer] = useState('')

  // State to hold the parsed GPX track points
  const [golarPolyline, setGolarPolyline] = useState<[number, number][]>([])

  const userMarkerIcon = useMemo(() => createAvatarDivIcon(pictureUrl ?? undefined), [pictureUrl])

  const currentPubIdx = useMemo(() => {
    if (!route || !state || !state.current_pub) return 0
    const idx = route.pubs.findIndex((p) => p.name === state.current_pub)
    return idx >= 0 ? idx : 0
  }, [route, state])

  const currentRouteName = useMemo(() => {
    return routes.find((r) => r.id === routeId)?.name || ''
  }, [routes, routeId])

  useEffect(() => {
    if (currentRouteName === 'Golar Pub Crawl') {
      fetch(golarGpxUrl)
        .then((res) => res.text())
        .then((text) => {
          const parser = new DOMParser()
          const xmlDoc = parser.parseFromString(text, 'text/xml')
          const trkpts = xmlDoc.querySelectorAll('trkpt')
          const pts: [number, number][] = []

          trkpts.forEach((pt) => {
            const lat = parseFloat(pt.getAttribute('lat') || '0')
            const lon = parseFloat(pt.getAttribute('lon') || '0')
            if (lat && lon) pts.push([lat, lon])
          })

          setGolarPolyline(pts)
        })
        .catch((err) => console.error('Failed to parse GPX:', err))
    } else {
      setGolarPolyline([])
    }
  }, [currentRouteName])

  useEffect(() => {
    let mounted = true
    Promise.all([api.routesDetail(), api.me(), api.chat(), api.stats()])
      .then(async ([rs, me, c, st]) => {
        if (!mounted || !me) return
        setRoutes(rs || [])
        setRouteId(me.route_id || '')
        setRouteJoinDraft(me.route_id || '')
        setNickname(me.nickname || '')
        setNicknameDraft(me.nickname || '')
        setChat(c.messages || [])
        setStats(st)

        if (me.route_id) {
          const [r, s] = await Promise.all([api.route(), api.state()])
          if (!mounted) return
          setRoute(r)
          setState(s)
          setPilsCredit(s.pils_pilot_credit)
          setMoodCredit(s.mood_credit)
        } else {
          setRoute(null)
          setState(null)
        }
      })
      .catch((e: unknown) => {
        notifications.show({ color: 'red', title: 'Failed to load', message: String(e) })
      })
    return () => {
      mounted = false
    }
  }, [apiIdentityKey])

  const currentCenter: [number, number] = useMemo(() => {
    if (!route || !state) return [59.9351816485413, 10.780315299805943]
    const pub = route.pubs.find((p) => p.name === state.current_pub) ?? route.pubs[0]
    return pubLatLng(pub)
  }, [route, state])

  const progressValue = useMemo(() => PROGRESS_STEPS[Math.min(currentPubIdx, PROGRESS_STEPS.length - 1)] ?? 10, [currentPubIdx])

  async function refreshStateAndStats() {
    const [s, st] = await Promise.all([api.state(), api.stats()])
    setState(s)
    setStats(st)
    setPilsCredit(s.pils_pilot_credit)
    setMoodCredit(s.mood_credit)
  }

  async function onNext() {
    await api.next()
    await refreshStateAndStats()
  }

  async function onReset() {
    await api.reset()
    await refreshStateAndStats()
  }

  async function onPostChat() {
    const message = chatDraft.trim()
    if (!message) return
    await api.chatPost(message)
    setChatDraft('')
    const c = await api.chat()
    setChat(c.messages || [])
  }

  async function onUpdateNickname() {
    const next = nicknameDraft.trim()
    if (!next) return
    const me = await api.meUpdate(next)
    setNickname(me.nickname || '')
    notifications.show({ color: 'green', title: 'Profile', message: 'Nickname updated' })
  }

  async function onDrink(type: 'beer' | 'wine' | 'shot', volume: number, label: string) {
    await api.drink(type, volume)
    notifications.show({ color: 'green', title: 'Registrert', message: label })
    await refreshStateAndStats()
  }

  async function onMood(value: 'happy' | 'normal' | 'dizzy' | 'drunk', label: string) {
    await api.mood(value)
    notifications.show({ color: 'green', title: 'Humør', message: label })
    await refreshStateAndStats()
  }

  async function onQuizSubmit() {
    const answer = quizAnswer.trim()
    const pubName = state?.current_pub
    if (!answer || !pubName) return

    const question = QUIZ_QUESTIONS[pubName] || DEFAULT_QUESTION

    try {
      await api.quiz(pubName, question, answer)

      notifications.show({ color: 'green', title: 'Quiz', message: 'Svar lagret!' })
      setQuizAnswer('')
      await refreshStateAndStats()
    } catch (e) {
      notifications.show({ color: 'red', title: 'Feil', message: 'Kunne ikke lagre svar' })
    }
  }

  async function onPilsPilot() {
    const q = pilsQuery.trim()
    if (!q) return
    const res = await api.pilsPilot(q)
    setPilsOut(res.output_markdown)
    setPilsQuery('')
    setPilsCredit(res.credit_left)
    notifications.show({ color: 'green', title: 'PilsPilot', message: 'Svar levert' })
    await refreshStateAndStats()
  }

  async function onMoodReport() {
    const res = await api.moodReport()
    setMoodOut(res.output_markdown)
    setMoodCredit(res.credit_left)
    notifications.show({ color: 'green', title: 'Stemningsrapport', message: 'Oppdatert' })
    await refreshStateAndStats()
  }

  async function joinSelectedRoute() {
    if (!routeJoinDraft) {
      notifications.show({ color: 'red', title: 'Route', message: 'Choose a route first' })
      return
    }
    await api.routesJoin({ route_id: routeJoinDraft })
    const [me, r, s] = await Promise.all([api.me(), api.route(), api.state()])
    setRouteId(me.route_id || '')
    setRouteJoinDraft(me.route_id || '')
    setRoute(r)
    setState(s)
    setPilsCredit(s.pils_pilot_credit)
    setMoodCredit(s.mood_credit)
    notifications.show({ color: 'green', title: 'Route', message: 'Joined route' })
  }

  function updateRoutePub(idx: number, patch: Partial<Pub>) {
    setRouteCreate((prev) => {
      if (!prev?.pubs || !prev.pubs[idx]) return prev
      const nextPubs = [...prev.pubs]
      nextPubs[idx] = { ...nextPubs[idx], ...patch }
      return { ...prev, pubs: nextPubs }
    })
  }

  async function createRoute() {
    const errors = validateRouteCreateInput(routeCreate)
    if (errors.length) {
      notifications.show({ color: 'red', title: 'Create route', message: errors[0] })
      return
    }
    await api.routesCreate({
      name: routeCreate.name.trim(),
      pubs: routeCreate.pubs.map((p) => ({ name: p.name.trim(), lat: Number(p.lat), lng: Number(p.lng) })),
    })
    const rs = await api.routesDetail()
    setRoutes(rs)
    notifications.show({ color: 'green', title: 'Create route', message: 'Route created' })
  }

  const pubsRemaining = useMemo(() => {
    if (!route || !state) return []
    const idx = route.pubs.findIndex((p) => p.name === state.current_pub)
    return route.pubs.slice(Math.max(idx, 0))
  }, [route, state])

  const nextPubName = pubsRemaining.length > 1 ? pubsRemaining[1]!.name : 'Siste Stopp er nådd'
  const pizzaAlert = pubsRemaining[0]?.name === 'Pane & Vino'
  const threeLeftAlert = pubsRemaining[0]?.name === 'Ludus Cafe & sportsbar'
  const finalAlert = pubsRemaining.length === 1 && pubsRemaining[0]?.name === 'Schouskjelleren Mikrobryggeri'

  const currentQuizQuestion = state?.current_pub ? QUIZ_QUESTIONS[state.current_pub] || DEFAULT_QUESTION : DEFAULT_QUESTION
  const extStats = stats as (StatsResponse & { quiz_stats?: QuizStat[] }) | null

  return (
    <AppShell header={{ height: 64 }} padding="md">
      <AppShell.Header>
        <Container h="100%" size="sm" style={{ display: 'flex', alignItems: 'center' }}>
          <Group justify="space-between" w="100%">
            <Title order={3}>Tour de Pub Crawl</Title>
            <Group gap="xs">{headerActions}</Group>
          </Group>
        </Container>
      </AppShell.Header>

      <AppShell.Main>
        <Container size="sm">
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="Kart">Kart</Tabs.Tab>
              <Tabs.Tab value="Stats">Stats</Tabs.Tab>
              <Tabs.Tab value="Chat">Chat</Tabs.Tab>
              <Tabs.Tab value="Post">Post</Tabs.Tab>
              <Tabs.Tab value="Profile">Profile</Tabs.Tab>
              <Tabs.Tab value="Routes">Routes</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="Kart" pt="md">
              {activeTab === 'Kart' && (
                <Stack gap="sm">
                  {!routeId && (
                    <Card withBorder>
                      <Stack gap="xs">
                        <Text fw={600}>Velg en rute for å bli med</Text>
                        <Select
                          placeholder="Choose route"
                          data={routes.map((r) => ({ value: r.id, label: `${r.name} (${r.pubs.length})` }))}
                          value={routeJoinDraft}
                          onChange={(val) => setRouteJoinDraft(val || '')}
                          searchable
                        />
                        <Group justify="flex-end">
                          <Button onClick={joinSelectedRoute}>Join route</Button>
                        </Group>
                      </Stack>
                    </Card>
                  )}
                  {pizzaAlert && (
                    <Card withBorder>
                      <Text fw={600}>Husk å kjøpe pizza på neste stopp!</Text>
                    </Card>
                  )}
                  {threeLeftAlert && (
                    <Card withBorder>
                      <Text fw={600}>Bare 3 stopp igjen, hold ut!</Text>
                    </Card>
                  )}
                  {finalAlert && (
                    <Card withBorder>
                      <Text fw={600}>Gratulerer med gjennomført Tour de Trondheimsveien!</Text>
                    </Card>
                  )}

                  <Card withBorder p={0} style={{ overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: 420 }}>
                      <MapContainer
                        key={routeId || 'base-map'}
                        style={{ width: '100%', height: '100%' }}
                        {...({ center: currentCenter, zoom: 18 } as Record<string, unknown>)}
                      >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <RecenterMap center={currentCenter} zoom={18} />

                        {route?.polyline?.length ? <Polyline positions={route.polyline} pathOptions={{ color: 'blue', weight: 6 }} /> : null}

                        {currentRouteName === 'Golar Pub Crawl' && golarPolyline.length > 0 && (
                          <Polyline positions={golarPolyline} pathOptions={{ color: 'red', weight: 4, dashArray: '8, 8' }} />
                        )}

                        {route?.pubs.map((p) => (
                          <Marker key={p.name} position={pubLatLng(p)}>
                            <Tooltip {...({ permanent: true } as Record<string, unknown>)}>{p.name}</Tooltip>
                            <Popup>{p.name}</Popup>
                          </Marker>
                        ))}
                        {state && route && (
                          <Marker position={currentCenter} icon={userMarkerIcon}>
                            <Popup>{nickname}</Popup>
                          </Marker>
                        )}
                      </MapContainer>
                    </div>
                  </Card>

                  <Progress value={progressValue} color="green" radius="xl" />

                  <Group grow>
                    <Button onClick={onNext} color="green">
                      Neste
                      <br />
                      Bar
                    </Button>
                    <Button
                      variant="light"
                      onClick={() => notifications.show({ color: 'blue', title: 'Trøndervits', message: JOKES_MILD[Math.floor(Math.random() * JOKES_MILD.length)] })}
                    >
                      Trøndervits
                    </Button>
                    <Button onClick={onReset} color="red" variant="light">
                      Reset
                    </Button>
                  </Group>

                  <Card withBorder>
                    <Text fw={600}>Gå til Neste Bar:</Text>
                    <Text>{nextPubName}</Text>
                  </Card>
                </Stack>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="Stats" pt="md">
              {activeTab === 'Stats' && (
                <Stack gap="sm">
                  <Group grow>
                    <Card withBorder>
                      <Text c="dimmed" size="sm">
                        Deltakere
                      </Text>
                      <Title order={2}>{stats?.user_count ?? 0}</Title>
                    </Card>
                    <Card withBorder>
                      <Text c="dimmed" size="sm">
                        👑 Beer KOM
                      </Text>
                      <Title order={2}>{stats?.beer_kom ?? 'Anonym'}</Title>
                    </Card>
                    <Card withBorder>
                      <Text c="dimmed" size="sm">
                        Liter ØL / Vin
                      </Text>
                      <Title order={2}>{stats?.total_liters ?? 0}</Title>
                    </Card>
                  </Group>

                  <Card withBorder>
                    <Title order={4} mb="sm">
                      Liter per bar
                    </Title>
                    <div style={{ width: '100%', height: 420 }}>
                      <ResponsiveContainer width="100%" height={420} minHeight={420}>
                        <BarChart data={stats?.liters_per_bar ?? []} layout="vertical" margin={{ left: 32, right: 16 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis type="category" dataKey="bar" width={170} />
                          <RTooltip />
                          <Bar dataKey="liters" fill="#f1c40f" radius={[6, 6, 6, 6]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  {/* FIXED: Quiz Stats Section will always render the card, falling back to a message if empty */}
                  <Card withBorder>
                    <Title order={4} mb="sm">Kollega Quiz Resultater</Title>
                    {extStats?.quiz_stats && extStats.quiz_stats.length > 0 ? (
                      <Stack gap="xl">
                        {extStats.quiz_stats.map((q, idx) => (
                          <Box key={`${q.pub}-${idx}`}>
                            <Text size="sm" c="dimmed">{q.pub}</Text>
                            <Text fw={600} mb="xs">{q.question}</Text>
                            <div style={{ width: '100%', height: Math.max(150, q.answers.length * 45 + 40) }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={q.answers} layout="vertical" margin={{ left: 0, right: 16 }}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis type="number" allowDecimals={false} />
                                  <YAxis type="category" dataKey="answer" width={100} />
                                  <RTooltip />
                                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </Box>
                        ))}
                      </Stack>
                    ) : (
                      <Text c="dimmed" size="sm">Ingen quiz-svar registrert på denne ruten enda.</Text>
                    )}
                  </Card>

                </Stack>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="Chat" pt="md">
              <Stack gap="sm">
                <Title order={4}>Chat</Title>
                <Card withBorder style={{ maxHeight: 420, overflow: 'auto' }}>
                  <Stack gap="xs">
                    {chat.map((m, idx) => (
                      <Card key={`${m.timestamp}-${idx}`} withBorder p="sm" style={{ background: '#f1c40f', color: 'white' }}>
                        <Group justify="space-between">
                          <Text fw={600}>{m.nickname}</Text>
                          <Text size="xs">{formatTs(m.timestamp)}</Text>
                        </Group>
                        <Text size="sm" mt={6}>
                          {m.message}
                        </Text>
                      </Card>
                    ))}
                  </Stack>
                </Card>
                <Textarea
                  label="Harru no å fortelle ?"
                  placeholder="Fyr løs"
                  value={chatDraft}
                  onChange={(e) => {
                    const val = e.currentTarget?.value;
                    if (val !== undefined) setChatDraft(val);
                  }}
                  autosize
                  minRows={4}
                  maxRows={4}
                />
                <Button onClick={onPostChat}>Post comment</Button>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="Post" pt="md">
              <Stack gap="md">
                <Title order={4}>Registrer</Title>

                <Card withBorder>
                  <Text c="dimmed" size="sm">
                    Current pub
                  </Text>
                  <Title order={3}>{state?.current_pub ?? 'Rendevous Kro'}</Title>
                </Card>

                <Group grow>
                  <Button color="yellow" onClick={() => onDrink('beer', 0.5, 'Registrert: 0.5 L')}>
                    0.5 L
                  </Button>
                  <Button color="yellow" onClick={() => onDrink('beer', 0.33, 'Registrert: 0.33 L')}>
                    0.33 L
                  </Button>
                  <Button color="yellow" onClick={() => onDrink('wine', 0.25, 'Registrert: Vin glass')}>
                    Vin glass
                  </Button>
                  <Button color="yellow" onClick={() => onDrink('shot', 0.02, 'Registrert: Shot glass')}>
                    Shot glass
                  </Button>
                </Group>

                <Group grow>
                  <Button variant="light" onClick={() => onMood('happy', 'Humør satt til: Happy')}>
                    Happy
                  </Button>
                  <Button variant="light" onClick={() => onMood('normal', 'Humør satt til: Normal')}>
                    Normal
                  </Button>
                  <Button variant="light" onClick={() => onMood('dizzy', 'Humør satt til: Dizzy')}>
                    Dizzy
                  </Button>
                  <Button variant="light" onClick={() => onMood('drunk', 'Humør satt til: Drunk')}>
                    Drunk
                  </Button>
                </Group>

                <Card withBorder mt="md" style={{ background: '#f8f9fa' }}>
                  <Text c="dimmed" size="sm" mb={4}>
                    Kollega Quiz - {state?.current_pub}
                  </Text>
                  <Title order={5} mb="md">
                    {currentQuizQuestion}
                  </Title>
                  <Group align="flex-end">
                    <TextInput
                      placeholder="Hvem tenker du på?"
                      value={quizAnswer}
                      onChange={(e) => {
                        const val = e.currentTarget?.value
                        if (val !== undefined) setQuizAnswer(val)
                      }}
                      style={{ flex: 1 }}
                    />
                    <Button color="blue" onClick={onQuizSubmit}>
                      Svar
                    </Button>
                  </Group>
                </Card>

              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="Profile" pt="md">
              <Stack gap="sm">
                <Title order={4}>Profile</Title>
                <Card withBorder>
                  <Stack>
                    <TextInput
                      label="Nickname"
                      value={nicknameDraft}
                      onChange={(e) => {
                        const val = e.currentTarget?.value;
                        if (val !== undefined) setNicknameDraft(val);
                      }}
                    />
                    <TextInput label="Email" value={displayEmail} disabled />
                    <Select
                      label="Current route"
                      placeholder="Choose route to join"
                      data={routes.map((r) => ({ value: r.id, label: `${r.name} (${r.pubs.length})` }))}
                      value={routeJoinDraft}
                      onChange={(val) => setRouteJoinDraft(val || '')}
                      searchable
                      clearable
                    />
                    <Group justify="flex-end">
                      <Button variant="light" onClick={joinSelectedRoute}>
                        Join route
                      </Button>
                      <Button color="yellow" onClick={onUpdateNickname}>
                        Change nickname
                      </Button>
                    </Group>
                  </Stack>
                </Card>
                <Card withBorder>
                  <Text c="dimmed" size="sm">
                    Current nickname
                  </Text>
                  <Title order={3}>{nickname}</Title>
                </Card>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="Routes" pt="md">
              <Stack gap="md">
                <Title order={4}>All routes</Title>
                <Text c="dimmed" size="sm">
                  Every route with stops in order and WGS84 coordinates (lat, lng).
                </Text>
                <Stack gap="md">
                  {routes.map((r) => (
                    <Card key={r.id} withBorder>
                      <Stack gap="xs">
                        <Group justify="space-between" align="flex-start" wrap="wrap">
                          <div>
                            <Title order={5}>{r.name}</Title>
                            <Text size="xs" c="dimmed">
                              id: {r.id} · {r.pubs.length} pubs
                            </Text>
                          </div>
                        </Group>
                        <Table striped highlightOnHover withTableBorder withColumnBorders>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th style={{ width: 48 }}>#</Table.Th>
                              <Table.Th>Pub</Table.Th>
                              <Table.Th>Latitude</Table.Th>
                              <Table.Th>Longitude</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {r.pubs.map((p, i) => (
                              <Table.Tr key={`${r.id}-${i}-${p.name}`}>
                                <Table.Td>{i + 1}</Table.Td>
                                <Table.Td>{p.name}</Table.Td>
                                <Table.Td>{p.lat.toFixed(6)}</Table.Td>
                                <Table.Td>{p.lng.toFixed(6)}</Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </Stack>
                    </Card>
                  ))}
                </Stack>

                <Title order={4}>Create a pub route</Title>
                <Card withBorder>
                  <Stack>
                    <TextInput
                      label="Route name"
                      placeholder="e.g. Grünerløkka warmup"
                      value={routeCreate.name}
                      onChange={(e) => {
                        const val = e.currentTarget?.value;
                        if (val !== undefined) setRouteCreate((p) => ({ ...p, name: val }));
                      }}
                    />
                    <Text fw={600}>Pubs (in order)</Text>
                    <Stack gap="xs">
                      {routeCreate.pubs.map((p, idx) => (
                        <Group key={idx} grow align="end">
                          <TextInput
                            label={`#${idx + 1} Name`}
                            value={p.name}
                            onChange={(e) => {
                              const val = e.currentTarget?.value;
                              if (val !== undefined) updateRoutePub(idx, { name: val });
                            }}
                          />
                          <TextInput
                            label="Lat"
                            value={String(p.lat)}
                            onChange={(e) => {
                              const val = e.currentTarget?.value;
                              if (val !== undefined) {
                                const num = parseFloat(val);
                                updateRoutePub(idx, { lat: isNaN(num) ? 0 : num });
                              }
                            }}
                          />
                          <TextInput
                            label="Lng"
                            value={String(p.lng)}
                            onChange={(e) => {
                              const val = e.currentTarget?.value;
                              if (val !== undefined) {
                                const num = parseFloat(val);
                                updateRoutePub(idx, { lng: isNaN(num) ? 0 : num });
                              }
                            }}
                          />
                          <Button
                            variant="light"
                            color="red"
                            onClick={() =>
                              setRouteCreate((prev) => ({ ...prev, pubs: prev.pubs.filter((_, i) => i !== idx) || [{ name: '', lat: 0, lng: 0 }] }))
                            }
                          >
                            Remove
                          </Button>
                        </Group>
                      ))}
                      <Group justify="space-between">
                        <Button
                          variant="light"
                          onClick={() => setRouteCreate((prev) => ({ ...prev, pubs: [...prev.pubs, { name: '', lat: 0, lng: 0 }] }))}
                        >
                          Add pub
                        </Button>
                        <Button onClick={createRoute}>Create route</Button>
                      </Group>
                    </Stack>
                  </Stack>
                </Card>
              </Stack>
            </Tabs.Panel>
          </Tabs>
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}

function AppAuth0Mode() {
  const { user, isLoading, isAuthenticated, loginWithRedirect, logout } = useAuth0()

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setApiUserIdentity(null)
      return
    }
    const id = (user.email ?? user.sub ?? '').trim()
    if (!id) {
      setApiUserIdentity(null)
      return
    }
    setApiUserIdentity(() => id)
    return () => setApiUserIdentity(null)
  }, [isAuthenticated, user])

  if (isLoading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    )
  }

  if (!isAuthenticated || !user) {
    return (
      <Center h="100vh" p="md">
        <Stack align="center" gap="md" maw={420}>
          <Title order={3}>Tour de Trondheimsveien</Title>
          <Text c="dimmed" ta="center">
            Log in with Auth0 to join a route. Your avatar starts on the first pub and moves when you tap Neste Bar.
          </Text>
          <Button onClick={() => void loginWithRedirect()}>Log in</Button>
        </Stack>
      </Center>
    )
  }

  const apiIdentityKey = (user.email ?? user.sub ?? '').trim()
  const displayEmail = user.email ?? user.sub ?? ''

  return (
    <AppCore
      apiIdentityKey={apiIdentityKey}
      displayEmail={displayEmail}
      pictureUrl={user.picture}
      headerActions={
        <Group gap="xs" wrap="nowrap">
          <Avatar src={user.picture ?? undefined} alt="" size="sm" radius="xl" />
          <Text size="sm" lineClamp={1} maw={140} visibleFrom="sm">
            {user.name ?? user.email ?? user.sub}
          </Text>
          <Button size="xs" variant="light" onClick={() => void logout({ logoutParams: { returnTo: window.location.origin } })}>
            Log out
          </Button>
        </Group>
      }
    />
  )
}

function AppDemoMode() {
  const [email, setEmail] = useState(() => getUserEmail())

  useEffect(() => {
    const resolved = (email || '').trim() || DEMO_FALLBACK_EMAIL
    setApiUserIdentity(() => resolved)
    return () => setApiUserIdentity(null)
  }, [email])

  function applyDemoEmail() {
    const next = (email || '').trim()
    if (!next) return
    setUserEmail(next)
    setEmail(next)
  }

  const key = (email || '').trim() || DEMO_FALLBACK_EMAIL

  return (
    <AppCore
      apiIdentityKey={key}
      displayEmail={email || ''}
      pictureUrl={null}
      headerActions={
        <Group gap="xs">
          <TextInput
            value={email || ''}
            onChange={(e) => {
              const val = e.currentTarget?.value;
              if (val !== undefined) setEmail(val);
            }}
            placeholder="X-User-Email (demo)"
            size="xs"
            w={220}
          />
          <Button size="xs" variant="light" onClick={applyDemoEmail}>
            Use user
          </Button>
        </Group>
      }
    />
  )
}

export default function App() {
  const auth0Ready = Boolean(import.meta.env.VITE_AUTH0_DOMAIN && import.meta.env.VITE_AUTH0_CLIENT_ID)
  if (auth0Ready) return <AppAuth0Mode />
  return <AppDemoMode />
}