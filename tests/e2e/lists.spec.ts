import { expect, test } from '@playwright/test';
import {
  activeListTitle, addTask, addTaskButton, createList, listButton, listMenu, listMenuTrigger, listNav,
  listPicker, listPickerButton, openCreateList, openListAction, openTaskForm, taskInput,
} from './helpers';

test('manages independent lists and restores the selected list', async ({ page }) => {
  await page.goto('/');
  await listMenuTrigger(page).click();
  await expect(listMenu(page).getByRole('button', { name: 'Удалить список', exact: true })).toBeDisabled();
  await addTask(page, 'Личная задача');
  await createList(page, '  Работа  ');
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await addTask(page, 'Рабочая задача');
  await page.getByRole('checkbox').check();
  await openListAction(page, 'Переименовать');
  const rename = page.getByRole('dialog', { name: 'Переименовать список' });
  await rename.getByRole('textbox').fill('Проект');
  await rename.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.reload();
  await expect(activeListTitle(page)).toHaveText('Проект');
  await expect(listButton(page, 'Проект')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('checkbox', { name: 'Рабочая задача' })).toBeChecked();
  await listButton(page, 'Мои задачи').click();
  await expect(page.getByRole('checkbox', { name: 'Личная задача' })).not.toBeChecked();
  await expect(page.getByRole('checkbox')).toHaveCount(1);
  await page.reload();
  await expect(activeListTitle(page)).toHaveText('Мои задачи');
  await expect(listButton(page, 'Мои задачи')).toHaveAttribute('aria-pressed', 'true');
});

test('confirms deletion, supports cancellation and protects the last list', async ({ page }) => {
  await page.goto('/');
  await createList(page, 'Учёба');
  await addTask(page, 'Не потерять');
  const remove = listMenu(page).getByRole('button', { name: 'Удалить список', exact: true });
  await openListAction(page, 'Удалить список');
  const dialog = page.getByRole('dialog', { name: 'Удалить список?' });
  await expect(dialog).toContainText('Учёба');
  await expect(dialog).toContainText('Задач в списке: 1');
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(listMenuTrigger(page)).toBeFocused();
  await expect(page.getByRole('checkbox', { name: 'Не потерять' })).toBeVisible();
  await openListAction(page, 'Удалить список');
  await page.keyboard.press('Escape');
  await expect(listMenuTrigger(page)).toBeFocused();
  await openListAction(page, 'Удалить список');
  await dialog.getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(listMenuTrigger(page)).toBeFocused();
  await expect(listNav(page).getByRole('button')).toHaveCount(1);
  await listMenuTrigger(page).click();
  await expect(remove).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(listNav(page).getByRole('button')).toHaveCount(1);
});

test('keeps two drafts in memory across list switches without saving either', async ({ page }) => {
  await page.goto('/');
  await addTask(page, 'Задача A');
  await page.getByRole('button', { name: 'Изменить задачу: Задача A' }).click();
  await page.getByRole('textbox', { name: 'Название задачи' }).fill('Черновик A');
  await createList(page, 'B');
  await addTask(page, 'Задача B');
  await page.getByRole('button', { name: 'Изменить задачу: Задача B' }).click();
  await page.getByRole('textbox', { name: 'Название задачи' }).fill('Черновик B');
  await listButton(page, 'Мои задачи').click();
  await expect(page.getByRole('textbox', { name: 'Название задачи' })).toHaveValue('Черновик A');
  const raw = await page.evaluate(() => localStorage.getItem('digital-todo.state.v2'));
  expect(raw).not.toContain('Черновик');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await listButton(page, 'B').click();
  await expect(page.getByRole('textbox', { name: 'Название задачи' })).toHaveValue('Черновик B');
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Задача B' })).toBeVisible();
  await listButton(page, 'Мои задачи').click();
  await expect(page.getByRole('checkbox', { name: 'Черновик A' })).toBeVisible();
});

test('migrates old tasks without overwriting the legacy key or repeating migration', async ({ browser }) => {
  const oldTasks = [{ id: 'legacy-task', title: 'Старая задача', completed: true }];
  const raw = JSON.stringify(oldTasks);
  const context = await browser.newContext({ storageState: { cookies: [], origins: [
    { origin: 'http://127.0.0.1:4173', localStorage: [{ name: 'digital-todo.tasks.v1', value: raw }] },
  ] } });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.getByRole('checkbox', { name: 'Старая задача' })).toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem('digital-todo.state.v2'))).toBeNull();
  await createList(page, 'Новое');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('digital-todo.state.v2')!));
  expect(saved.lists[0].tasks).toEqual(oldTasks);
  expect(await page.evaluate(() => localStorage.getItem('digital-todo.tasks.v1'))).toBe(raw);
  await page.reload();
  await expect(listNav(page).getByRole('button')).toHaveCount(2);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await context.close();
});

test('validates names, cancels rename and distinguishes equal list titles', async ({ page }) => {
  await page.goto('/');
  await openCreateList(page);
  const dialog = page.getByRole('dialog');
  const input = dialog.getByRole('textbox');
  await input.fill('   ');
  await input.press('Enter');
  await expect(dialog.getByText('Введите название списка.')).toBeVisible();
  await expect(input).toBeFocused();
  await input.fill('Мои задачи');
  await input.press('Enter');
  const sameNames = listButton(page, 'Мои задачи');
  await expect(sameNames).toHaveCount(2);
  const second = sameNames.and(listNav(page).locator('[aria-pressed="true"]'));
  await expect(second).toHaveAttribute('data-list-id', /^(?!inbox$).+$/);
  const secondId = (await second.getAttribute('data-list-id'))!;
  const byId = (id: string) => listNav(page).locator(`button[data-list-id="${id}"]`);
  await addTask(page, 'Вторая');
  await byId('inbox').click();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await byId(secondId).click();
  await expect(page.getByRole('checkbox', { name: 'Вторая' })).toBeVisible();
  await openListAction(page, 'Переименовать');
  await input.fill('Несохранённое');
  await page.keyboard.press('Escape');
  await expect(activeListTitle(page)).toHaveText('Мои задачи');
  await expect(byId(secondId)).toHaveAccessibleName('Мои задачи');
  await expect(byId(secondId)).toHaveAttribute('aria-pressed', 'true');
});

test('keeps delete consequences and actions visible before a long, literal list name', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  const title = '<img src=x onerror=alert(1)>' + 'Название'.repeat(30);
  await createList(page, title);
  await expect(activeListTitle(page)).toHaveText(title);
  await expect(listMenuTrigger(page)).toBeFocused();
  await addTask(page, 'Удалится вместе со списком');
  await openListAction(page, 'Удалить список');
  const dialog = page.getByRole('dialog', { name: 'Удалить список?' });
  const consequences = dialog.locator('#delete-list-description');
  const name = dialog.locator('#delete-list-name');
  const confirm = dialog.getByRole('button', { name: 'Удалить', exact: true });
  await expect(dialog).toContainText(title);
  await expect(dialog.locator('img')).toHaveCount(0);
  await expect(consequences).toContainText('Задач в списке: 1');
  await expect(consequences).toContainText(/все (его )?задачи/i);
  await expect(consequences).toBeInViewport({ ratio: 1 });
  await expect(confirm).toBeInViewport({ ratio: 1 });
  await expect(name).toContainText(title);
  const nameBox = (await name.boundingBox())!;
  const warningBox = (await consequences.boundingBox())!;
  expect(nameBox.y).toBeGreaterThanOrEqual(warningBox.y + warningBox.height);
  const scrollTop = await name.evaluate(element => {
    element.scrollTop = element.scrollHeight;
    return element.scrollTop;
  });
  expect(scrollTop).toBeGreaterThan(0);
  await expect(consequences).toBeInViewport({ ratio: 1 });
  await expect(confirm).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test('preserves legacy data if migration cannot be saved, then recovers on the next action', async ({ browser }) => {
  const raw = JSON.stringify([{ id: 'legacy', title: 'Не потерять', completed: true }]);
  const context = await browser.newContext({ storageState: { cookies: [], origins: [
    { origin: 'http://127.0.0.1:4173', localStorage: [{ name: 'digital-todo.tasks.v1', value: raw }] },
  ] } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (!sessionStorage.getItem('allow-writes')) throw new DOMException('Test quota', 'QuotaExceededError');
      return setItem.call(this, key, value);
    };
    // The test uses a different operation to control the failure boundary.
    Object.defineProperty(window, 'allowTestWrites', { value: () => setItem.call(sessionStorage, 'allow-writes', 'yes') });
  });
  await page.goto('http://127.0.0.1:4173/');
  await createList(page, 'Несохранённый список');
  await expect(page.locator('#storage-warning')).toContainText('Не удалось сохранить');
  expect(await page.evaluate(() => localStorage.getItem('digital-todo.state.v2'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('digital-todo.tasks.v1'))).toBe(raw);
  await page.reload();
  await expect(listNav(page).getByRole('button')).toHaveCount(1);
  await expect(page.getByRole('checkbox', { name: 'Не потерять' })).toBeChecked();
  await page.evaluate(() => (window as unknown as { allowTestWrites: () => void }).allowTestWrites());
  await createList(page, 'Сохранённый список');
  await expect(page.locator('#storage-warning')).toBeHidden();
  await page.reload();
  await expect(activeListTitle(page)).toHaveText('Сохранённый список');
  await expect(listButton(page, 'Сохранённый список')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('digital-todo.tasks.v1'))).toBe(raw);
  await context.close();
});

test('respects IME in create and rename dialogs and handles ordinary Escape afterwards', async ({ page, context }) => {
  await page.goto('/');
  const cdp = await context.newCDPSession(page);
  for (const action of ['Новый список', 'Переименовать']) {
    if (action === 'Новый список') await openCreateList(page);
    else await openListAction(page, 'Переименовать');
    const dialog = page.getByRole('dialog');
    await cdp.send('Input.imeSetComposition', { text: '仮', selectionStart: 1, selectionEnd: 1 });
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await cdp.send('Input.insertText', { text: action === 'Новый список' ? '仮名' : '名前' });
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
  }
  await expect(activeListTitle(page)).toHaveText('名前');
  await expect(listButton(page, '名前')).toHaveAttribute('aria-pressed', 'true');
  await openListAction(page, 'Переименовать');
  await page.getByRole('dialog').getByRole('textbox').fill('Не сохранять');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(activeListTitle(page)).toHaveText('名前');
  await expect(listButton(page, '名前')).toHaveAttribute('aria-pressed', 'true');
});

test('retains keyboard focus when switching lists and closing list actions', async ({ page }) => {
  await page.goto('/');
  await createList(page, 'Работа');
  const menu = listMenuTrigger(page);
  await expect(menu).toBeFocused();
  const inbox = listButton(page, 'Мои задачи');
  await inbox.focus();
  await page.keyboard.press('Enter');
  await expect(inbox).toBeFocused();
  await expect(inbox).toHaveAttribute('aria-pressed', 'true');
  await expect(listButton(page, 'Работа')).toHaveAttribute('aria-pressed', 'false');
  await expect(activeListTitle(page)).toHaveText('Мои задачи');

  await menu.focus();
  await page.keyboard.press('Enter');
  const rename = listMenu(page).getByRole('button', { name: 'Переименовать', exact: true });
  await page.keyboard.press('Tab');
  await expect(rename).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(rename).toBeHidden();
  await expect(menu).toBeFocused();

  await openListAction(page, 'Переименовать');
  const dialog = page.getByRole('dialog', { name: 'Переименовать список' });
  await dialog.getByRole('textbox', { name: 'Название списка' }).fill('Личное');
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(menu).toBeFocused();
  await expect(listButton(page, 'Личное')).toHaveAttribute('aria-pressed', 'true');
});

test('uses a modal list picker on mobile and returns focus when it closes', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 720 });
  await page.goto('/');
  const trigger = listPickerButton(page);
  const picker = listPicker(page);
  await expect(listNav(page)).toBeHidden();
  await expect(page.getByRole('button', { name: 'Новый список', exact: true })).toBeHidden();

  await trigger.click();
  await expect(picker).toBeVisible();
  await expect(listButton(picker, 'Мои задачи')).toHaveAttribute('aria-pressed', 'true');
  await picker.getByRole('button', { name: 'Закрыть списки', exact: true }).click();
  await expect(picker).toBeHidden();
  await expect(trigger).toBeFocused();

  await createList(page, 'Работа');
  await expect(picker).toBeHidden();
  await expect(listMenuTrigger(page)).toBeFocused();
  await expect(activeListTitle(page)).toHaveText('Работа');
  await addTask(page, 'Рабочая задача');

  await trigger.click();
  await expect(listButton(picker, 'Работа')).toHaveAttribute('aria-pressed', 'true');
  await listButton(picker, 'Мои задачи').click();
  await expect(picker).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(activeListTitle(page)).toHaveText('Мои задачи');
  await expect(page.getByRole('checkbox')).toHaveCount(0);

  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(picker).toBeHidden();
  await expect(trigger).toBeFocused();

  await page.setViewportSize({ width: 701, height: 720 });
  await expect(trigger).toBeHidden();
  await expect(listButton(page, 'Мои задачи')).toHaveAttribute('aria-pressed', 'true');
  await listButton(page, 'Работа').click();
  await expect(page.getByRole('checkbox', { name: 'Рабочая задача' })).toBeVisible();
});

test('restores the add form and its draft per list until reload', async ({ page }) => {
  await page.goto('/');
  const form = page.locator('#task-form');
  const input = await openTaskForm(page);
  await input.fill('Черновик добавления A');
  await createList(page, 'B');
  await expect(form).toBeHidden();
  await expect(addTaskButton(page)).toBeVisible();
  await expect(await openTaskForm(page)).toBeEmpty();
  await input.fill('Черновик добавления B');

  await listButton(page, 'Мои задачи').click();
  await expect(form).toBeVisible();
  await expect(taskInput(page)).toHaveValue('Черновик добавления A');
  await listButton(page, 'B').click();
  await expect(form).toBeVisible();
  await expect(taskInput(page)).toHaveValue('Черновик добавления B');
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('digital-todo.state.v2')!));
  expect(saved.lists.map((list: { tasks: unknown[] }) => list.tasks)).toEqual([[], []]);
  expect(JSON.stringify(saved)).not.toContain('Черновик добавления');

  await page.reload();
  await expect(activeListTitle(page)).toHaveText('B');
  await expect(form).toBeHidden();
  await expect(await openTaskForm(page)).toBeEmpty();
  await listButton(page, 'Мои задачи').click();
  await expect(form).toBeHidden();
  await expect(await openTaskForm(page)).toBeEmpty();
});
