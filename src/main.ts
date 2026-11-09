import './style.css';
import { loadTasks, saveTasks, type Task } from './storage';

function element<T extends HTMLElement>(selector: string): T {
  const result = document.querySelector<T>(selector);
  if (!result) throw new Error(`Missing element: ${selector}`);
  return result;
}

const form = element<HTMLFormElement>('#task-form');
const input = element<HTMLInputElement>('#task-title');
const inputError = element('#input-error');
const list = element<HTMLUListElement>('#task-list');
const emptyState = element('#empty-state');
const count = element('#task-count');
const warning = element('#storage-warning');
const storageStatus = element('#storage-status');
const announcement = element('#announcement');
const loaded = loadTasks();
let tasks = loaded.tasks;

function showStorageWarning(message: string): void {
  warning.textContent = message;
  warning.hidden = message.length === 0;
  storageStatus.textContent = message ? 'Сохранение требует внимания' : 'Задачи хранятся в этом браузере';
}

function updateSummary(): void {
  emptyState.hidden = tasks.length > 0;
  count.textContent = tasks.length
    ? `Выполнено ${tasks.filter(task => task.completed).length} из ${tasks.length}`
    : 'Пока пусто';
}

function persist(message: string): void {
  const saved = saveTasks(tasks);
  showStorageWarning(saved ? '' : 'Не удалось сохранить изменения. Сейчас они доступны только в этой вкладке и могут исчезнуть после обновления страницы.');
  announcement.textContent = message;
  updateSummary();
}

function createTaskRow(task: Task): HTMLLIElement {
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
  title.textContent = task.title;
  label.append(checkbox, title);

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'delete-button';
  removeButton.setAttribute('aria-label', `Удалить задачу: ${task.title}`);
  removeButton.title = 'Удалить задачу';
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '1.5');
  icon.setAttribute('stroke-linecap', 'round');
  icon.setAttribute('stroke-linejoin', 'round');
  icon.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6');
  icon.append(path);
  removeButton.append(icon);

  checkbox.addEventListener('change', () => {
    task.completed = checkbox.checked;
    row.classList.toggle('is-completed', task.completed);
    persist(task.completed ? 'Задача выполнена.' : 'Задача снова в работе.');
  });

  removeButton.addEventListener('click', () => {
    // Keep keyboard navigation in the list without rebuilding the other rows.
    const neighbor = row.nextElementSibling ?? row.previousElementSibling;
    tasks = tasks.filter(item => item.id !== task.id);
    row.remove();
    persist('Задача удалена.');
    (neighbor?.querySelector<HTMLInputElement>('input') ?? input).focus();
  });

  row.append(label, removeButton);
  return row;
}

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
  tasks.push(task);
  list.append(createTaskRow(task));
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

tasks.forEach(task => list.append(createTaskRow(task)));
updateSummary();
if (loaded.status === 'corrupt') {
  showStorageWarning('Сохранённый список повреждён и не может быть открыт. Добавление новой задачи заменит прежний список.');
} else if (loaded.status === 'unavailable') {
  showStorageWarning('Не удалось прочитать сохранённые задачи. Хранилище браузера недоступно; новые задачи могут не сохраниться.');
}
