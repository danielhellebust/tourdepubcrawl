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
  Modal,
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
  'Bli itj nå fæst uten skinnvæst', 'Bli itj nå fin uten mokkasin', 'Bli itj nå fart uten bart',
  'Bli itj nå barsk uten karsk', "Det bli fart på rattet me smårips'n i krattet",
  'Du e itj mannj før du har lært dæ å bannj', 'Det bli itj no darlings me klær fra Carlings',
  'Det e itj no fæst om du itj havne i fyllearrest', 'Du e litt femi om du hete Kurt Remi',
  "Det bli itj no sphænk ut'n bil me sænk", 'Du e itj nå tess hvis du ikke kjøre mokasiner te dress',
  'Du e itj sprø uten fuggelfrø', "Du blir itj knall ut'n kjall", 'E itj orntli vors om du itj må reng røde kors',
  'Du treng itj nå mus hvis du kjøre trailer med grus', 'Ska du ha dametække må du dra brække',
  'Det e litt flaut om du itj kan å braut', "Når du har sopp på taska e det på tide å få'n vaska",
  "Det e itj no tess ut'n grilldress", 'Du e heit når du e småfeit', 'E du søring e du itj verdt ein femtiøring',
  'Du e verdig om du får stå mens du sjer på RBK', "Du e itj klar før du får'n hard av å sjå ein ainna kar bar",
  "Du e itj kar hves du itj får'n hard", 'Du blir itj snasen uten skrå opp nasen',
  "Du sjer berre svin hves du itj' dunke bensin", "Du får itj no skreppa ut'n ein pris under leppa",
  "Det blir itj' mus uten siestabrus", "Bruke du trus kan du glømm å få dæ mus",
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

function pubLatLng(p: Pub): [number, number] { return [p.lat, p.lng]; }
const DEMO_FALLBACK_EMAIL = 'demo@tdt.local'

type AppCoreProps = {
  apiIdentityKey: string
  displayEmail: string
  pictureUrl?: string | null
  headerActions: ReactNode
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
  const [quizAnswer, setQuizAnswer] = useState('')
  const [golarPolyline, setGolarPolyline] = useState<[number, number][]>([])

  // Onboarding State
  const [onboardingOpened, setOnboardingOpened] = useState(false)

  const currentPubIdx = useMemo(() => {
    if (!route || !state || !state.current_pub) return 0
    return Math.max(0, route.pubs.findIndex((p) => p.name === state.current_pub))
  }, [route, state])

  const currentRouteName = useMemo(() => routes.find((r) => r.id === routeId)?.name || '', [routes, routeId])

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

        // Trigger onboarding if user is new or hasn't joined a route
        if (!me.route_id || !me.nickname || me.nickname === me.email) {
            setOnboardingOpened(true)
        }

        if (me.route_id) {
          const [r, s] = await Promise.all([api.route(), api.state()])
          if (!mounted) return
          setRoute(r); setState(s);
        }
      })
      .catch((e) => { notifications.show({ color: 'red', title: 'Error', message: String(e) }) })
    return () => { mounted = false }
  }, [apiIdentityKey])

  const currentCenter: [number, number] = useMemo(() => {
    if (!route || !state) return [59.9351816485413, 10.780315299805943]
    const pub = route.pubs.find((p) => p.name === state.current_pub) ?? route.pubs[0]
    return pubLatLng(pub)
  }, [route, state])

  async function refreshStateAndStats() {
    const [s, st, c] = await Promise.all([api.state(), api.stats(), api.chat()])
    setState(s); setStats(st); setChat(c.messages || [])
  }

  const onNext = async () => { await api.next(); await refreshStateAndStats(); }
  const onReset = async () => { await api.reset(); await refreshStateAndStats(); }
  const onPostChat = async () => {
    if (!chatDraft.trim()) return;
    await api.chatPost(chatDraft.trim()); setChatDraft(''); await refreshStateAndStats();
  }

  const joinSelectedRoute = async () => {
    if (!routeJoinDraft) return;
    await api.routesJoin({ route_id: routeJoinDraft });
    const [me, r, s] = await Promise.all([api.me(), api.route(), api.state()]);
    setRouteId(me.route_id || ''); setRoute(r); setState(s);
    await refreshStateAndStats();
  }

  const handleOnboarding = async () => {
      if (!nicknameDraft.trim() || !routeJoinDraft) {
          notifications.show({ color: 'red', message: 'Please set a nickname and pick a route!' });
          return;
      }
      try {
          await api.meUpdate(nicknameDraft.trim());
          await api.routesJoin({ route_id: routeJoinDraft });
          const [me, r, s] = await Promise.all([api.me(), api.route(), api.state()]);
          setNickname(me.nickname || '');
          setRouteId(me.route_id || '');
          setRoute(r);
          setState(s);
          setOnboardingOpened(false);
          notifications.show({ color: 'green', title: 'Welcome!', message: 'You are ready to go!' });
      } catch (e) {
          notifications.show({ color: 'red', message: 'Failed to initialize profile' });
      }
  }

  const extStats = stats as (StatsResponse & { quiz_stats?: QuizStat[], users?: UserMapState[] }) | null

  return (
    <AppShell header={{ height: 50 }} padding="xs">
      {/* Onboarding Modal */}
      <Modal
        opened={onboardingOpened}
        onClose={() => {}}
        withCloseButton={false}
        closeOnClickOutside={false}
        title="Welcome to the Pub Crawl!"
        centered
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">First, let's get you set up so you can see your friends on the map.</Text>
          <TextInput
            label="Your Nickname"
            placeholder="e.g. BeerMaster3000"
            value={nicknameDraft}
            onChange={(e) => setNicknameDraft(e.currentTarget.value)}
            required
          />
          <Select
            label="Choose your Route"
            placeholder="Select route"
            data={routes.map((r) => ({ value: r.id, label: r.name }))}
            value={routeJoinDraft}
            onChange={(val) => setRouteJoinDraft(val || '')}
            required
          />
          <Button fullWidth color="yellow" onClick={handleOnboarding}>Start Crawling!</Button>
        </Stack>
      </Modal>

      <AppShell.Header>
        <Container h="100%" size="sm" px="xs" style={{ display: 'flex', alignItems: 'center' }}>
          <Group justify="space-between" w="100%" wrap="nowrap">
            <Title order={4}>Pub Crawl</Title>
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
            </Tabs.List>

            <Tabs.Panel value="Kart" pt="xs">
              <Stack gap="xs">
                <Card withBorder p={0} style={{ overflow: 'hidden', borderRadius: '8px' }}>
                  <div style={{ width: '100%', height: 'calc(100vh - 250px)', minHeight: '350px' }}>
                    <MapContainer key={routeId || 'base-map'} style={{ width: '100%', height: '100%' }} {...({ center: currentCenter, zoom: 18 } as any)}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <RecenterMap center={currentCenter} zoom={18} />
                      {route?.polyline?.length ? <Polyline positions={route.polyline} pathOptions={{ color: 'blue', weight: 6 }} /> : null}
                      {route?.pubs.map((p) => (
                        <Marker key={p.name} position={pubLatLng(p)}>
                          <Tooltip permanent>{p.name}</Tooltip>
                        </Marker>
                      ))}
                      {extStats?.users?.map((u) => {
                          const pub = route?.pubs.find(p => p.name === u.current_pub);
                          if (!pub) return null;
                          const pos: [number, number] = [pub.lat + (Math.random()-0.5)*0.00015, pub.lng + (Math.random()-0.5)*0.00015];
                          return (
                              <Marker key={u.nickname} position={pos} icon={createAvatarDivIcon(u.picture_url)}>
                                  <Tooltip permanent direction="top" offset={[0, -10]}><Text size="xs" fw={700}>{u.nickname}</Text></Tooltip>
                              </Marker>
                          );
                      })}
                    </MapContainer>
                  </div>
                </Card>
                <Progress value={PROGRESS_STEPS[currentPubIdx] || 10} color="green" radius="xl" size="lg" />
                <Group grow gap="xs">
                  <Button onClick={onNext} color="green">Next Bar</Button>
                  <Button variant="light" onClick={() => notifications.show({ title: 'Vits', message: JOKES_MILD[Math.floor(Math.random() * JOKES_MILD.length)] })}>Vits</Button>
                </Group>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="Stats" pt="xs">
                <Stack gap="xs">
                    <Group grow gap="xs">
                        <Card withBorder padding="xs"><Text c="dimmed" size="xs">Users</Text><Title order={4}>{stats?.user_count ?? 0}</Title></Card>
                        <Card withBorder padding="xs"><Text c="dimmed" size="xs">Beer KOM</Text><Title order={4}>{stats?.beer_kom ?? 'Anonym'}</Title></Card>
                        <Card withBorder padding="xs"><Text c="dimmed" size="xs">Liters</Text><Title order={4}>{stats?.total_liters ?? 0}</Title></Card>
                    </Group>
                    <Card withBorder padding="xs">
                        <Title order={5} mb="xs">Liter per bar</Title>
                        <div style={{ height: 350 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={stats?.liters_per_bar ?? []} layout="vertical"><CartesianGrid strokeDasharray="3 3"/><XAxis type="number"/><YAxis type="category" dataKey="bar" width={100} tick={{fontSize: 10}}/><RTooltip/><Bar dataKey="liters" fill="#f1c40f"/></BarChart></ResponsiveContainer></div>
                    </Card>
                </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="Post" pt="xs">
                <Stack gap="xs">
                    <Card withBorder padding="xs"><Text c="dimmed" size="xs">Current pub</Text><Text fw={700}>{state?.current_pub ?? 'N/A'}</Text></Card>
                    <Group grow gap="xs">
                        <Button color="yellow" onClick={() => onDrink('beer', 0.5, '0.5 L')}>0.5L</Button>
                        <Button color="yellow" onClick={() => onDrink('beer', 0.33, '0.33 L')}>0.33L</Button>
                    </Group>
                </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="Chat" pt="xs">
                <Stack gap="xs">
                    <Card withBorder padding="xs" style={{ maxHeight: 300, overflow: 'auto' }}>
                        <Stack gap="xs">{chat.map((m, i) => <Box key={i} p="xs" bg="yellow.1" style={{ borderRadius: 4 }}><Text fw={700} size="xs">{m.nickname}</Text><Text size="xs">{m.message}</Text></Box>)}</Stack>
                    </Card>
                    <Textarea placeholder="Shoot" value={chatDraft} onChange={(e) => setChatDraft(e.currentTarget.value)} />
                    <Button onClick={onPostChat}>Send</Button>
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
    const id = (user.email ?? user.sub ?? '').trim();
    setApiUserIdentity(() => id);
  }, [isAuthenticated, user])

  if (isLoading) return <Center h="100vh"><Loader /></Center>
  if (!isAuthenticated || !user) return <Center h="100vh"><Button onClick={() => void loginWithRedirect()}>Log in</Button></Center>

  return <AppCore apiIdentityKey={user.email ?? user.sub ?? ''} displayEmail={user.email ?? ''} pictureUrl={user.picture} headerActions={<Button size="xs" variant="light" onClick={() => void logout({ logoutParams: { returnTo: window.location.origin } })}>Logout</Button>} />
}

function AppDemoMode() {
  const [email, setEmail] = useState(() => getUserEmail())
  useEffect(() => {
    setApiUserIdentity(() => email || DEMO_FALLBACK_EMAIL)
  }, [email])

  return (
    <AppCore
      apiIdentityKey={email || DEMO_FALLBACK_EMAIL}
      displayEmail={email || ''}
      pictureUrl={null}
      headerActions={
        <Group gap={4} wrap="nowrap">
          <Select size="xs" w={120} data={DEMO_USERS.map(u => ({ value: u, label: u }))} value={email} onChange={(val) => { setEmail(val || ''); setUserEmail(val || ''); }} searchable />
        </Group>
      }
    />
  )
}

export default function App() {
  const auth0Ready = Boolean(import.meta.env.VITE_AUTH0_DOMAIN && import.meta.env.VITE_AUTH0_CLIENT_ID)
  return auth0Ready ? <AppAuth0Mode /> : <AppDemoMode />
}