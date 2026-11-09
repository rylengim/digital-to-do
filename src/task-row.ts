import { isImeKey } from './dom';
import type { Task, TaskList } from './storage';

export function createTaskRow(
  task: Task, owner: TaskList,
  { onChange, onEmpty, announce }: {
    onChange: (message: string) => void;
    onEmpty: () => void;
    announce: (message: string) => void;
  },
): HTMLLIElement {
  const row = document.createElement('li');
  row.className = 'task';
  row.classList.toggle('is-completed', task.completed);

  const label = document.createElement('label');
  label.className = 'task-label';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'task-checkbox';
  checkbox.checked = task.completed;
  label.append(checkbox);
  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.className = 'task-title';
  const menu = document.createElement('details');
  menu.className = 'action-menu task-menu';
  const trigger = document.createElement('summary');
  trigger.className = 'icon-button';
  trigger.textContent = '⋯';
  const actions = document.createElement('div');
  actions.className = 'menu-actions';
  const editAction = document.createElement('button');
  editAction.type = 'button';
  editAction.textContent = 'Изменить';
  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'danger-text';
  removeButton.textContent = 'Удалить';
  actions.append(editAction, removeButton);
  menu.append(trigger, actions);

  function updateTitle(): void {
    editButton.textContent = task.title;
    checkbox.setAttribute('aria-label', task.title);
    trigger.setAttribute('aria-label', `Действия с задачей: ${task.title}`);
    editButton.setAttribute('aria-label', `Изменить задачу: ${task.title}`);
    removeButton.setAttribute('aria-label', `Удалить задачу: ${task.title}`);
  }
  updateTitle();

  editAction.addEventListener('click', () => editButton.click());
  editButton.addEventListener('click', () => {
    menu.open = false;
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
    controls.append(cancelButton, saveButton);

    function closeEditor(): void {
      editor.remove();
      label.hidden = editButton.hidden = menu.hidden = false;
      editButton.focus();
    }
    function cancelEdit(): void {
      closeEditor();
      announce(`Редактирование отменено: ${task.title}.`);
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
      onChange(`Задача изменена: ${task.title}.`);
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
    label.hidden = editButton.hidden = menu.hidden = true;
    row.append(editor);
    editInput.focus();
    editInput.select();
    editor.scrollIntoView({ block: 'nearest' });
  });

  checkbox.addEventListener('change', () => {
    task.completed = checkbox.checked;
    row.classList.toggle('is-completed', task.completed);
    onChange(task.completed ? 'Задача выполнена.' : 'Задача снова в работе.');
  });

  removeButton.addEventListener('click', () => {
    // Keep keyboard navigation in the list without rebuilding the other rows.
    const neighbor = row.nextElementSibling ?? row.previousElementSibling;
    owner.tasks = owner.tasks.filter(item => item.id !== task.id);
    row.remove();
    onChange('Задача удалена.');
    const nextFocus = neighbor?.querySelector<HTMLInputElement>('.edit-input')
      ?? neighbor?.querySelector<HTMLInputElement>('.task-checkbox');
    if (nextFocus) nextFocus.focus();
    else onEmpty();
  });

  row.append(label, editButton, menu);
  return row;
}
