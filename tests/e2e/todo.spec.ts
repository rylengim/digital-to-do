import { expect, test, type Page } from '@playwright/test';
import { addTask, addTaskButton, deleteTask, listMenuTrigger, openTaskForm, taskMenuTrigger, taskRows } from './helpers';

async function loadLongMobileList(page: Page) {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => {
    const tasks = Array.from({ length: 16 }, (_, index) => ({
      id: `task-${index + 1}`, title: `Задача ${index + 1}`, completed: false,
    }));
    localStorage.setItem('digital-todo.state.v2', JSON.stringify({
      version: 2, activeListId: 'inbox', lists: [{ id: 'inbox', title: 'Мои задачи', tasks }],
    }));
  });
  await page.goto('/');
  await expect(taskRows(page)).toHaveCount(16);
}

test('adds by button and Enter, completes, deletes and restores independent tasks', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  const input = await openTaskForm(page);
  await input.fill('  Проверить прототип  ');
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  const firstAnnouncement = await page.locator('#announcement').textContent();
  await addTask(page, 'Проверить прототип');
  await expect(page.locator('#announcement')).not.toHaveText(firstAnnouncement ?? '');
  const rows = taskRows(page);
  await expect(rows).toHaveCount(2);
  await rows.nth(1).getByRole('checkbox').check();
  await page.reload();
  await expect(rows.nth(0).getByRole('checkbox')).not.toBeChecked();
  await expect(rows.nth(1).getByRole('checkbox')).toBeChecked();
  await deleteTask(rows.nth(0));
  await page.reload();
  await expect(rows).toHaveCount(1);
  await expect(rows.getByRole('checkbox')).toBeChecked();
  await rows.getByRole('checkbox').uncheck();
  await page.reload();
  await expect(rows.getByRole('checkbox')).not.toBeChecked();
  await deleteTask(rows);
  await page.reload();
  await expect(rows).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Начните с одного дела' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('rejects blank input and renders HTML literally', async ({ page }) => {
  await page.goto('/');
  const input = await openTaskForm(page);
  await input.fill('   ');
  await input.press('Enter');
  await expect(page.getByText('Введите название задачи.')).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  const title = '<img src=x onerror="alert(1)">';
  await input.fill(title);
  await input.press('Enter');
  await expect(page.getByRole('button', { name: `Изменить задачу: ${title}`, exact: true })).toHaveText(title);
  await expect(page.locator('#task-list img')).toHaveCount(0);
  await expect(page.locator('#input-error')).toBeEmpty();
});

test('supports keyboard actions and keeps focus after closing a menu or deleting a task', async ({ page }) => {
  await page.goto('/');
  const addButton = addTaskButton(page);
  const form = page.locator('#task-form');
  await expect(form).toBeHidden();
  await addButton.focus();
  await page.keyboard.press('Enter');
  await expect(form.getByRole('textbox', { name: 'Что нужно сделать?' })).toBeFocused();
  await page.keyboard.type('Keyboard task');
  await page.keyboard.press('Enter');
  await expect(form).toBeHidden();
  await expect(addButton).toBeFocused();

  const row = taskRows(page);
  const checkbox = row.getByRole('checkbox', { name: 'Keyboard task', exact: true });
  const editTitle = row.getByRole('button', { name: 'Изменить задачу: Keyboard task', exact: true });
  const menuTrigger = taskMenuTrigger(row);
  const menuEdit = row.getByRole('button', { name: 'Изменить', exact: true });
  const remove = row.getByRole('button', { name: 'Удалить задачу: Keyboard task', exact: true });
  await page.keyboard.press('Tab');
  await expect(checkbox).toBeFocused();
  await page.keyboard.press('Space');
  await expect(checkbox).toBeChecked();
  await expect(checkbox).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(editTitle).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(menuTrigger).toBeFocused();
  await expect(menuTrigger).toHaveAccessibleName('Действия с задачей: Keyboard task');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(menuEdit).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(remove).toBeHidden();
  await expect(menuTrigger).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(menuEdit).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(remove).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(row).toHaveCount(0);
  await expect(addButton).toBeFocused();
});

test('cancels adding by button and Escape, clears the draft and returns focus', async ({ page }) => {
  await page.goto('/');
  const form = page.locator('#task-form');
  await expect(form).toBeHidden();
  for (const cancelWith of ['button', 'Escape']) {
    const input = await openTaskForm(page);
    await expect(input).toBeFocused();
    await expect(input).toBeEmpty();
    await input.fill('Не сохранять');
    if (cancelWith === 'button') {
      await form.getByRole('button', { name: 'Отмена', exact: true }).click();
    } else {
      await input.press('Escape');
    }
    await expect(form).toBeHidden();
    await expect(addTaskButton(page)).toBeFocused();
    await expect(taskRows(page)).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('digital-todo.state.v2'))).toBeNull();
  }
  await expect(await openTaskForm(page)).toBeEmpty();
});

test('returns focus to the open add form after deleting the only task', async ({ page }) => {
  await page.goto('/');
  await addTask(page, 'Единственная задача');
  const input = await openTaskForm(page);
  const draft = 'Черновик новой задачи';
  await input.fill(draft);
  await deleteTask(taskRows(page));
  await expect(taskRows(page)).toHaveCount(0);
  await expect(input).toBeVisible();
  await expect(input).toHaveValue(draft);
  await expect(input).toBeFocused();
  const saved = await page.evaluate(() => localStorage.getItem('digital-todo.state.v2'));
  expect(saved).not.toBeNull();
  expect(saved).not.toContain(draft);
});

test('tabs through the task row before the add button on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await addTask(page, 'Задача на телефоне');
  const row = taskRows(page);
  const checkbox = row.getByRole('checkbox', { name: 'Задача на телефоне', exact: true });
  const editTitle = row.getByRole('button', { name: 'Изменить задачу: Задача на телефоне', exact: true });
  await listMenuTrigger(page).focus();
  await page.keyboard.press('Tab');
  await expect(checkbox).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(editTitle).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(taskMenuTrigger(row)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(addTaskButton(page)).toBeFocused();
});

test('fits a narrow screen with a long unbroken task title', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  await addTask(page, 'ОченьДлиннаяЗадача'.repeat(30));
  const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
  const contentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(contentWidth).toBeLessThanOrEqual(viewportWidth);
  await expect(page.getByRole('checkbox')).toBeVisible();
  const row = taskRows(page);
  await taskMenuTrigger(row).click();
  const button = row.getByRole('button', { name: /^Удалить задачу:/ });
  await button.scrollIntoViewIfNeeded();
  await expect(button).toBeInViewport();
  await button.click();
  await expect(page.getByRole('heading', { name: 'Начните с одного дела' })).toBeVisible();
});

test('shows both task actions when opening a menu at the bottom of the mobile viewport', async ({ page }) => {
  await loadLongMobileList(page);
  const row = taskRows(page).nth(12);
  const trigger = taskMenuTrigger(row);
  await trigger.evaluate(element => element.scrollIntoView({ block: 'end' }));
  await expect(trigger).toBeInViewport({ ratio: 1 });
  await trigger.click();
  await expect(row.getByRole('button', { name: 'Изменить', exact: true })).toBeInViewport({ ratio: 1 });
  await expect(row.getByRole('button', { name: 'Удалить задачу: Задача 13', exact: true })).toBeInViewport({ ratio: 1 });
});

test('closes a task menu when Tab moves focus to the next task', async ({ page }) => {
  await page.goto('/');
  await addTask(page, 'Первая задача');
  await addTask(page, 'Следующая задача');
  const row = taskRows(page).first();
  const trigger = taskMenuTrigger(row);
  const edit = row.getByRole('button', { name: 'Изменить', exact: true });
  const remove = row.getByRole('button', { name: 'Удалить задачу: Первая задача', exact: true });
  const nextCheckbox = page.getByRole('checkbox', { name: 'Следующая задача', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(edit).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(remove).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(nextCheckbox).toBeFocused();
  await expect(edit).toBeHidden();
  await expect(remove).toBeHidden();
});

test('keeps a save failure in view when changing a task far down a mobile list', async ({ page }) => {
  await loadLongMobileList(page);
  const saved = await page.evaluate(() => localStorage.getItem('digital-todo.state.v2'));
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Test quota', 'QuotaExceededError'); };
  });
  const checkbox = page.getByRole('checkbox', { name: 'Задача 16', exact: true });
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  const warning = page.locator('#storage-warning');
  await expect(warning).toContainText('Не удалось сохранить');
  await expect(warning).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => localStorage.getItem('digital-todo.state.v2'))).toBe(saved);
});

test('warns about corrupt data and replaces it only after an explicit addition', async ({ browser }) => {
  const context = await browser.newContext({
    storageState: {
      cookies: [],
      origins: [{ origin: 'http://127.0.0.1:4173', localStorage: [{ name: 'digital-todo.tasks.v1', value: '{broken' }] }],
    },
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.locator('#storage-warning')).toContainText('Сохранённый список повреждён');
  await page.reload();
  await expect(page.locator('#storage-warning')).toBeVisible();
  await addTask(page, 'Новый список');
  await expect(page.locator('#storage-warning')).toBeHidden();
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Новый список' })).toBeVisible();
  await context.close();
});

test('remains usable and warns when the browser blocks storage', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('Storage blocked for test', 'SecurityError'); },
    });
  });
  await page.goto('/');
  await expect(page.locator('#storage-warning')).toContainText('Хранилище браузера недоступно');
  await addTask(page, 'Несохранённая задача');
  await expect(page.getByRole('checkbox')).toBeVisible();
  await expect(page.locator('#storage-warning')).toContainText('Не удалось сохранить');
  await page.getByRole('checkbox').check();
  await expect(page.getByRole('checkbox')).toBeChecked();
  await deleteTask(taskRows(page));
  await expect(page.getByRole('heading', { name: 'Начните с одного дела' })).toBeVisible();
});
