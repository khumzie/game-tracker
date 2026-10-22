import { mkdir, readFile, writeFile } from 'node:fs/promises'

const endpoint = 'https://query.wikidata.org/sparql'
const batchSize = 100
const maxBatches = 1000
const platformPattern = 'PC|Windows|Linux|Mac|Xbox One|Xbox Series|PlayStation 4|PlayStation 5|PS4|PS5|Nintendo Switch'

const normalizeTitle = (title) => title.toLowerCase().replace(/[^a-z0-9]/g, '')
const mapPlatform = (name) => {
  const value = name.toLowerCase()
  if (value.includes('pc') || value.includes('windows') || value.includes('linux') || value.includes('mac')) return 'PC'
  if (value.includes('xbox one') || value.includes('xbox series')) return 'Xbox'
  if (value.includes('playstation 4') || value.includes('playstation 5') || value === 'ps4' || value === 'ps5') return 'PlayStation'
  if (value.includes('switch')) return 'Switch'
  return null
}

const importFreeToGame = async () => {
  const response = await fetch('https://www.freetogame.com/api/games', {
    headers: { 'User-Agent': 'gameflow-catalog-sync/1.0' },
  })
  if (!response.ok) throw new Error(`FreeToGame returned ${response.status}`)
  const source = await response.json()
  return source.map((game) => ({
    id: `freetogame-${game.id}`,
    title: game.title,
    genre: game.genre || 'Game',
    hours: 'Free to play',
    description: game.short_description || 'A free game ready for your next adventure.',
    badge: 'Free to play',
    image: game.thumbnail,
    platforms: [mapPlatform(game.platform)].filter(Boolean),
  }))
}

const queryBatch = async (offset) => {
  const query = `SELECT ?game ?gameLabel ?platformLabel ?image ?description WHERE {
    ?game wdt:P31/wdt:P279* wd:Q7889.
    ?game wdt:P400 ?platform.
    ?platform rdfs:label ?platformLabel.
    FILTER(LANG(?platformLabel) = "en")
    FILTER(REGEX(?platformLabel, "${platformPattern}", "i"))
    OPTIONAL { ?game wdt:P18 ?image. }
    OPTIONAL { ?game schema:description ?description. FILTER(LANG(?description) = "en") }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  } ORDER BY ?game LIMIT ${batchSize} OFFSET ${offset}`
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await fetch(`${endpoint}?query=${encodeURIComponent(query)}&format=json`, {
      headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'gameflow-catalog-sync/1.0' },
    })
    if (response.ok) return response.json()
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 5) {
      throw new Error(`Wikidata returned ${response.status}`)
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 5000))
  }
}

const existing = JSON.parse(await readFile('public/catalog.json', 'utf8').catch(() => '[]'))
const merged = new Map(existing.map((game) => [normalizeTitle(game.title), game]))
const freeToPlayGames = await importFreeToGame()
for (const game of freeToPlayGames) {
  const key = normalizeTitle(game.title)
  merged.set(key, { ...(merged.get(key) || {}), ...game, platforms: [...new Set([...(merged.get(key)?.platforms || []), ...game.platforms])] })
}
let offset = 0
let rows = 0

for (let batch = 0; batch < maxBatches && process.env.SYNC_WIKIDATA !== 'false'; batch += 1) {
  let data
  try {
    data = await queryBatch(offset)
  } catch (error) {
    console.warn(`Optional Wikidata sync stopped: ${error.message}`)
    break
  }
  const bindings = data.results.bindings
  if (!bindings.length) break
  for (const record of bindings) {
    const title = record.gameLabel?.value
    if (!title || title.startsWith('Q')) continue
    const key = normalizeTitle(title)
    const game = merged.get(key) || {
      id: `wikidata-${key}`,
      title,
      genre: 'Game',
      hours: 'Unknown length',
      description: 'A game ready for your next adventure.',
      badge: 'Wikidata catalog',
      platforms: [],
    }
    const platform = mapPlatform(record.platformLabel?.value || '')
    if (platform && !game.platforms.includes(platform)) game.platforms.push(platform)
    if (record.image?.value && !game.image) game.image = record.image.value
    if (record.description?.value && game.description === 'A game ready for your next adventure.') game.description = record.description.value
    merged.set(key, game)
    rows += 1
  }
  offset += batchSize
  if (bindings.length < batchSize) break
  await new Promise((resolve) => setTimeout(resolve, 250))
}

await mkdir('public', { recursive: true })
await writeFile('public/catalog.json', `${JSON.stringify([...merged.values()], null, 2)}\n`)
console.log(`Catalog sync complete: ${merged.size} unique games, ${rows} source rows processed.`)
