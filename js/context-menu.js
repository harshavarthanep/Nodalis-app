/**
 * context-menu.js — tiny reusable right-click / long-press context menu.
 */
let menuEl = null;

function closeMenu() {
  if (menuEl) { menuEl.remove(); menuEl = null; }
  document.removeEventListener('click', closeMenu);
}

export function openContextMenu(x, y, items) {
  closeMenu();
  menuEl = document.createElement('div');
  menuEl.style.cssText = `
    position:fixed; top:${y}px; left:${x}px; z-index:200;
    background:var(--bg-0); border:1px solid var(--border); border-radius:8px;
    box-shadow:var(--shadow-md); padding:4px; min-width:160px; font-size:13.5px;`;
  items.forEach((item) => {
    if (item.separator) {
      const sep = document.createElement('div');
      sep.style.cssText = 'height:1px;background:var(--border);margin:4px 0;';
      menuEl.appendChild(sep);
      return;
    }
    const row = document.createElement('div');
    row.textContent = item.label;
    row.style.cssText = `padding:8px 10px;border-radius:6px;cursor:pointer;${item.danger ? 'color:var(--danger);' : ''}`;
    row.addEventListener('mouseenter', () => row.style.background = 'var(--bg-2)');
    row.addEventListener('mouseleave', () => row.style.background = 'transparent');
    row.addEventListener('click', (e) => { e.stopPropagation(); closeMenu(); item.action(); });
    menuEl.appendChild(row);
  });
  document.body.appendChild(menuEl);
  // keep on screen
  const rect = menuEl.getBoundingClientRect();
  if (rect.right > window.innerWidth) menuEl.style.left = `${window.innerWidth - rect.width - 8}px`;
  if (rect.bottom > window.innerHeight) menuEl.style.top = `${window.innerHeight - rect.height - 8}px`;
  setTimeout(() => document.addEventListener('click', closeMenu), 0);
}
