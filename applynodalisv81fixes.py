#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply-nodalis-v8-1-fixes.py
===========================

Nodalis v8.1 - "it remembers, and it stays connected".

This is a narrow patch. It changes five files' worth of logic inside the single
index.html and touches nothing else: no new features, no new UI, no restyling.
Every v8 feature keeps working exactly as it does now.

WHAT WAS WRONG, IN THE ORDER YOU NOTICED IT
-------------------------------------------

1.  ONLY THE FOLDER AND THE NOTES CAME BACK.

    Your theme, accent, fonts, density, roundness, animation level, editor
    preferences and keyboard overrides really were being saved into the folder.
    vault.pushAppData() wrote .nodalis/settings.json on every change and always
    had. The problem was at the other end: vault.pullAppData() read
    stickies.json, tasks.json, scratch.json, journal.json and every canvas -
    and never read settings.json. Not once, in any build.

    So the file was written, and nothing ever opened it. Reset the app, pick the
    same folder, and the notes came back (they are real markdown files) while
    every preference sat at its default with the real values unread a few bytes
    away. v8.1 reads that file.

2.  THE FOLDER KEPT DISCONNECTING.

    Three separate causes, all fixed here:

    a.  The one-shot recovery. armSilentReconnect() removed its own event
        listeners on the FIRST gesture, before checking whether there was
        anything to do. The first tap after load - anywhere, on anything -
        burned the single attempt, and if the status had not settled yet, the
        recovery never ran at all. Now it re-arms, tries the free
        queryPermission() path before ever showing a dialog, and rate-limits
        actual prompts to one per 45 seconds instead of one per session.

    b.  Nothing watched. There was one attempt at one moment. Now the tab
        re-checks when it comes back to the front, on focus, on pageshow, when
        the network returns, and on a slow timer while visible - so a folder
        that becomes reachable again is picked up silently, with no dialog.
        The same watcher notices a grant lapsing mid-session, which previously
        left the write queue accepting edits and discarding them.

    c.  Nothing protected the handle. The folder handle lives in IndexedDB, and
        a browser may evict that under storage pressure unless asked not to.
        navigator.storage.persist() was wired only to a button in Settings.
        v8.1 asks at boot and whenever a folder is adopted.

3.  RECONNECTING COULD EAT AN OFFLINE EDIT.  (You had not hit this yet.)

    store.upsertFromDisk() took a lastModified argument and never looked at it,
    so disk won unconditionally. Reconnecting runs pullAll() before pushAll(),
    which meant every note edited while the folder was disconnected was
    overwritten by the older copy on disk - and then that older copy was pushed
    back out. Now the newer side wins; ties still go to disk, so editing your
    notes in Obsidian still works the way it always has.

4.  TWO COPIES OF THE SAME RULES.

    The GitHub restore had its own hand-written list of which settings are
    secret and which belong to one device. It had drifted: it did not know about
    share-link passwords, and it did not know that githubRev and githubManifest
    describe what THIS device last pushed. Both paths now go through one
    function, which also re-applies the theme and rebuilds the keyboard map -
    something the GitHub path never did, so a restored theme used to sit in
    memory behind an unchanged screen until the next reload.

AND ONE THING THAT WAS QUIETLY UNSAFE
-------------------------------------

    The old folder write was `saveAppData('settings.json', state.settings)` -
    the settings object, verbatim, including your GitHub token and the password
    for every encrypted share link. Into a folder people sync to Dropbox,
    commit to git and copy onto USB sticks. Storing the password beside the
    thing it encrypts makes the encryption decorative.

    v8.1 writes a wrapped envelope containing only portable preferences.
    Secrets never leave this browser's database, and the per-device sync
    bookkeeping does not travel either. The repository address does travel, but
    only as a seed - it fills in an empty field and never overwrites a working
    connection - so after a reset you paste your token instead of running the
    whole wizard again.

    Old, unwrapped settings.json files from v8 are still read. They are treated
    as older than anything this device has done, so they win exactly where they
    should: on a device with no history of its own, which is the after-a-reset
    case.

HOW TO RUN IT
-------------

    python3 apply-nodalis-v8-1-fixes.py index.html

  - a timestamped .bak is written beside the file before anything changes
  - every anchor is located and verified BEFORE a single byte is written; if
    any one of them is missing or ambiguous, nothing is touched at all
  - running it twice is safe: the second run recognises its own work and exits
"""

import io
import os
import re
import shutil
import sys
import time

SENTINEL = 'v8.1: THE MISSING LINE'
VERSION = '8.1.0'

EDITS = [
    (
        'version stamp',
        "  N.version = '8.0.0';\n  N.versionName = 'v8';\n  N.built = '2026-08-24';",
        "  N.version = '8.1.0';\n  N.versionName = 'v8.1';\n  N.built = '2026-08-25';",
    ),
    (
        'settings timestamp in DEFAULT_SETTINGS',
        '    /* keymap overrides: commandId -> "Mod+Shift+K" */\n    keymap: {},\n  };',
        '    /* keymap overrides: commandId -> "Mod+Shift+K" */\n    keymap: {},\n\n    /*\n     * v8.1: when these preferences were last changed, on whichever device\n     * changed them.\n     *\n     * This one number is what makes "restore my settings from the folder" a\n     * decision rather than a guess. Without it there are only two options and\n     * both are wrong: let the folder always win, and an offline change is\n     * silently reverted the next time you connect; let the folder never win,\n     * and a freshly reset app comes up with default colours while your real\n     * preferences sit unread in a file inside the folder you just picked.\n     * With it, the later copy wins, which is what anyone would expect.\n     */\n    settingsSavedAt: 0,\n  };',
    ),
    (
        'saveSettings writes a stamped, secret-free envelope',
        "  async function saveSettings(patch) {\n    if (patch) U.deepMerge(state.settings, patch);\n    await db.setSetting('settings', state.settings);\n    if (N.vault && N.vault.isFolderMode()) N.vault.saveAppData('settings.json', state.settings);\n    bus.emit('settings:changed', state.settings);\n  }",
        "  async function saveSettings(patch) {\n    if (patch) U.deepMerge(state.settings, patch);\n    /*\n     * v8.1: stamp the change, then write the WRAPPED copy.\n     *\n     * The line this replaces handed state.settings to the folder verbatim -\n     * GitHub token and share-link passwords included - into a directory that\n     * people deliberately sync to Dropbox, commit to git, and copy onto USB\n     * sticks. Backing up the password for an encrypted note beside the\n     * encrypted note makes the encryption decorative.\n     *\n     * The stamp is the other half: see settingsSavedAt in DEFAULT_SETTINGS.\n     */\n    state.settings.settingsSavedAt = Date.now();\n    await db.setSetting('settings', state.settings);\n    writeSettingsToFolder();\n    bus.emit('settings:changed', state.settings);\n  }",
    ),
    (
        'disk reconcile respects which side is newer',
        "    if (existing) {\n      const sameBody = existing.content === parsed.content;\n      const sameProps = JSON.stringify(existing.properties || {}) === JSON.stringify(parsed.properties || {});\n      if (sameBody && sameProps) return 'unchanged';\n      existing.content = parsed.content;",
        '    if (existing) {\n      const sameBody = existing.content === parsed.content;\n      const sameProps = JSON.stringify(existing.properties || {}) === JSON.stringify(parsed.properties || {});\n      if (sameBody && sameProps) return \'unchanged\';\n\n      /*\n       * v8.1: DISK WINS, BUT ONLY WHEN DISK IS ACTUALLY NEWER.\n       *\n       * The comment on pullAll() says "disk wins on conflict - the folder is\n       * the source of truth, so an edit made in Obsidian survives", and that\n       * is the right rule. But it was implemented as "disk wins, full stop",\n       * with lastModified accepted as a parameter and then never looked at.\n       *\n       * That is fine on a normal read and quietly destructive on a reconnect.\n       * When the folder permission lapses the app keeps working - notes are\n       * still written to IndexedDB, the user has no idea anything is wrong.\n       * Reconnecting then runs pullAll() before pushAll(), so every note\n       * edited while disconnected was overwritten by the older copy still on\n       * disk, and then that older copy was pushed back out. The edit was gone\n       * from both places, with no error and nothing to undo.\n       *\n       * So compare the two clocks and let the newer side win. A tie, or\n       * anything inside the slack, still goes to disk - that keeps the\n       * external-editor promise intact, which is the case this rule exists for.\n       */\n      const diskAt = Number(lastModified) || 0;\n      const localAt = Number(existing.updatedAt) || 0;\n      if (diskAt && localAt && (localAt - diskAt) > DISK_CLOCK_SLACK) {\n        return \'local-newer\';\n      }\n\n      existing.content = parsed.content;',
    ),
    (
        'store exports the settings-restore path',
        '    loadAll: loadAll, load: loadAll, replaceAllNotes: replaceAllNotes, saveSettings: saveSettings, setSetting: setSetting, getSetting: getSetting,',
        '    loadAll: loadAll, load: loadAll, replaceAllNotes: replaceAllNotes, saveSettings: saveSettings, setSetting: setSetting, getSetting: getSetting,\n    /* v8.1: one settings-restore path, shared by the folder and by GitHub. */\n    applyRestoredSettings: applyRestoredSettings, portableSettings: portableSettings,\n    settingsEnvelope: settingsEnvelope, readSettingsEnvelope: readSettingsEnvelope,\n    writeSettingsToFolder: writeSettingsToFolder, normalizeSettings: normalizeSettings,',
    ),
    (
        'connecting a folder also protects the handle and starts the watch',
        "    await N.db.setSetting('vault-name', root.name);\n    setStatus('ok', '');\n    bus.emit('vault:connected', { name: root.name, createdContainer: root.created });",
        "    await N.db.setSetting('vault-name', root.name);\n    setStatus('ok', '');\n    /*\n     * v8.1: two things have to happen the moment a folder is adopted.\n     *\n     * The handle written on the line above lives in IndexedDB, which browsers\n     * are free to evict under storage pressure unless asked not to. Losing it\n     * does not lose a cache - it forgets which folder is yours, which is one\n     * of the ways this connection kept disappearing. keepStorage() asks.\n     *\n     * And the grant has to be watched from here on, so a lapse is noticed and\n     * recovered rather than discovered later as writes that never landed.\n     */\n    keepStorage();\n    installConnectionWatch();\n    bus.emit('vault:connected', { name: root.name, createdContainer: root.created });",
    ),
    (
        'a write that loses permission arms the recovery',
        "    const ok = await ensurePermission(false);\n    if (!ok) {\n      flushing = false;\n      setStatus('permission', 'Nodalis lost write access to your folder. Reconnect it to resume saving to disk.');\n      return;\n    }",
        "    const ok = await ensurePermission(false);\n    if (!ok) {\n      flushing = false;\n      setStatus('permission', 'Nodalis lost write access to your folder. Reconnect it to resume saving to disk.');\n      /*\n       * v8.1: this used to be the end of it. The status line changed, the queue\n       * sat there, and every subsequent edit was accepted and dropped - with no\n       * route back to a working folder short of finding the reconnect button in\n       * Settings. Arm the recovery so the next tap can fix it.\n       */\n      armSilentReconnect();\n      return;\n    }",
    ),
    (
        'a restored folder also protects the handle and starts the watch',
        "    if (granted) {\n      setStatus('ok', '');\n      bus.emit('vault:connected', { name: vault.name, restored: true });\n      return { restored: true, name: vault.name };\n    }",
        "    if (granted) {\n      setStatus('ok', '');\n      /* v8.1: same two duties as connectFolder - see the note there. */\n      keepStorage();\n      installConnectionWatch();\n      bus.emit('vault:connected', { name: vault.name, restored: true });\n      return { restored: true, name: vault.name };\n    }",
    ),
    (
        'the folder gets the wrapped settings, not the raw ones',
        "      await writeFile(APP_DIR + '/settings.json', JSON.stringify(s.settings, null, 2));",
        "      /*\n       * v8.1: the wrapped, secret-free copy - see saveSettings() in store.js.\n       * Writing s.settings straight out put the GitHub token and every\n       * share-link password into the folder.\n       */\n      await writeFile(APP_DIR + '/settings.json', JSON.stringify(\n        N.store.settingsEnvelope ? N.store.settingsEnvelope() : s.settings, null, 2));",
    ),
    (
        'the folder read finally includes settings.json',
        "    await load('stickies.json', (d) => N.store.replaceCollection('stickies', d));",
        "    /* ===================================================================== *\n     * v8.1: THE MISSING LINE.\n     *\n     * pushAppData() has always written .nodalis/settings.json. Every theme\n     * change, every font, every accent colour, every keyboard override went\n     * into that file on the way out. This function read stickies.json,\n     * tasks.json, scratch.json, journal.json and every canvas on the way back\n     * in - and never once read settings.json.\n     *\n     * So the data was there the whole time and nothing ever looked at it. Reset\n     * the app, point it at the same folder, and the notes came back because\n     * those are real markdown files, while every preference stayed at its\n     * default with the real values sitting unread a few bytes away. That is the\n     * entire reported bug, and this is where it lived.\n     *\n     * Settings are read FIRST, before the collections, so the theme is right\n     * before anything is painted with it.\n     * ===================================================================== */\n    await load('settings.json', async function (data) {\n      const parsed = N.store.readSettingsEnvelope ? N.store.readSettingsEnvelope(data) : null;\n      if (!parsed) return;\n      const mine = Number(N.store.state.settings.settingsSavedAt) || 0;\n      // This device is at least as up to date: leave it alone. Without this an\n      // offline change would be reverted every time the folder was re-read.\n      if (parsed.savedAt <= mine) return;\n      await N.store.applyRestoredSettings(parsed.settings, {\n        savedAt: parsed.savedAt,\n        writeBack: false,          // it came FROM this file; do not rewrite it\n      });\n      bus.emit('vault:settings-restored', { savedAt: parsed.savedAt, device: parsed.device });\n    });\n\n    await load('stickies.json', (d) => N.store.replaceCollection('stickies', d));",
    ),
    (
        'vault exports the connection watch',
        '    armSilentReconnect: armSilentReconnect,\n  };',
        '    armSilentReconnect: armSilentReconnect,\n    /* v8.1 */\n    checkConnection: checkConnection, keepStorage: keepStorage,\n    installConnectionWatch: installConnectionWatch,\n  };',
    ),
    (
        'a GitHub restore goes through the same settings path as the folder',
        "        const dump = JSON.parse(vaultFile.text);\n        // Keep this device's own GitHub credentials — they are not portable.\n        const keep = Object.assign({}, N.store.state.settings);\n        await N.db.importAll(dump, { replace: true });\n        await N.store.load();\n        const restored = Object.assign({}, N.store.state.settings, {\n          githubToken: keep.githubToken,\n          githubOwner: keep.githubOwner,\n          githubRepo: keep.githubRepo,\n          githubBranch: keep.githubBranch,\n          deviceName: keep.deviceName,\n        });\n        N.store.state.settings = restored;\n        await N.store.saveSettings();",
        '        const dump = JSON.parse(vaultFile.text);\n        /*\n         * v8.1: ONE RESTORE PATH, NOT TWO.\n         *\n         * What this replaced worked, but it was a second hand-written copy of\n         * the same rules - which fields are secret, which belong to this device\n         * and which travel - kept in a different module from the folder path.\n         * Two lists of the same thing drift: this one never learned about\n         * sharePasswords, and had no idea githubRev and githubManifest describe\n         * what THIS device last pushed, so a restore could leave the conflict\n         * detector comparing against a revision this device had never sent.\n         *\n         * store.applyRestoredSettings() is now the only thing that knows those\n         * rules, and it also re-applies the theme and rebuilds the keyboard map\n         * afterwards - which the old code did not, so a restored theme sat in\n         * memory behind an unchanged screen until the next reload.\n         */\n        const keep = Object.assign({}, N.store.state.settings);\n        await N.db.importAll(dump, { replace: true });\n        await N.store.load();\n        const incoming = Object.assign({}, N.store.state.settings);\n        // Start from what this device had - token, repository address and sync\n        // bookkeeping intact - then let the restored copy through the filter.\n        N.store.state.settings = keep;\n        await N.store.applyRestoredSettings(incoming, {\n          savedAt: Number(incoming.settingsSavedAt) || Date.now(),\n        });',
    ),
    (
        'boot asks the browser to keep this data',
        "      stage('opening local database', 0.18, 1, progress);\n      await withTimeout(N.db.open(), 9000, 'opening local database');",
        '      stage(\'opening local database\', 0.18, 1, progress);\n      await withTimeout(N.db.open(), 9000, \'opening local database\');\n      /*\n       * v8.1: ask once, as early as possible, and never block on the answer.\n       *\n       * Everything this app owns is in the database that just opened - notes,\n       * settings, and the handle for the folder you picked. A browser is\n       * entitled to evict all of it under storage pressure unless it has been\n       * asked not to, and until v8.1 the only thing that ever asked was a\n       * button buried in Settings that almost nobody presses. Eviction is the\n       * quiet version of "it keeps disconnecting": the folder handle goes, so\n       * the app comes up with no folder and no explanation.\n       */\n      N.db.requestPersistence().catch(function () { /* advisory only */ });',
    ),
]

REGIONS = [
    (
        'vault reconnect logic',
        '  /*\n   * When the grant really has expired, requestPermission() needs a user',
        "    document.addEventListener('keydown', attempt, true);\n  }",
        '  /* ===================================================================== *\n   * v8.1: STAYING CONNECTED\n   *\n   * The old version of this did one thing and then gave up. Read it in order:\n   *\n   *     const attempt = async function () {\n   *       document.removeEventListener(\'pointerdown\', attempt, true);\n   *       document.removeEventListener(\'keydown\', attempt, true);\n   *       if (vault.status !== \'permission\' || !vault.handle) return;\n   *\n   * The listeners came off on the FIRST gesture, before anything was even\n   * checked. So the first tap after load - a tap on the sidebar, a keypress in\n   * the editor, anything at all - burned the one and only attempt. If that tap\n   * happened before the status had settled to \'permission\', the recovery never\n   * ran at all and the folder stayed disconnected for the rest of the session\n   * with no way back except Settings. That is why it "keeps disconnecting".\n   *\n   * Three things are wrong with only asking once, and all three are fixed here:\n   *\n   *   1. THE FREE PATH WAS NEVER TRIED. Browsers hand the grant back on their\n   *      own more often than you would think - a new tab, a fresh session, a\n   *      site permission the user allowed permanently. queryPermission() costs\n   *      nothing and needs no gesture. Ask that first, every time, and most\n   *      reconnections happen with no dialog and no click.\n   *\n   *   2. NOTHING WATCHED FOR THE GRANT COMING BACK. There was one attempt at\n   *      one moment. Now the tab checks whenever it is brought back to the\n   *      front, whenever it regains focus, and on a slow timer while visible -\n   *      so a folder that becomes reachable again gets picked up by itself.\n   *\n   *   3. NOTHING NOTICED IT GOING AWAY. If the grant lapsed mid-session the\n   *      queue kept accepting writes and quietly dropping them at flush time.\n   *      The same watcher now catches that and re-arms the recovery.\n   *\n   * What has NOT changed is the manners. A permission dialog on every tap is\n   * worse than a broken folder, so an actual prompt is still gesture-driven,\n   * one at a time, and rate-limited. The difference is that declining once no\n   * longer ends the conversation forever.\n   * ===================================================================== */\n\n  let reconnectArmed = false;      // are we listening for a gesture?\n  let reconnectAsking = false;     // is a prompt on screen right now?\n  let lastAskAt = 0;               // when we last put a dialog in front of them\n  let watchInstalled = false;\n  let checking = false;\n  let storageAsked = false;\n\n  const ASK_COOLDOWN = 45000;      // never prompt twice inside this window\n  const WATCH_INTERVAL = 45000;    // and re-check quietly this often\n\n  /**\n   * Ask the browser to keep this origin\'s data. It matters far more than it\n   * looks: the folder handle itself lives in IndexedDB, so if this data is\n   * evicted under storage pressure the app does not just lose its cache - it\n   * forgets which folder is yours and has to be re-linked from scratch. This\n   * needs no gesture and no permission dialog on any current browser.\n   */\n  function keepStorage() {\n    if (storageAsked) return;\n    storageAsked = true;\n    try {\n      if (!N.db || !N.db.requestPersistence) return;\n      N.db.requestPersistence().then(function (r) {\n        if (!r || !r.granted) console.info(\'[vault] the browser would not mark this data persistent\');\n      }).catch(function () { /* advisory only */ });\n    } catch (err) { /* advisory only */ }\n  }\n\n  async function queryGrant() {\n    if (!vault.handle || !vault.handle.queryPermission) return \'denied\';\n    try { return await vault.handle.queryPermission({ mode: \'readwrite\' }); }\n    catch (err) { return \'denied\'; }\n  }\n\n  /** Take the grant we have been given and start using the folder again. */\n  async function adoptGrant(opts) {\n    const o = opts || {};\n    vault.mode = \'folder\';\n    try { await N.db.setSetting(\'vault-mode\', \'folder\'); } catch (err) { /* not fatal */ }\n    disarmSilentReconnect();\n    setStatus(\'ok\', \'\');\n    keepStorage();\n    bus.emit(\'vault:connected\', { name: vault.name, restored: true });\n    if (o.toast && N.toast) {\n      N.toast.success(\'Reconnected to "\' + vault.name + \'". Saving to your folder again.\', { ms: 4000 });\n    }\n    /*\n     * Catch up, in this order and for this reason.\n     *\n     * flushNow() first: when the grant lapsed, flush() bailed out and left\n     * whatever it was carrying in the queue - and because it bailed it also\n     * never rescheduled itself, so those writes would have sat there until the\n     * next unrelated edit happened to kick the timer. They are the newest\n     * version of anything they touch, so they go to disk before anything is\n     * read back.\n     *\n     * Then pull, which is timestamp-aware as of v8.1 and so can no longer\n     * overwrite an edit made while the folder was away, and finally push, which\n     * puts everything else on disk.\n     */\n    try { await flushNow(); } catch (err) { console.warn(\'[vault] catch-up flush failed\', err); }\n    try { await pullAll(); } catch (err) { console.warn(\'[vault] catch-up pull failed\', err); }\n    try { await pushAll(); } catch (err) { console.warn(\'[vault] catch-up push failed\', err); }\n  }\n\n  /** The no-dialog path: only acts if the browser already says yes. */\n  async function adoptIfGranted(opts) {\n    if (!vault.handle) return false;\n    if ((await queryGrant()) !== \'granted\') return false;\n    await adoptGrant(opts || {});\n    return true;\n  }\n\n  async function onReconnectGesture() {\n    if (!vault.handle) { disarmSilentReconnect(); return; }\n    if (vault.mode === \'folder\' && vault.status !== \'permission\') { disarmSilentReconnect(); return; }\n    if (reconnectAsking) return;\n\n    // Free first, always.\n    if (await adoptIfGranted({ toast: true })) return;\n\n    if (Date.now() - lastAskAt < ASK_COOLDOWN) return;\n    reconnectAsking = true;\n    lastAskAt = Date.now();\n    try {\n      const ok = await requestPermissionFor(vault.handle);\n      if (!ok) {\n        setStatus(\'permission\', \'Nodalis cannot write to "\' + vault.name + \'" until you allow it again.\');\n        return;\n      }\n      await adoptGrant({ toast: true });\n    } catch (err) {\n      console.warn(\'[vault] reconnect attempt failed\', err);\n    } finally {\n      reconnectAsking = false;\n    }\n  }\n\n  function armSilentReconnect() {\n    installConnectionWatch();\n    if (reconnectArmed) return;\n    reconnectArmed = true;\n    // Capture phase: the gesture still does whatever it was going to do.\n    document.addEventListener(\'pointerdown\', onReconnectGesture, true);\n    document.addEventListener(\'keydown\', onReconnectGesture, true);\n  }\n\n  function disarmSilentReconnect() {\n    if (!reconnectArmed) return;\n    reconnectArmed = false;\n    document.removeEventListener(\'pointerdown\', onReconnectGesture, true);\n    document.removeEventListener(\'keydown\', onReconnectGesture, true);\n  }\n\n  /**\n   * The quiet half. No dialogs ever come from here - it only reads the grant\n   * and reacts, which is what makes it safe to run on a timer.\n   */\n  async function checkConnection() {\n    if (checking || !vault.handle || document.hidden) return;\n    checking = true;\n    try {\n      if (vault.mode === \'folder\') {\n        const st = await queryGrant();\n        if (st === \'granted\') {\n          if (vault.status === \'permission\') setStatus(\'ok\', \'\');\n          keepStorage();\n          return;\n        }\n        // It lapsed under us. Say so, stop pretending writes are landing, and\n        // arm the recovery instead of silently dropping everything at flush.\n        vault.mode = \'browser\';\n        setStatus(\'permission\', \'Reconnect "\' + vault.name + \'" to resume saving to your folder.\');\n        armSilentReconnect();\n        return;\n      }\n      // We still hold the handle but are not using it. If the browser has\n      // handed the grant back, take it - silently, with no dialog.\n      await adoptIfGranted({ toast: true });\n    } catch (err) {\n      console.warn(\'[vault] connection check failed\', err);\n    } finally {\n      checking = false;\n    }\n  }\n\n  function installConnectionWatch() {\n    if (watchInstalled) return;\n    watchInstalled = true;\n    const check = function () { checkConnection(); };\n    document.addEventListener(\'visibilitychange\', function () { if (!document.hidden) check(); });\n    window.addEventListener(\'focus\', check);\n    window.addEventListener(\'online\', check);\n    window.addEventListener(\'pageshow\', check);\n    setInterval(check, WATCH_INTERVAL);\n  }',
    ),
]

INSERTS = [
    (
        'settings portability helpers',
        '  async function saveSettings(patch) {',
        '  /* ===================================================================== *\n   * v8.1: WHICH SETTINGS TRAVEL, AND WHICH STAY ON THIS DEVICE\n   *\n   * THE BUG THIS EXISTS TO FIX.\n   *\n   * pushAppData() wrote .nodalis/settings.json into the vault folder on every\n   * change - so your theme, fonts, density, accent, keyboard overrides and\n   * every other preference genuinely WERE in the folder, exactly as you would\n   * expect. And pullAppData() read stickies.json, tasks.json, scratch.json,\n   * journal.json and every canvas... and never read settings.json. Not once.\n   *\n   * So the data was being saved and never loaded. Reset the app, point it back\n   * at the same folder, and the notes and folders came back - because those are\n   * real markdown files - while every preference stayed at its default, sitting\n   * unread in a file six inches away. That is the whole of the reported bug.\n   *\n   * Fixing the read is one function call. The interesting part is deciding what\n   * SHOULD be in that file, because "all of it" is the wrong answer:\n   *\n   *   SECRETS must not go in. A vault folder gets synced to Dropbox, put in a\n   *   git repository, copied to a USB stick and shared with people. Writing a\n   *   GitHub token into it - and worse, writing the passwords for encrypted\n   *   share links into the same account that holds the encrypted notes - would\n   *   hand over the keys along with the locks. The GitHub backup path already\n   *   stripped these; the folder path stripped nothing.\n   *\n   *   PER-DEVICE SYNC BOOKKEEPING must not go in. githubRev and githubManifest\n   *   record what THIS device last pushed. Restoring another device\'s copy\n   *   would make the conflict detector compare against a revision this device\n   *   never sent, and it would either re-upload everything or refuse to push.\n   *\n   *   THE REPOSITORY ADDRESS should go in, but only as a SEED. Knowing which\n   *   repository your notes belong to is not a secret, and having it already\n   *   filled in after a reset turns "run the whole five-step wizard again"\n   *   into "paste your token". But it must never overwrite a connection that\n   *   is already working on this device.\n   *\n   * Everything else - which is to say all of the actual customisation - travels.\n   * ===================================================================== */\n\n  /* Never leave this device. Not to the folder, not to GitHub, not anywhere. */\n  const SECRET_SETTINGS = [\'githubToken\', \'sharePasswords\'];\n\n  /* This device\'s own sync bookkeeping. Portable in form, meaningless - and\n     actively harmful - anywhere else. */\n  const DEVICE_SETTINGS = [\n    \'githubRev\', \'githubSyncedAt\', \'githubDirty\', \'githubManifest\',\n    \'githubCommit\', \'deviceName\',\n  ];\n\n  /* Filled in from a restore only when this device has nothing of its own. */\n  const SEED_ONLY_SETTINGS = [\'githubOwner\', \'githubRepo\', \'githubBranch\'];\n\n  /* How much clock skew to forgive when comparing a file\'s modification time\n     against a note\'s own updatedAt. Two different clocks wrote them, and some\n     filesystems round to the nearest second or two. */\n  const DISK_CLOCK_SLACK = 2500;\n\n  /** The copy that is safe to write into a folder or a repository. */\n  function portableSettings(settings) {\n    const out = U.deepClone(settings || state.settings);\n    SECRET_SETTINGS.concat(DEVICE_SETTINGS).forEach(function (k) { delete out[k]; });\n    return out;\n  }\n\n  /**\n   * Merge a restored copy over what this device has, honouring the three rules\n   * above. Returns a new object; nothing is written.\n   */\n  function mergeRestoredSettings(current, incoming) {\n    const next = U.deepClone(current || {});\n    if (!incoming || typeof incoming !== \'object\') return next;\n    Object.keys(incoming).forEach(function (key) {\n      if (SECRET_SETTINGS.indexOf(key) !== -1) return;      // never\n      if (DEVICE_SETTINGS.indexOf(key) !== -1) return;      // never\n      if (SEED_ONLY_SETTINGS.indexOf(key) !== -1) {\n        if (!current || !current[key]) next[key] = incoming[key];\n        return;\n      }\n      next[key] = incoming[key];\n    });\n    return next;\n  }\n\n  /**\n   * The file that goes into the folder. Wrapped rather than bare so it carries\n   * its own timestamp - which is what lets a restore tell whether the folder\'s\n   * copy is newer than this device\'s, instead of guessing. A bare object (what\n   * every build before this one wrote) is still understood on the way in.\n   */\n  function settingsEnvelope() {\n    return {\n      nodalis: \'settings\',\n      version: N.version || \'\',\n      savedAt: state.settings.settingsSavedAt || Date.now(),\n      device: state.settings.deviceName || \'\',\n      note: \'Your Nodalis preferences. Secrets (GitHub token, share-link passwords) are deliberately NOT in here.\',\n      settings: portableSettings(state.settings),\n    };\n  }\n\n  /** Read either shape back. */\n  function readSettingsEnvelope(data) {\n    if (!data || typeof data !== \'object\') return null;\n    if (data.nodalis === \'settings\' && data.settings && typeof data.settings === \'object\') {\n      return { settings: data.settings, savedAt: Number(data.savedAt) || 0, device: data.device || \'\' };\n    }\n    // Pre-8.1: the file was the settings object itself, with no timestamp. Treat\n    // it as older than anything this device has done, so it only wins when this\n    // device has no history of its own - which is exactly the after-a-reset case\n    // it needs to win in.\n    if (data.themeStyle || data.uiFont || data.keymap) {\n      return { settings: data, savedAt: 1, device: \'\' };\n    }\n    return null;\n  }\n\n  function writeSettingsToFolder() {\n    if (!N.vault || !N.vault.isFolderMode || !N.vault.isFolderMode()) return;\n    try { N.vault.saveAppData(\'settings.json\', settingsEnvelope()); }\n    catch (err) { console.warn(\'[store] could not queue settings for the folder\', err); }\n  }\n\n  /**\n   * Fill in anything the restored copy did not carry, and run it through the\n   * same migration every locally-loaded settings object goes through, so a file\n   * written by an older build cannot leave the app holding a half-shaped object.\n   */\n  function normalizeSettings(raw) {\n    const merged = U.deepMerge(U.deepClone(DEFAULT_SETTINGS), raw || {});\n    migrateSettings(merged);\n    return merged;\n  }\n\n  /**\n   * Take a restored set of preferences and make them live: merged, saved, and\n   * re-applied. Re-applying matters - the theme, fonts, density and keyboard\n   * map are all read at apply time, so without this the right values would sit\n   * in memory behind the wrong-looking screen.\n   *\n   *   opts.savedAt    - the timestamp the restored copy carried, so this device\n   *                     does not claim the change as its own\n   *   opts.writeBack  - false when the copy came FROM the folder, so reading it\n   *                     does not immediately rewrite the file it came from\n   */\n  async function applyRestoredSettings(incoming, opts) {\n    const o = opts || {};\n    const merged = mergeRestoredSettings(state.settings, incoming);\n    merged.settingsSavedAt = o.savedAt || Date.now();\n    state.settings = normalizeSettings(merged);\n    await db.setSetting(\'settings\', state.settings);\n    if (o.writeBack !== false) writeSettingsToFolder();\n\n    bus.emit(\'settings:changed\', state.settings);\n    // Everything that is read rather than watched has to be told again.\n    try { if (N.theme && N.theme.apply) N.theme.apply(); } catch (err) { console.warn(\'[store] theme re-apply\', err); }\n    try { if (N.shortcuts && N.shortcuts.rebuild) N.shortcuts.rebuild(); } catch (err) { console.warn(\'[store] shortcut rebuild\', err); }\n    bus.emit(\'settings:restored\', state.settings);\n    return state.settings;\n  }\n\n',
    ),
]


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
    print('  Nodalis v8.1 - settings in the folder, and a folder that stays connected')
    print('  ' + '-' * 70)
    print('  file    %s  (%s bytes)' % (path, format(original_len, ',d')))

    if SENTINEL in text:
        print('')
        print('  This file already has the v8.1 fixes. Nothing to do.')
        print('')
        return

    if 'NODALIS' not in text or 'js/core/vault.js' not in text:
        fail('that does not look like a Nodalis index.html')
    if 'N.version' not in text:
        fail('this patch expects a v8 build (no version module found)')

    # ---------------------------------------------------------------- verify
    print('  ' + '-' * 70)
    print('  checking every anchor before writing anything')

    plan = []

    for name, old, new in EDITS:
        n = text.count(old)
        if n != 1:
            fail('anchor for "%s" was found %d times, expected exactly 1.\n'
                 '         This usually means the file is not a clean v8 build.\n'
                 '         Nothing has been changed.' % (name, n))
        plan.append(('edit', name, old, new))
        print('    ok   %s' % name)

    for name, start, end, body in REGIONS:
        si = text.find(start)
        if si < 0:
            fail('start of region "%s" not found. Nothing has been changed.' % name)
        if text.count(start) != 1:
            fail('start of region "%s" is ambiguous. Nothing has been changed.' % name)
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

    # ---------------------------------------------------------------- apply
    print('  ' + '-' * 70)
    for kind, name, a, b in plan:
        if kind == 'edit' or kind == 'region':
            text = text.replace(a, b, 1)
        else:
            text = text.replace(a, b + a, 1)

    # ---------------------------------------------------------------- sanity
    problems = []
    # Structure must be untouched: same number of style and script blocks, and
    # no module lost. These are counted against the file as it arrived rather
    # than against a hard-coded number, so the check holds for any v8 build.
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
    for must in ('readSettingsEnvelope', 'applyRestoredSettings',
                 'installConnectionWatch', 'DISK_CLOCK_SLACK'):
        if must not in text:
            problems.append('%s is missing from the result' % must)
    if len(text) <= original_len:
        problems.append('the file did not grow, which cannot be right')
    if problems:
        fail('the result failed its own checks, so nothing was saved:\n         - '
             + '\n         - '.join(problems))

    # ---------------------------------------------------------------- write
    backup = path + '.bak-' + time.strftime('%Y%m%d-%H%M%S')
    shutil.copy2(path, backup)
    write(path, text)

    print('  applied %d changes' % len(plan))
    print('  backup  %s' % backup)
    print('  result  %s bytes (+%s)'
          % (format(len(text), ',d'), format(len(text) - original_len, ',d')))
    print('')
    print('  WHAT TO CHECK, IN THIS ORDER')
    print('  ' + '-' * 70)
    print('   1. Hard-refresh the page. The loading screen should read v8.1.0.')
    print('   2. Settings -> change your theme and accent. Then look in your')
    print('      vault folder at .nodalis/settings.json - it should now be a')
    print('      wrapped file with "nodalis": "settings" and a savedAt stamp,')
    print('      and there should be NO githubToken anywhere in it.')
    print('   3. Reset the app, then pick the same folder again. The theme,')
    print('      accent, fonts and shortcuts should all come back with the notes.')
    print('   4. Close the tab, reopen it. The folder should reconnect by itself.')
    print('      If the browser does ask, it asks once - and if you decline, the')
    print('      next tap will offer again instead of giving up for the session.')
    print('   5. Switch to another tab for a minute and come back. Still connected.')
    print('')


if __name__ == '__main__':
    main()
