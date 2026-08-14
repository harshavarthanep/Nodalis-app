/* =========================================================================
 * Nodalis — features/help.js
 * The manual and the guided tour. The tour highlights real elements and
 * skips any step whose target is hidden — so it never points at nothing.
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;
  const el = U.el;

  const TOPICS = [
    {
      id: 'basics', title: 'Writing and linking', icon: 'edit',
      body: [
        ['Everything is markdown', 'Notes are plain `.md` files. Headings with `#`, lists with `-`, tasks with `- [ ]`, bold with `**`, and so on. If you already know markdown there is nothing new to learn.'],
        ['Linking notes', 'Type `[[` anywhere and start typing a name. Picking one inserts a link; typing a name that does not exist yet still works — click the link later and Nodalis offers to create it.'],
        ['Aliases', 'Add `aliases: [Other name, Nickname]` to a note\'s frontmatter and `[[Other name]]` will find it.'],
        ['Block references', 'Put the caret on a paragraph and run "Add block reference id". You get an anchor like `^a1b2c3` and a link copied to your clipboard that jumps to that exact paragraph.'],
        ['Embedding', '`![[Another note]]` pulls that note\'s content inline, live. Handy for a dashboard note that gathers several others.'],
        ['The block menu', 'Press `/` on an empty line for tables, callouts, code blocks, dates, a table of contents and more.'],
      ],
    },
    {
      id: 'organising', title: 'Organising', icon: 'folder',
      body: [
        ['Folders', 'Nest them as deep as you like. Right-click any folder for a new note inside it, a subfolder, rename, move or delete. Drag notes and folders around to reorganise.'],
        ['Tags', 'Write `#anything` in a note. Nested tags work too — `#project/website` shows under `#project`. The Tags panel lists them all with counts.'],
        ['Properties', 'A YAML block at the very top of a note becomes structured data: `status: doing`, `due: 2026-09-01`. Those keys turn into columns in the Database view and can be filtered on.'],
        ['Pinning', 'Pin the handful you open constantly and they sit at the top of the sidebar.'],
      ],
    },
    {
      id: 'views', title: 'The other views', icon: 'layers',
      body: [
        ['Graph', 'Every note is a dot, every `[[link]]` a line. Drag dots around, click one to open it, or switch to "Around this note" to see only its neighbourhood two hops out.'],
        ['Canvas', 'An infinite whiteboard. Cards, stickies, shapes, frames, images, freehand ink, and connectors that stay attached when you move things. You can drop a live note onto it.'],
        ['Database', 'Your notes as a table, kanban board, gallery or calendar — driven by whatever properties you have used. Drag cards between board columns to change a property.'],
        ['Tasks', 'Every `- [ ]` in every note, in one list, alongside standalone tasks. Ticking one here edits the original note.'],
        ['Priority matrix', 'The Eisenhower grid. Tasks are placed automatically from priority and due date; drag one and that choice is remembered.'],
        ['Sticky wall', 'Coloured stickies holding text, a checklist, or a sketch. Drop one on another to stack them.'],
        ['Scratchpad', 'For thoughts that are not notes yet. Capture, forget, sort out later — or never.'],
      ],
    },
    {
      id: 'storage', title: 'Where your notes live', icon: 'save',
      body: [
        ['A real folder, by preference', 'On Chrome, Edge, Brave, Opera or Arc, Settings → Storage lets you pick a folder. From then on every keystroke is written to a plain `.md` file within a second — deletes and renames included.'],
        ['Obsidian compatibility', 'The on-disk format matches Obsidian: markdown at the root, app data in a `.nodalis` folder. Point Nodalis at an existing vault and it reads straight in.'],
        ['Other browsers', 'Safari and Firefox cannot write to a folder. Nodalis works fully there but stores notes in the browser, and will keep reminding you to export a `.zip` — because clearing site data would erase them.'],
        ['Backups', 'Settings → Backup exports everything as a zip: notes as `.md`, plus canvases, stickies, tasks and attachments. Importing it anywhere restores the lot.'],
      ],
    },
    {
      id: 'shortcuts', title: 'Keyboard', icon: 'keyboard',
      body: [
        ['Everything is a command', 'Press the command palette shortcut and type. Every feature in the app is in there, with its shortcut shown next to it.'],
        ['Rebinding', 'Settings → Shortcuts lists every command. Click any shortcut to record a new one. Conflicts are detected rather than silently overriding.'],
        ['Chords', 'A binding can be a sequence, like `g then d`. Useful once the obvious combinations are taken.'],
      ],
    },
    {
      id: 'privacy', title: 'Privacy and cost', icon: 'lock',
      body: [
        ['No server', 'Nodalis is a set of static files. There is no backend, no account, no sync service and no analytics. Nothing you write leaves your machine unless you export it yourself.'],
        ['Offline', 'After the first load it works with no connection at all. Install it and it behaves like a native app.'],
        ['Free, permanently', 'There is nothing to charge for — no hosting, no infrastructure. The one optional download is the OCR engine, and only if you scan a page.'],
      ],
    },
  ];

  const TOUR = [
    {
      target: null,
      title: 'Welcome to Nodalis',
      text: 'Two minutes and you will know where everything is. Press Escape at any point to stop — you can replay this from the help menu.',
    },
    {
      target: '#btn-new-note',
      title: 'Start here',
      text: 'New notes. Everything you type is saved automatically, so there is no save button to remember.',
    },
    {
      target: '.sidebar-tabs',
      title: 'Four ways in',
      text: 'Files for the folder tree, Tags for anything you have tagged, Recent for what you touched last, and Boards for canvases and the sticky wall.',
    },
    {
      target: '#btn-search',
      title: 'The one shortcut worth learning',
      text: 'Search notes, jump to a tag, or run any command in the app. Everything is reachable from here.',
    },
    {
      target: '#view-tabs',
      title: 'The other views',
      text: 'The same notes, seen differently: as a graph of links, an infinite canvas, a database, or a task list.',
    },
    {
      target: '#right-panel',
      title: 'Context, on the right',
      text: 'What links here, the outline of the current note, and its properties. It fills in as you write.',
    },
    {
      target: '#vault-status',
      title: 'This is the important one',
      text: 'Where your notes are stored. Connect a real folder and every change is written to a plain markdown file on your disk.',
    },
    {
      target: '#btn-settings',
      title: 'Make it yours',
      text: 'Four themes, every font adjustable, every shortcut rebindable, and any feature you do not use can be switched off entirely.',
    },
  ];

  /* --------------------------------------------------------------- manual */

  function open(topicId) {
    let activeTopic = topicId || 'basics';
    let contentHost;

    const api = N.modal.open({
      title: 'Nodalis manual',
      size: 'lg',
      render: function () {
        const layout = el('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,150px) 1fr', gap: '24px', alignItems: 'start' } });
        if (window.innerWidth <= 760) layout.style.gridTemplateColumns = '1fr';

        const nav = el('div.settings-nav');
        TOPICS.forEach(function (topic) {
          const btn = el('button.settings-nav-item' + (topic.id === activeTopic ? '.is-active' : ''), { type: 'button' });
          btn.appendChild(N.icons.node(topic.icon, { size: 16 }));
          btn.appendChild(el('span', null, topic.title));
          btn.addEventListener('click', function () {
            activeTopic = topic.id;
            U.$$('.settings-nav-item', nav).forEach(function (b) { b.classList.toggle('is-active', b === btn); });
            paint();
          });
          nav.appendChild(btn);
        });
        layout.appendChild(nav);

        contentHost = el('div');
        layout.appendChild(contentHost);
        paint();
        return layout;
      },
      footer: function (a) {
        return [
          el('button.btn', { type: 'button', onclick: function () { a.close(); openTour(); } }, 'Replay the tour'),
          el('span.spacer'),
          el('button.btn', {
            type: 'button',
            onclick: function () { N.commands.run('settings.shortcuts'); a.close(); },
          }, 'All shortcuts'),
          el('button.btn.btn-primary', { type: 'button', onclick: function () { a.close(); } }, 'Close'),
        ];
      },
    });

    function paint() {
      if (!contentHost) return;
      U.clear(contentHost);
      const topic = TOPICS.find(function (t) { return t.id === activeTopic; });
      if (!topic) return;
      contentHost.appendChild(el('h3', { style: { fontSize: 'var(--text-xl)', marginBottom: '14px' } }, topic.title));
      topic.body.forEach(function (pair) {
        const block = el('div', { style: { marginBottom: '18px' } });
        block.appendChild(el('div', { style: { fontWeight: '600', marginBottom: '4px' } }, pair[0]));
        block.appendChild(el('div.muted', { style: { lineHeight: '1.65' }, html: N.markdown.renderInline(pair[1]) }));
        contentHost.appendChild(block);
      });

      if (topic.id === 'shortcuts') {
        const table = el('table.keymap-table', { style: { marginTop: '10px' } });
        const tbody = el('tbody');
        N.commands.all()
          .filter(function (c) { return N.shortcuts.accelFor(c.id); })
          .sort(function (a, b) { return a.group.localeCompare(b.group) || a.title.localeCompare(b.title); })
          .slice(0, 40)
          .forEach(function (cmd) {
            const tr = el('tr');
            tr.appendChild(el('td', null, cmd.title));
            tr.appendChild(el('td.keymap-keys', null, el('span.kbd', null, N.shortcuts.format(N.shortcuts.accelFor(cmd.id)))));
            tbody.appendChild(tr);
          });
        table.appendChild(tbody);
        contentHost.appendChild(table);
      }
    }

    return api.promise;
  }

  /* ----------------------------------------------------------------- tour */

  let tourState = null;

  function openTour() {
    closeTour();
    const steps = TOUR.filter(function (step) {
      if (!step.target) return true;
      const node = document.querySelector(step.target);
      return node && node.offsetParent !== null;
    });
    if (!steps.length) return;

    tourState = { index: 0, steps: steps, spot: null, pop: null };
    document.addEventListener('keydown', onTourKey, true);
    window.addEventListener('resize', repositionTour);
    paintStep();
  }

  function onTourKey(e) {
    if (!tourState) return;
    if (e.key === 'Escape') { e.preventDefault(); closeTour(); }
    if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); nextStep(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); prevStep(); }
  }

  function paintStep() {
    if (!tourState) return;
    const step = tourState.steps[tourState.index];
    if (!step) { closeTour(); return; }

    if (!tourState.spot) {
      tourState.spot = el('div.tour-spot');
      document.body.appendChild(tourState.spot);
    }
    if (tourState.pop && tourState.pop.parentNode) tourState.pop.remove();

    const pop = el('div.tour-pop');
    pop.appendChild(el('div.tour-pop-title', null, step.title));
    pop.appendChild(el('div.tour-pop-text', null, step.text));

    const foot = el('div.tour-pop-foot');
    const dots = el('div.tour-dots');
    tourState.steps.forEach(function (_, i) {
      dots.appendChild(el('div.tour-dot' + (i === tourState.index ? '.is-active' : '')));
    });
    foot.appendChild(dots);
    if (tourState.index > 0) {
      foot.appendChild(el('button.btn.btn-sm', { type: 'button', onclick: prevStep }, 'Back'));
    }
    foot.appendChild(el('button.btn.btn-sm', { type: 'button', onclick: closeTour }, 'Skip'));
    foot.appendChild(el('button.btn.btn-sm.btn-primary', { type: 'button', onclick: nextStep },
      tourState.index === tourState.steps.length - 1 ? 'Finish' : 'Next'));
    pop.appendChild(foot);

    document.body.appendChild(pop);
    tourState.pop = pop;
    repositionTour();
  }

  function repositionTour() {
    if (!tourState || !tourState.pop) return;
    const step = tourState.steps[tourState.index];
    const spot = tourState.spot;
    const pop = tourState.pop;
    const pad = 10;

    const node = step.target ? document.querySelector(step.target) : null;
    if (node) {
      const r = node.getBoundingClientRect();
      spot.style.display = '';
      spot.style.left = (r.left - 6) + 'px';
      spot.style.top = (r.top - 6) + 'px';
      spot.style.width = (r.width + 12) + 'px';
      spot.style.height = (r.height + 12) + 'px';

      const popRect = pop.getBoundingClientRect();
      let x = r.left;
      let y = r.bottom + 14;
      if (y + popRect.height > window.innerHeight - pad) y = Math.max(pad, r.top - popRect.height - 14);
      if (x + popRect.width > window.innerWidth - pad) x = window.innerWidth - popRect.width - pad;
      pop.style.left = Math.max(pad, x) + 'px';
      pop.style.top = y + 'px';
    } else {
      spot.style.display = 'none';
      const popRect = pop.getBoundingClientRect();
      pop.style.left = Math.max(pad, (window.innerWidth - popRect.width) / 2) + 'px';
      pop.style.top = Math.max(pad, (window.innerHeight - popRect.height) / 2) + 'px';
    }
  }

  function nextStep() {
    if (!tourState) return;
    if (tourState.index >= tourState.steps.length - 1) { finishTour(); return; }
    tourState.index++;
    paintStep();
  }

  function prevStep() {
    if (!tourState || tourState.index === 0) return;
    tourState.index--;
    paintStep();
  }

  async function finishTour() {
    closeTour();
    await N.store.setSetting('tourCompleted', true);
    N.loader.celebrate({ count: 36 });
    N.toast.success('That is the whole app. Press the command palette shortcut whenever you are looking for something.', {
      title: 'All set', ms: 6000,
    });
  }

  function closeTour() {
    document.removeEventListener('keydown', onTourKey, true);
    window.removeEventListener('resize', repositionTour);
    if (tourState) {
      if (tourState.spot && tourState.spot.parentNode) tourState.spot.remove();
      if (tourState.pop && tourState.pop.parentNode) tourState.pop.remove();
    }
    tourState = null;
  }

  /* --------------------------------------------------------- keyboard card */

  function openShortcutCard() {
    N.modal.open({
      title: 'Keyboard shortcuts',
      size: 'lg',
      render: function () {
        const wrap = el('div');
        const groups = N.commands.groups();
        Array.from(groups.keys()).sort().forEach(function (group) {
          const withKeys = groups.get(group).filter(function (c) { return N.shortcuts.accelFor(c.id); });
          if (!withKeys.length) return;
          wrap.appendChild(el('div.section-label', null, group));
          withKeys.forEach(function (cmd) {
            const r = el('div.row', { style: { justifyContent: 'space-between', gap: '16px', padding: '5px 8px' } });
            r.appendChild(el('span.truncate', null, cmd.title));
            r.appendChild(el('span.kbd', null, N.shortcuts.format(N.shortcuts.accelFor(cmd.id))));
            wrap.appendChild(r);
          });
        });
        return wrap;
      },
      footer: function (a) {
        return [
          el('button.btn', { type: 'button', onclick: function () { a.close(); N.commands.run('settings.shortcuts'); } }, 'Change these'),
          el('button.btn.btn-primary', { type: 'button', onclick: function () { a.close(); } }, 'Close'),
        ];
      },
    });
  }

  function init() {
    const btn = document.getElementById('btn-help');
    if (btn) btn.addEventListener('click', function () { open(); });

    N.commands.registerMany([
      { id: 'help.open', title: 'Open the manual', group: 'Help', icon: 'help', accel: 'F1', run: function () { open(); } },
      { id: 'help.tour', title: 'Replay the guided tour', group: 'Help', icon: 'play', run: openTour },
      { id: 'help.shortcuts', title: 'Show all keyboard shortcuts', group: 'Help', icon: 'keyboard', accel: 'Mod+Shift+/',
        run: openShortcutCard },
      { id: 'help.storage', title: 'How does storage work?', group: 'Help', icon: 'save',
        run: function () { open('storage'); } },
    ]);
  }

  N.help = { init: init, open: open, openTour: openTour, closeTour: closeTour, openShortcutCard: openShortcutCard, TOPICS: TOPICS };
})(window.NODALIS = window.NODALIS || {});
