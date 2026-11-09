export interface Task {
  id: string;
  title: string;
  completed: boolean;
}

export const STORAGE_KEY = 'digital-todo.tasks.v1';
type TaskStorage = Pick<Storage, 'getItem' | 'setItem'>;
type LoadResult = { tasks: Task[]; status: 'ok' | 'corrupt' | 'unavailable' };
const browserStorage = (): TaskStorage => window.localStorage;

function isTask(value: unknown): value is Task {
  if (typeof value !== 'object' || value === null) return false;
  const task = value as Record<string, unknown>;
  return typeof task.id === 'string' && task.id.trim().length > 0
    && typeof task.title === 'string' && task.title.trim().length > 0
    && typeof task.completed === 'boolean';
}

export function loadTasks(getStorage = browserStorage): LoadResult {
  let raw: string | null;
  try {
    raw = getStorage().getItem(STORAGE_KEY);
  } catch {
    return { tasks: [], status: 'unavailable' };
  }
  if (raw === null) return { tasks: [], status: 'ok' };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isTask)
      || new Set(parsed.map(task => task.id)).size !== parsed.length) {
      return { tasks: [], status: 'corrupt' };
    }
    return {
      tasks: parsed.map(({ id, title, completed }) => ({ id, title, completed })),
      status: 'ok',
    };
  } catch {
    return { tasks: [], status: 'corrupt' };
  }
}

export function saveTasks(tasks: Task[], getStorage = browserStorage): boolean {
  try {
    getStorage().setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch {
    return false;
  }
}
