import type { Locator, Page } from '@playwright/test';

export const taskInput = (page: Page) => page.getByRole('textbox', { name: 'Что нужно сделать?' });
export const addTaskButton = (page: Page) => page.getByRole('button', { name: 'Добавить задачу', exact: true });
export const taskRows = (page: Page) => page.getByRole('list', { name: 'Задачи', exact: true }).getByRole('listitem');
export const activeListTitle = (page: Page) => page.locator('h1#active-list-title');
export const listMenu = (page: Page) => page.locator('#list-menu');
export const listMenuTrigger = (page: Page) => listMenu(page).locator('summary[aria-label="Действия со списком"]');
export const taskMenuTrigger = (row: Locator) => row.locator('.task-menu > summary');
export const listPickerButton = (page: Page) => page.getByRole('button', { name: 'Списки', exact: true });
export const listPicker = (page: Page) => page.getByRole('dialog', { name: 'Мои списки', exact: true });
export const listNav = (surface: Page | Locator) => surface.getByRole('navigation', { name: 'Списки задач', exact: true });
export const listButton = (surface: Page | Locator, title: string) =>
  listNav(surface).getByRole('button', { name: title, exact: true });

export async function openTaskForm(page: Page) {
  const input = taskInput(page);
  if (!(await input.isVisible())) await addTaskButton(page).click();
  return input;
}

export async function addTask(page: Page, title: string) {
  const input = await openTaskForm(page);
  await input.fill(title);
  await input.press('Enter');
}

export async function deleteTask(row: Locator) {
  await taskMenuTrigger(row).click();
  await row.getByRole('button', { name: /^Удалить задачу:/ }).click();
}

export async function openCreateList(page: Page) {
  let surface: Page | Locator = page;
  if (await listPickerButton(page).isVisible()) {
    surface = listPicker(page);
    if (!(await surface.isVisible())) await listPickerButton(page).click();
  }
  await surface.getByRole('button', { name: 'Новый список', exact: true }).click();
}

export async function createList(page: Page, title: string) {
  await openCreateList(page);
  const dialog = page.getByRole('dialog', { name: 'Новый список', exact: true });
  await dialog.getByRole('textbox', { name: 'Название списка' }).fill(title);
  await dialog.getByRole('button', { name: 'Создать', exact: true }).click();
}

export async function openListAction(page: Page, name: 'Переименовать' | 'Удалить список') {
  await listMenuTrigger(page).click();
  await listMenu(page).getByRole('button', { name, exact: true }).click();
}
