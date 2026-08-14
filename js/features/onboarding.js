/* =========================================================================
 * Nodalis — features/onboarding.js
 * First run: ask where the notes should live, before anything is written.
 * This is the one decision worth interrupting someone for, so it is asked
 * once, plainly, with an honest description of each option's trade-off.
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;
  const el = U.el;

  async function shouldRun() {
    if (N.store.state.settings.firstRunComplete) return false;
    return true;
  }

  async function run() {
    const supported = U.supports.fileSystemAccess;

    const choice = await new Promise(function (resolve) {
      N.modal.open({
        title: '',
        dismissible: false,
        showClose: false,
        size: 'sm',
        render: function (api) {
          const wrap = el('div.onboard-card');

          // When local storage is unreachable, "keep it on this device" is not a
          // real option. Say so here rather than letting someone pick it and
          // silently lose everything on refresh.
          if (N.db.isDegraded()) {
            const warn = el('div.banner.is-danger', { style: { textAlign: 'left', marginBottom: '18px' } });
            warn.appendChild(N.icons.node('warning', { size: 19 }));
            warn.appendChild(el('div.banner-main', null, [
              el('div.banner-title', null, 'This browser is not letting Nodalis save'),
              el('div', { style: { lineHeight: '1.5' } },
                N.db.degradedReason() + ' Choosing a folder is the only way to keep anything you write.'),
            ]));
            wrap.appendChild(warn);
          }

          const mark = el('div', { style: { display: 'flex', justifyContent: 'center', marginBottom: '18px' } });
          mark.innerHTML =
            '<svg viewBox="0 0 32 32" width="52" height="52" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-linejoin="round">' +
            '<path d="M16 4l10.4 6v12L16 28 5.6 22V10z"/>' +
            '<path d="M16 4v24M5.6 10l20.8 12M26.4 10L5.6 22" stroke-width="1" opacity="0.5"/>' +
            '<circle cx="16" cy="16" r="3.1" fill="var(--accent)" stroke="none"/></svg>';
          wrap.appendChild(mark);

          wrap.appendChild(el('h2', { style: { fontSize: 'var(--text-2xl)', marginBottom: '10px' } }, 'Where should your notes live?'));
          wrap.appendChild(el('p.muted', { style: { lineHeight: '1.6', marginBottom: '22px' } },
            'Nodalis writes plain markdown files. Pick a real folder and they are yours on disk, readable by any app, safe from anything that happens to this browser.'));

          const list = el('div.stack', { style: { gap: '12px', textAlign: 'left' } });

          const folderBtn = el('button.onboard-choice', { type: 'button', disabled: !supported });
          folderBtn.appendChild(N.icons.node('folder-open', { size: 22 }));
          const fmain = el('div', { style: { flex: '1', minWidth: '0' } });
          const ftitle = el('div.onboard-choice-title');
          ftitle.appendChild(el('span', null, 'Choose a folder on my computer'));
          if (supported) ftitle.appendChild(el('span.onboard-recommended', null, 'recommended'));
          fmain.appendChild(ftitle);
          fmain.appendChild(el('div.onboard-choice-desc', null, supported
            ? 'Every change is written to a .md file within a second. Point it at an existing Obsidian vault and it will read straight from it.'
            : 'Not available in this browser. Chrome, Edge, Brave or Arc on a desktop can do this.'));
          if (supported && N.db.isDegraded()) {
            fmain.appendChild(el('div.onboard-choice-desc', {
              style: { marginTop: '6px', color: 'var(--accent)', fontWeight: '600' },
            }, 'The only option here that actually saves your work.'));
          }
          folderBtn.appendChild(fmain);
          folderBtn.addEventListener('click', function () { api.close('folder'); });
          list.appendChild(folderBtn);

          const deviceBtn = el('button.onboard-choice', { type: 'button' });
          deviceBtn.appendChild(N.icons.node('device', { size: 22 }));
          const dmain = el('div', { style: { flex: '1', minWidth: '0' } });
          const dtitle = el('div.onboard-choice-title');
          dtitle.appendChild(el('span', null, 'Just keep them on this device'));
          if (!supported) dtitle.appendChild(el('span.onboard-recommended', null, 'only option here'));
          dmain.appendChild(dtitle);
          dmain.appendChild(el('div.onboard-choice-desc', null, N.db.isDegraded()
            ? 'Not working right now — this browser is refusing local storage, so notes would vanish on reload. Pick this only to look around.'
            : 'Stored in this browser. Fast and private, but clearing site data would erase everything — so Nodalis will remind you to export a backup.'));
          deviceBtn.appendChild(dmain);
          deviceBtn.addEventListener('click', function () { api.close('device'); });
          list.appendChild(deviceBtn);

          wrap.appendChild(list);
          wrap.appendChild(el('p.small.dim', { style: { marginTop: '18px', lineHeight: '1.5' } },
            'You can change this at any time in Settings. Nothing is sent anywhere either way — Nodalis has no server.'));
          return wrap;
        },
        onClose: resolve,
      });
    });

    if (choice === 'folder') {
      const connected = await connectFlow();
      if (!connected) {
        // They cancelled the OS picker. Carry on locally rather than trapping them.
        N.toast.info('Carrying on with local storage. You can connect a folder any time from Settings.', { ms: 5000 });
      }
    }

    await N.store.setSetting('firstRunComplete', true);

    if (!N.store.state.notes.size) {
      await N.store.seedWelcomeVault();
    }

    if (choice === 'device' && N.db.isDegraded()) {
      N.toast.error('Nothing is being saved — this browser is blocking local storage. Export or connect a folder before you close the tab.', {
        title: 'Working in memory only', ms: 0, key: 'memory-only',
        action: { label: 'Export', onClick: function () { N.commands.run('export.vault'); } },
      });
    }

    // The tour only makes sense once there is something on screen to point at.
    if (!N.store.state.settings.tourCompleted) {
      setTimeout(function () { N.help.openTour(); }, 700);
    }
  }

  async function connectFlow() {
    try {
      await N.vault.connectFolder();
    } catch (err) {
      if (err && err.name === 'AbortError') return false;
      N.toast.error(U.describeError(err), { title: 'Could not use that folder' });
      return false;
    }

    // If the folder already has markdown in it, offer to adopt it.
    let existing = [];
    try {
      existing = await N.vault.walkMarkdown(N.vault.state.handle, '', [], { remaining: 500 });
    } catch (err) { existing = []; }

    if (existing.length) {
      const choice = await N.modal.choose({
        title: 'That folder already has notes in it',
        message: U.pluralize(existing.length, 'markdown file') + ' found. Nodalis can read them in — this is exactly how you would move an Obsidian vault across.',
        options: [
          { value: 'pull', label: 'Read them into Nodalis', description: 'Nothing is overwritten', icon: 'download' },
          { value: 'skip', label: 'Leave them alone for now', description: 'Start empty; you can sync later', icon: 'close' },
        ],
      });
      if (choice === 'pull') {
        const closing = N.toast.info('Reading your notes…', { ms: 0, key: 'pull' });
        try {
          const result = await N.vault.pullAll();
          closing();
          N.toast.success('Imported ' + U.pluralize(result.created, 'note'), { ms: 4000 });
          N.loader.celebrate({ count: 32 });
        } catch (err) {
          closing();
          N.toast.error(U.describeError(err), { title: 'Could not read the folder' });
        }
      }
    } else {
      // Empty folder: seed it and push, so there is something on disk immediately.
      if (!N.store.state.notes.size) await N.store.seedWelcomeVault();
      try {
        await N.vault.pushAll();
        N.toast.success('Your notes are saved in "' + N.vault.state.name + '"', { ms: 4000 });
      } catch (err) {
        N.toast.error(U.describeError(err), { title: 'Could not write to that folder' });
      }
    }
    return true;
  }

  /** The gentle, persistent nudge for people running without a folder. */
  async function maybeRemindBackup() {
    if (N.vault.isFolderMode()) return;
    const days = N.store.state.settings.snapshotReminderDays;
    if (!days) return;
    if (N.store.state.notes.size < 4) return;
    const due = await N.vault.shouldRemindSnapshot(days);
    if (!due) return;

    N.toast.warn('Your notes are only on this device. A backup takes two seconds.', {
      title: 'Worth backing up',
      ms: 0,
      key: 'backup-nudge',
      action: {
        label: 'Export now',
        onClick: async function () {
          const closing = N.toast.info('Packing…', { ms: 0, key: 'zip' });
          try {
            const result = await N.exporter.exportVaultZip();
            closing();
            N.toast.success('Saved ' + result.name, { ms: 4000 });
          } catch (err) {
            closing();
            N.toast.error(U.describeError(err));
          }
        },
      },
    });
  }

  N.onboarding = { shouldRun: shouldRun, run: run, connectFlow: connectFlow, maybeRemindBackup: maybeRemindBackup };
})(window.NODALIS = window.NODALIS || {});
