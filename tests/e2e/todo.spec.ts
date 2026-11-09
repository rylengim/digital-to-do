import { expect, test } from '@playwright/test';

test('adds by button and Enter, completes, deletes and restores independent tasks', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Что нужно сделать?' });
  await input.fill('  Проверить прототип  ');
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await input.fill('Проверить прототип');
  await input.press('Enter');
  const rows = page.getByRole('list', { name: 'Задачи', exact: true }).getByRole('listitem');
  await expect(rows).toHaveCount(2);
  await rows.nth(1).getByRole('checkbox').check();
  await page.reload();
  await expect(rows.nth(0).getByRole('checkbox')).not.toBeChecked();
  await expect(rows.nth(1).getByRole('checkbox')).toBeChecked();
  await rows.nth(0).getByRole('button').click();
  await page.reload();
  await expect(rows).toHaveCount(1);
  await expect(rows.getByRole('checkbox')).toBeChecked();
  await rows.getByRole('checkbox').uncheck();
  await page.reload();
  await expect(rows.getByRole('checkbox')).not.toBeChecked();
  await rows.getByRole('button').click();
  await page.reload();
  await expect(rows).toHaveCount(0);
  await expect(page.getByText('Начните с одного дела')).toBeVisible();
  expect(errors).toEqual([]);
});

test('rejects blank input and renders HTML literally', async ({ page }) => {
  await page.goto('/');
  const input = page.getByRole('textbox');
  await input.fill('   ');
  await input.press('Enter');
  await expect(page.getByText('Введите название задачи.')).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  const title = '<img src=x onerror="alert(1)">';
  await input.fill(title);
  await input.press('Enter');
  await expect(page.locator('.task-title')).toHaveText(title);
  await expect(page.locator('#task-list img')).toHaveCount(0);
  await expect(page.locator('#input-error')).toBeEmpty();
});

test('supports keyboard actions and keeps focus after deleting', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox')).toBeFocused();
  await page.keyboard.type('Keyboard task');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox')).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('checkbox')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByRole('checkbox')).toBeChecked();
  await expect(page.getByRole('checkbox')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Удалить задачу: Keyboard task' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox')).toBeFocused();
});

test('fits a narrow screen with a long unbroken task title', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  await page.getByRole('textbox').fill('ОченьДлиннаяЗадача'.repeat(30));
  await page.getByRole('textbox').press('Enter');
  const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
  const contentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(contentWidth).toBeLessThanOrEqual(viewportWidth);
  await expect(page.getByRole('checkbox')).toBeVisible();
  const button = page.getByRole('button', { name: /^Удалить задачу:/ });
  await expect(button).toBeInViewport();
  await button.click();
  await expect(page.getByText('Начните с одного дела')).toBeVisible();
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
  await page.getByRole('textbox').fill('Новый список');
  await page.getByRole('textbox').press('Enter');
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
  await page.getByRole('textbox').fill('Несохранённая задача');
  await page.getByRole('textbox').press('Enter');
  await expect(page.getByRole('checkbox')).toBeVisible();
  await expect(page.locator('#storage-warning')).toContainText('Не удалось сохранить');
  await page.getByRole('checkbox').check();
  await expect(page.getByRole('checkbox')).toBeChecked();
  await page.getByRole('button', { name: /^Удалить задачу:/ }).click();
  await expect(page.getByText('Начните с одного дела')).toBeVisible();
});
