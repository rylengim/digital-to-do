import './style.css';
import { loadState, saveState, type Task, type TaskList } from './storage';
import { element, isImeKey } from './dom';
import { setupListControls } from './list-controls';

const form = element<HTMLFormElement>('#task-form');
const input = element<HTMLInputElement>('#task-title');
const inputError = element('#input-error');
let list = element<HTMLUListElement>('#task-list');
const emptyState = element('#empty-state');
const count = element('#task-count');
const warning = element('#storage-warning');
const storageStatus = element('#storage-status');
const announcement = element('#announcement');
const loaded = loadState();
const state = loaded.state;
let activeList = state.lists.find(item => item.id === state.activeListId)!;
// Detached list elements retain editor drafts without putting drafts in saved data.
const taskViews = new Map<string, HTMLUListElement>([[activeList.id, list]]);
const addDrafts = new Map<string, string>();

function showStorageWarning(message: string): void {
  warning.textContent = message;
  warning.hidden = message.length === 0;
  storageStatus.textContent = message ? 'Сохранение требует внимания' : 'Задачи хранятся в этом браузере';
}

function updateSummary(): void {
  const tasks = activeList.tasks;
  emptyState.hidden = tasks.length > 0;
  count.textContent = tasks.length
    ? `Выполнено ${tasks.filter(task => task.completed).length} из ${tasks.length}`
    : 'Пока пусто';
}

function persist(message: string): void {
  const saved = saveState(state);
  showStorageWarning(saved ? '' : 'Не удалось сохранить изменения. Сейчас они доступны только в этой вкладке и могут исчезнуть после обновления страницы.');
  updateSummary();
  announcement.textContent = `${message} ${count.textContent}.`;
}

function createActionButton(action: string, pathData: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'task-action';
  button.title = action;
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '1.5');
  icon.setAttribute('stroke-linecap', 'round');
  icon.setAttribute('stroke-linejoin', 'round');
  icon.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathData);
  icon.append(path);
  button.append(icon);
  return button;
}

function createTaskRow(task: Task, owner: TaskList): HTMLLIElement {
  const row = document.createElement('li');
  row.className = 'task';
  row.classList.toggle('is-completed', task.completed);

  const label = document.createElement('label');
  label.className = 'task-label';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'task-checkbox';
  checkbox.checked = task.completed;
  const title = document.createElement('span');
  title.className = 'task-title';
  label.append(checkbox, title);

  const editButton = createActionButton('Изменить задачу', 'm14 5 5 5M4 20l5-1L20 8a3.5 3.5 0 0 0-5-5L4 14z');
  const removeButton = createActionButton('Удалить задачу', 'M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6');

  function updateTitle(): void {
    title.textContent = task.title;
    editButton.setAttribute('aria-label', `Изменить задачу: ${task.title}`);
    removeButton.setAttribute('aria-label', `Удалить задачу: ${task.title}`);
  }
  updateTitle();

  editButton.addEventListener('click', () => {
    const editor = document.createElement('form');
    editor.className = 'task-editor';
    editor.noValidate = true;
    editor.setAttribute('aria-label', `Редактирование задачи: ${task.title}`);

    const editLabel = document.createElement('label');
    editLabel.textContent = 'Название задачи';
    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.className = 'edit-input';
    editInput.value = task.title;
    editInput.autocomplete = 'off';
    editLabel.append(editInput);

    const error = document.createElement('p');
    error.className = 'edit-error';
    error.id = `edit-error-${crypto.randomUUID()}`;
    error.setAttribute('aria-live', 'polite');
    editInput.setAttribute('aria-describedby', error.id);

    const controls = document.createElement('div');
    controls.className = 'edit-controls';
    const saveButton = document.createElement('button');
    saveButton.type = 'submit';
    saveButton.className = 'edit-save';
    saveButton.textContent = 'Сохранить';
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'edit-cancel';
    cancelButton.textContent = 'Отмена';
    controls.append(saveButton, cancelButton);

    function closeEditor(): void {
      editor.remove();
      label.hidden = editButton.hidden = removeButton.hidden = false;
      editButton.focus();
    }
    function cancelEdit(): void {
      closeEditor();
      announcement.textContent = `Редактирование отменено: ${task.title}.`;
    }

    editor.addEventListener('submit', event => {
      event.preventDefault();
      const newTitle = editInput.value.trim();
      if (!newTitle) {
        error.textContent = 'Введите название задачи.';
        editInput.setAttribute('aria-invalid', 'true');
        editInput.focus();
        return;
      }
      // The draft stays in the input until an explicit save.
      task.title = newTitle;
      updateTitle();
      persist(`Задача изменена: ${task.title}.`);
      closeEditor();
    });
    editInput.addEventListener('input', () => {
      error.textContent = '';
      editInput.removeAttribute('aria-invalid');
    });
    editor.addEventListener('keydown', event => {
      if (isImeKey(event)) {
        // Cancel the implicit form submit, leaving Escape to the IME itself.
        if (event.key === 'Enter') event.preventDefault();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelEdit();
      }
    });
    cancelButton.addEventListener('click', cancelEdit);

    editor.append(editLabel, error, controls);
    label.hidden = editButton.hidden = removeButton.hidden = true;
    row.append(editor);
    editInput.focus();
    editInput.select();
    editor.scrollIntoView({ block: 'nearest' });
  });

  checkbox.addEventListener('change', () => {
    task.completed = checkbox.checked;
    row.classList.toggle('is-completed', task.completed);
    persist(task.completed ? 'Задача выполнена.' : 'Задача снова в работе.');
  });

  removeButton.addEventListener('click', () => {
    // Keep keyboard navigation in the list without rebuilding the other rows.
    const neighbor = row.nextElementSibling ?? row.previousElementSibling;
    owner.tasks = owner.tasks.filter(item => item.id !== task.id);
    row.remove();
    persist('Задача удалена.');
    (neighbor?.querySelector<HTMLInputElement>('.edit-input')
      ?? neighbor?.querySelector<HTMLInputElement>('.task-checkbox') ?? input).focus();
  });

  row.append(label, editButton, removeButton);
  return row;
}

form.addEventListener('keydown', event => {
  if (event.key === 'Enter' && isImeKey(event)) event.preventDefault();
});

form.addEventListener('submit', event => {
  event.preventDefault();
  const title = input.value.trim();
  if (!title) {
    inputError.textContent = 'Введите название задачи.';
    input.setAttribute('aria-invalid', 'true');
    input.focus();
    return;
  }

  const task: Task = { id: crypto.randomUUID(), title, completed: false };
  activeList.tasks.push(task);
  list.append(createTaskRow(task, activeList));
  input.value = '';
  inputError.textContent = '';
  input.removeAttribute('aria-invalid');
  persist('Задача добавлена.');
  input.focus();
});

input.addEventListener('input', () => {
  inputError.textContent = '';
  input.removeAttribute('aria-invalid');
});

function showActiveList(): void {
  const next = state.lists.find(item => item.id === state.activeListId)!;
  if (next.id !== activeList.id) {
    addDrafts.set(activeList.id, input.value);
    let view = taskViews.get(next.id);
    if (!view) {
      view = list.cloneNode(false) as HTMLUListElement;
      next.tasks.forEach(task => view!.append(createTaskRow(task, next)));
      taskViews.set(next.id, view);
    }
    list.replaceWith(view);
    list = view;
    activeList = next;
    input.value = addDrafts.get(next.id) ?? '';
    inputError.textContent = '';
    input.removeAttribute('aria-invalid');
  }
  for (const id of taskViews.keys()) {
    if (!state.lists.some(item => item.id === id)) {
      taskViews.delete(id);
      addDrafts.delete(id);
    }
  }
}

activeList.tasks.forEach(task => list.append(createTaskRow(task, activeList)));
setupListControls(state, message => {
  showActiveList();
  persist(message);
});
updateSummary();
if (loaded.status === 'corrupt') {
  showStorageWarning('Сохранённый список повреждён и не может быть открыт. Первое изменение создаст новый набор данных вместо повреждённого.');
} else if (loaded.status === 'unavailable') {
  showStorageWarning('Не удалось прочитать сохранённые задачи. Хранилище браузера недоступно; новые задачи могут не сохраниться.');
}
