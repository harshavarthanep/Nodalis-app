# Nodalis apps — Windows, Android, iPhone

Everything here is built automatically by GitHub from the same `index.html`
that runs your website. You never edit two copies: update `index.html`,
run the build, and all apps get the update.

## What is in this folder

| Path | What it is |
|---|---|
| `../.github/workflows/build-apps.yml` | The robot that builds the apps on GitHub's computers |
| `desktop/` | Windows app (Electron). Makes `Nodalis-Setup.exe` and `Nodalis-Portable.exe` |
| `mobile/` | Android + iOS app (Capacitor). Makes `Nodalis.apk` |
| `shared/native-bridge.js` | Small fixes so the web app behaves like a real app (saving files, share, links, notifications). Does nothing on the website |
| `shared/prepare-www.mjs` | Copies `index.html` into each app and adds the bridge |
| `../download.html` | Ready-made download page for your website |

## One-time setup (about 5 minutes)

1. **Upload these files to the repo.** Unzip `Nodalis-apps-files.zip` and drag
   everything (`.github`, `native`, `download.html`, `index.html`) into
   https://github.com/harshavarthanep/Nodalis-apps → **Add file → Upload files**
   → Commit. The `.github` folder starts with a dot, so if your file manager
   hides it, turn on "show hidden files" first.

2. **Add the Android signing key** (from the separate PRIVATE zip — never upload
   that zip to the repo). In the repo: **Settings → Secrets and variables →
   Actions → New repository secret**, three times:

   | Name | Value |
   |---|---|
   | `ANDROID_KEYSTORE_BASE64` | whole content of `KEYSTORE_BASE64.txt` |
   | `ANDROID_KEYSTORE_PASSWORD` | content of `KEYSTORE_PASSWORD.txt` |
   | `ANDROID_KEY_ALIAS` | `nodalis` |

   Keep a backup of the PRIVATE zip in Google Drive. Android only accepts an
   update if it is signed with the same key, so if this key is lost, users
   must uninstall and reinstall.

## Every release

1. Put the newest Nodalis build in the repo as `index.html` (as you do today).
2. **Actions → Build Nodalis apps → Run workflow**, type a version higher than
   the last one (1.0.0, then 1.0.1, 1.1.0 …) → **Run workflow**.
3. Wait ~10 minutes for the green tick. Files appear at
   https://github.com/harshavarthanep/Nodalis-apps/releases/latest

These links always give the newest version — put them on any website:

- Windows installer: `https://github.com/harshavarthanep/Nodalis-apps/releases/latest/download/Nodalis-Setup.exe`
- Windows portable: `https://github.com/harshavarthanep/Nodalis-apps/releases/latest/download/Nodalis-Portable.exe`
- Android: `https://github.com/harshavarthanep/Nodalis-apps/releases/latest/download/Nodalis.apk`
- Download page: `https://harshavarthanep.github.io/Nodalis-apps/download.html`

## What works where

| Feature | Windows app | Android app | iPhone (Home Screen) |
|---|---|---|---|
| Works offline | ✔ | ✔ | ✔ |
| Notes in a real folder on disk | ✔ | — stored inside the app; use GitHub sync / backup | — same |
| GitHub sync & restore | ✔ | ✔ | ✔ |
| Export / backup files | ✔ save dialog | ✔ saved to Documents/Nodalis + Share | ✔ |
| Reminders | ✔ Windows notifications | ✔ phone notifications (while the app is running) | limited |
| Dictation | — hidden | — hidden | depends on iOS version |
| OCR (reading text from images) | ✔ needs internet the first time | ✔ same | ✔ same |
| Print | ✔ | — use export instead | ✔ |

## Warnings users will see (normal for apps outside the stores)

- **Windows:** "Windows protected your PC" → *More info* → *Run anyway*. This
  goes away only with a paid code-signing certificate.
- **Android:** "Install unknown apps" → allow for Chrome / Files. Goes away only
  if the app is on the Play Store (one-time $25 developer fee; this same APK
  project can be uploaded there).

## iPhone and iPad

Apple does not allow installing apps from a website download — every native
iOS app must come through the App Store (Apple Developer Program, $99/year).
Until then, iPhone users add the website to the Home Screen; it runs
full-screen and offline like an app. When you join the Apple program, the
`mobile/` project already includes iOS (`npx cap add ios`), and it can be
built and sent to the App Store from Xcode or a GitHub macOS runner.

## Changing the app identity

`com.h24creationz.nodalis` is the app ID in `desktop/package.json` and
`mobile/capacitor.config.json`. Keep it forever — changing it makes phones and
PCs treat it as a different app.
