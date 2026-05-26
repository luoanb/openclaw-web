import { BrowserPodFileService } from "browserpod";
import type { FileService } from "os-core";
import { RuntimeManagerProvider } from "$lib/core/runtime";

export class FileServiceProvider {
  private static service: FileService | null = null;

  static getFileService(): FileService {
    FileServiceProvider.service ??= new BrowserPodFileService(
      RuntimeManagerProvider.getBrowserPodRuntimeManager(),
    );

    return FileServiceProvider.service;
  }
}
