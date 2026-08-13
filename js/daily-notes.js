/**
 * daily-notes.js — one-key daily note creation using the "Daily note" template.
 */
import { state, bus, createNote, findNoteByTitle } from './state.js';
import { applyTemplate, getTemplates } from './templates.js';
import { setActiveView } from './layout-manager.js';
import { showToast } from './layout-manager.js';

function todayTitle() {
  return new Date().toISOString().slice(0, 10);
}

export function initDailyNotes() {
  async function openToday() {
    const title = todayTitle();
    let note = findNoteByTitle(title);
    if (!note) {
      const templates = await getTemplates();
      const dailyTpl = templates.find((t) => t.id === 'daily');
      const content = applyTemplate(dailyTpl.body, { title });
      note = await createNote({ title, folder: 'Daily Notes', content });
      showToast("Created today's daily note");
    }
    bus.emit('note:open', note.id);
    setActiveView('editor');
  }

  document.getElementById('btn-daily-note').addEventListener('click', openToday);
  document.getElementById('sheet-daily-note').addEventListener('click', openToday);
  bus.on('daily-note:open', openToday);
}
