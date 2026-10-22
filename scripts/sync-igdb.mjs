import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'

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

const normalizeTitle = (title) => title.toLowerCase().replace(/[^a-z0-9]/g, '')
const mapPlatform = (name) => {
  const value = name.toLowerCase()
  if (value.includes('pc') || value.includes('windows') || value.includes('linux') || value.includes('mac')) return 'PC'
  if (value.includes('xbox one') || value.includes('series')) return 'Xbox'
  if (value.includes('playstation 4') || value.includes('playstation 5')) return 'PlayStation'
  if (value.includes('switch')) return 'Switch'
  return null
}

const targetPlatforms = [
  { id: 6, name: 'PC' },
  { id: 48, name: 'PlayStation 4' },
  { id: 167, name: 'PlayStation 5' },
  { id: 49, name: 'Xbox One' },
  { id: 169, name: 'Xbox Series' },
  { id: 130, name: 'Switch' },
]

const fetchPage = async (platformId, lastId) => {
  const query = `fields name,summary,cover.url,genres.name,platforms.name,first_release_date,category,parent_game;
  where platforms = (${platformId}) & id > ${lastId};
  sort id asc; limit 500;`
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: { 'Client-ID': clientId, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'text/plain' },
      body: query,
    })
    if (response.ok) return response.json()
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 5) throw new Error(`IGDB returned ${response.status}`)
    await new Promise((resolve) => setTimeout(resolve, attempt * 5000))
  }
}

const sourceById = new Map()
for (const platform of targetPlatforms) {
  let lastId = 0
  let pageCount = 0
  while (true) {
    const page = await fetchPage(platform.id, lastId)
    page.filter((item) => {
      const category = item.category ?? 0
      const allowedCategory = [0, 2, 4, 8, 9, 10].includes(category)
      const platforms = item.platforms?.map((itemPlatform) => mapPlatform(itemPlatform.name)).filter(Boolean) || []
      const title = item.name?.toLowerCase() || ''
      const cosmeticOnly = /(costume|skin|outfit|cosmetic|soundtrack|avatar|currency|wallpaper|artbook|season pass|bundle|pack)\b/.test(title)
      return allowedCategory && !cosmeticOnly && platforms.length > 0
    }).forEach((item) => sourceById.set(item.id, item))
    if (page.length < 500) break
    lastId = page[page.length - 1].id
    pageCount += 1
    if (pageCount % 10 === 0) console.log(`Scanned ${platform.name}: ${pageCount * 500} records; ${sourceById.size} unique matches.`)
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
}
const source = [...sourceById.values()]

if (!source.length) throw new Error('IGDB returned no matching games; existing catalog was not replaced')

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

await mkdir('public/catalog', { recursive: true })
for (const file of await readdir('public/catalog')) await rm(`public/catalog/${file}`)
await rm('public/catalog.json', { force: true })
const catalog = [...merged.values()]
const chunkSize = 10000
const chunks = []
for (let index = 0; index < catalog.length; index += chunkSize) {
  const filename = `chunk-${String(index / chunkSize).padStart(4, '0')}.json`
  await writeFile(`public/catalog/${filename}`, `${JSON.stringify(catalog.slice(index, index + chunkSize))}\n`)
  chunks.push(filename)
}
await writeFile('public/catalog/index.json', `${JSON.stringify({ version: new Date().toISOString(), count: catalog.length, chunks })}\n`)
console.log(`IGDB sync complete: ${merged.size} unique games from ${source.length} matching records in ${chunks.length} catalog chunks.`)
