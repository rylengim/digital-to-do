import { describe, expect, it } from 'vitest';
import { createInitialState, loadState, saveState, STORAGE_KEY, LEGACY_STORAGE_KEY } from '../src/storage';

const task = { id: 'one', title: 'Первая задача', completed: false };
const state = {
  version: 2 as const,
  activeListId: 'work',
  lists: [
    { id: 'home', title: 'Личное', tasks: [task] },
    { id: 'work', title: 'Работа', tasks: [{ ...task, id: 'two', completed: true }] },
  ],
};

function memoryStorage(values: Record<string, string> = {}) {
  const data = new Map(Object.entries(values));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, next: string) => { data.set(key, next); },
  };
}

describe('list storage and migration', () => {
  it('starts with one empty list without writing on load', () => {
    const storage = memoryStorage();
    expect(loadState(() => storage)).toEqual({ state: createInitialState(), status: 'ok' });
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('round-trips all lists, selected list and independent equal task titles', () => {
    const storage = memoryStorage();
    expect(saveState(state, () => storage)).toBe(true);
    expect(loadState(() => storage)).toEqual({ state, status: 'ok' });
  });

  it.each([{ tasks: [] }, { tasks: [task, { ...task, id: 'two', completed: true }] }])('imports legacy tasks without changing the original data', ({ tasks }) => {
    const raw = JSON.stringify(tasks);
    const storage = memoryStorage({ [LEGACY_STORAGE_KEY]: raw });
    const loaded = loadState(() => storage);
    expect(loaded.status).toBe('ok');
    expect(loaded.state.lists).toEqual([{ id: 'inbox', title: 'Мои задачи', tasks }]);
    expect(loaded.state.activeListId).toBe('inbox');
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(storage.getItem(LEGACY_STORAGE_KEY)).toBe(raw);
    expect(saveState(loaded.state, () => storage)).toBe(true);
    expect(storage.getItem(LEGACY_STORAGE_KEY)).toBe(raw);
    expect(loadState(() => storage).state).toEqual(loaded.state);
  });

  it('uses v2 even when older data still exists', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(state), [LEGACY_STORAGE_KEY]: '[{}]' });
    expect(loadState(() => storage)).toEqual({ state, status: 'ok' });
  });

  it.each([
    '{broken', 'null', '{}', '[]',
    JSON.stringify({ ...state, version: 3 }),
    JSON.stringify({ ...state, lists: [] }),
    JSON.stringify({ ...state, activeListId: 'missing' }),
    JSON.stringify({ ...state, lists: [state.lists[1], state.lists[1]] }),
    JSON.stringify({ ...state, lists: [{ id: 'work', title: '  ', tasks: [] }] }),
    JSON.stringify({ ...state, lists: [{ id: 'work', title: 'A', tasks: [{ ...task, completed: 'false' }] }] }),
    JSON.stringify({ ...state, lists: [{ id: 'home', title: 'A', tasks: [task] }, { id: 'work', title: 'B', tasks: [task] }] }),
  ])('rejects invalid v2 without fallback or writes: %s', (raw) => {
    const storage = memoryStorage({ [STORAGE_KEY]: raw, [LEGACY_STORAGE_KEY]: JSON.stringify([task]) });
    expect(loadState(() => storage)).toEqual({ state: createInitialState(), status: 'corrupt' });
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    expect(storage.getItem(LEGACY_STORAGE_KEY)).toBe(JSON.stringify([task]));
  });

  it.each(['{broken', 'null', '{}', '[null]', JSON.stringify([{ ...task, title: '   ' }]), JSON.stringify([{ ...task, id: '' }]), JSON.stringify([task, task])])('rejects malformed legacy data: %s', (raw) => {
    const storage = memoryStorage({ [LEGACY_STORAGE_KEY]: raw });
    expect(loadState(() => storage).status).toBe('corrupt');
    expect(storage.getItem(LEGACY_STORAGE_KEY)).toBe(raw);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('handles storage access being blocked', () => {
    const blocked = () => { throw new Error('Access denied'); };
    expect(loadState(blocked)).toEqual({ state: createInitialState(), status: 'unavailable' });
    expect(saveState(state, blocked)).toBe(false);
  });

  it('does not fall back to legacy when reading v2 throws', () => {
    const storage = memoryStorage({ [LEGACY_STORAGE_KEY]: JSON.stringify([task]) });
    const getItem = storage.getItem;
    storage.getItem = key => { if (key === STORAGE_KEY) throw new Error('Denied'); return getItem(key); };
    expect(loadState(() => storage).status).toBe('unavailable');
  });

  it('keeps both saved formats intact when writing fails', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(state), [LEGACY_STORAGE_KEY]: JSON.stringify([task]) });
    storage.setItem = () => { throw new Error('Quota exceeded'); };
    expect(saveState(createInitialState(), () => storage)).toBe(false);
    expect(loadState(() => storage).state).toEqual(state);
    expect(storage.getItem(LEGACY_STORAGE_KEY)).toBe(JSON.stringify([task]));
  });

  it('keeps legacy data usable if the first v2 write fails', () => {
    const storage = memoryStorage({ [LEGACY_STORAGE_KEY]: JSON.stringify([task]) });
    const loaded = loadState(() => storage);
    storage.setItem = () => { throw new Error('Quota exceeded'); };
    expect(saveState(loaded.state, () => storage)).toBe(false);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(loadState(() => storage).state.lists[0]?.tasks).toEqual([task]);
  });
});
