import { element, isImeKey } from './dom';
import { closeMenu } from './menus';
import type { AppState } from './storage';

export function setupListControls(state: AppState, onChange: (message: string) => void) {
  const navs = document.querySelectorAll<HTMLElement>('.list-nav');
  const picker = element<HTMLDialogElement>('#list-picker-dialog');
  const openPicker = element<HTMLButtonElement>('#open-lists');
  const menu = element<HTMLDetailsElement>('#list-menu');
  const heading = element('#active-list-title');
  const deleteButton = element<HTMLButtonElement>('#delete-list');
  const lastListHint = element('#last-list-hint');
  const nameDialog = element<HTMLDialogElement>('#list-name-dialog');
  const nameForm = element<HTMLFormElement>('#list-name-form');
  const nameHeading = element('#list-name-heading');
  const nameInput = element<HTMLInputElement>('#list-name');
  const nameError = element('#list-name-error');
  const nameSave = element<HTMLButtonElement>('#list-name-save');
  const deleteDialog = element<HTMLDialogElement>('#delete-list-dialog');
  const deleteForm = element<HTMLFormElement>('#delete-list-form');
  let editingId: string | null = null;
  let deletingId: string | null = null;

  function render(): void {
    const current = state.lists.find(list => list.id === state.activeListId)!;
    heading.textContent = current.title;
    heading.title = current.title;
    navs.forEach(nav => {
      const focused = document.activeElement instanceof HTMLButtonElement && nav.contains(document.activeElement)
        ? document.activeElement.dataset.listId : undefined;
      nav.replaceChildren(...state.lists.map(list => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.listId = list.id;
        button.setAttribute('aria-pressed', String(list.id === state.activeListId));
        const title = document.createElement('span');
        title.className = 'list-nav-title';
        title.textContent = list.title;
        const count = document.createElement('span');
        count.className = 'list-nav-count';
        count.textContent = String(list.tasks.filter(task => !task.completed).length);
        count.setAttribute('aria-hidden', 'true');
        button.append(title, count);
        button.addEventListener('click', () => {
          if (state.activeListId !== list.id) {
            state.activeListId = list.id;
            onChange(`Выбран список: ${list.title}.`);
          }
          if (picker.open) picker.close();
        });
        return button;
      }));
      if (focused !== undefined) {
        Array.from(nav.querySelectorAll('button')).find(button => button.dataset.listId === focused)?.focus();
      }
    });
    deleteButton.disabled = state.lists.length === 1;
    lastListHint.hidden = !deleteButton.disabled;
    if (deleteButton.disabled) deleteButton.setAttribute('aria-describedby', 'last-list-hint');
    else deleteButton.removeAttribute('aria-describedby');
  }

  openPicker.addEventListener('click', () => picker.showModal());
  element('#close-list-picker').addEventListener('click', () => picker.close());

  function openNameDialog(rename: boolean): void {
    if (picker.open) picker.close();
    if (rename) closeMenu(menu);
    const current = state.lists.find(list => list.id === state.activeListId)!;
    editingId = rename ? current.id : null;
    nameHeading.textContent = rename ? 'Переименовать список' : 'Новый список';
    nameSave.textContent = rename ? 'Сохранить' : 'Создать';
    nameInput.value = rename ? current.title : '';
    nameInput.removeAttribute('aria-invalid');
    nameError.textContent = '';
    nameDialog.showModal();
    nameInput.focus();
    nameInput.select();
  }
  document.querySelectorAll('[data-create-list]').forEach(button => {
    button.addEventListener('click', () => openNameDialog(false));
  });
  element('#rename-list').addEventListener('click', () => openNameDialog(true));
  element('#list-name-cancel').addEventListener('click', () => nameDialog.close());
  nameDialog.addEventListener('keydown', event => {
    if (isImeKey(event) && (event.key === 'Enter' || event.key === 'Escape')) event.preventDefault();
  });
  nameInput.addEventListener('input', () => {
    nameInput.removeAttribute('aria-invalid');
    nameError.textContent = '';
  });
  nameForm.addEventListener('submit', event => {
    event.preventDefault();
    const title = nameInput.value.trim();
    if (!title) {
      nameError.textContent = 'Введите название списка.';
      nameInput.setAttribute('aria-invalid', 'true');
      nameInput.focus();
      return;
    }
    if (editingId !== null) {
      state.lists.find(list => list.id === editingId)!.title = title;
    } else {
      const id = crypto.randomUUID();
      state.lists.push({ id, title, tasks: [] });
      state.activeListId = id;
    }
    onChange(editingId === null ? `Создан список: ${title}.` : `Список переименован: ${title}.`);
    nameDialog.close();
    closeMenu(menu);
  });

  deleteButton.addEventListener('click', () => {
    if (state.lists.length === 1) return;
    closeMenu(menu);
    const current = state.lists.find(list => list.id === state.activeListId)!;
    deletingId = current.id;
    element('#delete-list-description').textContent = `Будут удалены список и все его задачи. Это действие нельзя отменить. Задач в списке: ${current.tasks.length}.`;
    element('#delete-list-name').textContent = current.title;
    deleteDialog.showModal();
    element('#delete-list-cancel').focus();
  });
  element('#delete-list-cancel').addEventListener('click', () => deleteDialog.close());
  deleteForm.addEventListener('submit', event => {
    event.preventDefault();
    const index = state.lists.findIndex(list => list.id === deletingId);
    if (index < 0 || state.lists.length === 1) return;
    state.lists.splice(index, 1);
    state.activeListId = state.lists[Math.min(index, state.lists.length - 1)]!.id;
    onChange('Список удалён.');
    deleteDialog.close();
    closeMenu(menu);
  });

  render();
  return { render };
}
