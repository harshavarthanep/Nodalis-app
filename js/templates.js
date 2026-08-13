/**
 * templates.js — reusable note templates with {{date}}, {{time}}, {{title}} placeholders.
 */
import { DB } from './db.js';

const DEFAULT_TEMPLATES = [
  { id: 'blank', name: 'Blank note', body: '' },
  { id: 'daily', name: 'Daily note', body: `# {{date}}\n\n## Focus\n- \n\n## Notes\n\n\n## Tasks\n- [ ] \n` },
  { id: 'meeting', name: 'Meeting notes', body: `# {{title}}\n**Date:** {{date}} {{time}}\n\n## Attendees\n- \n\n## Agenda\n- \n\n## Decisions\n- \n\n## Action items\n- [ ] \n` },
  { id: 'project', name: 'Project brief', body: `---\nstatus: todo\npriority: medium\n---\n# {{title}}\n\n## Goal\n\n\n## Milestones\n- [ ] \n\n## Notes\n\n` },
];

export async function getTemplates() {
  const custom = await DB.getSetting('templates', []);
  return [...DEFAULT_TEMPLATES, ...custom];
}

export async function saveCustomTemplate(name, body) {
  const custom = await DB.getSetting('templates', []);
  custom.push({ id: 't' + Date.now(), name, body });
  await DB.setSetting('templates', custom);
}

export function applyTemplate(body, { title }) {
  const now = new Date();
  return body
    .replace(/\{\{date\}\}/g, now.toISOString().slice(0, 10))
    .replace(/\{\{time\}\}/g, now.toTimeString().slice(0, 5))
    .replace(/\{\{title\}\}/g, title || 'Untitled');
}
