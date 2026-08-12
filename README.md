# ZenDocs (NotesV2) — refactored file structure

This is a structural refactor of the original single-file `index.html`
(previously ~21,200 lines, ~1.4 MB). **No feature was removed and no
behaviour was intentionally changed** — this was a mechanical split plus
dead-code cleanup, verified by re-running the app before and after the
change and diffing the results. See "What changed" below for the exact,
narrow set of edits that were necessary to make the split work.

## New structure

```
index.html                 — markup only, plus <link>/<script src> tags
css/styles.css              — the app's CSS (previously an inline <style> block)
js/
  01-core-firebase-editor.js            — Firebase init, app state, Quill setup, routing,
                                           note CRUD, export (Word/PDF/Text/Markdown), search
  02-tags-graph-daily-planner.js        — #tags/[[wiki-links]]/backlinks/graph, daily notes,
                                           calendar, kanban, canvas
  03-media-status-home-focus-pwa.js     — image insert, status bar, home dashboard, offline
                                           reminder, pinned notes, sidebar/accent, focus mode,
                                           study mode, PWA install
  04-eisenhower-downloads-patch1.js     — Eisenhower matrix, app downloads, calendar quick-view,
                                           due-date notifications, Pomodoro, read-aloud, backup
  05-production-patches-2.js            — trash, encrypted vault, reference panel, publish as
                                           webpage, markdown/CSV import, templates, menu cleanup
  06-auth-header-guest.js               — sign-in/sign-up screen, unified header toolbar,
                                           shared/guest note view
  07-locked-notes-capture-stats.js      — locked notes, quick capture, command palette, writing
                                           stats, autosave/undo rewrite
  08-header-fixes-connections.js        — header + sidebar fixes, read-first mode, automatic
                                           connections & tag suggestions
  09-notes-qa-timeline-voice-trackers.js— "ask your notes", timeline/daily review, voice
                                           capture, trackers ("the grid") core
  10-trackers-companion-consequence.js  — tracker robot companion, consequence engine
  11-transitions-review-shortcuts-meeting.js — screen transitions, daily review, shortcuts,
                                           meeting mode
  12-weather-alerts-init.js             — live weather/sky ambience, auto day/night theme,
                                           final app init calls
manifest.json, sw.js, logo.svg, icon-*.png, apple-touch-icon.png  — unchanged
```

The 12 JS files are loaded with plain `<script src="./js/...">` tags, in
the same order the code used to run in, so execution order — and
therefore behaviour — is identical to the original single `<script>`
block. They are **not** ES modules, on purpose: this app relies on
old-style shared globals (see below), and GitHub Pages needs no build
step either way.

The files are grouped roughly by the version banners already present in
the original code's comments (`V3`, `V4.1`, `V5.2`, …) — that history is
preserved in each file's contents, it's just organised now instead of
being one continuous scroll.

## What changed (and why it was necessary)

1. **Dead code removed.** ~1,500 lines across 19 blocks that were
   entirely commented out (old, superseded implementations left behind
   after later patches replaced them — e.g. an old guest-view panel, an
   old idle-save routine, an entire disabled "V9.7 motion & effects"
   feature) were deleted. Every removed block was 100% inert — comment
   lines can't execute — so this is a pure cleanup with zero behaviour
   change. It was verified with a line-by-line diff against the
   original showing the only removed lines were `//`-commented ones.

2. **21 variables changed from `const`/`let` to `var`.** This is the one
   change required to make the split actually work, and it's worth
   explaining: in the original single `<script>` block, top-level
   `const`/`let` (e.g. `state`, `els`, `ZD_FEATURES`, `auth`, `db`, …)
   were visible to *all* the code because it was all one script. Splitting
   into separate `<script src>` files exposed a quirk of the language —
   `const`/`let` at the top level of a *classic* script are scoped to
   that one script tag and don't cross to another `<script>` tag, while
   `var` and `function` declarations do (they attach to `window`). The
   fix was to change exactly the declarations that other files needed to
   see from `const`/`let` to `var` — same value, same object, just
   visible across files the way it already implicitly was before. This
   was found by parsing the code and cross-checking every top-level
   `const`/`let`/`class` name against every file for usage outside its
   own declaring file, then verified by loading the app in a headless
   browser before and after and diffing the console output — the fix
   made the two runs produce byte-identical output. Nothing else about
   these variables changed.

3. **CSS mostly extracted, with one deliberate exception.** The large
   `<style>` block that had no `id` (root theme variables, layout,
   toolbar, modals, etc.) moved into `css/styles.css`. The two small
   loading-screen `<style id="zd-load-style">` / `<style id="zl-style">`
   blocks were **kept inline** in `index.html`, in their original
   position and order — the app looks up `#zd-load-style` with
   `getElementById` at boot and rewrites its contents to match your
   saved theme/accent color before the loading screen paints, which only
   works for a live inline `<style>` element, not a linked stylesheet.
   Moving it would have silently broken that theming.

4. **`sw.js` cache bumped from v4 to v5** and the precache list now
   includes `css/styles.css` and the 12 `js/*.js` files (previously it
   only listed `index.html` itself). Without this, a browser that had
   already installed the old service worker would keep serving the old
   single-file shell to returning visitors after you deploy this
   update. The one dead, never-registered `push` event listener that was
   commented out in `sw.js` was also removed for the same reason as #1.

## How this was verified

The refactor wasn't just "looks right" — it was tested:

- Every JS file parses independently and the 12 files concatenate back
  to byte-identical content as the cleaned single script (minus the
  intentionally removed dead comments).
- Every element `id=` referenced anywhere in the code was cross-checked
  between the original and the new structure; the only differences are
  the ones explained in #1 above (ids that only existed inside the
  removed dead code).
- The app was loaded in a real headless browser (Firebase + Quill
  vendored locally so it could run without live internet access in the
  test sandbox) for both the original single file and the new split
  version, and the resulting console output, thrown errors, and a
  screenshot were compared — they matched exactly (the only diff was a
  log timestamp).

## A couple of things worth knowing before you deploy

- **The Firebase config in `js/01-core-firebase-editor.js` contains an
  API key** (`firebaseConfig.apiKey`, plus your Firebase project id).
  This was already public in your original `index.html` — Firebase web
  API keys are meant to be client-visible and aren't a secret by
  themselves — but it's worth double-checking your Firestore/Auth
  security rules are what actually protects your data, since anyone can
  read this key out of your deployed site's source.
- On GitHub Pages, this all works as static files with no build step —
  just push the contents of this folder to your Pages branch/`docs`
  folder. `manifest.json`'s icon paths are relative, so they'll keep
  working from a subpath too (e.g. `username.github.io/NotesV2/`).
- "Lighter/faster" here mainly means: the browser no longer has to parse
  ~1,500 lines of inert comments on every load, and because the code is
  now split into cacheable files, editing one feature in the future only
  invalidates that one file (both in your browser's HTTP cache and in
  the service worker's precache) instead of the whole 1.4 MB blob. It's
  not a rewrite for raw performance (no minification/bundling was done,
  since that would obscure the very thing you asked for — readable,
  separated files for future edits) — if you later want a build step
  (minify + bundle for production, keep the split source for
  development), that's a reasonable next step but a separate decision.
