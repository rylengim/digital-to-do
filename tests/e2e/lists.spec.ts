import { expect, test, type Page } from '@playwright/test';

async function createList(page: Page, title: string) {
  await page.getByRole('button', { name: 'Новый список', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Новый список', exact: true });
  await dialog.getByRole('textbox', { name: 'Название списка' }).fill(title);
  await dialog.getByRole('button', { name: 'Создать', exact: true }).click();
}

async function addTask(page: Page, title: string) {
  const input = page.getByRole('textbox', { name: 'Что нужно сделать?' });
  await input.fill(title);
  await input.press('Enter');
}

test('manages independent lists and restores the selected list', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Удалить список', exact: true })).toBeDisabled();
  await addTask(page, 'Личная задача');
  await createList(page, '  Работа  ');
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await addTask(page, 'Рабочая задача');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Переименовать', exact: true }).click();
  const rename = page.getByRole('dialog', { name: 'Переименовать список' });
  await rename.getByRole('textbox').fill('Проект');
  await rename.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.reload();
  const picker = page.getByRole('combobox', { name: 'Текущий список' });
  await expect(picker.locator('option:checked')).toHaveText('Проект');
  await expect(page.getByRole('checkbox', { name: 'Рабочая задача' })).toBeChecked();
  await picker.selectOption({ label: 'Мои задачи' });
  await expect(page.getByRole('checkbox', { name: 'Личная задача' })).not.toBeChecked();
  await expect(page.getByRole('checkbox')).toHaveCount(1);
  await page.reload();
  await expect(picker.locator('option:checked')).toHaveText('Мои задачи');
});

test('confirms deletion, supports cancellation and protects the last list', async ({ page }) => {
  await page.goto('/');
  await createList(page, 'Учёба');
  await addTask(page, 'Не потерять');
  const remove = page.getByRole('button', { name: 'Удалить список', exact: true });
  await remove.click();
  const dialog = page.getByRole('dialog', { name: 'Удалить список?' });
  await expect(dialog).toContainText('Учёба');
  await expect(dialog).toContainText('Задач в списке: 1');
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(remove).toBeFocused();
  await expect(page.getByRole('checkbox', { name: 'Не потерять' })).toBeVisible();
  await remove.click();
  await page.keyboard.press('Escape');
  await expect(remove).toBeFocused();
  await remove.click();
  await dialog.getByRole('button', { name: 'Удалить', exact: true }).click();
  const picker = page.getByRole('combobox', { name: 'Текущий список' });
  await expect(picker).toBeFocused();
  await expect(picker.locator('option')).toHaveCount(1);
  await expect(remove).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(picker.locator('option')).toHaveCount(1);
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
  const picker = page.getByRole('combobox', { name: 'Текущий список' });
  await picker.selectOption({ label: 'Мои задачи' });
  await expect(page.getByRole('textbox', { name: 'Название задачи' })).toHaveValue('Черновик A');
  const raw = await page.evaluate(() => localStorage.getItem('digital-todo.state.v2'));
  expect(raw).not.toContain('Черновик');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await picker.selectOption({ label: 'B' });
  await expect(page.getByRole('textbox', { name: 'Название задачи' })).toHaveValue('Черновик B');
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Задача B' })).toBeVisible();
  await picker.selectOption({ label: 'Мои задачи' });
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
  await expect(page.getByRole('combobox').locator('option')).toHaveCount(2);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await context.close();
});

test('validates names, cancels rename and distinguishes equal list titles', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Новый список', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const input = dialog.getByRole('textbox');
  await input.fill('   ');
  await input.press('Enter');
  await expect(dialog.getByText('Введите название списка.')).toBeVisible();
  await expect(input).toBeFocused();
  await input.fill('Мои задачи');
  await input.press('Enter');
  const picker = page.getByRole('combobox');
  const secondId = await picker.inputValue();
  expect(secondId).not.toBe('inbox');
  await addTask(page, 'Вторая');
  await picker.selectOption('inbox');
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await picker.selectOption(secondId);
  await expect(page.getByRole('checkbox', { name: 'Вторая' })).toBeVisible();
  await page.getByRole('button', { name: 'Переименовать', exact: true }).click();
  await input.fill('Несохранённое');
  await page.keyboard.press('Escape');
  await expect(picker.locator('option:checked')).toHaveText('Мои задачи');
});

test('keeps controls usable at 320px and renders list names literally', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/');
  const title = '<img src=x onerror=alert(1)>' + 'Название'.repeat(30);
  await createList(page, title);
  await expect(page.getByRole('combobox').locator('option:checked')).toHaveText(title);
  await page.getByRole('button', { name: 'Удалить список', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Удалить список?' });
  await expect(dialog).toContainText(title);
  await expect(dialog.locator('img')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Удалить', exact: true })).toBeInViewport();
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
  await expect(page.getByRole('combobox').locator('option')).toHaveCount(1);
  await expect(page.getByRole('checkbox', { name: 'Не потерять' })).toBeChecked();
  await page.evaluate(() => (window as unknown as { allowTestWrites: () => void }).allowTestWrites());
  await createList(page, 'Сохранённый список');
  await expect(page.locator('#storage-warning')).toBeHidden();
  await page.reload();
  await expect(page.getByRole('combobox').locator('option:checked')).toHaveText('Сохранённый список');
  expect(await page.evaluate(() => localStorage.getItem('digital-todo.tasks.v1'))).toBe(raw);
  await context.close();
});

test('respects IME in create and rename dialogs and handles ordinary Escape afterwards', async ({ page, context }) => {
  await page.goto('/');
  const cdp = await context.newCDPSession(page);
  for (const action of ['Новый список', 'Переименовать']) {
    await page.getByRole('button', { name: action, exact: true }).click();
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
  await expect(page.getByRole('combobox').locator('option:checked')).toHaveText('名前');
  await page.getByRole('button', { name: 'Переименовать', exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('Не сохранять');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('combobox').locator('option:checked')).toHaveText('名前');
});
