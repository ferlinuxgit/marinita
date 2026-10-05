/** A checklist row. Top-level rows (`parentId === null`) are tasks; their children are subtasks. */
export type ChecklistItem = {
  id: string;
  parentId: string | null;
  position: number;
  name: string;
  done: boolean;
  notes: string;
};

export type ChecklistTask = ChecklistItem & {
  subtasks: ChecklistItem[];
};

const byPosition = (a: ChecklistItem, b: ChecklistItem) => a.position - b.position;

export function buildChecklist(items: ChecklistItem[]): ChecklistTask[] {
  const children = new Map<string, ChecklistItem[]>();

  for (const item of items) {
    if (item.parentId) {
      children.set(item.parentId, [...(children.get(item.parentId) ?? []), item]);
    }
  }

  return items
    .filter((item) => item.parentId === null)
    .sort(byPosition)
    .map((task) => ({ ...task, subtasks: (children.get(task.id) ?? []).sort(byPosition) }));
}

/**
 * Counts what can be ticked: simple tasks and individual subtasks. A task with subtasks is only a
 * grouping and is not counted itself.
 */
export function countProgress(tasks: ChecklistTask[]) {
  let done = 0;
  let total = 0;

  for (const task of tasks) {
    const checkable = task.subtasks.length > 0 ? task.subtasks : [task];
    total += checkable.length;
    done += checkable.filter((item) => item.done).length;
  }

  return { done, total };
}

/** Copies names, order and grouping with new ids, every box unticked and empty notes. */
export function cloneStructure(items: ChecklistItem[], newId: () => string): ChecklistItem[] {
  const tasks = buildChecklist(items);
  const copy: ChecklistItem[] = [];

  tasks.forEach((task, taskIndex) => {
    const taskId = newId();
    copy.push({ id: taskId, parentId: null, position: taskIndex, name: task.name, done: false, notes: "" });
    task.subtasks.forEach((subtask, subtaskIndex) => {
      copy.push({ id: newId(), parentId: taskId, position: subtaskIndex, name: subtask.name, done: false, notes: "" });
    });
  });

  return copy;
}
