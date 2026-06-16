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
      tasks: Array.isArray(store?.tasks) ? store.tasks : [],
      notes: Array.isArray(store?.notes) ? store.notes : [],
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
      tasks: [...store.tasks],
      notes: [...store.notes],
    };
  }
}
