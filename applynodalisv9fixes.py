#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply-nodalis-v9-fixes.py
=========================

Nodalis v9.

    python3 apply-nodalis-v9-fixes.py index.html

IMPORTANT: this patch writes TWO files.

    index.html   the app, patched in place
    sw.js        NEW, written into the same directory

Upload BOTH to your GitHub Pages repository, side by side. sw.js is small and
it is the only way the web platform allows a notification to carry buttons -
it is what makes Snooze work from the Windows and Android notification itself.
Without it the app still runs and reminders still appear; they just lose their
buttons, and the app now says so instead of pretending.

-------------------------------------------------------------------------------
1.  WHY v8.1 DID NOT FIX THE SETTINGS, AND WHAT WAS ACTUALLY HAPPENING
-------------------------------------------------------------------------------

v8.1 taught the app to READ .nodalis/settings.json, which was genuinely
missing. It then decided whether to use the file by comparing timestamps: take
the folder's copy only if it is newer than this device's. On the one machine
that matters - the freshly reset one - that comparison never came out true.

Measured on a clean profile, before the user had even picked a folder:

    this device's settings stamp   1787757447400
    the folder's real settings      1787757443800   <- 3.6 seconds "older"

    -> the file is judged stale and skipped
    -> and the defaults are then written over it

One line did that, in editor.js, nowhere near anything to do with syncing:

    setMode(N.store.state.settings.editorMode || 'split');
      ...
      N.store.state.settings.editorMode = next;
      N.store.saveSettings();          // unconditional, on every boot

Nothing changed - 'split' was written over 'split' - but saveSettings() stamped
the clock anyway. That was enough to make a brand-new install look newer than
the folder holding the real theme. And because the next write went out to disk,
the customisation was not merely ignored, it was destroyed.

A rule that requires no module anywhere in 40,000 lines to write a setting
before the restore runs is a rule that breaks again next month. So v9 replaces
the design with three independent layers, any one of which is enough:

  1. A DEVICE WITH NO HISTORY HAS NOTHING TO LOSE.  loadAll() now records
     whether there was a settings row in IndexedDB at all - decided after the
     database is read and before a single feature module is constructed. If
     there was none (first run, reset, cleared site data) a restored copy is
     adopted outright, whatever the clocks say. Nothing can get in front of
     that line, so nothing can spoil the answer.

  2. THE CLOCK ONLY MOVES FOR A REAL CHANGE.  saveSettings() fingerprints the
     portable settings before and after the write and stamps only if they
     differ. No-op writes and per-device bookkeeping stop counting. editor.js's
     line is harmless now, and so is the next one like it.

  3. NOTHING WRITES TO THE FOLDER BEFORE THE FOLDER HAS BEEN READ.  Between
     "you picked a folder" and "we read it" sat a permission prompt, a modal
     about existing notes, and a directory walk - seconds of a live app, during
     which any save clobbered the file. That window is now held shut.

And a fourth thing that was simply missing: the folder is now READ AT THE
MOMENT IT IS CONNECTED. Before v9 only pullAll() read settings, and pullAll()
does not run on most routes - connecting from Settings never read them, and
neither did answering "leave my existing notes alone for now" during
onboarding. Even on the route that does pull, the read came after a directory
walk that a large vault can make slow enough to hit the boot timeout.

-------------------------------------------------------------------------------
2.  "EVERYTHING SHOULD BE SAVED" - FOUR THINGS THE FOLDER NEVER HELD
-------------------------------------------------------------------------------

A connected folder was a weaker backup than a GitHub repository. It held
stickies, tasks, scratch, journal, canvases and settings, and not:

  FOLDERS     colour, icon, order, collapsed state - and any folder you made
              but have not put a note in yet, which exists on disk as nothing
              at all. Now .nodalis/folders.json.
  TRASH       trashed notes live in the notes store and deliberately have no
              markdown file, so nothing carried them. A reset emptied your
              trash. Now .nodalis/trash.json - and, since it was missing there
              too, in the GitHub backup as well.
  VERSIONS    history.js has written .nodalis/versions/ since v6 and nothing
              has ever read it back. Reading it would not have been enough
              either: the files were named by note id, and a restore gives
              every note a new id, so id-keyed history could never survive the
              one event it exists for. v9 names them by note PATH and reads
              both shapes.
  VIEW STATE  which folders are collapsed, sidebar width, the recent list. The
              difference between "my app" and "a fresh install with my notes
              in it". Now .nodalis/viewstate.json.

Order matters on the way back in, and is now explicit: settings, folders,
collections, canvases, trash (after notes, so a live note always beats a stale
trash row), versions (matched to notes by path), view state last.

-------------------------------------------------------------------------------
3.  THE SNOOZE BUTTON IN THE WINDOWS / ANDROID NOTIFICATION
-------------------------------------------------------------------------------

"the snooze button coming from windows notification or android notification is
 not working and inside the website it is working"

Both halves were true, with one cause. A notification can only carry BUTTONS if
a service worker shows it:

    new Notification(title, {actions})              actions ignored.
                                                    Throws outright on Android.
    registration.showNotification(title, {actions}) real buttons. Needs sw.js.

remind.js already preferred the second form and app.js already called
register('sw.js') - but a single-file build shipped no sw.js, so it 404'd every
time and the code fell back to the plain constructor. No buttons on Windows;
on Android the constructor throws, so nothing appeared at all. The in-app card
kept working because it is only a toast. That is exactly the asymmetry
reported.

And where a worker DID exist - left over from an earlier deployment - it had
never heard of 'notificationclick'. The buttons were drawn, and pressing them
did nothing: the OS dismissed the notification and no message ever reached the
page. remind.js has always listened for that message. Nothing sent it.

v9 ships sw.js, and every route now lands in one function:

  * a button on the OS notification   -> postMessage -> remind.applyAction()
  * a tap on the notification body    -> same
  * no tab open when it was pressed   -> the worker opens one with
                                         ?ndaction=snooze&ndremind=<id>, which
                                         is carried out and then cleaned out of
                                         the address bar
  * no service worker at all          -> a plain notification whose body is
                                         clickable and does the same thing one
                                         tap later, and Reminders says so
                                         honestly rather than implying buttons
  * Android with no worker            -> the throw is caught and the in-app
                                         card carries the reminder

sw.js also brings real offline use: network first, so a new deployment is never
masked by a stale cache; cache second, so a tunnel does not take the app away.

-------------------------------------------------------------------------------
HOW IT RUNS
-------------------------------------------------------------------------------

  - a timestamped .bak is written beside index.html before anything changes
  - every anchor is located and verified BEFORE a single byte is written; if
    one is missing or ambiguous, nothing is touched at all
  - sw.js is only written once index.html has been patched successfully
  - running it twice is safe: the second run recognises its own work and exits
"""

import io
import os
import re
import shutil
import sys
import time

SENTINEL = 'v9: THE ONE FACT THAT MAKES A RESTORE DECIDABLE'
VERSION = '9.0.0'

EDITS = [
    (
        'version stamp',
        "  N.version = '8.1.0';\n  N.versionName = 'v8.1';\n  N.built = '2026-08-25';",
        "  N.version = '9.0.0';\n  N.versionName = 'v9';\n  N.built = '2026-08-26';",
    ),
    (
        'loadAll records whether this device has settings of its own',
        "    const saved = await db.getSetting('settings', null);\n    if (saved && typeof saved === 'object') {\n      state.settings = U.deepMerge(U.deepClone(DEFAULT_SETTINGS), saved);\n      migrateSettings(state.settings);\n    }",
        '    const saved = await db.getSetting(\'settings\', null);\n    /*\n     * v9: THE ONE FACT THAT MAKES A RESTORE DECIDABLE, RECORDED HERE.\n     *\n     * "Has this device ever had preferences of its own?" is settled at this\n     * exact line - after the database has been read and before a single\n     * feature module has been constructed, let alone run. That ordering is the\n     * entire point. v8.1 tried to answer the same question later, from the\n     * settingsSavedAt timestamp, and lost: editor.init() writes a setting on\n     * every boot (setMode writes \'split\' over \'split\' and saves), so by the\n     * time anyone asked, a brand-new install was already holding a timestamp\n     * newer than the folder containing the user\'s real theme. The folder was\n     * judged stale and then overwritten with defaults.\n     *\n     * Nothing can get in front of this line, so nothing can spoil the answer.\n     */\n    state.settingsFresh = !(saved && typeof saved === \'object\');\n    if (!state.settingsFresh) {\n      state.settings = U.deepMerge(U.deepClone(DEFAULT_SETTINGS), saved);\n      migrateSettings(state.settings);\n    } else {\n      // No history at all: make sure the clock reads zero, so even the\n      // timestamp comparison agrees with the freshness flag.\n      state.settings.settingsSavedAt = 0;\n    }',
    ),
    (
        'portableSettings also leaves onboarding state behind',
        '  /** The copy that is safe to write into a folder or a repository. */\n  function portableSettings(settings) {\n    const out = U.deepClone(settings || state.settings);\n    SECRET_SETTINGS.concat(DEVICE_SETTINGS).forEach(function (k) { delete out[k]; });\n    return out;\n  }',
        '  /** The copy that is safe to write into a folder or a repository. */\n  function portableSettings(settings) {\n    const out = U.deepClone(settings || state.settings);\n    SECRET_SETTINGS.concat(DEVICE_SETTINGS).forEach(function (k) { delete out[k]; });\n    /* v9: onboarding state belongs to a device, not to a vault. See\n       LOCAL_ONLY_SETTINGS - firstRunComplete arriving from a restore would\n       suppress the very screen that starts a restore. */\n    LOCAL_ONLY_SETTINGS.forEach(function (k) { delete out[k]; });\n    return out;\n  }',
    ),
    (
        'a restore cannot import onboarding state either',
        '    Object.keys(incoming).forEach(function (key) {\n      if (SECRET_SETTINGS.indexOf(key) !== -1) return;      // never\n      if (DEVICE_SETTINGS.indexOf(key) !== -1) return;      // never',
        '    Object.keys(incoming).forEach(function (key) {\n      if (SECRET_SETTINGS.indexOf(key) !== -1) return;      // never\n      if (DEVICE_SETTINGS.indexOf(key) !== -1) return;      // never\n      if (LOCAL_ONLY_SETTINGS.indexOf(key) !== -1) return;  // v9: never',
    ),
    (
        'the folder file is not rewritten while it is being read',
        "  function writeSettingsToFolder() {\n    if (!N.vault || !N.vault.isFolderMode || !N.vault.isFolderMode()) return;\n    try { N.vault.saveAppData('settings.json', settingsEnvelope()); }\n    catch (err) { console.warn('[store] could not queue settings for the folder', err); }\n  }",
        '  function writeSettingsToFolder() {\n    if (!N.vault || !N.vault.isFolderMode || !N.vault.isFolderMode()) return;\n    /*\n     * v9: the window that ate the user\'s settings.\n     *\n     * Between "you picked a folder" and "we have read what is in it" there are\n     * several seconds of a fully live app - a permission prompt, a modal asking\n     * about the notes already in there, a walk of the directory. Any save\n     * landing in that window wrote this device\'s defaults over the real file,\n     * so the customisation was gone before anything got round to reading it.\n     * The hold is released the moment the read finishes, succeeds or fails.\n     */\n    if (folderSettingsHeld()) return;\n    try { N.vault.saveAppData(\'settings.json\', settingsEnvelope()); }\n    catch (err) { console.warn(\'[store] could not queue settings for the folder\', err); }\n  }',
    ),
    (
        'saveSettings only moves the clock for a change that would travel',
        '  async function saveSettings(patch) {\n    if (patch) U.deepMerge(state.settings, patch);\n    /*\n     * v8.1: stamp the change, then write the WRAPPED copy.',
        '  async function saveSettings(patch) {\n    /*\n     * v9: A NO-OP WRITE IS NOT A CHANGE.\n     *\n     * v8.1 stamped settingsSavedAt on every call, which made the timestamp\n     * useless: editor.init() calls saveSettings() on every single boot after\n     * writing \'split\' over \'split\', and that alone was enough to make a\n     * freshly reset device look newer than the folder holding the real\n     * preferences. Rather than chase that one line - and the next one somebody\n     * adds - the clock now moves only when the PORTABLE part of the settings\n     * genuinely differs before and after. Bookkeeping writes (githubRev and\n     * friends), onboarding flags and no-op writes all stop counting, because\n     * none of them would travel anyway.\n     */\n    const before = portableFingerprint();\n    if (patch) U.deepMerge(state.settings, patch);\n    if (portableFingerprint() !== before) {\n      state.settings.settingsSavedAt = Date.now();\n      /*\n       * And this device is no longer a blank slate. A real change to something\n       * that travels is the moment it stops being one - so a folder connected\n       * afterwards has to beat this on the clock rather than simply arriving.\n       * Without this, someone who chose "just keep them on this device", set a\n       * theme, and then connected a folder would watch their new theme be\n       * replaced by the folder\'s older one.\n       */\n      claimSettings();\n    }\n    await db.setSetting(\'settings\', state.settings);\n    writeSettingsToFolder();\n    bus.emit(\'settings:changed\', state.settings);\n  }\n\n  /* The v8.1 body, kept for the record:\n     ------------------------------------------------------------------\n     v8.1: stamp the change, then write the WRAPPED copy.',
    ),
    (
        'close the quoted v8.1 body',
        "     * The stamp is the other half: see settingsSavedAt in DEFAULT_SETTINGS.\n     */\n    state.settings.settingsSavedAt = Date.now();\n    await db.setSetting('settings', state.settings);\n    writeSettingsToFolder();\n    bus.emit('settings:changed', state.settings);\n  }",
        '       The stamp is the other half: see settingsSavedAt in DEFAULT_SETTINGS.\n\n         state.settings.settingsSavedAt = Date.now();   <- unconditional\n     ------------------------------------------------------------------ */',
    ),
    (
        'applyRestoredSettings takes ownership, and can be forced',
        "  async function applyRestoredSettings(incoming, opts) {\n    const o = opts || {};\n    const merged = mergeRestoredSettings(state.settings, incoming);\n    merged.settingsSavedAt = o.savedAt || Date.now();\n    state.settings = normalizeSettings(merged);\n    await db.setSetting('settings', state.settings);",
        '  async function applyRestoredSettings(incoming, opts) {\n    const o = opts || {};\n    /*\n     * v9: THE DECISION LIVES HERE AS WELL AS IN THE CALLER.\n     *\n     * Callers pass the timestamp the restored copy carried. Unless they say\n     * force - which only an explicit "restore from GitHub" does, because the\n     * user asked for it by name - the same rule applies as everywhere else: a\n     * fresh device takes it, a device with a history of its own needs the copy\n     * to be newer. Having it in one function as well as at every call site\n     * means a restore source added later cannot quietly skip it.\n     */\n    if (o.force !== true && !shouldAdoptSettings(o.savedAt)) {\n      claimSettings();\n      return state.settings;\n    }\n    const merged = mergeRestoredSettings(state.settings, incoming);\n    merged.settingsSavedAt = o.savedAt || Date.now();\n    state.settings = normalizeSettings(merged);\n    /*\n     * v9: this device now has preferences of its own - the ones it just took.\n     * Anything read after this must beat them on the clock rather than simply\n     * arriving, so a second, older file cannot undo the restore.\n     */\n    claimSettings();\n    await db.setSetting(\'settings\', state.settings);',
    ),
    (
        'store exports the v9 API',
        '    applyRestoredSettings: applyRestoredSettings, portableSettings: portableSettings,\n    settingsEnvelope: settingsEnvelope, readSettingsEnvelope: readSettingsEnvelope,\n    writeSettingsToFolder: writeSettingsToFolder, normalizeSettings: normalizeSettings,',
        '    applyRestoredSettings: applyRestoredSettings, portableSettings: portableSettings,\n    settingsEnvelope: settingsEnvelope, readSettingsEnvelope: readSettingsEnvelope,\n    writeSettingsToFolder: writeSettingsToFolder, normalizeSettings: normalizeSettings,\n    /* v9: the restore decision, and everything else the folder now carries. */\n    isFreshDevice: isFreshDevice, claimSettings: claimSettings,\n    shouldAdoptSettings: shouldAdoptSettings, portableFingerprint: portableFingerprint,\n    holdFolderSettings: holdFolderSettings, folderSettingsHeld: folderSettingsHeld,\n    folderRows: folderRows, mergeFolders: mergeFolders,\n    trashRows: trashRows, mergeTrash: mergeTrash,\n    exportViewState: exportViewState, importViewState: importViewState,\n    adoptVersions: adoptVersions,',
    ),
    (
        'connecting a folder reads its settings before anything can write them',
        "    keepStorage();\n    installConnectionWatch();\n    bus.emit('vault:connected', { name: root.name, createdContainer: root.created });\n    return root.handle;",
        '    keepStorage();\n    installConnectionWatch();\n\n    /*\n     * v9: READ THE FOLDER HERE, NOT LATER.\n     *\n     * Before v9 the only thing that read .nodalis/settings.json was pullAll(),\n     * and pullAll() only runs on some of the routes into this function. Pick a\n     * folder from Settings: no read. Pick one during onboarding and answer\n     * "leave my existing notes alone for now": no read. Even on the route that\n     * does pull, the read came after a directory walk that a large vault can\n     * make slow enough to be cut off by the boot timeout.\n     *\n     * So it happens right here, on every route, before the write queue has had\n     * a chance to touch anything - which is what the hold is for.\n     */\n    N.store.holdFolderSettings(true);\n    try { await adoptFolderSettings(); }\n    catch (err) { console.warn(\'[vault] could not read the folder settings\', err); }\n    finally { N.store.holdFolderSettings(false); }\n    /*\n     * And now the traffic goes the other way. If the folder had no settings, or\n     * if this device\'s were newer and kept, the folder should be holding OUR\n     * copy from this moment on - otherwise it would sit with a stale file until\n     * the next time a preference happened to change. If we did adopt the\n     * folder\'s copy this writes back exactly what was read, which is a no-op.\n     */\n    N.store.writeSettingsToFolder();\n\n    bus.emit(\'vault:connected\', { name: root.name, createdContainer: root.created });\n    return root.handle;',
    ),
    (
        'a folder restored at startup reads its settings straight away too',
        "    if (granted) {\n      setStatus('ok', '');\n      /* v8.1: same two duties as connectFolder - see the note there. */\n      keepStorage();\n      installConnectionWatch();\n      bus.emit('vault:connected', { name: vault.name, restored: true });\n      return { restored: true, name: vault.name };\n    }",
        "    if (granted) {\n      setStatus('ok', '');\n      /* v8.1: same two duties as connectFolder - see the note there. */\n      keepStorage();\n      installConnectionWatch();\n      /*\n       * v9: and the same read. One small file, before the expensive walk, so\n       * your theme is right even if the startup pull is cut short by the boot\n       * budget on a large vault.\n       */\n      N.store.holdFolderSettings(true);\n      try { await adoptFolderSettings(); }\n      catch (err) { console.warn('[vault] could not read the folder settings', err); }\n      finally { N.store.holdFolderSettings(false); }\n      N.store.writeSettingsToFolder();     /* see connectFolder */\n      bus.emit('vault:connected', { name: vault.name, restored: true });\n      return { restored: true, name: vault.name };\n    }",
    ),
    (
        'vault exports the folder-settings read',
        '    armSilentReconnect: armSilentReconnect,\n    /* v8.1 */\n    checkConnection: checkConnection, keepStorage: keepStorage,\n    installConnectionWatch: installConnectionWatch,',
        '    armSilentReconnect: armSilentReconnect,\n    /* v8.1 */\n    checkConnection: checkConnection, keepStorage: keepStorage,\n    installConnectionWatch: installConnectionWatch,\n    /* v9 */\n    adoptFolderSettings: adoptFolderSettings, pullVersions: pullVersions,\n    pullAppData: pullAppData,',
    ),
    (
        'version history is written under the note path, so a restore can find it',
        "  const queueDiskWrite = U.debounce(async function (noteId) {\n    if (!N.vault.isFolderMode()) return;\n    try {\n      const list = await versionsFor(noteId);\n      await N.vault.saveAppData('versions/' + noteId, list);\n    } catch (err) {\n      console.warn('[history] could not write versions to disk', err);\n    }\n  }, 2500);",
        "  /*\n   * v9: NAMED BY PATH, NOT BY NOTE ID.\n   *\n   * This has written .nodalis/versions/ since v6 and nothing has ever read it\n   * back - the same shape of bug as settings.json, one directory over. But\n   * simply reading it would not have worked either, because the files were\n   * named by note id and a restore hands every note a brand-new id. History\n   * keyed that way could never have survived the one event it exists for.\n   *\n   * A note's PATH is the identifier it actually keeps across a restore, so\n   * that is the name now, with the path recorded inside the file as well so\n   * the match can be made even if the filename had to be sanitised. Files\n   * written by older builds are still read; see vault.pullVersions.\n   */\n  function versionFileFor(note) {\n    const path = String((note && note.path) || '').replace(/\\.md$/i, '');\n    // A short, stable hash keeps two notes whose sanitised names collide in\n    // separate files, while the same note always rewrites its own.\n    let h = 0;\n    for (let i = 0; i < path.length; i++) { h = ((h << 5) - h + path.charCodeAt(i)) | 0; }\n    const safe = path.replace(/[^A-Za-z0-9._ -]+/g, '_').slice(0, 60) || 'note';\n    return 'versions/' + safe + '-' + (h >>> 0).toString(36) + '.json';\n  }\n\n  const queueDiskWrite = U.debounce(async function (noteId) {\n    if (!N.vault.isFolderMode()) return;\n    try {\n      const note = N.store.getNote(noteId);\n      if (!note) return;\n      const list = await versionsFor(noteId);\n      await N.vault.saveAppData(versionFileFor(note), {\n        nodalis: 'versions',\n        path: note.path,\n        title: N.store.noteTitle(note),\n        folder: note.folder || '',\n        versions: list,\n      });\n    } catch (err) {\n      console.warn('[history] could not write versions to disk', err);\n    }\n  }, 2500);",
    ),
    (
        'purging history removes the file it actually wrote',
        "    lastSnapshotAt.delete(keyFor(noteId));\n    if (N.vault.isFolderMode()) {\n      try { await N.vault.deleteAppData('versions/' + noteId); } catch (err) { /* already gone */ }\n    }",
        "    lastSnapshotAt.delete(keyFor(noteId));\n    if (N.vault.isFolderMode()) {\n      const note = N.store.getNote(noteId);\n      /* v9: the new path-named file, and the old id-named one from before it. */\n      if (note) { try { await N.vault.deleteAppData(versionFileFor(note)); } catch (err) { /* already gone */ } }\n      try { await N.vault.deleteAppData('versions/' + noteId); } catch (err) { /* already gone */ }\n    }",
    ),
    (
        'the GitHub backup carries the trash too',
        '    delete dump.stores.notes;                 // notes travel as markdown\n    return dump;',
        '    /*\n     * v9: trashed notes were the one thing no backup carried.\n     *\n     * They live in the notes store with a trashedAt stamp and deliberately\n     * have no markdown file - deleting a note removes its file. So dropping\n     * the notes store dropped them, and "restore from GitHub" quietly emptied\n     * the trash. They ride along under their own key, restored after the\n     * markdown notes so that a note which is live on this device always wins.\n     */\n    try { dump.trashedNotes = N.store.trashRows(); } catch (err) { dump.trashedNotes = []; }\n    delete dump.stores.notes;                 // notes travel as markdown\n    return dump;',
    ),
    (
        'a GitHub restore is explicit, so it takes the settings outright',
        '        N.store.state.settings = keep;\n        await N.store.applyRestoredSettings(incoming, {\n          savedAt: Number(incoming.settingsSavedAt) || Date.now(),\n        });',
        '        N.store.state.settings = keep;\n        /*\n         * v9: force.\n         *\n         * A pull is something the user asked for by name - "replace this\n         * device with what is in my repository". There is no timestamp\n         * comparison to be made: they said take theirs. The only things still\n         * held back are the ones that must never travel at all, which\n         * applyRestoredSettings enforces on its own.\n         */\n        await N.store.applyRestoredSettings(incoming, {\n          savedAt: Number(incoming.settingsSavedAt) || Date.now(),\n          force: true,\n        });',
    ),
    (
        'and it brings the trash back with it',
        "      await N.store.setSetting('githubRev', remote.manifest.rev);\n      await N.store.setSetting('githubSyncedAt', Date.now());\n      await N.store.setSetting('githubDirty', false);",
        "      /* v9: after the live notes, so a note that exists here always wins. */\n      if (vaultFile) {\n        try {\n          const dump2 = JSON.parse(vaultFile.text);\n          if (Array.isArray(dump2.trashedNotes) && dump2.trashedNotes.length) {\n            await N.store.mergeTrash(dump2.trashedNotes);\n          }\n        } catch (err) { console.warn('[github] trash could not be restored', err); }\n      }\n\n      await N.store.setSetting('githubRev', remote.manifest.rev);\n      await N.store.setSetting('githubSyncedAt', Date.now());\n      await N.store.setSetting('githubDirty', false);",
    ),
    (
        'the editor stops stamping the settings clock on every boot',
        "    if (next !== 'edit') renderPreview();\n    N.store.state.settings.editorMode = next;\n    N.store.saveSettings();\n  }",
        "    if (next !== 'edit') renderPreview();\n    /*\n     * v9: THIS LINE BROKE SETTINGS RESTORE FOR TWO WHOLE VERSIONS.\n     *\n     * init() calls setMode(settings.editorMode || 'split'), so on every single\n     * boot this wrote 'split' over 'split' and then saved. Harmless in itself -\n     * except that saveSettings() stamped settingsSavedAt, which is what the\n     * folder restore compares against. A brand-new install therefore arrived\n     * at your vault folder already claiming to hold newer settings than the\n     * file containing your real theme, so the file was skipped and then\n     * overwritten with defaults.\n     *\n     * saveSettings() is now change-aware and would ignore this anyway. Not\n     * writing at all when nothing changed is still the right thing to do.\n     */\n    if (N.store.state.settings.editorMode === next) return;\n    N.store.state.settings.editorMode = next;\n    N.store.saveSettings();\n  }",
    ),
    (
        'notification presses all land in one place',
        "    // the service worker tells us which button was pressed on a notification\n    if (navigator.serviceWorker) {\n      navigator.serviceWorker.addEventListener('message', function (e) {\n        const d = e.data || {};\n        if (d.type === 'nd-remind-action' && d.id) {\n          if (d.action === 'snooze') snooze(d.id);\n          else if (d.action === 'done') complete(d.id);\n          else {\n            const rec = all().find(function (r) { return r.id === d.id; });\n            if (rec) openTarget(rec);\n          }\n        }\n      });\n    }",
        "    // the service worker tells us which button was pressed on a notification\n    if (navigator.serviceWorker) {\n      navigator.serviceWorker.addEventListener('message', function (e) {\n        const d = e.data || {};\n        if (d.type === 'nd-remind-action' && d.id) applyAction(d.id, d.action || 'open');\n      });\n    }\n\n    /*\n     * v9: a press that arrived with no tab open. The service worker opened one\n     * with the instruction in the query string - carry it out.\n     */\n    consumeUrlAction();\n\n    // And warm the capability probe, so the Reminders screen can tell the\n    // truth about whether the OS notification will have buttons on it.\n    setTimeout(function () { osRegistration(); }, 1200);",
    ),
    (
        'remind exports the shared action path',
        '  N.remind = {\n    init: init, setFor: setFor, list: openList, check: check,\n    snooze: snooze, complete: complete, all: all, remove: remove,\n    describe: describe, remindCurrent: remindCurrent\n  };',
        '  N.remind = {\n    init: init, setFor: setFor, list: openList, check: check,\n    snooze: snooze, complete: complete, all: all, remove: remove,\n    describe: describe, remindCurrent: remindCurrent,\n    /* v9 */\n    applyAction: applyAction, osActionsAvailable: osActionsAvailable,\n    osRegistration: osRegistration, notify: notify, create: save\n  };',
    ),
    (
        'the notification permission message says what you actually get',
        "            N.toast[p === 'granted' ? 'success' : 'warn'](\n              p === 'granted' ? 'Notifications are on. Reminders will alert you.'",
        "            if (p === 'granted') await osRegistration();\n            N.toast[p === 'granted' ? 'success' : 'warn'](\n              p === 'granted' ? (osActionsAvailable()\n                ? 'Notifications are on, with Snooze and Done on the notification itself.'\n                : 'Notifications are on. Snooze lives inside Nodalis - for buttons on the notification itself, sw.js needs to sit next to index.html.')",
    ),
    (
        'the service worker registration is checked, not assumed',
        "  function registerServiceWorker() {\n    if (!('serviceWorker' in navigator)) return;\n    if (location.protocol === 'file:') return;   // service workers cannot run from file://\n    navigator.serviceWorker.register('sw.js').then(function (reg) {",
        '  /*\n   * v9: WHY THIS MATTERS MORE THAN IT LOOKS.\n   *\n   * A notification can only carry BUTTONS if a service worker shows it - the\n   * platform allows no other route. This registration has always been here and\n   * has always pointed at sw.js, a file a single-file build never shipped, so\n   * it 404\'d every time and the reminder notifications silently fell back to\n   * the plain constructor: no Snooze on Windows, and nothing at all on\n   * Android, where that constructor throws. v9 ships sw.js beside index.html.\n   *\n   * The failure is now reported rather than swallowed, because "your Snooze\n   * button will not work" is worth one line in the console.\n   */\n  function registerServiceWorker() {\n    if (!(\'serviceWorker\' in navigator)) return;\n    if (location.protocol === \'file:\') return;   // service workers cannot run from file://\n    navigator.serviceWorker.register(\'sw.js\').then(function (reg) {\n      /*\n       * Confirm it is a v9 worker that knows about notification buttons - an\n       * older one left over from a previous deployment will draw the buttons\n       * and then do nothing at all when they are pressed, which is the worst\n       * of the three possible states and the hardest to notice.\n       *\n       * Through `ready` rather than reg.active: on a first load the worker is\n       * still installing and reg.active is null, so pinging it there would\n       * quietly do nothing on exactly the load where you want to see this.\n       */\n      navigator.serviceWorker.ready.then(function (active) {\n        const target = (active && active.active) || navigator.serviceWorker.controller;\n        if (target) target.postMessage({ type: \'nd-sw-ping\' });\n      }).catch(function () { /* nothing depends on the handshake */ });',
    ),
    (
        'and a missing sw.js is explained rather than shrugged at',
        "    }).catch(function (err) {\n      console.warn('[nodalis] service worker not registered', err);\n    });\n  }",
        "    }).catch(function (err) {\n      console.warn('[nodalis] sw.js did not register, so notifications will have no ' +\n        'Snooze/Done buttons (everything else works). Put sw.js next to index.html.', err);\n    });\n\n    navigator.serviceWorker.addEventListener('message', function (e) {\n      const d = e.data || {};\n      if (d.type === 'nd-sw-pong') {\n        swVersion = d.version || '';\n        console.info('[nodalis] service worker ' + swVersion + ' is handling notifications');\n      }\n    });\n  }\n\n  let swVersion = '';",
    ),
]

REGIONS = [
    (
        'folder push covers everything',
        '  async function pushAppData() {',
        "    } catch (err) {\n      console.warn('[vault] app-data push failed', err);\n    }\n  }",
        "  /* ===================================================================== *\n   * v9: THE FOLDER HOLDS EVERYTHING, AND IT IS READ BEFORE IT IS WRITTEN\n   *\n   * pushAppData/pullAppData used to cover six things. They now cover ten, so\n   * that a connected folder is a complete backup rather than a partial one -\n   * see the note in store.js for what was missing and why each item matters.\n   *\n   * The ORDER in pullAppData is deliberate and load-bearing:\n   *\n   *   1. settings   - so the theme is right before anything is painted with it\n   *   2. folders    - so folder colours exist before the sidebar draws\n   *   3. collections\n   *   4. canvases\n   *   5. trash      - after notes, so a live note always beats a stale trash row\n   *   6. versions   - last, because they are matched to notes by path\n   *   7. view state - last of all; it references note ids that must exist first\n   * ===================================================================== */\n\n  async function pushAppData() {\n    if (!isFolderMode() || !N.store) return;\n    const s = N.store.state;\n    try {\n      await writeFile(APP_DIR + '/stickies.json', JSON.stringify(Array.from(s.stickies.values()), null, 2));\n      await writeFile(APP_DIR + '/tasks.json', JSON.stringify(Array.from(s.tasks.values()), null, 2));\n      await writeFile(APP_DIR + '/scratch.json', JSON.stringify(Array.from(s.scratch.values()), null, 2));\n      await writeFile(APP_DIR + '/journal.json', JSON.stringify(Array.from(s.journal.values()), null, 2));\n\n      /* v9: the four that were missing. */\n      await writeFile(APP_DIR + '/folders.json', JSON.stringify(N.store.folderRows(), null, 2));\n      await writeFile(APP_DIR + '/trash.json', JSON.stringify(N.store.trashRows(), null, 2));\n      try {\n        await writeFile(APP_DIR + '/viewstate.json',\n          JSON.stringify(await N.store.exportViewState(), null, 2));\n      } catch (err) { console.warn('[vault] view state could not be written', err); }\n\n      /*\n       * Settings last, and only if nothing is holding the file shut. Between\n       * picking a folder and reading it there is a window - a permission\n       * prompt, a modal about existing notes, seconds of a live app - and a\n       * write landing in that window would overwrite the user's real\n       * preferences with this device's defaults. See store.js layer 3.\n       */\n      if (!N.store.folderSettingsHeld()) {\n        await writeFile(APP_DIR + '/settings.json', JSON.stringify(\n          N.store.settingsEnvelope ? N.store.settingsEnvelope() : s.settings, null, 2));\n      }\n\n      for (const canvas of s.canvases.values()) {\n        await writeFile(APP_DIR + '/canvases/' + canvas.id + '.json', JSON.stringify(canvas, null, 2));\n      }\n    } catch (err) {\n      console.warn('[vault] app-data push failed', err);\n    }\n  }",
    ),
    (
        'folder read covers everything',
        '  async function pullAppData() {',
        "    } catch (err) { console.warn('[vault] canvas pull failed', err); }\n  }",
        '  /**\n   * Read the folder\'s settings, and use them if they should win. Split out of\n   * pullAppData so that CONNECTING a folder restores your preferences even on\n   * the routes that never call pullAll() - which, before v9, was most of them:\n   * connectFolder() from Settings, and the onboarding branch where someone\n   * chooses "leave my existing notes alone for now".\n   */\n  async function adoptFolderSettings() {\n    if (!isFolderMode() || !N.store) return { adopted: false, reason: \'not-folder\' };\n    let data = null;\n    try { data = await readAppData(\'settings.json\'); }\n    catch (err) { return { adopted: false, reason: \'unreadable\' }; }\n\n    const parsed = data && N.store.readSettingsEnvelope ? N.store.readSettingsEnvelope(data) : null;\n    if (!parsed) {\n      // No settings in the folder. This device\'s preferences are now the\n      // record, so stop treating it as having nothing to lose.\n      N.store.claimSettings();\n      return { adopted: false, reason: \'no-file\' };\n    }\n    if (!N.store.shouldAdoptSettings(parsed.savedAt)) {\n      N.store.claimSettings();\n      return { adopted: false, reason: \'ours-is-newer\', savedAt: parsed.savedAt };\n    }\n    await N.store.applyRestoredSettings(parsed.settings, {\n      savedAt: parsed.savedAt,\n      writeBack: false,               // it came FROM this file\n    });\n    bus.emit(\'vault:settings-restored\', { savedAt: parsed.savedAt, device: parsed.device });\n    return { adopted: true, savedAt: parsed.savedAt, device: parsed.device };\n  }\n\n  async function pullAppData() {\n    if (!isFolderMode() || !N.store) return;\n    const load = async function (name, apply) {\n      let data = null;\n      try { data = await readAppData(name); }\n      catch (err) { console.warn(\'[vault] could not read \' + name, err); return; }\n      if (data) { try { await apply(data); } catch (err) { console.warn(\'[vault] apply \' + name, err); } }\n    };\n\n    await adoptFolderSettings();\n    await load(\'folders.json\', (d) => N.store.mergeFolders(d));\n    await load(\'stickies.json\', (d) => N.store.replaceCollection(\'stickies\', d));\n    await load(\'tasks.json\', (d) => N.store.replaceCollection(\'tasks\', d));\n    await load(\'scratch.json\', (d) => N.store.replaceCollection(\'scratch\', d));\n    await load(\'journal.json\', (d) => N.store.replaceCollection(\'journal\', d));\n\n    // Canvases are one file each.\n    try {\n      const appDir = await getDir(vault.handle, APP_DIR, false).catch(() => null);\n      if (appDir) {\n        const canvasDir = await appDir.getDirectoryHandle(\'canvases\', { create: false }).catch(() => null);\n        if (canvasDir) {\n          const canvases = [];\n          for await (const entry of canvasDir.values()) {\n            if (entry.kind !== \'file\' || !/\\.json$/i.test(entry.name)) continue;\n            try {\n              const text = await (await entry.getFile()).text();\n              const parsed = JSON.parse(text);\n              if (parsed && parsed.id) canvases.push(parsed);\n            } catch (err) { console.warn(\'[vault] bad canvas file \' + entry.name, err); }\n          }\n          if (canvases.length) await N.store.replaceCollection(\'canvases\', canvases);\n        }\n      }\n    } catch (err) { console.warn(\'[vault] canvas pull failed\', err); }\n\n    await load(\'trash.json\', (d) => N.store.mergeTrash(d));\n    await pullVersions();\n    await load(\'viewstate.json\', (d) => N.store.importViewState(d));\n  }\n\n  /**\n   * .nodalis/versions/ has been written since v6 and read by nothing, ever.\n   *\n   * The files were named by note id, and a restore hands every note a new id,\n   * so id-named history could never have survived the thing it exists for.\n   * v9 writes them named by note PATH - the one identifier a note keeps - and\n   * reads both shapes, so history written by an older build is not thrown away.\n   */\n  async function pullVersions() {\n    if (!isFolderMode() || !N.store || !N.store.adoptVersions) return 0;\n    let dir = null;\n    try {\n      const appDir = await getDir(vault.handle, APP_DIR, false);\n      dir = await appDir.getDirectoryHandle(\'versions\', { create: false });\n    } catch (err) { return 0; }\n\n    let restored = 0;\n    try {\n      for await (const entry of dir.values()) {\n        if (entry.kind !== \'file\') continue;\n        let parsed = null;\n        try { parsed = JSON.parse(await (await entry.getFile()).text()); }\n        catch (err) { continue; }\n\n        if (parsed && parsed.nodalis === \'versions\' && Array.isArray(parsed.versions)) {\n          restored += await N.store.adoptVersions(parsed.path || \'\', parsed.versions);\n        } else if (Array.isArray(parsed) && parsed.length) {\n          // Pre-v9: a bare array in a file named by the old note id. It can\n          // only be placed if that note id still exists on this device.\n          const id = String(entry.name).replace(/\\.json$/i, \'\');\n          const note = N.store.getNote(id);\n          if (note) restored += await N.store.adoptVersions(note.path, parsed);\n        }\n      }\n    } catch (err) { console.warn(\'[vault] version pull failed\', err); }\n    if (restored) bus.emit(\'history:changed\');\n    return restored;\n  }',
    ),
    (
        'the notification path',
        '  async function notify(rec, missed) {',
        '    return shown;\n  }',
        '  /* ===================================================================== *\n   * v9: THE SNOOZE BUTTON IN THE WINDOWS / ANDROID NOTIFICATION\n   *\n   * "the snooze button coming from windows notification or android\n   *  notification is not working and inside the website it is working"\n   *\n   * Both halves of that were true, and they had the same single cause.\n   *\n   * A notification can only carry BUTTONS if a service worker shows it:\n   *\n   *     new Notification(title, {actions})            <- actions ignored.\n   *                                                      Throws on Android.\n   *     registration.showNotification(title, {actions}) <- real buttons.\n   *\n   * This module already preferred the second form, and app.js already called\n   * navigator.serviceWorker.register(\'sw.js\') - but a single-file build ships\n   * no sw.js, so the registration 404\'d and there was no worker. What was left\n   * was the plain constructor: no buttons on Windows, and nothing at all on\n   * Android, where it throws. The in-app card kept working because it is just\n   * a toast, which is exactly the asymmetry that was reported.\n   *\n   * And when a worker DID exist - left over from an earlier deployment - it had\n   * never heard of \'notificationclick\'. So the buttons were drawn and pressing\n   * them did nothing at all: the OS dismissed the notification and no message\n   * ever reached the page. This module has always listened for that message.\n   * Nothing was ever sending it.\n   *\n   * v9 ships sw.js next to index.html, and everything below assumes it may or\n   * may not be there:\n   *\n   *   - worker present  -> real buttons; presses arrive as a postMessage, or,\n   *                        if no tab is open, as ?ndaction= on a fresh load.\n   *   - worker absent   -> a plain notification whose BODY is clickable and\n   *                        does the same thing one tap later, and the app says\n   *                        so honestly in Reminders instead of pretending.\n   *   - Android, no worker -> the constructor throws, we catch it, and the\n   *                        in-app card carries the reminder instead.\n   * ===================================================================== */\n\n  let osReg = null;\n  let osProbedAt = 0;\n  const OS_REPROBE_MS = 20000;\n\n  /**\n   * The registration that can actually show a notification, or null.\n   *\n   * navigator.serviceWorker.ready is used rather than getRegistration()\n   * because getRegistration() will hand back a worker that is still\n   * installing, and showNotification() on one of those throws. It is raced\n   * against a timeout because `ready` never settles when no worker is\n   * registered at all - which is exactly the case being handled.\n   */\n  async function osRegistration() {\n    if (osReg) return osReg;\n    if (Date.now() - osProbedAt < OS_REPROBE_MS) return null;\n    osProbedAt = Date.now();\n    if (!(\'serviceWorker\' in navigator)) return null;\n    try {\n      const reg = await Promise.race([\n        navigator.serviceWorker.ready,\n        new Promise(function (r) { setTimeout(function () { r(null); }, 2500); }),\n      ]);\n      osReg = (reg && typeof reg.showNotification === \'function\') ? reg : null;\n    } catch (err) { osReg = null; }\n    return osReg;\n  }\n\n  /** Whether the OS notification will have Snooze/Done on it. */\n  function osActionsAvailable() { return !!osReg; }\n\n  async function notify(rec, missed) {\n    const body = describe(rec) + (missed ? \' - this was due while Nodalis was closed\' : \'\');\n\n    // vibrate first: it works even when notifications are blocked\n    if (N.haptics && N.haptics.buzz) { try { N.haptics.buzz(\'success\'); } catch (e) {} }\n\n    let shown = false;\n    if (\'Notification\' in window && Notification.permission === \'granted\') {\n      const reg = await osRegistration();\n      if (reg) {\n        try {\n          await reg.showNotification(titleFor(rec), {\n            body: body,\n            tag: \'nd-remind-\' + rec.id,\n            renotify: true,\n            data: { id: rec.id, kind: rec.kind, refId: rec.refId },\n            vibrate: [90, 60, 90],\n            requireInteraction: true,\n            actions: [\n              { action: \'snooze\', title: \'Snooze 10 min\' },\n              { action: \'done\', title: \'Done\' }\n            ]\n          });\n          shown = true;\n        } catch (err) {\n          console.warn(\'[remind] the service worker would not show it\', err);\n          osReg = null;                 // stop trusting it until the next probe\n        }\n      }\n      if (!shown) {\n        try {\n          const n2 = new Notification(titleFor(rec), {\n            body: body + \' - open Nodalis to snooze\',\n            tag: \'nd-remind-\' + rec.id,\n            data: { id: rec.id },\n          });\n          n2.onclick = function () {\n            try { window.focus(); } catch (e) { /* pop-up rules */ }\n            applyAction(rec.id, \'open\');\n            n2.close();\n          };\n          shown = true;\n        } catch (err) {\n          // Android throws here by design. The in-app card below is the answer.\n          shown = false;\n        }\n      }\n    }\n\n    // Always show the in-app card too: it carries Snooze/Done even when the\n    // OS notification was blocked, and it is what the user sees if they are\n    // already looking at the app.\n    N.toast.show(titleFor(rec) + \' - \' + describe(rec), {\n      kind: missed ? \'warn\' : \'info\',\n      title: missed ? \'Missed reminder\' : \'Reminder\',\n      key: \'nd-remind-\' + rec.id,\n      ms: 0,                                   // stays until acted on\n      action: { label: \'Snooze 10m\', onClick: function () { applyAction(rec.id, \'snooze\'); } }\n    });\n\n    return shown;\n  }\n\n  /**\n   * One place where a notification press lands, whichever route it took: a\n   * button on the OS notification, a tap on its body, the in-app card, or\n   * ?ndaction= on a cold start because no tab was open when it was pressed.\n   */\n  async function applyAction(id, action) {\n    const rec = all().find(function (r) { return r.id === id; });\n    if (!rec) return false;\n    try {\n      if (action === \'snooze\') {\n        await snooze(id);\n        N.toast.dismiss(\'nd-remind-\' + id);\n        N.toast.success(\'Snoozed for 10 minutes.\', { ms: 3200 });\n        return true;\n      }\n      if (action === \'done\') {\n        await complete(id);\n        N.toast.dismiss(\'nd-remind-\' + id);\n        N.toast.success(\'Marked as done.\', { ms: 3200 });\n        return true;\n      }\n    } catch (err) {\n      console.warn(\'[remind] could not apply "\' + action + \'"\', err);\n      return false;\n    }\n    openTarget(rec);\n    return true;\n  }\n\n  /**\n   * A press that arrived with no tab open. The service worker opened one with\n   * the instruction in the query string; carry it out, then take it back out\n   * of the address bar so a refresh does not snooze the same thing twice.\n   */\n  function consumeUrlAction() {\n    let params = null;\n    try { params = new URLSearchParams(location.search || \'\'); } catch (err) { return; }\n    const id = params.get(\'ndremind\');\n    const action = params.get(\'ndaction\');\n    if (!id || !action) return;\n    try {\n      params.delete(\'ndremind\');\n      params.delete(\'ndaction\');\n      const q = params.toString();\n      history.replaceState(null, \'\', location.pathname + (q ? \'?\' + q : \'\') + (location.hash || \'\'));\n    } catch (err) { /* the address bar is cosmetic here */ }\n    // After the store has settled, so all() can find the record.\n    setTimeout(function () { applyAction(id, action); }, 600);\n  }',
    ),
]

INSERTS = [
    (
        'the v9 settings decision and the rest of "everything"',
        '  async function saveSettings(patch) {',
        '  /* ===================================================================== *\n   * v9: WHY THE v8.1 FIX DID NOT WORK, AND WHAT ACTUALLY GOES WRONG\n   *\n   * v8.1 taught pullAppData() to read .nodalis/settings.json, which was the\n   * missing half of the round trip. It then decided whether to use the file by\n   * comparing timestamps: take the folder\'s copy only if its savedAt is newer\n   * than this device\'s settingsSavedAt. On paper that is the correct rule.\n   *\n   * In practice, on the one machine that matters - the freshly reset one - it\n   * never fired. Here is the whole failure, measured rather than guessed:\n   *\n   *     stamp before the user has even picked a folder:  1787757447400\n   *     the folder\'s real settings.json:                 1787757443800\n   *     -> the file is "older", so it is skipped\n   *     -> and then the defaults are written over it\n   *\n   * A brand-new device was arriving at the folder with a settings timestamp\n   * already in hand. One line did it, in editor.js:\n   *\n   *     setMode(N.store.state.settings.editorMode || \'split\');\n   *     ...\n   *     N.store.state.settings.editorMode = next;\n   *     N.store.saveSettings();          // <- unconditional, on every boot\n   *\n   * Nothing changed - \'split\' was written over \'split\' - but saveSettings()\n   * stamped the clock anyway. That single no-op write, in a module that has\n   * nothing to do with syncing, was enough to make the fresh install look\n   * NEWER than the folder holding the user\'s real theme. And because the next\n   * write went out to disk, the user\'s saved customisation was not merely\n   * ignored, it was overwritten. Worse than not restoring.\n   *\n   * That is a design fault, not a stray line. A rule that depends on no module\n   * anywhere in a 40,000-line file ever writing a setting before the restore\n   * runs is a rule that will break again the next time someone adds a feature.\n   * So v9 fixes the design, in three independent layers:\n   *\n   *   1. A DEVICE WITH NO HISTORY HAS NOTHING TO LOSE.\n   *      loadAll() now records whether there was a settings row in IndexedDB\n   *      at all. If there was not - a first run, a reset, cleared site data -\n   *      then any restored copy is adopted outright, whatever the clocks say.\n   *      This is the layer that fixes the reported bug, and it cannot be\n   *      defeated by a stray write because it is decided before any module\n   *      has run.\n   *\n   *   2. THE CLOCK ONLY MOVES WHEN SOMETHING THAT TRAVELS ACTUALLY CHANGES.\n   *      saveSettings() compares a canonical fingerprint of the portable\n   *      settings before and after the write. A no-op write, or a write that\n   *      only touches this device\'s own sync bookkeeping, no longer counts as\n   *      a change. editor.js\'s line is now harmless - as is every other line\n   *      like it, including ones not yet written.\n   *\n   *   3. NOTHING WRITES TO THE FOLDER BEFORE THE FOLDER HAS BEEN READ.\n   *      Between "you picked a folder" and "we read its settings" there was a\n   *      window - a permission prompt, a modal asking about existing notes,\n   *      several seconds of a live app - in which any save would clobber the\n   *      file. That window is now held shut explicitly.\n   * ===================================================================== */\n\n  /*\n   * Keys that live only on this device, in addition to SECRET_SETTINGS and\n   * DEVICE_SETTINGS: onboarding state, and the stamp itself.\n   *\n   * firstRunComplete matters more than it looks. It is what decides whether\n   * the "where should your notes live?" screen appears - which is the screen\n   * that starts the restore. Letting it arrive FROM a restore would be a small\n   * loop with a large blast radius.\n   */\n  const LOCAL_ONLY_SETTINGS = [\'firstRunComplete\', \'tourCompleted\', \'settingsSavedAt\'];\n\n  /**\n   * A canonical string for everything that would travel. Keys are sorted, so\n   * two settings objects that differ only in property order compare equal -\n   * otherwise a patch that re-adds an existing key would read as a change.\n   */\n  function stableStringify(v) {\n    if (v === null || typeof v !== \'object\') return JSON.stringify(v) || \'null\';\n    if (Array.isArray(v)) return \'[\' + v.map(stableStringify).join(\',\') + \']\';\n    return \'{\' + Object.keys(v).sort().map(function (k) {\n      return JSON.stringify(k) + \':\' + stableStringify(v[k]);\n    }).join(\',\') + \'}\';\n  }\n\n  function portableFingerprint(settings) {\n    const s = portableSettings(settings || state.settings);\n    LOCAL_ONLY_SETTINGS.forEach(function (k) { delete s[k]; });\n    return stableStringify(s);\n  }\n\n  /* ---- layer 1: does this device have preferences of its own to protect? -- */\n\n  /**\n   * True when this device booted with no stored settings at all. Set once, in\n   * loadAll(), before a single feature module has had a chance to run - which\n   * is precisely why it cannot be spoiled by one.\n   */\n  function isFreshDevice() { return state.settingsFresh !== false; }\n\n  /** Called once a restore has been taken, or genuinely declined. */\n  function claimSettings() { state.settingsFresh = false; }\n\n  /**\n   * The whole decision, in one place, for every restore source.\n   *\n   *   fresh device        -> take it, always\n   *   otherwise           -> take it only if it is newer than what we have\n   *\n   * A file with no timestamp at all (every build before v8.1 wrote the bare\n   * settings object) arrives here as savedAt: 1, so it wins on a fresh device\n   * and loses on one with a history. That is exactly the behaviour wanted.\n   */\n  function shouldAdoptSettings(fileSavedAt) {\n    if (isFreshDevice()) return true;\n    return (Number(fileSavedAt) || 0) > (Number(state.settings.settingsSavedAt) || 0);\n  }\n\n  /* ---- layer 3: hold folder writes shut until the folder has been read ---- */\n\n  let folderHold = 0;\n  let folderHoldSince = 0;\n  const FOLDER_HOLD_MAX = 30000;      // never hold shut forever, whatever fails\n\n  function holdFolderSettings(on) {\n    if (on) {\n      if (folderHold === 0) folderHoldSince = Date.now();\n      folderHold++;\n    } else if (folderHold > 0) {\n      folderHold--;\n    }\n    return folderHold;\n  }\n\n  function folderSettingsHeld() {\n    if (folderHold <= 0) return false;\n    // A read that hangs must not silently stop the app saving preferences for\n    // the rest of the session. Release after half a minute and carry on.\n    if (Date.now() - folderHoldSince > FOLDER_HOLD_MAX) { folderHold = 0; return false; }\n    return true;\n  }\n\n  /* ------------------------------------------------------------------------ *\n   * v9: THE REST OF "EVERYTHING"\n   *\n   * The folder held stickies, tasks, scratch, journal, canvases and settings.\n   * It did not hold four things that the GitHub backup did, so a folder was\n   * quietly a weaker backup than a repository:\n   *\n   *   FOLDERS      colour, icon, order and collapsed state - and any folder\n   *                you made but have not put a note in yet, which does not\n   *                exist on disk as anything at all.\n   *   TRASH        trashed notes live in the notes store with a trashedAt\n   *                stamp and have no markdown file by design, so nothing\n   *                carried them. Emptying the trash was the only way to lose\n   *                a note; now a reset was another.\n   *   VERSIONS     history.js has always written .nodalis/versions/, and\n   *                nothing has ever read it back. Same shape of bug as\n   *                settings.json, one directory over.\n   *   VIEW STATE   which folders are collapsed, the sidebar width, the recent\n   *                list. Small, but it is the difference between "my app" and\n   *                "a fresh install with my notes in it".\n   * ------------------------------------------------------------------------ */\n\n  function folderRows() { return Array.from(state.folders.values()); }\n\n  /* Structure comes from the disk; everything else comes from the file. */\n  const FOLDER_STRUCTURE = [\'id\', \'path\', \'parent\', \'name\'];\n\n  /**\n   * Merge by PATH, not by id, and never replace.\n   *\n   * Two things make this less obvious than it looks. First, a folder present\n   * here but missing from the file is far more likely to be one this device\n   * just created from a note\'s path than one deleted on another machine, so\n   * removing it would be the wrong guess with an expensive downside. Second -\n   * and this is the part that caught me - reading the markdown runs\n   * ensureFolderChain(), which invents a BRAND-NEW id for every folder it\n   * meets. Matching the file\'s rows by id therefore matched nothing on the one\n   * device that matters, and inserted a second row for every folder: one with\n   * the right id and no decoration, one with the decoration and an id nothing\n   * referenced. folderByPath() then returned whichever it happened to reach\n   * first, which is how a restored folder came back plain.\n   *\n   * Notes address folders by path string, never by id, so keeping OUR id and\n   * taking THEIR decoration is safe and is what both sides want.\n   */\n  async function mergeFolders(rows) {\n    if (!Array.isArray(rows) || !rows.length) return 0;\n    const byPath = new Map();\n    state.folders.forEach(function (f) { if (f && f.path) byPath.set(f.path, f); });\n\n    let n = 0;\n    rows.forEach(function (f) {\n      if (!f || !f.path) return;\n      const mine = byPath.get(f.path);\n      if (!mine) {\n        // Not here at all. This is the only way a folder you made but have not\n        // put a note in yet can come back - it has no presence on disk beyond\n        // this row.\n        const row = Object.assign({}, f, { id: f.id || U.uid(\'fd\') });\n        state.folders.set(row.id, row);\n        byPath.set(row.path, row);\n        n++;\n        return;\n      }\n      let touched = false;\n      Object.keys(f).forEach(function (k) {\n        if (FOLDER_STRUCTURE.indexOf(k) !== -1) return;\n        if (f[k] === undefined || f[k] === null) return;\n        if (stableStringify(mine[k]) === stableStringify(f[k])) return;\n        mine[k] = f[k];\n        touched = true;\n      });\n      // Keep the earliest creation date; it is the truer one.\n      if (f.createdAt && (!mine.createdAt || f.createdAt < mine.createdAt)) {\n        mine.createdAt = f.createdAt; touched = true;\n      }\n      if (touched) n++;\n    });\n\n    await db.bulkPut(\'folders\', Array.from(state.folders.values()));\n    emitVaultChange();\n    return n;\n  }\n\n  function trashRows() { return Array.from((state.trash || new Map()).values()); }\n\n  async function mergeTrash(rows) {\n    if (!Array.isArray(rows) || !rows.length) return 0;\n    if (!state.trash) state.trash = new Map();\n    let n = 0;\n    for (const t of rows) {\n      if (!t || !t.id || !t.trashedAt) continue;\n      // A note that is live here must never be dragged back into the trash by\n      // a stale file. Live wins, every time.\n      if (state.notes.has(t.id)) continue;\n      if (!state.trash.has(t.id)) { state.trash.set(t.id, t); n++; }\n      await db.put(\'notes\', t);\n    }\n    if (n) bus.emit(\'trash:changed\');\n    return n;\n  }\n\n  const META_KEYS = [\'recent-notes\', \'collapsed-folders\', \'sidebar-width\', \'last-snapshot-at\'];\n\n  async function exportViewState() {\n    const out = {};\n    for (const k of META_KEYS) {\n      try { out[k] = await db.getMeta(k, null); } catch (err) { /* skip */ }\n    }\n    return out;\n  }\n\n  async function importViewState(data) {\n    if (!data || typeof data !== \'object\') return 0;\n    let n = 0;\n    for (const k of META_KEYS) {\n      if (data[k] === undefined || data[k] === null) continue;\n      try { await db.setMeta(k, data[k]); n++; } catch (err) { /* skip */ }\n    }\n    if (n) {\n      state.recentNoteIds = (await db.getMeta(\'recent-notes\', [])) || [];\n      state.recentNoteIds = state.recentNoteIds.filter(function (id) { return state.notes.has(id); });\n    }\n    return n;\n  }\n\n  /**\n   * Version records are keyed by note id, and a restore hands every note a\n   * brand-new id - so history written under the old ids would be orphaned the\n   * moment it came back. They are matched by PATH on the way in instead, which\n   * is the one identifier a note keeps across a restore.\n   */\n  async function adoptVersions(path, rows) {\n    if (!Array.isArray(rows) || !rows.length) return 0;\n    let note = null;\n    state.notes.forEach(function (n) { if (!note && n.path === path) note = n; });\n    if (!note) {\n      // Fall back to folder + title, the same way upsertFromDisk does.\n      const parts = String(path).replace(/\\.md$/i, \'\').split(\'/\');\n      const title = (parts.pop() || \'\').toLowerCase();\n      const folder = parts.join(\'/\');\n      state.notes.forEach(function (n) {\n        if (!note && n.folder === folder && noteTitle(n).toLowerCase() === title) note = n;\n      });\n    }\n    if (!note) return 0;\n    const keep = rows.filter(function (v) { return v && v.id && v.at; })\n      .map(function (v) { return Object.assign({}, v, { noteId: note.id }); });\n    if (!keep.length) return 0;\n    await db.bulkPut(\'versions\', keep);\n    return keep.length;\n  }\n\n\n  /* ------------------------------------------------------------------------ *\n   * v9: and they reach the folder as they change, not only on a full push.\n   *\n   * pushAppData() runs on a full sync. Everything else in the app writes its\n   * own file as it changes, through scheduleAppDataWrite() - but that only\n   * knows about the five map-backed collections. Folder colours, the trash and\n   * the view state had no such route, so recolouring a folder would sit in\n   * IndexedDB until something happened to trigger a whole push. These close\n   * that gap without adding another thing to remember.\n   * ------------------------------------------------------------------------ */\n\n  const writeFoldersSoon = U.debounce(function () {\n    if (N.vault && N.vault.isFolderMode()) N.vault.saveAppData(\'folders.json\', folderRows());\n  }, 1200);\n\n  const writeTrashSoon = U.debounce(function () {\n    if (N.vault && N.vault.isFolderMode()) N.vault.saveAppData(\'trash.json\', trashRows());\n  }, 1200);\n\n  const writeViewStateSoon = U.debounce(function () {\n    if (!N.vault || !N.vault.isFolderMode()) return;\n    exportViewState().then(function (v) { N.vault.saveAppData(\'viewstate.json\', v); })\n      .catch(function () { /* view state is a convenience, never a blocker */ });\n  }, 3000);\n\n  bus.on(\'folder:created\', writeFoldersSoon);\n  bus.on(\'folder:renamed\', writeFoldersSoon);\n  bus.on(\'folder:deleted\', writeFoldersSoon);\n  bus.on(\'trash:changed\', writeTrashSoon);\n  bus.on(\'vault:changed\', function () { writeFoldersSoon(); writeViewStateSoon(); });\n\n',
    ),
]

SW_SOURCE = '/* =========================================================================\n * Nodalis — sw.js  (v9)\n *\n * WHY THIS FILE HAS TO EXIST\n *\n * Nodalis is one HTML file, deliberately. This is the one exception, and it is\n * not a choice: a notification with BUTTONS on it can only be shown by a\n * service worker. The web platform allows no other route.\n *\n *   new Notification(...)                        - no buttons, ever, anywhere.\n *                                                  Throws outright on Android.\n *   registration.showNotification(..., {actions}) - buttons. Requires this file.\n *\n * That is the whole of the "Snooze does nothing when I press it in the Windows\n * or Android notification" bug. Either there was no service worker at all, so\n * the notification had no buttons; or there was an older one from a previous\n * deployment that had never heard of \'notificationclick\', so the buttons were\n * drawn and pressing them did nothing. The app has always listened for the\n * message this file sends. Nothing was sending it.\n *\n * DEPLOY BOTH FILES. index.html and sw.js, side by side, same directory. If\n * this file is missing the app still works and reminders still appear - they\n * just lose their buttons, and the app says so plainly in Reminders.\n *\n * It also brings genuine offline use with it, which the app wanted anyway:\n * network first so a new deployment is never masked by a stale cache, cache\n * second so a plane or a tunnel does not take the app away.\n * ========================================================================= */\n\nconst VERSION = \'nodalis-v9\';\nconst SHELL = VERSION + \'-shell\';\n\nself.addEventListener(\'install\', function (event) {\n  // Take over immediately: a notification button that needs a reload before it\n  // works is a notification button that does not work.\n  self.skipWaiting();\n  event.waitUntil((async function () {\n    try {\n      const cache = await caches.open(SHELL);\n      await cache.addAll([\'./\', \'./index.html\']);\n    } catch (err) { /* a cold cache is not a failure */ }\n  })());\n});\n\nself.addEventListener(\'activate\', function (event) {\n  event.waitUntil((async function () {\n    const names = await caches.keys();\n    await Promise.all(names.map(function (n) {\n      return n.indexOf(VERSION) === 0 ? null : caches.delete(n);\n    }));\n    await self.clients.claim();\n  })());\n});\n\n/* ------------------------------------------------------------------ fetch */\n\nself.addEventListener(\'fetch\', function (event) {\n  const req = event.request;\n  if (req.method !== \'GET\') return;\n\n  const url = new URL(req.url);\n  if (url.origin !== self.location.origin) return;   // never touch GitHub\'s API\n\n  event.respondWith((async function () {\n    try {\n      const fresh = await fetch(req);\n      if (fresh && fresh.ok && fresh.type !== \'opaque\') {\n        try { (await caches.open(SHELL)).put(req, fresh.clone()); } catch (err) { /* full, or opaque */ }\n      }\n      return fresh;\n    } catch (err) {\n      const hit = await caches.match(req);\n      if (hit) return hit;\n      if (req.mode === \'navigate\') {\n        const shell = await caches.match(\'./index.html\');\n        if (shell) return shell;\n      }\n      throw err;\n    }\n  })());\n});\n\n/* --------------------------------------------------- notification buttons */\n\n/**\n * The bit that was missing.\n *\n * event.action is \'\' for a tap on the notification body, or the action id for\n * a button. Either way: bring a window to the front if there is one and tell\n * it what was pressed; if there is no window, open one with the instruction in\n * the URL so a snooze still happens when the app was closed.\n */\nself.addEventListener(\'notificationclick\', function (event) {\n  const action = event.action || \'open\';\n  const data = event.notification.data || {};\n  event.notification.close();\n\n  event.waitUntil((async function () {\n    const clients = await self.clients.matchAll({ type: \'window\', includeUncontrolled: true });\n    for (const client of clients) {\n      try { client.postMessage({ type: \'nd-remind-action\', action: action, id: data.id, kind: data.kind, refId: data.refId }); }\n      catch (err) { /* client going away */ }\n      if (\'focus\' in client) { try { await client.focus(); return; } catch (err) { /* try the next one */ } }\n      return;\n    }\n    const target = \'./?ndaction=\' + encodeURIComponent(action) +\n      \'&ndremind=\' + encodeURIComponent(data.id || \'\');\n    try { await self.clients.openWindow(target); } catch (err) { /* nothing else to try */ }\n  })());\n});\n\nself.addEventListener(\'message\', function (event) {\n  const d = event.data || {};\n  if (d.type === \'nd-sw-ping\' && event.source) {\n    try { event.source.postMessage({ type: \'nd-sw-pong\', version: VERSION, actions: true }); }\n    catch (err) { /* the page went away */ }\n  }\n  if (d.type === \'nd-sw-skip-waiting\') self.skipWaiting();\n});\n'


def fail(msg):
    sys.stderr.write('\n  ERROR: ' + msg + '\n\n')
    sys.exit(1)


def read(path):
    with io.open(path, 'r', encoding='utf-8') as fh:
        return fh.read()


def write(path, text):
    with io.open(path, 'w', encoding='utf-8', newline='') as fh:
        fh.write(text)


def main():
    if len(sys.argv) < 2:
        fail('usage: python3 %s /path/to/index.html' % os.path.basename(sys.argv[0]))
    path = sys.argv[1]
    if not os.path.isfile(path):
        fail('no such file: ' + path)

    text = read(path)
    original_text = text
    original_len = len(text)
    print('')
    print('  Nodalis v9 - settings that actually come back, and a Snooze that works')
    print('  ' + '-' * 70)
    print('  file    %s  (%s bytes)' % (path, format(original_len, ',d')))

    already = SENTINEL in text
    if already:
        print('')
        print('  index.html already has the v9 fixes.')
    else:
        if 'NODALIS' not in text or 'js/core/vault.js' not in text:
            fail('that does not look like a Nodalis index.html')
        if "N.version = '8.1.0'" not in text:
            fail('this patch expects the v8.1 build.\n'
                 '         Apply apply-nodalis-v8-1-fixes.py first, or start from\n'
                 '         the index-v8.1.html that came with it. Nothing changed.')

        # ------------------------------------------------------------ verify
        print('  ' + '-' * 70)
        print('  checking every anchor before writing anything')

        plan = []

        for name, old, new in EDITS:
            n = text.count(old)
            if n != 1:
                fail('anchor for "%s" was found %d times, expected exactly 1.\n'
                     '         Nothing has been changed.' % (name, n))
            plan.append(('edit', name, old, new))
            print('    ok   %s' % name)

        for name, start, end, body in REGIONS:
            if text.count(start) != 1:
                fail('start of region "%s" was found %d times, expected 1.\n'
                     '         Nothing has been changed.' % (name, text.count(start)))
            si = text.find(start)
            ei = text.find(end, si)
            if ei < 0:
                fail('end of region "%s" not found after its start. Nothing changed.' % name)
            plan.append(('region', name, text[si:ei + len(end)], body))
            print('    ok   %s (region, %s bytes)' % (name, format(ei + len(end) - si, ',d')))

        for name, anchor, body in INSERTS:
            n = text.count(anchor)
            if n != 1:
                fail('insertion point for "%s" was found %d times, expected 1.\n'
                     '         Nothing has been changed.' % (name, n))
            plan.append(('insert', name, anchor, body))
            print('    ok   %s (insert)' % name)

        # ------------------------------------------------------------- apply
        print('  ' + '-' * 70)
        for kind, name, a, b in plan:
            if kind == 'insert':
                text = text.replace(a, b + a, 1)
            else:
                text = text.replace(a, b, 1)

        # ------------------------------------------------------------ sanity
        problems = []
        for label, needle in (('<style>', '\n<style>\n'), ('<script>', '\n<script>\n')):
            was, now = original_text.count(needle), text.count(needle)
            if was != now:
                problems.append('%s blocks went from %d to %d' % (label, was, now))
        was_modules = len(re.findall(r'/\* ===== js/', original_text))
        modules = len(re.findall(r'/\* ===== js/', text))
        if modules != was_modules:
            problems.append('module count went from %d to %d' % (was_modules, modules))
        if SENTINEL not in text:
            problems.append('the patch did not leave its own marker behind')
        if "N.version = '%s'" % VERSION not in text:
            problems.append('the version stamp was not updated')
        for must in ('isFreshDevice', 'shouldAdoptSettings', 'folderSettingsHeld',
                     'adoptFolderSettings', 'pullVersions', 'trashRows',
                     'importViewState', 'applyAction', 'consumeUrlAction'):
            if must not in text:
                problems.append('%s is missing from the result' % must)
        if len(text) <= original_len:
            problems.append('the file did not grow, which cannot be right')
        if problems:
            fail('the result failed its own checks, so nothing was saved:\n         - '
                 + '\n         - '.join(problems))

        # ------------------------------------------------------------- write
        backup = path + '.bak-' + time.strftime('%Y%m%d-%H%M%S')
        shutil.copy2(path, backup)
        write(path, text)
        print('  applied %d changes' % len(plan))
        print('  backup  %s' % backup)
        print('  result  %s bytes (+%s)'
              % (format(len(text), ',d'), format(len(text) - original_len, ',d')))

    # ------------------------------------------------------------------ sw.js
    sw_path = os.path.join(os.path.dirname(os.path.abspath(path)) or '.', 'sw.js')
    existing = read(sw_path) if os.path.isfile(sw_path) else None
    if existing == SW_SOURCE:
        print('  sw.js   already up to date  (%s)' % sw_path)
    else:
        if existing is not None:
            shutil.copy2(sw_path, sw_path + '.bak-' + time.strftime('%Y%m%d-%H%M%S'))
            print('  sw.js   replaced an older one (backed up)')
        write(sw_path, SW_SOURCE)
        print('  sw.js   written  %s  (%s bytes)' % (sw_path, format(len(SW_SOURCE), ',d')))

    print('')
    print('  UPLOAD BOTH FILES')
    print('  ' + '-' * 70)
    print('   index.html and sw.js, side by side in the same directory.')
    print('   sw.js is what puts Snooze and Done on the notification itself.')
    print('')
    print('  WHAT TO CHECK, IN THIS ORDER')
    print('  ' + '-' * 70)
    print('   1. Hard-refresh twice. The loading screen should read v9.0.0, and')
    print('      the console should say "service worker nodalis-v9 is handling')
    print('      notifications".')
    print('   2. Set a theme and accent. Look in .nodalis/settings.json - wrapped,')
    print('      stamped, and with no githubToken anywhere in it.')
    print('   3. Clear site data completely, reload, and pick the same folder.')
    print('      Theme, accent, fonts, density, shortcuts, folder colours,')
    print('      collapsed folders and your trash should all come back.')
    print('   4. Set a reminder a minute out, switch to another window, and press')
    print('      Snooze on the Windows/Android notification. It should snooze.')
    print('   5. Do the same with the tab closed. It should open the app and')
    print('      snooze, then take the parameters back out of the address bar.')
    print('')


if __name__ == '__main__':
    main()
