import { BrowserPodTerminalService } from "browserpod";
import type { TerminalService } from "os-core";
import { RuntimeManagerProvider } from "$lib/core/runtime";

export class TerminalServiceProvider {
  private static service: TerminalService | null = null;

  static getTerminalService(): TerminalService {
    TerminalServiceProvider.service ??= new BrowserPodTerminalService(
      RuntimeManagerProvider.getBrowserPodRuntimeManager(),
    );

    return TerminalServiceProvider.service;
  }
}
