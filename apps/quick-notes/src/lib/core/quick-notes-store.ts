import type { QuickNote, QuickNotesStore, QuickTask } from "./quick-notes-types";

export class QuickNotesStoreService {
  static createEmptyStore(): QuickNotesStore {
    return {
      tasks: [],
      notes: [],
    };
  }

  static normalizeStore(store: Partial<QuickNotesStore> | null | undefined): QuickNotesStore {
    return {
      tasks: Array.isArray(store?.tasks)
        ? store.tasks.map((task) => QuickNotesStoreService.normalizeTask(task))
        : [],
      notes: Array.isArray(store?.notes)
        ? store.notes.map((note) => QuickNotesStoreService.normalizeNote(note))
        : [],
    };
  }

  static withTasks(store: QuickNotesStore, tasks: QuickTask[]): QuickNotesStore {
    return {
      ...store,
      tasks,
    };
  }

  static withNotes(store: QuickNotesStore, notes: QuickNote[]): QuickNotesStore {
    return {
      ...store,
      notes,
    };
  }

  static prepareForSave(store: QuickNotesStore): QuickNotesStore {
    return {
      tasks: store.tasks.map((task) => QuickNotesStoreService.normalizeTask(task)),
      notes: store.notes.map((note) => QuickNotesStoreService.normalizeNote(note)),
    };
  }

  private static normalizeTask(task: QuickTask): QuickTask {
    return {
      ...task,
      completedAt: task.completedAt ?? null,
      pinnedAt: task.pinnedAt ?? null,
    };
  }

  private static normalizeNote(note: QuickNote): QuickNote {
    return {
      ...note,
      pinnedAt: note.pinnedAt ?? null,
    };
  }
}
