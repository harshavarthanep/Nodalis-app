# ZenDocz

A calm, offline-first workspace for notes, knowledge graphs, boards, canvases, calendars and more — rebuilt from scratch on top of the old "NotesV2 / ZenDocs Pro V3.0" codebase.

This is a **full rewrite**, not a patch. The old app was a single 21,000-line HTML file with a real correctness bug (a leftover, half-deleted loading-screen style that made the login/loading screen flash the wrong theme color) plus a lot of dead code from features being patched over in place instead of edited (a retired auth form still sitting in the DOM, a vault/unlock routine implemented twice, a weather widget implemented twice, hundreds of lines of commented-out old versions of the theme-switch effect). None of that carried over — everything here was re-architected and re-written clean.

## What you got

- **`src/`** — the modular source (this is what you edit / put in GitHub).
- **`dist/ZenDocz.html`** — the single self-contained file, built from `src/` by `build.js`. Open it directly in a browser, no server needed, no build step required to use it.
- **`dist/manifest.json`, `dist/sw.js`, `dist/icon-*.png`** — companion files so you can also host `ZenDocz.html` as a real installable PWA (optional; the single file works fine without them too).
- **`build.js`** — regenerates `dist/ZenDocz.html` from `src/` (`node build.js`). Third-party CDN scripts (fonts, the Quill editor, Firebase) are intentionally left as CDN `<script>` tags rather than vendored inline — that's normal practice and keeps the file a sane size.

## Two ways to use it (chosen at login, per your spec)

**On This Device (Local mode)** — always free, no account.
- Data lives in the browser's IndexedDB, instantly, offline, always.
- Optionally, click "Choose a folder on this device" (Settings, or the login screen) to also mirror the whole workspace into a real folder you pick, as `workspace.json` (+ a rolling backup copy). This uses the File System Access API, supported in Chrome/Edge/Opera on desktop and Android — not in Firefox or Safari, which is a browser limitation, not something ZenDocz can work around. Where it's unsupported, the button is hidden automatically.
- **Any device, any browser**: Settings → "Export backup" downloads one portable `.json` file with everything. "Import backup" on another device (or another browser) brings it all back. This is the universal path and always works, regardless of File System Access support.

**Sync Across Devices (Cloud mode)** — sign in with email/password.
- Backed by Firebase (the same project the old app used — `notes-b4daa` — so if you had existing data there it's untouched and compatible; see "Firebase" below on reusing vs. replacing it).
- Firestore's offline persistence is enabled, so Cloud mode also works with no connection — edits queue locally and flush the moment you're back online.
- The offline indicator pill at the top is accurate for both modes: in Local mode it just says "offline, everything still works"; in Cloud mode it says changes will sync once you reconnect.

Both modes implement the exact same generic storage interface (`core/storage-adapter.js`) — every feature module (notes, kanban, canvas, templates, vault, habits, etc.) calls the same methods regardless of which mode is active. That's what makes "local vs. cloud" a real, safe choice instead of two half-finished code paths, and it's also why Export/Import round-trips cleanly between the two modes if you ever want to move a workspace from one to the other.

## The theme/login bug you flagged — root cause and fix

The old app's bug: a `<style id="zd-load-style">` block for a previous loading-screen design was never deleted when the loading screen was redesigned, and it still applied to the live loading screen via a shared CSS id, forcing a dark background for a moment before the real theme logic (which read a *different*, unused localStorage key, `zdTheme` instead of `theme`) half-corrected it. Result: a visible flash of the wrong theme.

The fix isn't a patch, it's a design constraint: there is now exactly **one** place that resolves the theme (`js/00-bootstrap-theme.js`), it runs synchronously before any stylesheet, and every single screen — loading, login, app — reads the same `html.theme-dark` class and CSS variables. There's no second implementation left to drift out of sync. The login screen also no longer has a dark/light toggle on it at all (which was the "illogical" part you flagged) — flipping themes before you're in a workspace has nothing to preview, so that control now lives only in Settings, once, where it belongs.

## Feature scope (per what you chose to keep)

Kept and rebuilt clean: rich text editor, folders, tags + backlinks + auto-linking, full-text search / command palette (Ctrl-K), trash, Graph view, Kanban, Canvas, Calendar + Daily Notes, Templates, Version History, Encrypted Vault (one consolidated crypto implementation, not two), Note Sharing, Eisenhower Matrix, Pomodoro, Habit Tracker + a local rule-based Coach chatbot, Writing Streaks, Weather, Night Sky ambient screen, and Voice Notes (live transcription).

A few honest scope notes:
- **Weather** and **Voice Notes** are the two features that inherently need a live connection (weather data and most browsers' speech recognition both call out to a service) — everything else is genuinely offline. Both say so plainly in their UI instead of silently failing.
- **Night Sky** is its own screen rather than a global background behind your notes — layering a moving animation behind real writing hurts readability, so it's scoped as a calming destination screen instead.
- **Sharing** is a real public read-only link in Cloud mode (backed by a `shared/{id}` Firestore document — see "Firebase rules" below, you need to add one rule for this to work) and a file-export/import flow in Local mode, since there's no server for a local-only link to point at.
- The old app's Word/PDF export and "publish as static webpage" tool were not ported (Markdown and plain-text export were, and they cover the same core need); this is the one deliberate feature reduction versus the old app, to keep this pass focused — happy to add them back in a follow-up if you want them.

## Firebase

Reusing your existing project (`notes-b4daa`), per your choice. Two things to do on your end before shipping:

1. **API key note**: the config in `js/main.js` (`FIREBASE_CONFIG`) includes your Firebase Web API key. This is normal for a client-side Firebase app (it's not a secret the way a server key is — access is controlled by your Firestore security rules, not by hiding this key) but it's still project-identifying, so don't paste it into public places beyond what's already necessary.
2. **Firestore rule for Sharing**: add a rule allowing public read (and owner-only write) on the top-level `shared` collection, e.g.:
   ```
   match /shared/{shareId} {
     allow read: if true;
     allow write: if request.auth != null;
   }
   ```
   Without this, Sharing links in Cloud mode won't load for recipients.

## Monetization — scaffolded, not active (per your chosen delivery plan)

`js/monetization.config.js` is the single hook point for the paywall pass. Right now `MONETIZATION_ENABLED = false`, so Cloud mode is fully free and unrestricted, and Local mode is never touched by this file at all. Every new Cloud sign-up already records `trialStartedAt` in its profile, so whenever the paywall pass ships, it has real trial data from day one — no migration needed. When you're ready:

1. Set `MONETIZATION_ENABLED = true`.
2. Fill in `PAYMENT_DETAILS` (UPI ID, payee name, bank account details, monthly amount) — **these are sensitive once real**, so keep that file out of a public GitHub repo (private repo, or move it to a server-side config) once it has your real details in it.
3. Build the actual paywall UI/gate against `ZenMonetization.isTrialActive(profile)` — that function is ready, the UI in front of it is the next pass.

## Running it

- **Just open it**: `dist/ZenDocz.html` works by double-clicking it or serving it from any static host (GitHub Pages, Netlify, Vercel, S3, etc.) — no build step needed for end users.
- **Editing**: work in `src/`, then run `node build.js` to regenerate `dist/ZenDocz.html`. `src/index.html` itself is also directly usable during development (serve `src/` with any static server — it needs to be served over `http(s)://` or `file://` with relative paths intact, not opened as a single moved file, since it loads its CSS/JS as separate files).
- **PWA install**: host `dist/ZenDocz.html` alongside `dist/manifest.json`, `dist/sw.js` and the icon PNGs (same folder) for "Add to Home Screen" / desktop install support.

## Testing performed

Automated headless-browser smoke test (`tools/smoke-test.js`, Playwright): boots the built single-file app, completes the Local-mode "Get started" flow, opens every nav view (Home, Notes, Graph, Kanban, Canvas, Calendar, Eisenhower, Pomodoro, Habits, Streaks, Weather, Night Sky, Voice, Templates, Vault, Trash), exercises the command palette, and toggles simulated offline/online — zero uncaught JavaScript errors. Screenshots were also captured at desktop and mobile viewport widths to check responsive layout.

One limitation of the sandbox this was built in: it has no outbound internet access, so the Quill editor script, Google Fonts, and the Firebase SDK (all loaded from CDNs) could not actually be fetched during testing — the app was verified to fail gracefully in that condition (a clear "editor library couldn't load, check your connection" message instead of a crash) rather than verified end-to-end with a real network. Please do a normal click-through on a real connection before shipping — in particular: typing and formatting in the editor, tags/backlinks/auto-linking as you type, Firebase sign-up/sign-in, and the Sharing flow.

## Suggested next steps

1. Click through everything once yourself on a normal internet connection (see the testing caveat above).
2. Add the Firestore rule for `shared/{shareId}` if you want Sharing to work in Cloud mode.
3. When ready to charge: build the paywall UI against `js/monetization.config.js`.
4. Consider Word/PDF export and "publish as webpage" if you want full parity with the old app's export options.
