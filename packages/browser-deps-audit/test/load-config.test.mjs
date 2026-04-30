import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAuditConfig } from "../audit.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const goodConfig = path.join(__dirname, "../native-risk-packages.json");

test("loadAuditConfig loads blockedEntries", () => {
  const cfg = loadAuditConfig(goodConfig);
  assert.equal(cfg.blockedByName.has("better-sqlite3"), true);
  assert.equal(cfg.blockedByName.get("better-sqlite3").evidenceLevel, "wc-runtime");
  assert.equal(cfg.legacyNames.size, 0);
});

test("loadAuditConfig rejects invalid evidenceLevel", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bda-test-"));
  const bad = path.join(dir, "native-risk-packages.json");
  fs.writeFileSync(
    bad,
    JSON.stringify({
      schemaVersion: 2,
      scriptDangerPatterns: [],
      blockedEntries: [
        {
          package: "x",
          evidenceLevel: "nope",
          evidenceRef: "r",
          failureMode: "native_addon",
        },
      ],
    }),
  );
  assert.throws(() => loadAuditConfig(bad), /evidenceLevel/);
});

test("loadAuditConfig legacy blockedPackages yields legacyNames only", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bda-test-"));
  const legacy = path.join(dir, "native-risk-packages.json");
  fs.writeFileSync(
    legacy,
    JSON.stringify({
      scriptDangerPatterns: [],
      blockedPackages: ["foo-native"],
    }),
  );
  const cfg = loadAuditConfig(legacy);
  assert.equal(cfg.legacyNames.has("foo-native"), true);
  assert.equal(cfg.blockedByName.size, 0);
  assert.ok(cfg.migrationHint);
});
