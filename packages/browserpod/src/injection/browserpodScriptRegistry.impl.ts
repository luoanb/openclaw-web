import type { BrowserPodInjectionScript } from "./browserpodInjection.interfaces";
import ulsScriptContent from "./scripts/uls.js?raw";

export class BrowserPodScriptRegistry {
  static getDefaultScripts(): readonly BrowserPodInjectionScript[] {
    return [
      {
        id: "utf8-ls",
        command: "uls",
        runner: "node",
        version: "1.0.0",
        description: "UTF-8 friendly directory listing helper.",
        asset: {
          sourcePath: "packages/browserpod/src/injection/scripts/uls.js",
          filename: "uls.js",
        },
        load: () => ulsScriptContent,
      },
    ];
  }
}
