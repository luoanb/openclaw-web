import { invoke } from "@tauri-apps/api/core";

import { QuickNotesStoreService } from "./quick-notes-store";
import type { QuickNotesStore } from "./quick-notes-types";

export class QuickNotesRepository {
  static async loadStore(): Promise<QuickNotesStore> {
    try {
      const store = await invoke<QuickNotesStore>("load_store");
      return QuickNotesStoreService.normalizeStore(store);
    } catch (error) {
      throw new Error(this.toMessage(error, "读取本地数据失败"));
    }
  }

  static async saveStore(store: QuickNotesStore): Promise<QuickNotesStore> {
    try {
      const savedStore = await invoke<QuickNotesStore>("save_store", {
        store: QuickNotesStoreService.prepareForSave(store),
      });

      return QuickNotesStoreService.normalizeStore(savedStore);
    } catch (error) {
      throw new Error(this.toMessage(error, "保存本地数据失败"));
    }
  }

  private static toMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === "string") {
      return error;
    }

    return fallback;
  }
}
