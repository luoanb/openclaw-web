import { QuickNotesStoreService } from "../quick-notes-store";
import type { QuickNote, QuickNotesStore, QuickTask } from "../quick-notes-types";

export type ImportMode = "overwrite" | "append";
export type ConflictResolution = "keepCurrent" | "preferImported";

export class QuickNotesDataSyncService {
  static serializeStore(store: QuickNotesStore): string {
    return JSON.stringify(QuickNotesStoreService.prepareForSave(store), null, 2);
  }

  static parseImportFile(text: string): QuickNotesStore {
    let parsed: unknown;

    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("INVALID_JSON");
    }

    if (!parsed || typeof parsed !== "object") {
      throw new Error("INVALID_FORMAT");
    }

    const record = parsed as Partial<QuickNotesStore>;

    if (!Array.isArray(record.notes)) {
      throw new Error("MISSING_NOTES");
    }

    return QuickNotesStoreService.normalizeStore({
      notes: record.notes,
      tasks: Array.isArray(record.tasks) ? record.tasks : [],
    });
  }

  static mergeStore(
    current: QuickNotesStore,
    imported: QuickNotesStore,
    mode: ImportMode,
    conflictResolution: ConflictResolution
  ): QuickNotesStore {
    if (mode === "overwrite") {
      return QuickNotesStoreService.normalizeStore(imported);
    }

    return {
      tasks: QuickNotesDataSyncService.mergeItems(
        current.tasks,
        imported.tasks,
        conflictResolution
      ),
      notes: QuickNotesDataSyncService.mergeItems(
        current.notes,
        imported.notes,
        conflictResolution
      ),
    };
  }

  static downloadJson(store: QuickNotesStore, filename?: string): void {
    const name =
      filename ??
      `quick-notes-export-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([QuickNotesDataSyncService.serializeStore(store)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  static countImportedItems(imported: QuickNotesStore): number {
    return imported.notes.length + imported.tasks.length;
  }

  private static mergeItems<T extends QuickNote | QuickTask>(
    current: T[],
    imported: T[],
    conflictResolution: ConflictResolution
  ): T[] {
    const byId = new Map(current.map((item) => [item.id, item]));

    for (const item of imported) {
      if (!byId.has(item.id) || conflictResolution === "preferImported") {
        byId.set(item.id, item);
      }
    }

    return [...byId.values()];
  }
}
