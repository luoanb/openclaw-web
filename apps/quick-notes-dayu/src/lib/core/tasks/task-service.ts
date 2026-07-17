import type { QuickTask } from "../quick-notes-types";

export class TaskService {
  static createTask(tasks: QuickTask[], content: string, now: string): QuickTask[] {
    const normalizedContent = TaskService.normalizeContent(content);

    if (!normalizedContent) {
      return tasks;
    }

    return [
      {
        id: TaskService.createId(),
        content: normalizedContent,
        status: "active",
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        pinnedAt: null,
      },
      ...tasks,
    ];
  }

  static updateTaskContent(
    tasks: QuickTask[],
    taskId: string,
    content: string,
    now: string
  ): QuickTask[] {
    const normalizedContent = TaskService.normalizeContent(content);

    if (!normalizedContent) {
      return tasks;
    }

    return tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            content: normalizedContent,
            updatedAt: now,
          }
        : task
    );
  }

  static completeTask(tasks: QuickTask[], taskId: string, now: string): QuickTask[] {
    return tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            status: "done",
            updatedAt: now,
            completedAt: now,
            pinnedAt: null,
          }
        : task
    );
  }

  static restoreTask(tasks: QuickTask[], taskId: string, now: string): QuickTask[] {
    return tasks.map((task) =>
      task.id === taskId && (task.status === "done" || task.status === "deprecated")
        ? {
            ...task,
            status: "active",
            updatedAt: now,
            completedAt: null,
          }
        : task
    );
  }

  static deprecateTask(tasks: QuickTask[], taskId: string, now: string): QuickTask[] {
    return tasks.map((task) =>
      task.id === taskId && task.status === "active"
        ? {
            ...task,
            status: "deprecated",
            updatedAt: now,
            completedAt: null,
            pinnedAt: null,
          }
        : task
    );
  }

  static deleteTask(tasks: QuickTask[], taskId: string): QuickTask[] {
    return tasks.filter((task) => task.id !== taskId);
  }

  static pinTask(tasks: QuickTask[], taskId: string, now: string): QuickTask[] {
    return tasks.map((task) =>
      task.id === taskId && task.status === "active"
        ? {
            ...task,
            pinnedAt: now,
          }
        : task
    );
  }

  static unpinTask(tasks: QuickTask[], taskId: string): QuickTask[] {
    return tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            pinnedAt: null,
          }
        : task
    );
  }

  static getActiveTasks(tasks: QuickTask[], query: string): QuickTask[] {
    return TaskService.sortByUpdatedAtDesc(
      TaskService.filterTasks(tasks, query).filter((task) => task.status === "active")
    );
  }

  static getPinnedActiveTasks(tasks: QuickTask[], query: string): QuickTask[] {
    return TaskService.sortByPinnedAtDesc(
      TaskService.filterTasks(tasks, query).filter(
        (task) => task.status === "active" && Boolean(task.pinnedAt)
      )
    );
  }

  static getDoneTasks(tasks: QuickTask[], query: string): QuickTask[] {
    return [...TaskService.filterTasks(tasks, query).filter((task) => task.status === "done")].sort(
      (left, right) => TaskService.compareDesc(left.completedAt ?? "", right.completedAt ?? "")
    );
  }

  static getDeprecatedTasks(tasks: QuickTask[], query: string): QuickTask[] {
    return TaskService.sortByUpdatedAtDesc(
      TaskService.filterTasks(tasks, query).filter((task) => task.status === "deprecated")
    );
  }

  private static filterTasks(tasks: QuickTask[], query: string): QuickTask[] {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return tasks;
    }

    return tasks.filter((task) => task.content.toLowerCase().includes(normalizedQuery));
  }

  private static sortByUpdatedAtDesc(tasks: QuickTask[]): QuickTask[] {
    return [...tasks].sort((left, right) => TaskService.compareDesc(left.updatedAt, right.updatedAt));
  }

  private static sortByPinnedAtDesc(tasks: QuickTask[]): QuickTask[] {
    return [...tasks].sort((left, right) =>
      TaskService.compareDesc(left.pinnedAt ?? "", right.pinnedAt ?? "")
    );
  }

  private static compareDesc(left: string, right: string): number {
    return right.localeCompare(left);
  }

  private static normalizeContent(content: string): string {
    return content.trim();
  }

  private static createId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
