import { isImeKey } from './dom';

export function closeMenu(menu: HTMLDetailsElement): void {
  menu.open = false;
  menu.querySelector<HTMLElement>('summary')?.focus();
}

function positionMenu(menu: HTMLDetailsElement): void {
  const panel = menu.querySelector<HTMLElement>('.menu-actions');
  if (!panel) return;
  menu.classList.remove('opens-up');
  const viewport = window.visualViewport;
  const top = (viewport?.offsetTop ?? 0) + 8;
  const bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 8;
  const rect = panel.getBoundingClientRect();
  if (rect.bottom <= bottom) return;
  if (menu.getBoundingClientRect().top - rect.height - 4 >= top) menu.classList.add('opens-up');
  else panel.scrollIntoView({ block: 'nearest' });
}

export function setupMenus(): void {
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || isImeKey(event)) return;
    const menu = event.target instanceof Element
      ? event.target.closest<HTMLDetailsElement>('details[open]') : null;
    if (menu) {
      event.preventDefault();
      closeMenu(menu);
    }
  });
  const closeOutside = (event: Event): void => {
    document.querySelectorAll<HTMLDetailsElement>('details[open]').forEach(menu => {
      if (event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
    });
  };
  document.addEventListener('click', closeOutside);
  document.addEventListener('focusin', closeOutside);
  document.addEventListener('toggle', event => {
    if (!(event.target instanceof HTMLDetailsElement) || !event.target.open) return;
    document.querySelectorAll<HTMLDetailsElement>('details[open]').forEach(menu => {
      if (menu !== event.target) menu.open = false;
    });
    positionMenu(event.target);
  }, true);
  window.addEventListener('resize', () => {
    document.querySelectorAll<HTMLDetailsElement>('details[open]').forEach(positionMenu);
  });
}
