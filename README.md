# Nodalis

**Your knowledge, connected.** A local-first, offline-capable notes + canvas + knowledge-graph PWA inspired by the best of **Obsidian** and **AFFiNE** — built from real, public user feedback, not just guesswork.

No build step. No backend. No account. Just static files you can push to GitHub Pages today.

---

## v1.1 changelog (this update)

Requested fixes and additions, all shipped:

- **Fixed:** notes could not be created inside a folder. Folders now support arbitrary nesting; right-click (or long-press) any folder for "New note here" / "New subfolder" / rename / delete, and any note for pin / duplicate / move / rename / delete.
- **Guided tour** on first run, covering every major feature, replayable anytime from the new **Help (?) icon** — which also has a full in-app feature manual and keyboard-shortcut reference.
- **Data safety, made close to foolproof:** connecting a local folder now auto-writes every change to disk (debounced), not just on manual "push"; both GitHub and local-folder modes auto-restore on startup so a linked vault "comes back exactly as you left it"; a persistent backup-health indicator in the sidebar gently flags local-only vaults instead of giving false confidence.
- **New features:** pinned notes, a recent-notes list, word count + reading time, Obsidian-style callout/admonition blocks (`> [!warning] ...`), paste/drop image attachments straight into a note, duplicate note, move-to-folder, and a native Share sheet for notes and for the app itself.
- **Four selectable theme styles:** the default Nodalis look (now a warm **paper-white** light mode instead of stark white), a **Notion-style** workspace, a monochrome **"Nothing"-inspired** theme (dot-matrix font, red accent, dot-grid background), and an **iOS-26-style frosted Glass** theme (clear or slight-black shade) — each with light/dark or shade variants where it makes sense, plus an **"auto by time of day"** option alongside the system-preference auto mode.
- **Full customization panel:** accent color (presets or any custom color), editor font, information density, and the ability to hide any of Graph / Canvas / Database / the Tags or Canvases sidebar tabs — so the app can shrink down to only what you actually use.
- **Motion & polish pass:** smooth view transitions, button micro-interactions, a sync-in-progress spinner, and small celebratory animations for milestones like finishing the tour or connecting a backup for the first time.

---

## Why "Nodalis"?

Short, easy to say, evokes the node-graph at the heart of the app (your notes are *nodes*, your links are the *connections between them*). It's a coined word, not a dictionary word, which makes clean domain names realistically obtainable — unlike single common words (`slate`, `quartz`, `loom`...), which are almost always already registered.

**Naming shortlist checked during research** (no exact product/domain collision found in web searches at time of writing — always do a final registrar + trademark check yourself before buying):

| Name | Vibe | Notes |
|---|---|---|
| **Nodalis** (used here) | Nodes / network of thought | Clean in searches; `nodalis.com` / `nodalis.in` looked unregistered |
| Loomstone | Weaving + permanence | Clean in searches; "Loom" the video app is a different category/spelling |
| Cindrium | Ember / spark of an idea | Clean in searches |
| Wrenfold | Small tool that builds structure | Clean in searches |

A domain search engine result is **not** the same as a registrar confirming availability — before you buy, check the actual registrar (Namecheap, Google Domains successor, etc.) and run a quick trademark search for your country.

---

## What real user feedback shaped this build

Pulled from Reddit threads, Product Hunt reviews, Hacker News discussions, and note-taking dev blogs while researching this project:

**Complaints about Obsidian → how Nodalis responds**
- *"No built-in database/kanban/project tools, have to use plugins"* → built-in **Database view** (table + kanban, driven by simple YAML frontmatter properties), no plugin required.
- *"Mobile app feels clunky, sync is confusing and often paid"* → fully responsive mobile/tablet/desktop layouts out of the box, plus a **free** GitHub-repo sync option alongside local-folder and manual export.
- *"Steep learning curve, plugin overload, too much configuration before it's useful"* → works immediately with zero setup; advanced stuff (sync, templates) lives in one Settings screen instead of a plugin marketplace.
- *"No native cloud storage, must self-manage backups"* → one-click **Export vault to .zip** and three selectable sync modes.

**Complaints about AFFiNE → how Nodalis responds**
- *"Missing backlinks and block-level references"* → full **linked + unlinked backlinks** panel and an interactive **graph view**, both first-class citizens.
- *"Weak search, no tags system"* → **#tags** parsed anywhere in text, a dedicated tag browser, and a fuzzy command palette / quick switcher (`Ctrl/Cmd+K`, `Ctrl/Cmd+O`) that searches note titles instantly.
- *"Feature disparity between desktop and mobile"* → single codebase, same feature set, responsive layout — there is no separate "mobile app" with fewer features.
- *"Text/UI too small, eye strain"* → mobile editor uses 16px+ base font and generous spacing by default.

**Shared complaint (both apps) → response**
- *"No self-hosting / no real interoperability"* → your data is always plain markdown files, on your device, exportable at any time — there's no proprietary format to get locked into.

Honest scope note: full parity with either app (real-time multiplayer collaboration, an AI assistant, a plugin marketplace, OCR, audio/video indexing) is a multi-year engineering effort for their teams and is **out of scope** for this build. See [Roadmap](#roadmap--honest-limitations) below.

---

## Feature list

- **Markdown editor** with live preview, split/edit/preview modes, `[[wikilink]]` autocomplete, `#tag` support, Obsidian-style `> [!note]` callout blocks, paste/drop image attachments, word count + reading time, and `Ctrl/Cmd+B`/`I` formatting shortcuts.
- **Nested folders** of any depth: right-click (or long-press) a folder for "New note here" / "New subfolder" / rename / delete, and a note for pin / duplicate / move to another folder / rename / delete.
- **Pinned & recent notes** for one-click access to what you're actively working on.
- **Backlinks panel**: linked mentions *and* unlinked mentions (like Obsidian), plus an outline (headings) and a properties viewer.
- **Knowledge graph**: zero-dependency force-directed graph, canvas-rendered, pan/zoom, drag nodes, click to open, pinch-to-zoom on touch.
- **Infinite canvas / whiteboard** ("Edgeless mode"): pannable/zoomable board with linked-note cards, sticky notes, and shapes — drag, resize, delete.
- **Database view**: turn any folder or tag into a sortable table or a drag-and-drop kanban board, grouped by any YAML frontmatter property.
- **Command palette** (`Ctrl/Cmd+K`) and **quick switcher** (`Ctrl/Cmd+O`) with fuzzy matching over commands and note titles.
- **Daily notes** and a small **template system** (`{{date}}`, `{{time}}`, `{{title}}` placeholders).
- **Guided tour + Help center**: a first-run walkthrough of every feature (replayable anytime from the `?` icon), a full in-app feature manual, and a keyboard-shortcuts reference.
- **Share**: send a note (or the app itself) via your device's native share sheet, with clipboard-copy as a fallback.
- **Three interchangeable sync modes**, switchable anytime from Settings, with **continuous auto-backup** and **auto-restore on startup**:
  1. **Local-only** — everything stays in this browser; back up manually with Export/Import.
  2. **GitHub repo sync** — push/pull your notes as real `.md` files in a GitHub repo you own, using a personal access token. No server required.
  3. **Local folder (File System Access API)** — point at a real folder on disk (Chrome/Edge desktop); every change writes to it automatically, and it's the same folder that reloads on your next visit.
  A backup-health indicator in the sidebar nudges local-only vaults to connect one of the above once there's real content worth protecting.
- **Four theme styles** — Nodalis (default, warm paper-white light / dark), Notion-style, monochrome "Nothing"-inspired (vendored dot-matrix font), and frosted Glass (iOS-26-style, clear or slight-black shade) — each with **auto (system)** or **auto (time of day)** light/dark switching where applicable.
- **Full customization panel**: accent color (presets + custom picker), editor font, information density, and per-feature visibility toggles (hide Graph/Canvas/Database or sidebar tabs you don't use).
- **Full PWA**: installable, works offline (service worker precaches the entire app shell), custom app icon, manifest shortcuts for "New note" / "Daily note" / "Graph view".
- **Responsive design**: dedicated layouts for desktop (3-pane), tablet (overlay sidebar/panel), and mobile (bottom navigation + slide-over sheets) — verified with automated tests, see [Testing](#testing).
- Zero required external dependencies at runtime — the only vendored assets are [JSZip](https://stuk.github.io/jszip/) (MIT) and the [DotGothic16](https://github.com/fontworks-fonts/DotGothic16) font (SIL OFL), both bundled locally so everything works fully offline.

---

## Quick start (just open it)

Because this is a static app with no build step, you can run it locally with anything that serves static files:

```bash
# Option A — Python (usually preinstalled)
python3 -m http.server 8080

# Option B — Node
npx serve .
```

Then open `http://localhost:8080`.

## Deploying to GitHub Pages

1. Create a new GitHub repository and push this entire folder to its `main` branch (this repo already includes `.nojekyll`, which is required so GitHub Pages serves the `_nodalis` folder names inside exported zips and doesn't run Jekyll processing over the app files).
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to "Deploy from a branch", branch `main`, folder `/ (root)`.
4. Save. GitHub will give you a URL like `https://<your-username>.github.io/<repo-name>/`.
5. Open it — Nodalis works immediately, and after the first visit it's fully installable and works offline (try airplane mode after the first load).

If you'd rather use a custom domain, add a `CNAME` file with your domain, and configure the DNS records GitHub's docs specify for Pages.

## Setting up sync (optional)

Open **Settings** inside the app:

- **Local-only** is the default — nothing to configure.
- **GitHub sync**: create a *fine-grained personal access token* at github.com scoped only to **Contents: Read and write** on the one repository you want to use as your vault backend, then fill in owner/repo/branch/folder + the token in Settings. ⚠️ **This token is sensitive** — it's stored only in this browser's local storage and is never sent anywhere except `api.github.com`. Treat it like a password; don't share your exported settings.
- **Local folder sync**: only available in Chrome/Edge on desktop (the File System Access API isn't supported in Safari/Firefox or on mobile yet). Click "Choose folder", grant permission, and your vault reads/writes real `.md` files there.

You can switch between all three modes at any time — nothing is destructive, and Export/Import always works as a manual fallback.

## Architecture

```
index.html            App shell markup
manifest.webmanifest  PWA manifest
sw.js                 Service worker (offline cache-first + stale-while-revalidate)
css/                  variables → base → layout → components → themes → customization → motion → responsive
js/
  db.js               IndexedDB wrapper
  state.js            In-memory store + pub/sub event bus + note/folder/link model
  markdown.js          Zero-dependency markdown renderer + frontmatter/tag/callout parser
  layout-manager.js    Responsive panel show/hide, view switching, toasts, celebration bursts
  sidebar.js            Nested file tree, pinned/recent notes, tags, canvases list
  editor.js / preview.js  Markdown editing + live rendering, image attachments, word count
  backlinks.js           Backlinks / outline / properties panel
  graph.js               Force-directed knowledge graph (canvas)
  canvas.js               Infinite whiteboard / edgeless mode
  database-view.js        Table + kanban views
  command-palette.js       Ctrl+K palette, Ctrl+O quick switcher, shortcuts
  templates.js / daily-notes.js
  settings.js              Settings screen (appearance, sync, customization, templates, data, share, about)
  theme.js                 Theme style + light/dark/auto(system/time) resolution
  customization.js         Accent color, editor font, density, feature visibility
  tour.js                  First-run + replayable guided tour
  help.js                  Help center: tour replay, feature manual, shortcuts
  auto-backup.js           Continuous local-folder backup, auto-restore, backup-health indicator
  sync/github-sync.js      GitHub REST API push/pull
  sync/fs-sync.js          File System Access API push/pull
  sync/export-import.js    Zip export/import (JSZip, vendored)
vendor/jszip.min.js    Vendored dependency (offline-safe, no CDN)
vendor/fonts/          DotGothic16 (SIL OFL) — used by the "Nothing" theme
icons/                 App icon (SVG source + generated PNGs)
tests/
  e2e.spec.mjs               Core smoke test across mobile/tablet/desktop
  feature-regression.spec.mjs  Tour, help, folders, pin/duplicate, callouts, themes, customization
```

Everything is plain ES modules loaded directly by the browser (`<script type="module">`) — there is no bundler, no `node_modules` required to run the app itself. `package.json`'s dependencies are dev-only, for running the automated tests.

## Testing

Two Playwright suites load the app on a real static file server (mirroring how GitHub Pages serves it):

- **`e2e.spec.mjs`** exercises every major view at three breakpoints — **mobile (390×844), tablet (834×1194), desktop (1440×900)**: command palette, note creation, wikilink + tag rendering, graph view, canvas cards, the database table, and the settings screen with all three sync options visible. It also verifies the service worker activates and the app shell still loads with the network fully disabled.
- **`feature-regression.spec.mjs`** covers the second-pass feature set: the first-run tour actually appearing and completing, the help center, nested-folder note creation (with a direct IndexedDB check that the bug is really fixed), pin/duplicate, callout rendering, word count, all four theme styles applying correctly, density/font customization, and per-feature visibility toggles.

```bash
npm install       # installs playwright + serve-handler (dev-only)
npm test          # runs tests/e2e.spec.mjs
node tests/feature-regression.spec.mjs
```

At the time of shipping, both suites together pass **54/54 checks** with zero console errors, across all three breakpoints, all four theme styles, and light/dark modes.

## Roadmap / honest limitations

Nodalis deliberately does **not** attempt to be 100% feature-identical to Obsidian or AFFiNE — some of what they offer requires a hosted backend or years of dedicated engineering:

- No real-time multiplayer collaboration (would require a hosted sync server; GitHub Pages can't run one).
- No built-in AI assistant.
- No plugin marketplace / third-party plugin API (the codebase is small and readable enough to fork and extend directly instead).
- No OCR, audio/video transcript indexing, or semantic ("search by meaning") search — both Obsidian and AFFiNE lack true semantic search too, per the research behind this build.
- Kanban/table views are driven by simple YAML frontmatter properties, not a full relational database engine.
- The GitHub sync mode currently uses last-write-wins (no three-way merge); for true concurrent multi-device editing, pull before you edit.

These are reasonable follow-up milestones once the core (this build) is validated with real daily use — which is the fastest way to find out which of the above actually matter to your workflow before investing in them.

## License

MIT — see `LICENSE`. Do whatever you like with it.
