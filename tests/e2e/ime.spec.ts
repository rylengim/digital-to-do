import { expect, test } from '@playwright/test';

// CDP drives Chromium's composition path; this does not replace a system IME test.
test('IME Enter and Escape keep an edit draft open until composition is committed', async ({ page, context }) => {
  await page.goto('/');
  const addInput = page.getByRole('textbox', { name: 'Что нужно сделать?' });
  await addInput.fill('Исходное');
  await addInput.press('Enter');
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
  const input = page.getByRole('textbox', { name: 'Что нужно сделать?' });
  await input.focus();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: '仮', selectionStart: 1, selectionEnd: 1 });
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listitem')).toHaveCount(0);
  await expect(input).toHaveValue('仮');
  expect(await page.evaluate(() => localStorage.getItem('digital-todo.state.v2'))).toBeNull();
  await cdp.send('Input.insertText', { text: '仮名' });
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('checkbox')).toHaveAccessibleName('仮名');
  await expect(input).toBeEmpty();
  await page.reload();
  await expect(page.getByRole('checkbox')).toHaveAccessibleName('仮名');
});
