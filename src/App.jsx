import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'gameflow-decisions'
const REMOVED_KEY = 'gameflow-removed-games'
const OFFSET_KEY = 'gameflow-wikidata-offset'
const SYNC_DONE_KEY = 'gameflow-wikidata-complete'
const UNKNOWN_YEAR = '__unknown__'

const games = [
  { id: 'elden-ring', title: 'Elden Ring', genre: 'Action RPG', releaseDate: '2022-02-25', platforms: ['PC', 'Xbox', 'PlayStation'], hours: '100+ hrs', color: 'ember', badge: 'Must play', description: 'A vast, mysterious world built for getting lost in.' },
  { id: 'hades-ii', title: 'Hades II', genre: 'Roguelike', releaseDate: '2025-09-25', platforms: ['PC', 'Xbox', 'PlayStation', 'Switch'], hours: '40 hrs', color: 'violet', badge: 'New release', description: 'Fight, die, and grow stronger in the underworld.' },
  { id: 'baldurs-gate-3', title: "Baldur's Gate 3", genre: 'RPG', releaseDate: '2023-08-03', platforms: ['PC', 'Xbox', 'PlayStation'], hours: '120+ hrs', color: 'gold', badge: 'Critics pick', description: 'Your choices shape a story with no two playthroughs alike.' },
  { id: 'zelda-totk', title: 'Zelda: Tears of the Kingdom', genre: 'Adventure', releaseDate: '2023-05-12', platforms: ['Switch'], hours: '80 hrs', color: 'sky', badge: 'Nintendo exclusive', description: 'Build, explore, and uncover the secrets above and below Hyrule.' },
  { id: 'forza-horizon-5', title: 'Forza Horizon 5', genre: 'Racing', releaseDate: '2021-11-05', platforms: ['PC', 'Xbox'], hours: '60 hrs', color: 'lime', badge: 'Open world', description: 'Your ultimate horizon awaits in the vibrant landscapes of Mexico.' },
  { id: 'god-of-war-ragnarok', title: 'God of War Ragnarök', genre: 'Action adventure', releaseDate: '2022-11-09', platforms: ['PC', 'PlayStation'], hours: '25 hrs', color: 'ice', badge: 'Story rich', description: 'Face the end of the gods with Kratos and Atreus.' },
  { id: 'stardew-valley', title: 'Stardew Valley', genre: 'Simulation', releaseDate: '2016-02-26', platforms: ['PC', 'Xbox', 'PlayStation', 'Switch'], hours: '50+ hrs', color: 'sunset', badge: 'Cozy', description: 'Turn an overgrown field into a home, one day at a time.' },
  { id: 'cyberpunk-2077', title: 'Cyberpunk 2077', genre: 'Action RPG', releaseDate: '2020-12-10', platforms: ['PC', 'Xbox', 'PlayStation'], hours: '70 hrs', color: 'neon', badge: 'Immersive', description: 'Become an urban mercenary in the city of dreams.' },
  { id: 'animal-crossing', title: 'Animal Crossing: New Horizons', genre: 'Life sim', releaseDate: '2020-03-20', platforms: ['Switch'], hours: '100+ hrs', color: 'coral', badge: 'Relaxing', description: 'Build your perfect island getaway at your own pace.' },
  { id: 'monster-hunter-wilds', title: 'Monster Hunter Wilds', genre: 'Action RPG', releaseDate: '2025-02-28', platforms: ['PC', 'Xbox', 'PlayStation'], hours: '80 hrs', color: 'forest', badge: 'Co-op ready', description: 'Hunt colossal creatures in a world that changes with the seasons.' },
  { id: 'hollow-knight', title: 'Hollow Knight', genre: 'Metroidvania', releaseDate: '2017-02-24', platforms: ['PC', 'Xbox', 'PlayStation', 'Switch'], hours: '35 hrs', color: 'midnight', badge: 'Indie gem', description: 'Descend into a haunting, beautifully hand-drawn kingdom.' },
  { id: 'marvel-rivals', title: 'Marvel Rivals', genre: 'Hero shooter', releaseDate: '2024-12-06', platforms: ['PC', 'Xbox', 'PlayStation'], hours: '∞ replayable', color: 'crimson', badge: 'Multiplayer', description: 'Assemble an all-star Marvel squad and battle it out.' },
]

const platformIcons = { PC: '▣', Xbox: '✕', PlayStation: '△', Switch: '▰' }
const artwork = ['ember', 'violet', 'gold', 'sky', 'lime', 'ice', 'sunset', 'neon', 'coral', 'forest', 'midnight', 'crimson']

const normalizeTitle = (title) => title.toLowerCase().replace(/[^a-z0-9]/g, '')
const formatReleaseDate = (value) => {
  if (!value) return 'Release date unknown'
  const date = new Date(typeof value === 'number' ? value * 1000 : value)
  return Number.isNaN(date.getTime()) ? 'Release date unknown' : `Released ${date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`
}
const releaseYear = (value) => {
  if (!value) return ''
  const date = new Date(typeof value === 'number' ? value * 1000 : value)
  return Number.isNaN(date.getTime()) ? '' : String(date.getFullYear())
}
const mapPlatform = (name) => {
  const value = name.toLowerCase()
  if (value.includes('pc') || value.includes('windows') || value.includes('linux') || value.includes('mac')) return 'PC'
  if (value.includes('xbox one') || value.includes('xbox series')) return 'Xbox'
  if (value.includes('playstation 4') || value.includes('playstation 5') || value === 'ps4' || value === 'ps5') return 'PlayStation'
  if (value.includes('switch')) return 'Switch'
  return null
}
const mergeGames = (existing, incoming) => {
  const merged = new Map(existing.map((game) => [normalizeTitle(game.title), { ...game }]))
  incoming.forEach((game) => {
    if (!game.title) return
    const key = normalizeTitle(game.title)
    const prior = merged.get(key)
    merged.set(key, {
      ...(prior || {}),
      ...game,
      id: prior?.id || game.id || key,
      platforms: [...new Set([...(prior?.platforms || []), ...(game.platforms || [])])],
      color: prior?.color || game.color || artwork[merged.size % artwork.length],
      badge: prior?.badge || game.badge || 'Imported',
      description: game.description || prior?.description || 'A game ready for your next adventure.',
    })
  })
  return [...merged.values()]
}

const parseImport = (text) => {
  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : parsed.games || []
  } catch {
    const [header, ...rows] = text.trim().split(/\r?\n/)
    const columns = header.split(',').map((item) => item.trim().toLowerCase())
    return rows.map((row) => {
      const values = row.split(',').map((item) => item.trim())
      const item = Object.fromEntries(columns.map((column, index) => [column, values[index] || '']))
      return { ...item, platforms: (item.platforms || '').split('|').map(mapPlatform).filter(Boolean) }
    })
  }
}

const fetchWikidataBatch = async (offset, signal) => {
  const query = `SELECT ?game ?gameLabel ?platformLabel WHERE {
    ?game wdt:P31/wdt:P279* wd:Q7889.
    ?game wdt:P400 ?platform.
    ?platform rdfs:label ?platformLabel.
    FILTER(LANG(?platformLabel) = "en")
    FILTER(REGEX(?platformLabel, "PC|Windows|Linux|Mac|Xbox One|Xbox Series|PlayStation 4|PlayStation 5|PS4|PS5|Nintendo Switch", "i"))
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  } ORDER BY ?game LIMIT 500 OFFSET ${offset}`
  const response = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`, {
    headers: { Accept: 'application/sparql-results+json' },
    signal,
  })
  if (!response.ok) throw new Error(`Wikidata returned ${response.status}`)
  const data = await response.json()
  const grouped = new Map()
  data.results.bindings.forEach((record) => {
    const title = record.gameLabel?.value
    if (!title || title.startsWith('Q')) return
    const key = normalizeTitle(title)
    const current = grouped.get(key) || { id: `wikidata-${key}`, title, platforms: [], badge: 'Wikidata import' }
    const platform = mapPlatform(record.platformLabel?.value || '')
    if (platform) current.platforms.push(platform)
    grouped.set(key, current)
  })
  return [...grouped.values()]
}

function App() {
  const [catalog, setCatalog] = useState(() => {
    return games
  })
  const [decisions, setDecisions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
    } catch {
      return {}
    }
  })
  const [removedGames, setRemovedGames] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(REMOVED_KEY)) || {}
    } catch {
      return {}
    }
  })
  const [activeTab, setActiveTab] = useState('discover')
  const [filter, setFilter] = useState('All')
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef({ startX: 0, startY: 0, x: 0, y: 0, active: false })
  const cardRef = useRef(null)
  const animationFrameRef = useRef(0)
  const [showFilters, setShowFilters] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importStatus, setImportStatus] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [importOffset, setImportOffset] = useState(() => Number(localStorage.getItem(OFFSET_KEY) || 0))
  const [removeYear, setRemoveYear] = useState('')
  const [removeGenre, setRemoveGenre] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(decisions))
  }, [decisions])
  useEffect(() => {
    localStorage.setItem(REMOVED_KEY, JSON.stringify(removedGames))
  }, [removedGames])
  useEffect(() => {
    localStorage.setItem(OFFSET_KEY, String(importOffset))
  }, [importOffset])

  useEffect(() => {
    let cancelled = false
    const loadPublishedCatalog = async () => {
      try {
        const root = import.meta.env.BASE_URL
        const indexResponse = await fetch(`${root}catalog/index.json`, { cache: 'no-store' })
        if (!indexResponse.ok) throw new Error(`Catalog index returned ${indexResponse.status}`)
        const index = await indexResponse.json()
        for (const [chunkIndex, chunk] of index.chunks.entries()) {
          const response = await fetch(`${root}catalog/${chunk}`, { cache: 'no-store' })
          if (!response.ok) throw new Error(`Catalog chunk returned ${response.status}`)
          const chunkGames = await response.json()
          if (!cancelled) {
            setImportStatus(`Loading catalog chunk ${chunkIndex + 1} of ${index.chunks.length}`)
            setCatalog((current) => mergeGames(current, chunkGames).filter((game) => !removedGames[game.id]))
          }
        }
        if (!cancelled) {
          setImportStatus(`Loaded ${index.count.toLocaleString()} games from the latest catalog.`)
        }
      } catch (error) {
        if (!cancelled) setImportStatus(`Catalog update unavailable: ${error.message}`)
      }
    }
    loadPublishedCatalog()
    return () => { cancelled = true }
  }, [removedGames])

  const currentGames = useMemo(() => {
    const undecided = catalog.filter((game) => !decisions[game.id])
    if (filter === 'All') return undecided
    return undecided.filter((game) => game.platforms.includes(filter))
  }, [catalog, decisions, filter])

  const likedGames = catalog.filter((game) => decisions[game.id] === 'liked')
  const playedGames = catalog.filter((game) => decisions[game.id] === 'played')
  const declinedGames = catalog.filter((game) => decisions[game.id] === 'skipped')
  const currentGame = currentGames[0]
  const removedCount = Object.keys(removedGames).length
  const exploredCount = Object.keys(decisions).length + removedCount
  const progress = Math.round((exploredCount / (catalog.length + removedCount)) * 100)

  const addImportedGames = (incoming) => {
    const normalized = incoming.map((game, index) => ({
      ...game,
      title: game.title || game.name,
      id: game.id || normalizeTitle(game.title || game.name || `imported-${index}`),
      platforms: Array.isArray(game.platforms) ? game.platforms.map((item) => typeof item === 'string' ? mapPlatform(item) || item : mapPlatform(item.name || '')).filter(Boolean) : [],
      genre: game.genre || game.genres?.[0]?.name || 'Game',
      releaseDate: game.releaseDate || game.release_date || game.released || game.first_release_date || (game.year ? String(game.year) : ''),
      hours: game.hours || (game.playtime ? `${game.playtime} hrs` : 'Unknown length'),
    }))
    setCatalog((current) => mergeGames(current, normalized))
    setImportStatus(`Added ${normalized.filter((game) => game.title).length} games. Duplicates were merged.`)
  }

  const importFile = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => addImportedGames(parseImport(String(reader.result)))
    reader.readAsText(file)
    event.target.value = ''
  }

  const importWikidata = async () => {
    setIsImporting(true)
    const batchSize = 500
    setImportStatus(`Importing games ${importOffset + 1}-${importOffset + batchSize} from the free Wikidata catalog...`)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 30000)
    try {
      const imported = await fetchWikidataBatch(importOffset, controller.signal)
      if (!imported.length) {
        localStorage.setItem(SYNC_DONE_KEY, 'true')
        setImportStatus('The free source has no more matching games in this catalog.')
      } else {
        addImportedGames(imported)
        setImportOffset((offset) => offset + batchSize)
        setImportStatus(`Imported ${imported.length} games. Automatic sync will continue on the next app load.`)
      }
    } catch (error) {
      setImportStatus(error.name === 'AbortError' ? 'Wikidata took too long to respond. Try again in a moment.' : `Import failed: ${error.message}`)
    } finally {
      window.clearTimeout(timeout)
      setIsImporting(false)
    }

  }

  const importRawg = async () => {
    const key = import.meta.env.VITE_RAWG_API_KEY
    if (!key) {
      setImportStatus('Add VITE_RAWG_API_KEY to .env.local to enable the RAWG import.')
      return
    }

    setIsImporting(true)
    setImportStatus('Importing the first 10,000 RAWG results...')
    try {
      const pages = await Promise.all(Array.from({ length: 10 }, (_, index) => fetch(`https://api.rawg.io/api/games?key=${key}&page=${index + 1}&page_size=100&ordering=-added`).then((response) => {
        if (!response.ok) throw new Error(`RAWG returned ${response.status}`)
        return response.json()
      })))
      addImportedGames(pages.flatMap((page) => page.results.map((game) => ({
        id: `rawg-${game.id}`, title: game.name, genre: game.genres?.[0]?.name || 'Game', releaseDate: game.released || '', description: game.description_raw?.slice(0, 150), platforms: game.platforms?.map((item) => item.platform.name).map(mapPlatform).filter(Boolean) || [], badge: 'RAWG import', hours: game.playtime ? `${game.playtime} hrs` : 'Unknown length',
      }))))
    } catch (error) {
      setImportStatus(`Import failed: ${error.message}`)
    } finally {
      setIsImporting(false)
    }
  }

  const decide = (decision) => {
    if (!currentGame) return
    if (cardRef.current) cardRef.current.style.transform = 'translate3d(0, 0, 0) rotate(0deg)'
    setDecisions((current) => ({ ...current, [currentGame.id]: decision }))
    dragRef.current = { startX: 0, startY: 0, x: 0, y: 0, active: false }
    setIsDragging(false)
  }

  const handlePointerDown = (event) => {
    dragRef.current = { startX: event.clientX, startY: event.clientY, x: 0, y: 0, active: true }
    setIsDragging(true)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event) => {
    const drag = dragRef.current
    if (!drag.active) return
    drag.x = event.clientX - drag.startX
    drag.y = event.clientY - drag.startY
    if (!animationFrameRef.current) {
      animationFrameRef.current = window.requestAnimationFrame(() => {
        const rotation = Math.max(-12, Math.min(12, dragRef.current.x / 14))
        if (cardRef.current) cardRef.current.style.transform = `translate3d(${dragRef.current.x}px, ${dragRef.current.y}px, 0) rotate(${rotation}deg)`
        animationFrameRef.current = 0
      })
    }
  }

  const handlePointerUp = () => {
    const drag = dragRef.current
    if (!drag.active) return
    if (drag.x > 90) decide('liked')
    else if (drag.x < -90) decide('skipped')
    else if (drag.y < -90) decide('played')
    else {
      dragRef.current = { startX: 0, startY: 0, x: 0, y: 0, active: false }
      setIsDragging(false)
      if (cardRef.current) cardRef.current.style.transform = 'translate3d(0, 0, 0) rotate(0deg)'
    }
  }

  const resetGame = (id) => setDecisions((current) => {
    const next = { ...current }
    delete next[id]
    return next
  })
  const recategorizeGame = (id, decision) => {
    if (decision === 'discover') {
      resetGame(id)
      setActiveTab('discover')
      return
    }
    setDecisions((current) => ({ ...current, [id]: decision }))
  }

  const genres = [...new Set(catalog.map((game) => game.genre).filter(Boolean))].sort()
  const knownYears = [...new Set(catalog.map((game) => releaseYear(game.releaseDate)).filter(Boolean))].sort((a, b) => Number(b) - Number(a))
  const hasUnknownYears = catalog.some((game) => !releaseYear(game.releaseDate))
  const removableGames = catalog.filter((game) => (!removeYear || (removeYear === UNKNOWN_YEAR ? !releaseYear(game.releaseDate) : releaseYear(game.releaseDate) === removeYear)) && (!removeGenre || game.genre === removeGenre))
  const removeGames = () => {
    if ((!removeYear && !removeGenre) || !removableGames.length) return
    const nextRemoved = { ...removedGames }
    removableGames.forEach((game) => { nextRemoved[game.id] = true })
    setRemovedGames(nextRemoved)
    setCatalog((current) => current.filter((game) => !nextRemoved[game.id]))
    setDecisions((current) => {
      const next = { ...current }
      removableGames.forEach((game) => { delete next[game.id] })
      return next
    })
    setImportStatus(`Removed ${removableGames.length.toLocaleString()} games from this device.`)
  }

  const visibleLibrary = activeTab === 'liked' ? likedGames : activeTab === 'played' ? playedGames : declinedGames
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">✦</span><span>gameflow</span></div>
        <button className="avatar" aria-label="Profile">JD</button>
      </header>

      <section className="hero-copy">
        <p className="eyebrow">YOUR NEXT ADVENTURE</p>
        <h1>Find your next<br /><em>favorite game.</em></h1>
        <p className="subcopy">Swipe through a world of games. Your choices, your pace.</p>
      </section>

      <nav className="tabs" aria-label="Game views">
        <button className={activeTab === 'discover' ? 'active' : ''} onClick={() => setActiveTab('discover')}>Discover <span>{currentGames.length}</span></button>
        <button className={activeTab === 'liked' ? 'active' : ''} onClick={() => setActiveTab('liked')}>Want to play <span>{likedGames.length}</span></button>
        <button className={activeTab === 'played' ? 'active' : ''} onClick={() => setActiveTab('played')}>Played <span>{playedGames.length}</span></button>
        <button className={activeTab === 'declined' ? 'active' : ''} onClick={() => setActiveTab('declined')}>Declined <span>{declinedGames.length}</span></button>
      </nav>

      {activeTab === 'discover' ? (
        <>
          <div className="toolbar">
            <div><strong>{progress}% explored · {catalog.length.toLocaleString()} games</strong><span className="progress-track"><span style={{ width: `${Math.max(progress, 3)}%` }} /></span></div>
            <div className="toolbar-actions"><button className={`filter-button ${showImport ? 'selected' : ''}`} onClick={() => setShowImport(!showImport)}>＋ <span>Import</span></button><button className={`filter-button ${showFilters ? 'selected' : ''}`} onClick={() => setShowFilters(!showFilters)}>☷ <span>Filters</span></button></div>
          </div>
          {showImport && <div className="import-panel">
            <strong>Grow your library</strong>
            <p>Free import scope: PC plus Xbox One/Series, PlayStation 4/5, and Nintendo Switch. Wii, DS, and older console-only games are excluded. Repeat the import to load the next batch. Titles are merged and platforms combined.</p>
            <div className="import-actions"><label className="import-file">Choose JSON / CSV<input type="file" accept=".json,.csv,application/json,text/csv" onChange={importFile} /></label><button className="free-source-button" onClick={importWikidata} disabled={isImporting}>{isImporting ? 'Importing…' : `Import free batch ${importOffset / 500 + 1}`}</button><button className="rawg-button" onClick={importRawg} disabled={isImporting}>Import from RAWG</button></div>
            <small>CSV columns: title, genre, releaseDate, platforms (separate platforms with |), hours, description. Wikidata coverage is community-maintained, so no free source can guarantee every game ever released.</small>
            {importStatus && <div className="import-status">{importStatus}</div>}
          </div>}
          {showFilters && <div className="filters">
            <div className="filter-group"><span>Platforms</span>{['All', 'PC', 'Xbox', 'PlayStation', 'Switch'].map((item) => <button key={item} className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)}>{item === 'All' ? 'All platforms' : `${platformIcons[item]} ${item}`}</button>)}</div>
            <div className="bulk-remove"><strong>Bulk remove</strong><span>Remove matching games from this device, including games with unknown release dates.</span><div className="bulk-remove-controls"><select aria-label="Release year to remove" value={removeYear} onChange={(event) => setRemoveYear(event.target.value)}><option value="">Any release year</option>{knownYears.map((year) => <option key={year} value={year}>{year}</option>)}{hasUnknownYears && <option value={UNKNOWN_YEAR}>Unknown release year</option>}</select><select aria-label="Category to remove" value={removeGenre} onChange={(event) => setRemoveGenre(event.target.value)}><option value="">Any category</option>{genres.map((genre) => <option key={genre} value={genre}>{genre}</option>)}</select><button className="remove-button" onClick={removeGames} disabled={(!removeYear && !removeGenre) || !removableGames.length}>Remove {removableGames.length.toLocaleString()}</button></div></div>
          </div>}

          <section className="deck" aria-label="Game discovery deck">
            {currentGame ? (
              <>
                <div className="swipe-hint left">← skip</div>
                <div className="swipe-hint right">want to play →</div>
                <article ref={cardRef} className={`game-card ${currentGame.color} ${isDragging ? 'dragging' : ''}`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>
                  <div className="card-art">{currentGame.image ? <img className="game-image" src={currentGame.image} alt="" decoding="async" onError={(event) => { event.currentTarget.style.display = 'none' }} /> : <><span className="art-orb orb-one" /><span className="art-orb orb-two" /><span className="art-symbol">✦</span></>}<span className="card-badge">{currentGame.badge}</span></div>
                  <div className="card-content">
                    <div className="card-meta"><span>{currentGame.genre}</span><span>·</span><span>{formatReleaseDate(currentGame.releaseDate)}</span><span>·</span><span>{currentGame.hours}</span></div>
                    <h2>{currentGame.title}</h2>
                    <p className="card-description">{currentGame.description}</p>
                    <div className="platforms">{currentGame.platforms.map((platform) => <span key={platform} title={platform}>{platformIcons[platform]} {platform}</span>)}</div>
                  </div>
                </article>
                <div className="gesture-guide"><span><b>←</b> Skip</span><span><b>↑</b> Played</span><span><b>→</b> Want it</span></div>
                <div className="action-row"><button className="action skip" onClick={() => decide('skipped')} aria-label="Skip game">×</button><button className="action played" onClick={() => decide('played')} aria-label="Mark as played">↑</button><button className="action like" onClick={() => decide('liked')} aria-label="Add to want to play">♥</button></div>
              </>
            ) : (
              <div className="empty-state"><div className="empty-icon">✦</div><h2>You're all caught up</h2><p>We saved your choices. Clear a filter or revisit your library to keep exploring.</p><button onClick={() => setDecisions({})}>Start over</button></div>
            )}
          </section>
        </>
      ) : (
        <section className="library">
          <div className="library-heading"><div><p className="eyebrow">{activeTab === 'liked' ? 'YOUR SHORTLIST' : activeTab === 'played' ? 'YOUR HISTORY' : 'YOUR DECLINED GAMES'}</p><h2>{activeTab === 'liked' ? 'Want to play' : activeTab === 'played' ? 'Played games' : 'Declined'}</h2></div><span className="count-pill">{visibleLibrary.length} games</span></div>
          {visibleLibrary.length ? <div className="library-grid">{visibleLibrary.map((game) => <article className="library-card" key={game.id}><div className={`mini-art ${game.color}`}>{game.image ? <img className="mini-image" src={game.image} alt="" loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = 'none' }} /> : <span>✦</span>}</div><div className="library-info"><h3>{game.title}</h3><p>{game.genre} · {formatReleaseDate(game.releaseDate)} · {game.hours}</p><div className="platforms">{game.platforms.map((platform) => <span key={platform}>{platformIcons[platform]}</span>)}</div></div><label className="recategorize"><span className="sr-only">Move {game.title} to</span><select value={decisions[game.id]} onChange={(event) => recategorizeGame(game.id, event.target.value)}><option value="liked">Want to play</option><option value="played">Played</option><option value="skipped">Declined</option><option value="discover">Discover</option></select></label></article>)}</div> : <div className="empty-state small"><div className="empty-icon">{activeTab === 'declined' ? '×' : '♡'}</div><h2>No games here yet</h2><p>{activeTab === 'declined' ? 'Games you swipe left will be collected here.' : 'Swipe right on games you want to remember.'}</p><button onClick={() => setActiveTab('discover')}>Discover games</button></div>}
        </section>
      )}

      <footer><span><i className="status-dot" /> Saved on this device</span><span>PC · Xbox · PlayStation · Switch</span></footer>
    </main>
  )
}

export default App
