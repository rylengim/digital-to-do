import { expect, test } from '@playwright/test';

test('saves a renamed completed task without changing its id or its duplicate', async ({ page }) => {
  await page.goto('/');
  const addInput = page.getByRole('textbox', { name: 'Что нужно сделать?' });
  for (let i = 0; i < 2; i++) {
    await addInput.fill('Одинаковые задачи');
    await addInput.press('Enter');
  }
  const rows = page.getByRole('listitem');
  await rows.nth(1).getByRole('checkbox').check();
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem('digital-todo.state.v2')!).lists[0].tasks);
  await rows.nth(1).getByRole('button', { name: /^Изменить задачу:/ }).click();
  const editor = rows.nth(1).getByRole('textbox', { name: 'Название задачи' });
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue('Одинаковые задачи');
  await editor.fill('  Уточнённая задача  ');
  await rows.nth(1).getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(rows.nth(1).getByRole('button', { name: 'Изменить задачу: Уточнённая задача' })).toBeFocused();
  await expect(rows.nth(1).getByRole('button', { name: 'Удалить задачу: Уточнённая задача' })).toBeVisible();
  await page.reload();
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).getByRole('checkbox', { name: 'Одинаковые задачи' })).not.toBeChecked();
  await expect(rows.nth(1).getByRole('checkbox', { name: 'Уточнённая задача' })).toBeChecked();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('digital-todo.state.v2')!).lists[0].tasks);
  expect(saved).toEqual([original[0], { ...original[1], title: 'Уточнённая задача' }]);
});

test('cancels by button and Escape and never saves a draft through another action', async ({ page }) => {
  await page.goto('/');
  const addInput = page.getByRole('textbox', { name: 'Что нужно сделать?' });
  await addInput.fill('Исходная задача');
  await addInput.press('Enter');
  const row = page.getByRole('listitem').first();
  const editButton = row.getByRole('button', { name: 'Изменить задачу: Исходная задача' });
  for (const cancelWith of ['button', 'Escape', 'reload']) {
    await editButton.click();
    const editor = row.getByRole('textbox', { name: 'Название задачи' });
    await editor.fill('Несохранённый черновик');
    // Saving a different task must not accidentally persist this draft.
    await addInput.fill(`Другая задача ${cancelWith}`);
    await addInput.press('Enter');
    if (cancelWith === 'button') {
      await row.getByRole('button', { name: 'Отмена', exact: true }).click();
    } else if (cancelWith === 'Escape') {
      await editor.press('Escape');
    } else {
      await page.reload();
    }
    await expect(row.getByRole('checkbox')).toHaveAccessibleName('Исходная задача');
    if (cancelWith !== 'reload') await expect(editButton).toBeFocused();
    await page.reload();
    await expect(row.getByRole('checkbox')).toHaveAccessibleName('Исходная задача');
  }
});

test('rejects empty edits, saves with Enter and safely displays HTML as text', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('textbox').fill('Старая задача');
  await page.getByRole('textbox').press('Enter');
  await page.getByRole('button', { name: /^Изменить задачу:/ }).focus();
  await page.keyboard.press('Enter');
  const editor = page.getByRole('textbox', { name: 'Название задачи' });
  for (const blank of ['', '   ']) {
    await editor.fill(blank);
    await editor.press('Enter');
    await expect(editor).toBeFocused();
    await expect(editor).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('listitem').getByText('Введите название задачи.', { exact: true })).toBeVisible();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('digital-todo.state.v2')!).lists[0].tasks);
    expect(saved[0].title).toBe('Старая задача');
  }
  const title = '<img src=x onerror="alert(1)">';
  await editor.fill(title);
  await editor.press('Enter');
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('checkbox')).toHaveAccessibleName(title);
  await expect(page.locator('#task-list img')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('checkbox')).toHaveAccessibleName(title);
  expect(errors).toEqual([]);
});

test('keeps editing controls usable on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/');
  await page.getByRole('textbox').fill('Задача');
  await page.getByRole('textbox').press('Enter');
  await page.getByRole('button', { name: /^Изменить задачу:/ }).click();
  await page.getByRole('textbox', { name: 'Название задачи' }).fill('ДлинноеНазвание'.repeat(40));
  await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Отмена', exact: true })).toBeInViewport();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Изменить задачу:/ })).toBeVisible();
});

test('reports a failed edit write and preserves the last saved version', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox').fill('Сохранённая задача');
  await page.getByRole('textbox').press('Enter');
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Test quota', 'QuotaExceededError'); };
  });
  await page.reload();
  await page.getByRole('button', { name: /^Изменить задачу:/ }).click();
  const editor = page.getByRole('textbox', { name: 'Название задачи' });
  await editor.fill('Изменённая задача');
  await editor.press('Enter');
  await expect(page.getByRole('checkbox')).toHaveAccessibleName('Изменённая задача');
  await expect(page.locator('#storage-warning')).toContainText('Не удалось сохранить изменения');
  await page.reload();
  await expect(page.getByRole('checkbox')).toHaveAccessibleName('Сохранённая задача');
});
