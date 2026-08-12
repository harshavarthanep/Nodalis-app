# ZenDocz — single-file build

This is the single-file build: one `index.html` with all of ZenDocz's own
HTML/CSS/JS inlined (Quill, the Firebase SDK, and Tailwind still load from
their CDNs, same as the modular build — see the main README for why).

Before deploying, replace the Firebase config near the top of the inlined
script (search for "REPLACE BEFORE LAUNCH") with your own project's config.

This file is **generated** from the modular build (`../NotesV2/`) by
`../NotesV2/tools/build_single_file.js`. If you edit the modular version
later, regenerate this file rather than hand-editing it directly — run
`node tools/build_single_file.js` from inside the `NotesV2` folder.

See `../NotesV2/README.md` for the full write-up: the dual local/cloud
storage architecture, monetization setup, what was tested, and known
limitations.
