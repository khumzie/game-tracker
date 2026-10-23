# gameflow

gameflow is a mobile-first game tracker PWA. Discover games with a quick swipe:

- Swipe left (or tap `×`) to skip.
- Swipe right (or tap `♥`) to add a game to **Want to play**.
- Swipe up (or tap `↑`) to mark a game as **Played**.
- Use the filters to focus on PC, Xbox, PlayStation, or Switch.
- Revisit saved choices from the **Want to play** and **Played** tabs.
- Review left-swiped games in the **Declined** tab, or use the circular arrow to return any game to Discover.

The catalog starts with a small built-in set, then grows through the **Import** control. The primary import uses Wikidata's public, no-account-needed query service. Its default scope is PC plus Xbox One/Series, PlayStation 4/5, and Nintendo Switch; Wii, DS, and older console-only games are excluded. The repository includes a GitHub Actions workflow that runs the exhaustive free catalog sync daily and can also be started manually. It writes a published `public/catalog.json` file, which the PWA loads automatically on startup. This means the crawl runs on GitHub's server even when the phone app is closed; the app only needs to open later to receive the latest catalog. The workflow scans in reliable 100-row batches with retries until Wikidata has no more matching rows, then deduplicates by title and combines platforms. You can also upload a JSON/CSV export or optionally connect a RAWG API key. Imported games are normalized to one canonical record per title and combine available platforms, so cross-platform games never appear as duplicates.

For GitHub Pages, set the repository's Pages source to **GitHub Actions** and enable **Read and write permissions** for Actions under repository settings. The included deployment workflow publishes the PWA on pushes to `main`.

### Store free IGDB credentials

The complete catalog sync uses IGDB through a free Twitch developer application. Add the credentials here:

1. Open the repository: https://github.com/khumzie/game-tracker
2. Go to **Settings → Secrets and variables → Actions**
3. Select **New repository secret**
4. Create `TWITCH_CLIENT_ID` and paste your client ID
5. Create `TWITCH_CLIENT_SECRET` and paste your client secret
6. Run **Actions → Sync game catalog → Run workflow**

The credentials are only available to the server-side GitHub Action. They are not bundled into the PWA, catalog, or browser. The workflow fetches the broad IGDB stream with ID-cursor pagination, then locally filters for PC, Xbox One/Series, PlayStation 4/5, and Switch. It keeps expansions, remakes, remasters, and definitive/expanded editions, while excluding standalone DLC/add-ons, bundles, mods, episodes, ports, updates, and cosmetic-only records. Cross-platform duplicates are merged and artwork/descriptions retained. The generated catalog is split into 10,000-game JSON chunks so GitHub's 100 MB single-file limit cannot truncate a large result. The PWA loads the index and chunks on startup without putting the full catalog into localStorage. The scheduled job keeps the catalog updated, and each catalog commit automatically redeploys the PWA.

## Importing a large catalog

For a RAWG import, create a `.env.local` file in the project root. This is optional; the Wikidata import does not need a key:

```bash
VITE_RAWG_API_KEY=your_rawg_key
```

Then restart Vite and choose **Import → Import from RAWG**. The importer retrieves 10 pages of 100 games (up to 1,000 records per run), merges duplicates, and retains only the supported platform labels used by the tracker. Repeat the import after RAWG updates or upload your own larger export.

JSON can be an array of records or `{ "games": [...] }`. CSV expects:

```text
title,genre,releaseDate,platforms,hours,description
```

Separate multiple CSV platforms with `|`, for example `PC|Xbox|PlayStation`.

Release dates are shown on discovery and library cards, and can be used with the
Filters panel to bulk-remove games by release year and category/genre. Bulk
removals are saved in `localStorage` on the current device.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

The app includes a web manifest and registers its service worker so it can be added to an iPhone home screen when served over HTTPS.

Artwork uses IGDB's optimized cover transform rather than full-resolution originals. The service worker stores artwork in a separate runtime cache as cards are viewed, so previously seen covers remain available offline without adding hundreds of megabytes to the GitHub repository. New artwork is fetched when online and cached automatically; unvisited covers are not downloaded until needed.

The service worker uses a network-first strategy for the app shell and catalog files, removes obsolete application caches on activation, and checks for updates with browser HTTP caching disabled. This keeps normal refreshes on phones and laptops from becoming stuck on an old deployment; previously viewed artwork remains cached separately for offline use.
