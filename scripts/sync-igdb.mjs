import { mkdir, writeFile } from 'node:fs/promises'

const clientId = process.env.TWITCH_CLIENT_ID
const clientSecret = process.env.TWITCH_CLIENT_SECRET
if (!clientId || !clientSecret) throw new Error('Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET GitHub secret')

const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }),
})
if (!tokenResponse.ok) throw new Error(`Twitch authentication failed: ${tokenResponse.status}`)
const { access_token: accessToken } = await tokenResponse.json()

const fetchPage = async (lastId) => {
  const query = `fields name,summary,cover.url,genres.name,platforms.name,first_release_date;
  where platforms.id = (3,6,14,48,49,130,167,169)
    & category = (0,2,4,8,9,10)
    & id > ${lastId};
  sort id asc; limit 500;`
  const response = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: { 'Client-ID': clientId, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'text/plain' },
    body: query,
  })
  if (!response.ok) throw new Error(`IGDB returned ${response.status}`)
  return response.json()
}
const source = []
let lastId = 0
while (true) {
  const page = await fetchPage(lastId)
  source.push(...page)
  if (page.length < 500) break
  lastId = page[page.length - 1].id
}

const normalizeTitle = (title) => title.toLowerCase().replace(/[^a-z0-9]/g, '')
const mapPlatform = (name) => {
  const value = name.toLowerCase()
  if (value.includes('pc') || value.includes('windows') || value.includes('linux') || value.includes('mac')) return 'PC'
  if (value.includes('xbox one') || value.includes('series')) return 'Xbox'
  if (value.includes('playstation 4') || value.includes('playstation 5')) return 'PlayStation'
  if (value.includes('switch')) return 'Switch'
  return null
}
const merged = new Map()
for (const item of source) {
  const game = {
  id: `igdb-${item.id}`,
  title: item.name,
  genre: item.genres?.[0]?.name || 'Game',
  hours: 'Unknown length',
  description: item.summary || 'A game ready for your next adventure.',
  badge: 'IGDB catalog',
  image: item.cover?.url ? `https:${item.cover.url.replace('t_thumb', 't_cover_big')}` : '',
  platforms: item.platforms?.map((platform) => mapPlatform(platform.name)).filter(Boolean) || [],
  }
  if (!game.title) continue
  const key = normalizeTitle(game.title)
  const previous = merged.get(key)
  merged.set(key, {
    ...(previous || {}),
    ...game,
    id: previous?.id || game.id,
    platforms: [...new Set([...(previous?.platforms || []), ...(game.platforms || [])])],
    image: game.image || previous?.image || '',
    description: game.description !== 'A game ready for your next adventure.' ? game.description : previous?.description,
  })
}

await mkdir('public', { recursive: true })
await writeFile('public/catalog.json', `${JSON.stringify([...merged.values()], null, 2)}\n`)
console.log(`IGDB sync complete: ${merged.size} unique games.`)
