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
  "Det bli fart på rattet me smårips'n i krattet",
  'Du e itj mannj før du har lært dæ å bannj',
  'Det bli itj no darlings me klær fra Carlings',
  'Det e itj no fæst om du itj havne i fyllearrest',
  'Du e litt femi om du hete Kurt Remi',
  "Det bli itj no sphænk ut'n bil me sænk",
  'Du e itj nå tess hvis du ikke kjøre mokasiner te dress',
  'Du e itj sprø uten fuggelfrø',
  "Du blir itj knall ut'n kjall",
  'E itj orntli vors om du itj må reng røde kors',
  'Du treng itj nå mus hvis du kjøre trailer med grus',
  'Ska du ha dametække må du dra brække',
  'Det e litt flaut om du itj kan å braut',
  "Når du har sopp på taska e det på tide å få'n vaska",
  "Det e itj no tess ut'n grilldress",
  'Du e heit når du e småfeit',
  'E du søring e du itj verdt ein femtiøring',
  'Du e verdig om du får stå mens du sjer på RBK',
  "Du e itj klar før du får'n hard av å sjå ein ainna kar bar",
  "Du e itj kar hves du itj får'n hard",
  'Du blir itj snasen uten skrå opp nasen',
  "Du sjer berre svin hves du itj' dunke bensin",
  "Du får itj no skreppa ut'n ein pris under leppa",
  "Det blir itj' mus uten siestabrus",
  "Bruke du trus kan du glømm å få dæ mus",
]

const DEMO_USERS = [
  "Victor Pettersson", "Teddy Teisrud", "Lars Mong", "Anne Margrete Bertsch",
  "Harald Vegstein", "Maria Lattila", "Steffen Olsen", "Monja Fløttre",
  "Josefin Schmidt", "Rodolfo Gordillo", "Yolanda Aspelund", "Even Skaar",
  "Kristin Haugbraaten", "Eirik Sæther", "Toni Poljanic", "Velimir Brnicevic",
  "Vladimir Rodionov", "Michael Windeler", "Bjørn Tore Mathisen", "Tove Bergh",
  "Ragnhild OrtenJohansen", "Jørn Vidar", "Rob Rhind", "Idar Herland",
  "Robert Bos", "Per Christian Hoel", "Geir Edvardsen", "Einar Lunde",
  "Niksa Kacic", "Per Christian Riis-Ulsbøl", "Negar Nourielmi", "Alexander Bergsmo",
  "Lindi Coetzer", "Sudheesh Kanhangad", "Asle Pettersen", "Ole Mathisen",
  "Dag Rougthvedt", "Leif Erich", "Joseph Udie Abanyam", "John DOE1","John DOE2", "John DOE3", "John DOE4"
]

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

type UserMapState = {
  nickname: string;
  current_pub: string;
  picture_url?: string;
};

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
  const [routeCreate, setRouteCreate] = useState<RouteCreateInput>({ name: '', pubs: [{ name: '', lat: 0, lng: 0 }] })
  const [pilsQuery, setPilsQuery] = useState('')
  const [pilsOut, setPilsOut] = useState<string>('')
  const [pilsCredit, setPilsCredit] = useState<number | null>(null)
  const [moodOut, setMoodOut] = useState<string>('')
  const [moodCredit, setMoodCredit] = useState<number | null>(null)
  const [quizAnswer, setQuizAnswer] = useState('')
  const [golarPolyline, setGolarPolyline] = useState<[number, number][]>([])

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
    const interval = setInterval(() => { refreshStateAndStats() }, 30000);
    return () => clearInterval(interval);
  }, []);

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
          if (s) { setPilsCredit(s.pils_pilot_credit); setMoodCredit(s.mood_credit); }
        } else { setRoute(null); setState(null); }
      })
      .catch((e: unknown) => { notifications.show({ color: 'red', title: 'Failed to load', message: String(e) }) })
    return () => { mounted = false }
  }, [apiIdentityKey])

  const currentCenter: [number, number] = useMemo(() => {
    if (!route || !state) return [59.9351816485413, 10.780315299805943]
    const pub = route.pubs.find((p) => p.name === state.current_pub) ?? route.pubs[0]
    return pubLatLng(pub)
  }, [route, state])

  const progressValue = useMemo(() => PROGRESS_STEPS[Math.min(currentPubIdx, PROGRESS_STEPS.length - 1)] ?? 10, [currentPubIdx])

  async function refreshStateAndStats() {
    const [s, st, c] = await Promise.all([api.state(), api.stats(), api.chat()])
    setState(s); setStats(st); setChat(c.messages || [])
    if (s) { setPilsCredit(s.pils_pilot_credit); setMoodCredit(s.mood_credit); }
  }

  async function onNext() { await api.next(); await refreshStateAndStats(); }
  async function onReset() { await api.reset(); await refreshStateAndStats(); }
  async function onPostChat() {
    const message = chatDraft.trim(); if (!message) return;
    await api.chatPost(message); setChatDraft(''); await refreshStateAndStats();
  }
  async function onUpdateNickname() {
    const next = nicknameDraft.trim(); if (!next) return;
    const me = await api.meUpdate(next); setNickname(me.nickname || '');
    notifications.show({ color: 'green', title: 'Profile', message: 'Nickname updated' })
  }
  async function onDrink(type: 'beer' | 'wine' | 'shot', volume: number, label: string) {
    await api.drink(type, volume); notifications.show({ color: 'green', title: 'Registrert', message: label }); await refreshStateAndStats();
  }
  async function onMood(value: 'happy' | 'normal' | 'dizzy' | 'drunk', label: string) {
    await api.mood(value); notifications.show({ color: 'green', title: 'Humør', message: label }); await refreshStateAndStats();
  }
  async function onQuizSubmit() {
    const answer = quizAnswer.trim(); const pubName = state?.current_pub; if (!answer || !pubName) return;
    const question = QUIZ_QUESTIONS[pubName] || DEFAULT_QUESTION
    try {
      await api.quiz(pubName, question, answer); notifications.show({ color: 'green', title: 'Quiz', message: 'Reply saved!' });
      setQuizAnswer(''); await refreshStateAndStats();
    } catch (e) { notifications.show({ color: 'red', title: 'Feil', message: 'Kunne ikke lagre svar' }) }
  }

  async function joinSelectedRoute() {
    if (!routeJoinDraft) { notifications.show({ color: 'red', title: 'Route', message: 'Choose a route first' }); return; }
    await api.routesJoin({ route_id: routeJoinDraft });
    const [me, r, s] = await Promise.all([api.me(), api.route(), api.state()]);
    setRouteId(me.route_id || ''); setRouteJoinDraft(me.route_id || ''); setRoute(r); setState(s);
    if (s) { setPilsCredit(s.pils_pilot_credit); setMoodCredit(s.mood_credit); }
    notifications.show({ color: 'green', title: 'Route', message: 'Joined route' }); await refreshStateAndStats();
  }

  function updateRoutePub(idx: number, patch: Partial<Pub>) {
    setRouteCreate((prev) => {
      if (!prev?.pubs || !prev.pubs[idx]) return prev;
      const nextPubs = [...prev.pubs]; nextPubs[idx] = { ...nextPubs[idx], ...patch };
      return { ...prev, pubs: nextPubs }
    })
  }

  async function createRoute() {
    const errors = validateRouteCreateInput(routeCreate);
    if (errors.length) { notifications.show({ color: 'red', title: 'Create route', message: errors[0] }); return; }
    await api.routesCreate({ name: routeCreate.name.trim(), pubs: routeCreate.pubs.map((p) => ({ name: p.name.trim(), lat: Number(p.lat), lng: Number(p.lng) })) });
    const rs = await api.routesDetail(); setRoutes(rs); notifications.show({ color: 'green', title: 'Create route', message: 'Route created' })
  }

  const pubsRemaining = useMemo(() => {
    if (!route || !state) return [];
    const idx = route.pubs.findIndex((p) => p.name === state.current_pub);
    return route.pubs.slice(Math.max(idx, 0))
  }, [route, state])

  const nextPubName = pubsRemaining.length > 1 ? pubsRemaining[1]!.name : 'Siste Stopp er nådd'
  const pizzaAlert = pubsRemaining[0]?.name === 'Pane & Vino'
  const threeLeftAlert = pubsRemaining[0]?.name === 'Ludus Cafe & sportsbar'
  const finalAlert = pubsRemaining.length === 1 && pubsRemaining[0]?.name === 'Schouskjelleren Mikrobryggeri'
  const currentQuizQuestion = state?.current_pub ? QUIZ_QUESTIONS[state.current_pub] || DEFAULT_QUESTION : DEFAULT_QUESTION
  const extStats = stats as (StatsResponse & { quiz_stats?: QuizStat[], users?: UserMapState[] }) | null

  return (
    <AppShell header={{ height: 50 }} padding="xs">
      <AppShell.Header>
        <Container h="100%" size="sm" px="xs" style={{ display: 'flex', alignItems: 'center' }}>
          <Group justify="space-between" w="100%" wrap="nowrap">
            <Title order={4} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Pub Crawl</Title>
            <Group gap="xs" wrap="nowrap">{headerActions}</Group>
          </Group>
        </Container>
      </AppShell.Header>

      <AppShell.Main>
        <Container size="sm" px={0}>
          <Tabs value={activeTab} onChange={setActiveTab} variant="pills" color="yellow">
            <Tabs.List grow>
              <Tabs.Tab value="Kart">Map</Tabs.Tab>
              <Tabs.Tab value="Stats">Stats</Tabs.Tab>
              <Tabs.Tab value="Post">Post</Tabs.Tab>
              <Tabs.Tab value="Chat">Chat</Tabs.Tab>
              <Tabs.Tab value="Profile">Profile</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="Kart" pt="xs">
              {activeTab === 'Kart' && (
                <Stack gap="xs">
                  {!routeId && (
                    <Card withBorder padding="xs">
                      <Stack gap="xs">
                        <Text fw={600} size="sm">Velg en rute for å bli med</Text>
                        <Select size="sm" placeholder="Choose route" data={routes.map((r) => ({ value: r.id, label: `${r.name} (${r.pubs.length})` }))} value={routeJoinDraft} onChange={(val) => setRouteJoinDraft(val || '')} searchable />
                        <Button size="sm" onClick={joinSelectedRoute}>Join route</Button>
                      </Stack>
                    </Card>
                  )}
                  {pizzaAlert && <Card withBorder padding="xs" bg="orange.1"><Text fw={600} size="sm">Husk å kjøpe pizza på neste stopp!</Text></Card>}
                  {threeLeftAlert && <Card withBorder padding="xs" bg="blue.0"><Text fw={600} size="sm">Bare 3 stopp igjen, hold ut!</Text></Card>}
                  {finalAlert && <Card withBorder padding="xs" bg="green.1"><Text fw={600} size="sm">Gratulerer med gjennomført Tour de Trondheimsveien!</Text></Card>}

                  <Card withBorder p={0} style={{ overflow: 'hidden', borderRadius: '8px' }}>
                    <div style={{ width: '100%', height: 'calc(100vh - 280px)', minHeight: '350px' }}>
                      <MapContainer key={routeId || 'base-map'} style={{ width: '100%', height: '100%' }} {...({ center: currentCenter, zoom: 18 } as Record<string, unknown>)}>
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
                        {extStats?.users?.map((u) => {
                            const userPub = route?.pubs.find(p => p.name === u.current_pub);
                            if (!userPub) return null;
                            const jitterLat = (Math.random() - 0.5) * 0.00015;
                            const jitterLng = (Math.random() - 0.5) * 0.00015;
                            const jitteredPos: [number, number] = [userPub.lat + jitterLat, userPub.lng + jitterLng];
                            return (
                                <Marker key={u.nickname} position={jitteredPos} icon={createAvatarDivIcon(u.picture_url)}>
                                    <Tooltip permanent direction="top" offset={[0, -10]} opacity={0.9}><Text size="xs" fw={700}>{u.nickname}</Text></Tooltip>
                                    <Popup><Stack gap={4} align="center"><Avatar src={u.picture_url} size="xs" /><Text size="xs" fw={700}>{u.nickname}</Text><Text size="xs">Sted: {u.current_pub}</Text></Stack></Popup>
                                </Marker>
                            );
                        })}
                      </MapContainer>
                    </div>
                  </Card>
                  <Progress value={progressValue} color="green" radius="xl" size="lg" />
                  <Group grow gap="xs">
                    <Button onClick={onNext} color="green" size="md">Next Bar</Button>
                    <Button variant="light" size="md" onClick={() => notifications.show({ color: 'blue', title: 'Trøndervits', message: JOKES_MILD[Math.floor(Math.random() * JOKES_MILD.length)] })}>Vits</Button>
                    <Button onClick={onReset} color="red" variant="light" size="md">Reset</Button>
                  </Group>
                  <Card withBorder padding="xs"><Text size="xs" c="dimmed">Click for next bar:</Text><Text fw={700} size="sm">{nextPubName}</Text></Card>
                </Stack>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="Stats" pt="xs">
              {activeTab === 'Stats' && (
                <Stack gap="xs">
                  <Group grow gap="xs">
                    <Card withBorder padding="xs"><Text c="dimmed" size="xs">Deltakere</Text><Title order={4}>{stats?.user_count ?? 0}</Title></Card>
                    <Card withBorder padding="xs"><Text c="dimmed" size="xs">Beer KOM</Text><Title order={4} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{stats?.beer_kom ?? 'Anonym'}</Title></Card>
                    <Card withBorder padding="xs"><Text c="dimmed" size="xs">Liters</Text><Title order={4}>{stats?.total_liters ?? 0}</Title></Card>
                  </Group>
                  <Card withBorder padding="xs">
                    <Title order={5} mb="xs">Liter per bar</Title>
                    <div style={{ width: '100%', height: 600 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats?.liters_per_bar ?? []} layout="vertical" margin={{ top: 5, left: 0, right: 30, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" fontSize={10} />
                          <YAxis
                            type="category"
                            dataKey="bar"
                            width={110}
                            tick={{ fontSize: 9 }}
                            interval={0}
                          />
                          <RTooltip labelStyle={{ fontSize: 12 }} itemStyle={{ fontSize: 12 }} />
                          <Bar dataKey="liters" fill="#f1c40f" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                  <Card withBorder padding="xs">
                    <Title order={5} mb="xs">Colleague Quiz Results</Title>
                    {extStats?.quiz_stats && extStats.quiz_stats.length > 0 ? (
                      <Stack gap="md">
                        {extStats.quiz_stats.map((q, idx) => (
                          <Box key={`${q.pub}-${idx}`}>
                            <Text size="xs" c="dimmed">{q.pub}</Text>
                            <Text fw={600} size="sm" mb="xs">{q.question}</Text>
                            <div style={{ width: '100%', height: Math.max(120, q.answers.length * 35 + 30) }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={q.answers} layout="vertical" margin={{ left: 0, right: 20 }}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis type="number" allowDecimals={false} fontSize={10} />
                                  <YAxis type="category" dataKey="answer" width={80} tick={{ fontSize: 9 }} />
                                  <RTooltip labelStyle={{ fontSize: 11 }} itemStyle={{ fontSize: 11 }} />
                                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </Box>
                        ))}
                      </Stack>
                    ) : ( <Text c="dimmed" size="xs">Ingen quiz-svar registrert enda.</Text> )}
                  </Card>
                </Stack>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="Chat" pt="xs">
              <Stack gap="xs">
                <Title order={5}>Chat</Title>
                <Card withBorder padding="xs" style={{ maxHeight: 350, overflow: 'auto' }}>
                  <Stack gap="xs">
                    {chat.map((m, idx) => (
                      <Card key={`${m.timestamp}-${idx}`} withBorder p="xs" py={4} style={{ background: '#f1c40f', color: 'white' }}>
                        <Group justify="space-between" wrap="nowrap"><Text fw={700} size="xs">{m.nickname}</Text><Text size="10px">{formatTs(m.timestamp)}</Text></Group>
                        <Text size="xs" mt={2}>{m.message}</Text>
                      </Card>
                    ))}
                  </Stack>
                </Card>
                <Textarea size="sm" label="Got something on your mind ?" placeholder="Shoot" value={chatDraft} onChange={(e) => setChatDraft(e.currentTarget.value)} autosize minRows={2} maxRows={3} />
                <Button size="sm" onClick={onPostChat}>Post</Button>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="Post" pt="xs">
              <Stack gap="xs">
                <Title order={5}>Registrer</Title>
                <Card withBorder padding="xs"><Text c="dimmed" size="xs">Current pub</Text><Text fw={700} size="md">{state?.current_pub ?? 'Rendevous Kro'}</Text></Card>
                <Group grow gap="xs">
                  <Button size="sm" color="yellow" onClick={() => onDrink('beer', 0.5, '0.5 L')}>0.5 L</Button>
                  <Button size="sm" color="yellow" onClick={() => onDrink('beer', 0.33, '0.33 L')}>0.33 L</Button>
                </Group>
                <Group grow gap="xs">
                  <Button size="sm" color="yellow" variant="light" onClick={() => onDrink('wine', 0.25, 'Vin glass')}>Vin</Button>
                  <Button size="sm" color="yellow" variant="light" onClick={() => onDrink('shot', 0.02, 'Shot glass')}>Shot</Button>
                </Group>
                <Group grow gap="xs">
                  <Button size="xs" variant="outline" color="gray" onClick={() => onMood('happy', 'Happy')}>Happy</Button>
                  <Button size="xs" variant="outline" color="gray" onClick={() => onMood('normal', 'Normal')}>Normal</Button>
                  <Button size="xs" variant="outline" color="gray" onClick={() => onMood('dizzy', 'Dizzy')}>Dizzy</Button>
                  <Button size="xs" variant="outline" color="gray" onClick={() => onMood('drunk', 'Drunk')}>Drunk</Button>
                </Group>
                <Card withBorder mt="xs" padding="xs" bg="gray.0">
                  <Text c="dimmed" size="xs" mb={4}>Quiz - {state?.current_pub}</Text>
                  <Text fw={600} size="sm" mb="xs">{currentQuizQuestion}</Text>
                  <Stack gap="xs">
                    <TextInput size="sm" placeholder="Who is on your mind?" value={quizAnswer} onChange={(e) => setQuizAnswer(e.currentTarget.value)} />
                    <Button size="sm" color="blue" onClick={onQuizSubmit}>Reply</Button>
                  </Stack>
                </Card>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="Profile" pt="xs">
              <Stack gap="xs">
                <Title order={5}>Profile</Title>
                <Card withBorder padding="xs">
                  <Stack gap="xs">
                    <TextInput size="sm" label="Nickname" value={nicknameDraft} onChange={(e) => setNicknameDraft(e.currentTarget.value)} />
                    <Select size="sm" label="Join route" placeholder="Choose route" data={routes.map((r) => ({ value: r.id, label: `${r.name}` }))} value={routeJoinDraft} onChange={(val) => setRouteJoinDraft(val || '')} searchable clearable />
                    <Group grow gap="xs">
                      <Button size="sm" variant="light" onClick={joinSelectedRoute}>Join</Button>
                      <Button size="sm" color="yellow" onClick={onUpdateNickname}>Save</Button>
                    </Group>
                  </Stack>
                </Card>
                <Card withBorder padding="xs"><Text c="dimmed" size="xs">Current</Text><Text fw={700} size="sm">{nickname}</Text></Card>
              </Stack>
            </Tabs.Panel>

            {/* Routes tab kept but simplified for mobile */}
            <Tabs.Panel value="Routes" pt="xs">
               <Stack gap="xs">
                 <Title order={5}>Routes</Title>
                 {routes.map((r) => (
                   <Card key={r.id} withBorder padding="xs">
                     <Text fw={700} size="sm">{r.name}</Text>
                     <Text size="xs" c="dimmed">{r.pubs.length} pubs</Text>
                   </Card>
                 ))}
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
    if (!isAuthenticated || !user) { setApiUserIdentity(null); return; }
    const id = (user.email ?? user.sub ?? '').trim(); if (!id) { setApiUserIdentity(null); return; }
    setApiUserIdentity(() => id); return () => setApiUserIdentity(null)
  }, [isAuthenticated, user])
  if (isLoading) return <Center h="100vh"><Loader /></Center>
  if (!isAuthenticated || !user) {
    return (
      <Center h="100vh" p="md">
        <Stack align="center" gap="md" maw={420}>
          <Title order={3}>Pub Crawl</Title>
          <Text c="dimmed" ta="center" size="sm">Log in with Auth0 to join a route.</Text>
          <Button onClick={() => void loginWithRedirect()}>Log in</Button>
        </Stack>
      </Center>
    )
  }
  const apiIdentityKey = (user.email ?? user.sub ?? '').trim(); const displayEmail = user.email ?? user.sub ?? ''
  return <AppCore apiIdentityKey={apiIdentityKey} displayEmail={displayEmail} pictureUrl={user.picture} headerActions={<Group gap="xs" wrap="nowrap"><Avatar src={user.picture ?? undefined} alt="" size="sm" radius="xl" /><Button size="xs" variant="light" onClick={() => void logout({ logoutParams: { returnTo: window.location.origin } })}>Logout</Button></Group>} />
}

function AppDemoMode() {
  const [email, setEmail] = useState(() => getUserEmail())
  useEffect(() => {
    const resolved = (email || '').trim() || DEMO_FALLBACK_EMAIL;
    setApiUserIdentity(() => resolved); return () => setApiUserIdentity(null)
  }, [email])
  function applyDemoEmail() {
    const next = (email || '').trim(); if (!next) return;
    setUserEmail(next); setEmail(next);
  }
  const key = (email || '').trim() || DEMO_FALLBACK_EMAIL
  return (
    <AppCore
      apiIdentityKey={key}
      displayEmail={email || ''}
      pictureUrl={null}
      headerActions={
        <Group gap={4} wrap="nowrap">
          <Select
            placeholder="User"
            size="xs"
            w={120}
            data={DEMO_USERS.map(u => ({ value: u, label: u }))}
            value={email}
            onChange={(val) => setEmail(val || '')}
            searchable
          />
          <Button size="xs" variant="light" onClick={applyDemoEmail} px={4}>Use</Button>
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