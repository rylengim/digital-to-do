import { expect, test, type Locator } from '@playwright/test';
import { addTask, addTaskButton, openTaskForm, taskRows } from './helpers';

// CDP drives Chromium's composition path; this does not replace a system IME test.
test('IME Enter and Escape keep an edit draft open until composition is committed', async ({ page, context }) => {
  await page.goto('/');
  await addTask(page, 'Исходное');
  await page.getByRole('checkbox').check();
  const original = await page.evaluate(() => localStorage.getItem('digital-todo.state.v2'));
  await page.getByRole('button', { name: 'Изменить задачу: Исходное' }).click();
  const editor = page.getByRole('textbox', { name: 'Название задачи' });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: '仮', selectionStart: 1, selectionEnd: 1 });
  await page.keyboard.press('Enter');
  await expect(editor).toBeVisible();
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue('仮');
  expect(await page.evaluate(() => localStorage.getItem('digital-todo.state.v2'))).toBe(original);
  await page.keyboard.press('Escape');
  await expect(editor).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('digital-todo.state.v2'))).toBe(original);

  await cdp.send('Input.insertText', { text: '仮名' });
  await page.keyboard.press('Enter');
  await expect(editor).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: '仮名', exact: true })).toBeChecked();
  await page.reload();
  await expect(page.getByRole('checkbox', { name: '仮名', exact: true })).toBeChecked();
});

test('IME confirmation does not add a partial task', async ({ page, context }) => {
  await page.goto('/');
  const input = await openTaskForm(page);
  await expect(input).toBeFocused();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: '仮', selectionStart: 1, selectionEnd: 1 });
  await page.keyboard.press('Enter');
  await expect(taskRows(page)).toHaveCount(0);
  await expect(input).toHaveValue('仮');
  expect(await page.evaluate(() => localStorage.getItem('digital-todo.state.v2'))).toBeNull();
  await cdp.send('Input.insertText', { text: '仮名' });
  await page.keyboard.press('Enter');
  await expect(taskRows(page)).toHaveCount(1);
  await expect(page.getByRole('checkbox')).toHaveAccessibleName('仮名');
  await expect(page.locator('#task-form')).toBeHidden();
  await expect(addTaskButton(page)).toBeFocused();
  await openTaskForm(page);
  await expect(input).toBeEmpty();
  await page.reload();
  await expect(page.getByRole('checkbox')).toHaveAccessibleName('仮名');
});

test('ignores the final IME key with keyCode 229 even after composition has ended', async ({ page }) => {
  await page.goto('/');
  const input = await openTaskForm(page);
  await input.fill('仮名');
  const imeKey = (target: Locator, key: 'Enter' | 'Escape') => target.evaluate((element, key) => {
    const event = new KeyboardEvent('keydown', {
      key, keyCode: 229, isComposing: false, bubbles: true, cancelable: true,
    });
    element.dispatchEvent(event);
    return { keyCode: event.keyCode, defaultPrevented: event.defaultPrevented };
  }, key);
  expect(await imeKey(input, 'Enter')).toEqual({ keyCode: 229, defaultPrevented: true });
  await imeKey(input, 'Escape');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('仮名');
  await expect(taskRows(page)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('digital-todo.state.v2'))).toBeNull();

  await input.press('Enter');
  await expect(addTaskButton(page)).toBeFocused();
  await page.getByRole('button', { name: 'Изменить задачу: 仮名' }).click();
  const editor = page.getByRole('textbox', { name: 'Название задачи' });
  const saved = await page.evaluate(() => localStorage.getItem('digital-todo.state.v2'));
  await editor.fill('名前');
  expect(await imeKey(editor, 'Enter')).toEqual({ keyCode: 229, defaultPrevented: true });
  await imeKey(editor, 'Escape');
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue('名前');
  expect(await page.evaluate(() => localStorage.getItem('digital-todo.state.v2'))).toBe(saved);
  await editor.press('Escape');
  await expect(page.getByRole('button', { name: 'Изменить задачу: 仮名' })).toBeFocused();
});
