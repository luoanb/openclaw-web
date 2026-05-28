import { describe, expect, it } from "vitest";
import ulsScriptContent from "./scripts/uls.js?raw";
import { BrowserPodScriptRegistry } from "./browserpodScriptRegistry.impl";

describe("BrowserPodScriptRegistry", () => {
  it("loads the raw injected script asset content", async () => {
    const [script] = BrowserPodScriptRegistry.getDefaultScripts();
    const content = await script!.load();

    expect(content).toBe(ulsScriptContent);
    expect(content).not.toContain("sourceMappingURL=data:application/json;base64");
  });
});
