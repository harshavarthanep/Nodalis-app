# Nodalis

**Your knowledge, connected.** Notes, tasks, an infinite canvas and a graph of how it all
links together — running entirely in your browser, storing plain markdown files on your own
disk, working offline, costing nothing, forever.

No server. No account. No telemetry. No build step to deploy.

---

## Get it running in 60 seconds

**Option A — GitHub Pages (recommended)**

1. Create a repository and copy everything in this folder into it.
2. Push it.
3. Repository → **Settings → Pages** → Source: *Deploy from a branch* → `main` / `/ (root)`.
4. Wait a minute, then open `https://<your-username>.github.io/<repo>/`.

That's the whole deployment. There is nothing to compile and no dependencies to install.

**Option B — the `dist/` folder**

`npm run build` produces a complete, deployable single-file app:

```
dist/
  index.html            the entire app in one file (~1.1 MB)
  manifest.webmanifest  name, icons, install metadata
  sw.js                 offline cache
  icons/                favicon, apple-touch-icon, 192px, 512px, maskable
  README.txt            deployment notes
```

Two ways to use it. **Double-click `dist/index.html`** and it just runs — no server, no
internet; it carries an inlined data-URL favicon so it still has a tab icon on its own.
**Or upload the whole `dist/` folder** to any static host and it becomes a full installable
PWA with a proper icon, app name and offline cache.

**Option C — locally with a server** (needed for the service worker and install prompt)

```bash
npx serve .          # or: python3 -m http.server
```

---

## Which build should I use?

| | `index.html` (modular) | `dist/` (single file + PWA) |
|---|---|---|
| Files | ~40 small ones | 1 HTML + manifest + sw + icons |
| Size | ~1.1 MB total | ~1.2 MB total |
| Works from `file://` | yes | yes |
| Offline after first load | yes | yes |
| Installable as an app | yes | yes, when served from the folder |
| Favicon and app icon | yes | yes — inline *and* as real files |
| Easy to read and edit | yes | not really |
| Good for GitHub Pages | **yes** | also fine |

Both are built from the same source. `npm run build` regenerates the single file from the
modular one, so they can never drift apart.

---

## Where your notes actually live

This is the part worth reading.

**With a folder connected** (Chrome, Edge, Brave, Opera, Arc on desktop) Nodalis writes every
change to a real `.md` file on your disk within about a second — including deletes and
renames. Clearing your browser cache cannot touch it. Put that folder in Dropbox or iCloud and
you have sync. Point it at an existing Obsidian vault and your notes come straight across,
links and all.

```
MyVault/
  Projects/Website redesign.md      ← plain markdown, yours forever
  Daily/2026-08-14.md
  .nodalis/
    canvases/<id>.json
    stickies.json  tasks.json  scratch.json  journal.json  settings.json
    attachments/<id>.png
```

**Without one** (Safari, Firefox, anything on iPhone or iPad) the File System Access API
simply does not exist — Apple does not permit it on iOS in any browser. Nodalis still works
completely, storing notes in the browser, but it will keep telling you so and nudging you to
export a `.zip`. It will never claim to be backed up when it isn't.

**Backups.** Settings → Backup exports everything as a zip: notes as `.md`, plus canvases,
stickies, tasks and attachments. Importing it anywhere restores the lot.

---

## What's in it

**Writing** — full markdown with tables, footnotes, math, callouts (`> [!warning]`), task
lists and syntax-highlighted code. `[[Wikilinks]]` with aliases, heading and block targets.
`![[Embeds]]` that pull one note into another live. `^block-ids` for linking to an exact
paragraph. A `/` block menu, live preview with scroll sync, and image paste or drop.

**Organising** — nested folders with drag and drop, nested `#tags`, YAML frontmatter
properties, pinning, and a fuzzy command palette that reaches every feature in the app.

**Views** — a force-directed knowledge graph (global or two hops around the current note);
an infinite canvas with cards, stickies, shapes, frames, images, freehand ink and connectors
that stay attached; database views as table, kanban board, gallery or calendar driven by your
properties; and full-text search with operators (`tag:`, `folder:`, `is:orphan`, `prop:x=y`,
`"phrases"`, `-exclusions`, `/regex/`).

**Getting things done** — every `- [ ]` in every note gathered into one task list, plus
standalone tasks; an Eisenhower priority matrix that places tasks automatically and remembers
what you drag; a wall of colour-coded sticky notes holding text, checklists or sketches, which
stack when you drop one on another; a scratchpad for thoughts that aren't notes yet; and a
daily review with an honest writing streak and a year heat-map.

**Getting things in and out** — scan a photographed page into a note with OCR; export a note
as `.md`, `.pdf`, `.docx`, `.html`, `.png` or `.jpg`; export the whole vault as a zip.

**Making it yours** — four complete themes (warm paper, Notion, Nothing OS, iOS-26 Liquid
Glass), separate interface and writing fonts, adjustable size, spacing, line width, density
and corner radius, and a shortcut editor where every single command can be rebound. Any
feature you don't use can be switched off entirely and it disappears from the interface.

---

## Keyboard

Every command has a shortcut and every one can be changed in **Settings → Shortcuts**.

| | |
|---|---|
| Command palette | `Ctrl/Cmd + K` |
| Jump to a note | `Ctrl/Cmd + O` |
| Run a command | `Ctrl/Cmd + Shift + P` |
| Search everything | `Ctrl/Cmd + Shift + F` |
| New note | `Ctrl/Cmd + N` |
| Quick capture | `Ctrl/Cmd + Shift + C` |
| Today's daily note | `Ctrl/Cmd + D` |
| Toggle sidebar | `Ctrl/Cmd + B` |
| Graph | `Ctrl/Cmd + G` |
| Block menu | `/` on an empty line |
| Undo a vault action | `Ctrl/Cmd + Shift + Z` |
| All shortcuts | `Ctrl/Cmd + Shift + /` |

---

## Browser support

| | Notes work | Folder on disk | Install as app | OCR |
|---|---|---|---|---|
| Chrome / Edge / Brave / Opera / Arc (desktop) | yes | **yes** | yes | yes |
| Safari (macOS) | yes | no | yes | yes |
| Firefox | yes | no | no | yes |
| iOS / iPadOS (any browser) | yes | no | Add to Home Screen | yes |
| Android Chrome | yes | no | yes | yes |

Where the Liquid Glass theme can't use `backdrop-filter`, it falls back to opaque surfaces
rather than a smeared mess. Where IndexedDB is blocked entirely, the app still runs from
memory and says so loudly rather than pretending to have saved anything.

---

## Development

```bash
npm install          # only needed for the tests and the build script
npm run build        # regenerate the dist/ folder from the modular source
npm test             # 67 checks: desktop, tablet, mobile, stress, degraded storage
npm run test:single  # 69 checks — same suite plus PWA assets, against dist/
npm run verify:pwa   # serve dist/, confirm the service worker caches it offline
npm run check        # all of the above
```

The tests boot a real Chromium at three viewports, exercise every view, stress the app with
600 notes, and simulate the failures that actually bite in production: no IndexedDB at all,
no folder API, and — the one that caused the 2.0.1 fixes — an `indexedDB.open()` whose
callbacks never fire. Screenshots land in `tests/shots/`.

### Layout

```
index.html            the shell — every element the JS attaches to
css/
  tokens.css          type scale, spacing, radii, motion, z-index ladder
  themes.css          the four themes; the only place colour is defined
  base.css            reset plus prose styles for rendered markdown
  layout.css          app shell and panels
  components.css      buttons, fields, menus, modals, toasts
  views.css           editor, graph, canvas, database, tasks, matrix, sticky
  motion.css          every keyframe, plus the boot sequence
  responsive.css      three real layouts, not one with things hidden
js/
  core/               util, bus, db, serialize, vault, store
  ui/                 icons, toast, modal, menu, loader, theme, commands, shortcuts, palette
  features/           one file per feature
  app.js              boot, routing, global commands, error net
tools/build.mjs       concatenates the modular source into the single file
sw.js                 offline cache
```

Modules are plain scripts attaching to one global `NODALIS` namespace — no bundler, and the
app works from `file://` where ES modules would fail on CORS. `js/core/store.js` is the single
source of truth; every mutation goes through it, persists to IndexedDB, queues a write to
disk, emits an event, and records an undo step.

### Adding a feature

1. Write `js/features/thing.js` as an IIFE that attaches `N.thing = { init: ... }`.
2. Register its commands with `N.commands.registerMany([...])` — that alone puts it in the
   palette, the shortcut editor and the mobile More sheet.
3. Add the script tag to `index.html` and the path to `sw.js`.
4. Run `npm run build && npm test`.

---

## Changelog

**2.0.1 — production fixes**

- **Boot could hang forever.** `indexedDB.open()` can return a request whose callbacks never
  fire — WebKit drops requests made early in page load, a blocked upgrade in another tab does
  the same, and hardened privacy modes stall rather than erroring. Nothing in the boot
  sequence had a timeout, so the loader sat on "opening local database" indefinitely.
  Now every open races a 6-second timeout and retries once, every transaction is bounded, and
  every boot stage has its own ceiling with a 20-second watchdog behind all of them.
- **"Skip" left you with a dead shell.** It only hid the animation; boot was still stuck
  behind it, so the visible interface did nothing. Skip now releases whatever boot is waiting
  on — the app is usable about 1.6 seconds later even against a permanently hung database.
- **The notes icon was invisible in light mode.** `--accent` was only ever set by JavaScript,
  so a stalled boot rendered the active toolbar button with no background and
  `--accent-on: #ffffff` text: white on white. Every colour token now has a static CSS
  default, and there is a test that fails if the active icon is ever invisible.
- **The storage indicator said "Checking storage…" forever.** It only updated once the
  interface finished building, which never happened. Bounded boot fixes the cause; the label
  also starts as a neutral "Starting…" now.
- **The single-file build had no favicon or PWA files.** It is now a proper `dist/` folder —
  one self-contained HTML file plus a manifest, a purpose-built service worker and the full
  icon set — so it installs and works offline when deployed, and still runs standalone.
- Onboarding now tells you plainly when storage is broken instead of offering "keep them on
  this device" as though it would work, and a recovery bar offers to retry storage, export,
  or connect a folder.

## Honest limitations

Things Nodalis does **not** do, so you aren't surprised later:

- **No real-time collaboration.** There is no server, so there is nothing to collaborate
  through. Two people editing the same folder over Dropbox will fight.
- **No mobile folder access.** Not a shortcut taken — the API does not exist on iOS.
- **No plugin marketplace.** Features are built in and switchable, not installable.
- **Math renders as styled text**, not typeset LaTeX. Bundling KaTeX would have doubled the
  download for something most notes never use.
- **OCR downloads an engine once** (~3 MB, from a CDN) unless your browser has built-in text
  detection. Everything else works with no network at all, ever.
- **Very large vaults slow down.** Tested comfortably to 600 notes; the graph gets busy well
  before the app gets slow.

---

## Licence

MIT. Do what you like with it.

Fonts: Inter, Space Grotesk, Space Mono and Doto, all SIL Open Font License.
Zip handling: [JSZip](https://stuk.github.io/jszip/) (MIT).
Optional text recognition: [Tesseract.js](https://tesseract.projectnaptha.com/) (Apache 2.0).
