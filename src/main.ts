import './style.css';
import { loadState, saveState, type Task, type TaskList } from './storage';
import { element, isImeKey } from './dom';
import { setupListControls } from './list-controls';
import { createTaskRow } from './task-row';
import { setupMenus } from './menus';

const form = element<HTMLFormElement>('#task-form');
const input = element<HTMLInputElement>('#task-title');
const inputError = element('#input-error');
const addButton = element<HTMLButtonElement>('#add-task');
let list = element<HTMLUListElement>('#task-list');
const emptyState = element('#empty-state');
const count = element('#task-count');
const warning = element('#storage-warning');
const storageStatus = element('#storage-status');
const announcement = element('#announcement');
const loaded = loadState();
const state = loaded.state;
let activeList = state.lists.find(item => item.id === state.activeListId)!;
// Detached lists retain editor drafts; draft text never enters persisted state.
const taskViews = new Map<string, HTMLUListElement>([[activeList.id, list]]);
const addDrafts = new Map<string, { value: string; open: boolean }>();

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
  listControls.render();
  announcement.textContent = `${message} ${count.textContent}.`;
}

function taskRow(task: Task, owner: TaskList): HTMLLIElement {
  return createTaskRow(task, owner, {
    onChange: persist,
    onEmpty: () => (form.hidden ? addButton : input).focus(),
    announce: message => { announcement.textContent = message; },
  });
}

function setFormOpen(open: boolean): void {
  form.hidden = !open;
  addButton.hidden = open;
  addButton.setAttribute('aria-expanded', String(open));
}

// Keep the DOM/tab order aligned with the button's desktop/mobile position.
const mobileLayout = window.matchMedia('(max-width: 700px)');
function positionAddButton(): void {
  const focused = document.activeElement === addButton;
  if (mobileLayout.matches) emptyState.after(addButton);
  else form.before(addButton);
  if (focused) addButton.focus({ preventScroll: true });
}
positionAddButton();
mobileLayout.addEventListener('change', positionAddButton);

function clearInputError(): void {
  inputError.textContent = '';
  input.removeAttribute('aria-invalid');
}

function closeAddForm(): void {
  input.value = '';
  clearInputError();
  setFormOpen(false);
  addButton.focus();
}

addButton.addEventListener('click', () => {
  setFormOpen(true);
  input.focus();
  form.scrollIntoView({ block: 'nearest' });
});
element('#cancel-add-task').addEventListener('click', closeAddForm);
form.addEventListener('keydown', event => {
  if (isImeKey(event)) {
    if (event.key === 'Enter') event.preventDefault();
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    closeAddForm();
  }
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
  list.append(taskRow(task, activeList));
  persist('Задача добавлена.');
  closeAddForm();
});
input.addEventListener('input', clearInputError);

function showActiveList(): void {
  const next = state.lists.find(item => item.id === state.activeListId)!;
  if (next.id !== activeList.id) {
    addDrafts.set(activeList.id, { value: input.value, open: !form.hidden });
    let view = taskViews.get(next.id);
    if (!view) {
      view = list.cloneNode(false) as HTMLUListElement;
      next.tasks.forEach(task => view!.append(taskRow(task, next)));
      taskViews.set(next.id, view);
    }
    list.querySelectorAll<HTMLDetailsElement>('details[open]').forEach(menu => { menu.open = false; });
    list.replaceWith(view);
    list = view;
    activeList = next;
    const draft = addDrafts.get(next.id);
    input.value = draft?.value ?? '';
    setFormOpen(draft?.open ?? false);
    clearInputError();
  }
  for (const id of taskViews.keys()) {
    if (!state.lists.some(item => item.id === id)) {
      taskViews.delete(id);
      addDrafts.delete(id);
    }
  }
}

activeList.tasks.forEach(task => list.append(taskRow(task, activeList)));
const listControls = setupListControls(state, message => {
  showActiveList();
  persist(message);
});
setupMenus();
updateSummary();
if (loaded.status === 'corrupt') {
  showStorageWarning('Сохранённый список повреждён и не может быть открыт. Первое изменение создаст новый набор данных вместо повреждённого.');
} else if (loaded.status === 'unavailable') {
  showStorageWarning('Не удалось прочитать сохранённые задачи. Хранилище браузера недоступно; новые задачи могут не сохраниться.');
}
