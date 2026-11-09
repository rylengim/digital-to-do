import { element, isImeKey } from './dom';
import type { AppState } from './storage';

export function setupListControls(state: AppState, onChange: (message: string) => void): void {
  const picker = element<HTMLSelectElement>('#list-picker');
  const createButton = element<HTMLButtonElement>('#create-list');
  const renameButton = element<HTMLButtonElement>('#rename-list');
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
    picker.replaceChildren(...state.lists.map(list => {
      const option = document.createElement('option');
      option.value = list.id;
      option.textContent = list.title;
      return option;
    }));
    picker.value = state.activeListId;
    deleteButton.disabled = state.lists.length === 1;
    lastListHint.hidden = !deleteButton.disabled;
    if (deleteButton.disabled) deleteButton.setAttribute('aria-describedby', 'last-list-hint');
    else deleteButton.removeAttribute('aria-describedby');
  }

  function openNameDialog(rename: boolean): void {
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

  createButton.addEventListener('click', () => openNameDialog(false));
  renameButton.addEventListener('click', () => openNameDialog(true));
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
    render();
    onChange(editingId === null ? `Создан список: ${title}.` : `Список переименован: ${title}.`);
    nameDialog.close();
  });

  picker.addEventListener('change', () => {
    state.activeListId = picker.value;
    onChange(`Выбран список: ${state.lists.find(list => list.id === picker.value)!.title}.`);
  });
  deleteButton.addEventListener('click', () => {
    if (state.lists.length === 1) return;
    const current = state.lists.find(list => list.id === state.activeListId)!;
    deletingId = current.id;
    element('#delete-list-description').textContent = `Будет удалён список «${current.title}» и все его задачи. Задач в списке: ${current.tasks.length}. Это действие нельзя отменить.`;
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
    render();
    onChange('Список удалён.');
    deleteDialog.close();
    picker.focus();
  });

  render();
}
