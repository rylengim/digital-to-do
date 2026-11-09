export interface Task {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskList {
  id: string;
  title: string;
  tasks: Task[];
}

export interface AppState {
  version: 2;
  activeListId: string;
  lists: TaskList[];
}

export const STORAGE_KEY = 'digital-todo.state.v2';
export const LEGACY_STORAGE_KEY = 'digital-todo.tasks.v1';
type TaskStorage = Pick<Storage, 'getItem' | 'setItem'>;
type LoadResult = { state: AppState; status: 'ok' | 'corrupt' | 'unavailable' };
const browserStorage = (): TaskStorage => window.localStorage;

export function createInitialState(tasks: Task[] = []): AppState {
  return { version: 2, activeListId: 'inbox', lists: [{ id: 'inbox', title: 'Мои задачи', tasks }] };
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isTask(value: unknown): value is Task {
  if (typeof value !== 'object' || value === null) return false;
  const task = value as Record<string, unknown>;
  return isNonemptyString(task.id) && isNonemptyString(task.title)
    && typeof task.completed === 'boolean';
}

function isTaskArray(value: unknown): value is Task[] {
  return Array.isArray(value) && value.every(isTask)
    && new Set(value.map(task => task.id)).size === value.length;
}

function isTaskList(value: unknown): value is TaskList {
  if (typeof value !== 'object' || value === null) return false;
  const list = value as Record<string, unknown>;
  return isNonemptyString(list.id) && isNonemptyString(list.title) && isTaskArray(list.tasks);
}

function isAppState(value: unknown): value is AppState {
  if (typeof value !== 'object' || value === null) return false;
  const state = value as Record<string, unknown>;
  if (state.version !== 2 || !Array.isArray(state.lists) || state.lists.length === 0
    || !state.lists.every(isTaskList)) return false;
  return state.lists.some(list => list.id === state.activeListId)
    && new Set(state.lists.map(list => list.id)).size === state.lists.length
    && isTaskArray(state.lists.flatMap(list => list.tasks));
}

function copyTasks(tasks: Task[]): Task[] {
  return tasks.map(({ id, title, completed }) => ({ id, title, completed }));
}

export function loadState(getStorage = browserStorage): LoadResult {
  let raw: string | null;
  let legacy = false;
  try {
    const storage = getStorage();
    raw = storage.getItem(STORAGE_KEY);
    if (raw === null) {
      raw = storage.getItem(LEGACY_STORAGE_KEY);
      legacy = true;
    }
  } catch {
    return { state: createInitialState(), status: 'unavailable' };
  }
  if (raw === null) return { state: createInitialState(), status: 'ok' };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (legacy && isTaskArray(parsed)) {
      // Load into memory only. The first explicit change writes v2; v1 stays untouched.
      return { state: createInitialState(copyTasks(parsed)), status: 'ok' };
    }
    if (!legacy && isAppState(parsed)) {
      return {
        state: {
          version: 2,
          activeListId: parsed.activeListId,
          lists: parsed.lists.map(({ id, title, tasks }) => ({ id, title, tasks: copyTasks(tasks) })),
        },
        status: 'ok',
      };
    }
  } catch {
    // A malformed current format must not silently fall back to an older snapshot.
  }
  return { state: createInitialState(), status: 'corrupt' };
}

export function saveState(state: AppState, getStorage = browserStorage): boolean {
  try {
    getStorage().setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
