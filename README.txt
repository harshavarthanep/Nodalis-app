Nodalis 2.1.0 — single file + PWA
=================================

Everything in this folder is one deployable app.

  index.html            the entire app — HTML, CSS, JavaScript and fonts,
                        in one file, about 1.2 MB
  manifest.webmanifest  name, icons and install metadata
  sw.js                 offline cache
  icons/                favicon, apple-touch, 192, 512, maskable
  README.txt            this file


TWO WAYS TO USE IT
------------------

1. Double-click index.html.
   It runs straight from the file system — no server, no internet. It carries
   an inlined favicon so it still has a tab icon on its own.

2. Upload this whole folder to any static host.
   Then it is a full PWA: real icon, real app name, installable, and it keeps
   working with no connection after the first load.

For GitHub Pages: create a repository, copy these five items into it, push,
then Settings -> Pages -> Deploy from a branch -> main -> / (root).


WHERE YOUR NOTES GO
-------------------

On Chrome, Edge, Brave, Opera or Arc on a desktop, Nodalis asks for a folder
on your disk the first time you open it and writes every change to plain .md
files there — including deletes and renames. Clearing your browser cannot
touch them. Point it at an existing Obsidian vault and your notes come across,
links and all.

Everywhere else (Safari, Firefox, anything on iPhone or iPad) that API does
not exist. Nodalis still works completely, storing notes in the browser, and
it will keep telling you so and nudging you to export a zip. It will never
claim to be backed up when it isn't.


IF YOU WANT TO EDIT IT
----------------------

Use the modular package instead — same app, about forty small readable files,
with the tests and the build script. `npm run build` regenerates this folder
from that source, so the two can never drift apart.
