Nodalis — single-file build
===========================

Two ways to use this folder.

1. Just open it
   Double-click index.html. That is the entire app — no server, no install,
   no internet. Everything is inlined into that one file.

2. Deploy the folder (recommended)
   Upload all of dist/ to any static host — GitHub Pages, Netlify, S3, a
   folder on your own server. Served over http(s) it becomes a full PWA:
   installable, offline-cached, with a proper icon and app name.

   For GitHub Pages, either publish this folder as the site root, or copy
   its contents into your repository root and enable Pages on that branch.

Files
  index.html             the app (about 1324 KB)
  manifest.webmanifest   name, icons and install metadata
  sw.js                  offline cache
  icons/                 favicon, apple-touch-icon, 192px and 512px icons

Where your notes go
  On Chrome, Edge, Brave, Opera or Arc on a desktop, Nodalis asks for a
  folder on first run and writes every change to plain .md files there.
  Everywhere else it stores notes in the browser and tells you to export
  a backup regularly — it will never claim to be backed up when it is not.

A note on file:// mode
  Opened directly, the browser will not register a service worker and will
  not offer to install the app. Nothing else is affected. Deploy the folder
  if you want those two things.

Generated 2026-08-16 from the modular source by tools/build.mjs.
