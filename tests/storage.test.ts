import { describe, expect, it } from 'vitest';
import { loadTasks, saveTasks, STORAGE_KEY } from '../src/storage';

const task = { id: 'one', title: 'Первая задача', completed: false };

function memoryStorage(initial: string | null = null) {
  let value = initial;
  return {
    getItem: (key: string) => key === STORAGE_KEY ? value : null,
    setItem: (key: string, next: string) => { if (key === STORAGE_KEY) value = next; },
  };
}

describe('task storage', () => {
  it('starts empty when there is no saved list', () => {
    expect(loadTasks(() => memoryStorage())).toEqual({ tasks: [], status: 'ok' });
  });

  it('round-trips completed tasks and keeps equal titles independent', () => {
    const storage = memoryStorage();
    const tasks = [task, { ...task, id: 'two', completed: true }];
    expect(saveTasks(tasks, () => storage)).toBe(true);
    expect(loadTasks(() => storage)).toEqual({ tasks, status: 'ok' });
    expect(saveTasks([], () => storage)).toBe(true);
    expect(loadTasks(() => storage).tasks).toEqual([]);
  });

  it.each([
    '{broken', 'null', '{}', '[null]',
    JSON.stringify([{ ...task, completed: 'false' }]),
    JSON.stringify([{ ...task, title: '   ' }]),
    JSON.stringify([{ ...task, id: '' }]),
    JSON.stringify([task, task]),
  ])('rejects invalid data without overwriting it: %s', (raw) => {
    const storage = memoryStorage(raw);
    expect(loadTasks(() => storage)).toEqual({ tasks: [], status: 'corrupt' });
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it('handles storage access blocked by the browser', () => {
    const blocked = () => { throw new Error('Access denied'); };
    expect(loadTasks(blocked)).toEqual({ tasks: [], status: 'unavailable' });
    expect(saveTasks([task], blocked)).toBe(false);
  });

  it('reports failed writes and leaves the previous saved list intact', () => {
    const storage = memoryStorage(JSON.stringify([task]));
    storage.setItem = () => { throw new Error('Quota exceeded'); };
    expect(saveTasks([], () => storage)).toBe(false);
    expect(loadTasks(() => storage).tasks).toEqual([task]);
  });
});
