#!/usr/bin/env node
/**
 * S3 Phase 0 — D1：面向「浏览器 / WebContainer / --no-addons」场景的依赖风险审计。
 *
 * 用法:
 *   pnpm exec browser-deps-audit [projectRoot]
 *   browser-deps-audit /path/to/openclaw --lockfile-only
 *   pnpm run research:browser-deps-audit -- --lockfile-only
 *
 * 选项:
 *   --lockfile-only  仅扫描 pnpm-lock.yaml / package-lock.json 的 packages 清单与根 package.json（不 require 依赖树；偏保守）
 *   --allow-lockfile pkg1,pkg2  lockfile-only 下放行名单中的包（可重复传参）
 *   --include-dev    解析模式（默认仅 production：dependencies + optionalDependencies）
 *   --strict         将 warn 视为失败（退出码 1）
 *   --strict-heuristic  与 --strict 联用：将 HEURISTIC_* 也计入失败（默认仅 error + strict 下的 warn）
 *   --json           机器可读输出
 *
 * 项目根可选 openclaw-browser-audit.config.json：{ "allowLockfilePackages": ["sharp"] }（仅 lockfile-only）
 *
 * 阻断名单：native-risk-packages.json 的 blockedEntries（须 wc-runtime | wc-doc + evidenceRef）。
 * 旧版 blockedPackages 无证据，命中时仅 LEGACY_BLOCKLIST_NO_EVIDENCE（warn）。
 */

import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_BASENAME = "native-risk-packages.json";

/** @typedef {{ id?: string, package: string, evidenceLevel: string, evidenceRef: string, failureMode?: string, verifiedAt?: string, verifiedRuntimeNote?: string }} BlockedEntry */

/**
 * @param {string} configPath
 * @returns {{ schemaVersion: number, scriptPatterns: Array<{id: string, level?: string, re: RegExp}>, blockedByName: Map<string, BlockedEntry>, legacyNames: Set<string>, migrationHint: string | null }}
 */
export function loadAuditConfig(configPath) {
  const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const scriptDangerPatterns = raw.scriptDangerPatterns || [];
  const scriptPatterns = scriptDangerPatterns.map((p) => ({
    ...p,
    re: new RegExp(p.regex, "i"),
  }));

  const entries = raw.blockedEntries;
  const legacyFlat = raw.blockedPackages;

  if (Array.isArray(entries) && entries.length > 0) {
    const blockedByName = new Map();
    for (const e of entries) {
      validateBlockedEntry(e, configPath);
      const name = e.package;
      if (blockedByName.has(name)) {
        throw new Error(`${CONFIG_BASENAME}: duplicate blockedEntries.package "${name}"`);
      }
      blockedByName.set(name, {
        id: e.id || name,
        package: name,
        evidenceLevel: e.evidenceLevel,
        evidenceRef: e.evidenceRef,
        failureMode: e.failureMode,
        verifiedAt: e.verifiedAt,
        verifiedRuntimeNote: e.verifiedRuntimeNote,
      });
    }
    return {
      schemaVersion: raw.schemaVersion || 2,
      scriptPatterns,
      blockedByName,
      legacyNames: new Set(),
      migrationHint: null,
    };
  }

  if (Array.isArray(legacyFlat) && legacyFlat.length > 0) {
    return {
      schemaVersion: 1,
      scriptPatterns,
      blockedByName: new Map(),
      legacyNames: new Set(legacyFlat),
      migrationHint:
        "native-risk-packages.json：请迁移到 schemaVersion 2 的 blockedEntries（wc-runtime / wc-doc + evidenceRef）；当前 blockedPackages 命中仅 warn。",
    };
  }

  return {
    schemaVersion: raw.schemaVersion || 2,
    scriptPatterns,
    blockedByName: new Map(),
    legacyNames: new Set(),
    migrationHint: null,
  };
}

/**
 * @param {unknown} e
 * @param {string} configPath
 */
function validateBlockedEntry(e, configPath) {
  if (!e || typeof e !== "object") throw new Error(`${configPath}: blockedEntries item must be object`);
  const pkg = /** @type {{ package?: string }} */ (e).package;
  if (!pkg || typeof pkg !== "string") {
    throw new Error(`${configPath}: blockedEntries[].package required`);
  }
  const level = /** @type {{ evidenceLevel?: string }} */ (e).evidenceLevel;
  if (level !== "wc-runtime" && level !== "wc-doc") {
    throw new Error(
      `${configPath}: blockedEntries[].evidenceLevel must be "wc-runtime" or "wc-doc" for package "${pkg}"`,
    );
  }
  const ref = /** @type {{ evidenceRef?: string }} */ (e).evidenceRef;
  if (!ref || typeof ref !== "string" || !ref.trim()) {
    throw new Error(`${configPath}: blockedEntries[].evidenceRef required for package "${pkg}"`);
  }
  const fm = /** @type {{ failureMode?: string }} */ (e).failureMode;
  if (!fm || typeof fm !== "string") {
    throw new Error(`${configPath}: blockedEntries[].failureMode required for package "${pkg}"`);
  }
}

const CONFIG_PATH = path.join(__dirname, CONFIG_BASENAME);

function parseArgs(argv) {
  const args = {
    root: null,
    lockfileOnly: false,
    includeDev: false,
    strict: false,
    strictHeuristic: false,
    json: false,
    allowLockfilePackages: new Set(),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--lockfile-only") args.lockfileOnly = true;
    else if (a === "--include-dev") args.includeDev = true;
    else if (a === "--strict") args.strict = true;
    else if (a === "--strict-heuristic") args.strictHeuristic = true;
    else if (a === "--json") args.json = true;
    else if (a === "--allow-lockfile") {
      const next = argv[i + 1];
      if (next && !next.startsWith("-")) {
        next.split(",").forEach((p) => p.trim() && args.allowLockfilePackages.add(p.trim()));
        i++;
      }
    } else if (a.startsWith("--allow-lockfile=")) {
      a.slice("--allow-lockfile=".length)
        .split(",")
        .forEach((p) => p.trim() && args.allowLockfilePackages.add(p.trim()));
    } else if (!a.startsWith("-")) args.root = path.resolve(a);
  }
  if (!args.root) args.root = process.cwd();
  return args;
}

/** 项目根可选配置：openclaw-browser-audit.config.json */
function loadProjectAuditConfig(root) {
  const cfgPath = path.join(root, "openclaw-browser-audit.config.json");
  if (!fs.existsSync(cfgPath)) return { allowLockfilePackages: [] };
  try {
    const j = readJson(cfgPath);
    const list = j.allowLockfilePackages;
    return { allowLockfilePackages: Array.isArray(list) ? list : [] };
  } catch {
    return { allowLockfilePackages: [] };
  }
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function listFilesRecursive(dir, maxDepth, depth = 0, acc = [], cap = 80) {
  if (acc.length >= cap || depth > maxDepth) return acc;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    if (acc.length >= cap) break;
    if (e.name === ".git" || e.name === "node_modules") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) listFilesRecursive(full, maxDepth, depth + 1, acc, cap);
    else if (e.name.endsWith(".node")) acc.push(full);
  }
  return acc;
}

/**
 * @param {ReturnType<typeof loadAuditConfig>} auditCfg
 */
function auditScripts(pkgJson, pkgName, via, auditCfg) {
  const findings = [];
  const scripts = pkgJson.scripts || {};
  for (const key of ["preinstall", "install", "postinstall"]) {
    const text = scripts[key];
    if (!text || typeof text !== "string") continue;
    for (const p of auditCfg.scriptPatterns) {
      if (p.re.test(text)) {
        findings.push({
          level: p.level || "warn",
          code: `SCRIPT:${p.id}`,
          package: pkgName,
          via,
          detail: `${key}: ${text.slice(0, 120)}${text.length > 120 ? "…" : ""}`,
          evidenceLevel: "heuristic",
          evidenceRef: `script regex id=${p.id}`,
        });
      }
    }
  }
  return findings;
}

/**
 * @param {ReturnType<typeof loadAuditConfig>} auditCfg
 * @param {string} pkgName
 */
function blocklistFindingForPackage(auditCfg, pkgName, via, detailExtra) {
  const entry = auditCfg.blockedByName.get(pkgName);
  if (entry) {
    return {
      level: "error",
      code: "BLOCKLIST_PACKAGE",
      package: pkgName,
      via,
      detail: detailExtra ? `${detailExtra} | ${entry.evidenceRef}` : entry.evidenceRef,
      evidenceLevel: entry.evidenceLevel,
      evidenceRef: entry.evidenceRef,
      blockedEntryId: entry.id || pkgName,
    };
  }
  if (auditCfg.legacyNames.has(pkgName)) {
    return {
      level: "warn",
      code: "LEGACY_BLOCKLIST_NO_EVIDENCE",
      package: pkgName,
      via,
      detail:
        "命中旧版 blockedPackages（无 wc-runtime/wc-doc 证据）；请迁移到 blockedEntries。默认不视为 WC 阻断依据。",
      evidenceLevel: "legacy-heuristic",
      evidenceRef: CONFIG_BASENAME,
    };
  }
  return null;
}

/**
 * @param {ReturnType<typeof loadAuditConfig>} auditCfg
 */
function auditPackageDir(dir, pkgName, via, auditCfg) {
  const findings = [];
  const bl = blocklistFindingForPackage(auditCfg, pkgName, via, "依赖树解析命中");
  if (bl) findings.push(bl);

  const gyp = path.join(dir, "binding.gyp");
  if (fs.existsSync(gyp)) {
    findings.push({
      level: "warn",
      code: "HEURISTIC_BINDING_GYP",
      package: pkgName,
      via,
      detail: "存在 binding.gyp（通常表示需编译 native）；非 WC 阻断唯一依据",
      evidenceLevel: "heuristic",
      evidenceRef: "binding.gyp present",
    });
  }
  const nodeFiles = listFilesRecursive(dir, 3, 0, [], 40);
  for (const f of nodeFiles) {
    findings.push({
      level: "warn",
      code: "HEURISTIC_DOT_NODE",
      package: pkgName,
      via,
      detail: path.relative(dir, f) || f,
      evidenceLevel: "heuristic",
      evidenceRef: ".node file under package",
    });
  }
  return findings;
}

function collectRootDepNames(pkg, includeDev) {
  const names = [];
  const push = (obj, label) => {
    for (const k of Object.keys(obj || {})) names.push({ name: k, via: `root.${label}` });
  };
  push(pkg.dependencies, "dependencies");
  push(pkg.optionalDependencies, "optionalDependencies");
  if (includeDev) {
    push(pkg.devDependencies, "devDependencies");
    push(pkg.peerDependencies, "peerDependencies");
  }
  return names;
}

/**
 * @param {ReturnType<typeof loadAuditConfig>} auditCfg
 */
function auditResolveMode(root, includeDev, auditCfg) {
  const pkgPath = path.join(root, "package.json");
  if (!fs.existsSync(pkgPath)) {
    return [
      {
        level: "error",
        code: "NO_PACKAGE_JSON",
        package: "-",
        via: root,
        detail: "缺少 package.json",
      },
    ];
  }
  const pkg = readJson(pkgPath);
  const require = createRequire(pkgPath);
  const findings = [];
  findings.push(...auditScripts(pkg, pkg.name || "(root)", "root", auditCfg));

  const queue = collectRootDepNames(pkg, includeDev);
  const seen = new Set();

  while (queue.length) {
    const { name, via } = queue.shift();
    if (seen.has(name)) continue;
    seen.add(name);

    let dir;
    try {
      dir = path.dirname(require.resolve(`${name}/package.json`, { paths: [root] }));
    } catch {
      findings.push({
        level: "warn",
        code: "UNRESOLVED",
        package: name,
        via,
        detail: "未安装或无法解析（可忽略于 lockfile-only CI 之前）",
        evidenceLevel: "heuristic",
        evidenceRef: "unresolved module",
      });
      continue;
    }

    let sub;
    try {
      sub = readJson(path.join(dir, "package.json"));
    } catch {
      continue;
    }
    const pkgName = sub.name || name;

    findings.push(...auditPackageDir(dir, pkgName, via, auditCfg));
    findings.push(...auditScripts(sub, pkgName, via, auditCfg));

    const nextSections = includeDev
      ? ["dependencies", "optionalDependencies", "peerDependencies", "devDependencies"]
      : ["dependencies", "optionalDependencies", "peerDependencies"];

    for (const sec of nextSections) {
      for (const dep of Object.keys(sub[sec] || {})) {
        if (!seen.has(dep)) queue.push({ name: dep, via: `${pkgName}.${sec}` });
      }
    }
  }

  return findings;
}

/**
 * 从 pnpm-lock.yaml 的 packages: 段提取「包名@」键中的包名（不含版本）。
 */
function parsePnpmPackageNames(lockPath) {
  const text = fs.readFileSync(lockPath, "utf8");
  const idx = text.indexOf("\npackages:");
  if (idx === -1) return [];
  const chunk = text.slice(idx);
  const names = new Set();
  const lineRe = /^\s{2}['"]?((?:@[^/]+\/)?[^@'"\s]+)@[0-9]/gm;
  let m;
  while ((m = lineRe.exec(chunk)) !== null) {
    names.add(m[1]);
  }
  return [...names];
}

function parseNpmLockPackageNames(lockPath) {
  const lock = readJson(lockPath);
  const names = new Set();
  const pkgs = lock.packages || {};
  for (const key of Object.keys(pkgs)) {
    if (!key.startsWith("node_modules/")) continue;
    const rel = key.replace(/^node_modules\//, "");
    const name = rel.includes("node_modules") ? rel.split("node_modules/").pop() : rel;
    if (name) names.add(name);
  }
  return [...names];
}

/**
 * @param {ReturnType<typeof loadAuditConfig>} auditCfg
 */
function auditLockfileOnly(root, allowLockfilePackages, auditCfg) {
  const allow = new Set(allowLockfilePackages);
  const findings = [];
  const pkgPath = path.join(root, "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = readJson(pkgPath);
    findings.push(...auditScripts(pkg, pkg.name || "(root)", "root", auditCfg));
    for (const sec of ["dependencies", "optionalDependencies", "devDependencies"]) {
      const isDev = sec === "devDependencies";
      for (const name of Object.keys(pkg[sec] || {})) {
        const entry = auditCfg.blockedByName.get(name);
        if (entry) {
          findings.push({
            level: isDev ? "warn" : "error",
            code: isDev ? "BLOCKLIST_ROOT_DECL_DEV" : "BLOCKLIST_ROOT_DECL",
            package: name,
            via: `root.${sec}`,
            detail: `根 package.json 声明 | ${entry.evidenceRef}`,
            evidenceLevel: entry.evidenceLevel,
            evidenceRef: entry.evidenceRef,
            blockedEntryId: entry.id || name,
          });
        } else if (auditCfg.legacyNames.has(name)) {
          findings.push({
            level: "warn",
            code: "LEGACY_BLOCKLIST_NO_EVIDENCE",
            package: name,
            via: `root.${sec}`,
            detail: "根声明命中旧版 blockedPackages（无证据）",
            evidenceLevel: "legacy-heuristic",
            evidenceRef: CONFIG_BASENAME,
          });
        }
      }
    }
  }

  const pnpmLock = path.join(root, "pnpm-lock.yaml");
  const npmLock = path.join(root, "package-lock.json");
  let names = [];
  if (fs.existsSync(pnpmLock)) names = parsePnpmPackageNames(pnpmLock);
  else if (fs.existsSync(npmLock)) names = parseNpmLockPackageNames(npmLock);
  else {
    findings.push({
      level: "warn",
      code: "NO_LOCKFILE",
      package: "-",
      via: root,
      detail: "未找到 pnpm-lock.yaml 或 package-lock.json，lockfile-only 仅校验根 package.json",
      evidenceLevel: "heuristic",
      evidenceRef: "no lockfile",
    });
  }

  for (const name of names) {
    const entry = auditCfg.blockedByName.get(name);
    const legacyHit = auditCfg.legacyNames.has(name);
    if (!entry && !legacyHit) continue;

    if (allow.has(name)) {
      findings.push({
        level: "warn",
        code: "BLOCKLIST_LOCKFILE_ALLOWED",
        package: name,
        via: "lockfile packages",
        detail:
          "命中名单但被 openclaw-browser-audit.config.json 或 --allow-lockfile 放行（仅 lockfile-only）",
        evidenceLevel: "policy",
        evidenceRef: "allowLockfilePackages",
      });
      continue;
    }

    if (entry) {
      findings.push({
        level: "error",
        code: "BLOCKLIST_LOCKFILE",
        package: name,
        via: "lockfile packages",
        detail: `锁文件中出现阻断包 | ${entry.evidenceRef}`,
        evidenceLevel: entry.evidenceLevel,
        evidenceRef: entry.evidenceRef,
        blockedEntryId: entry.id || name,
      });
    } else {
      findings.push({
        level: "warn",
        code: "LEGACY_LOCKFILE_NO_EVIDENCE",
        package: name,
        via: "lockfile packages",
        detail: "锁内命中旧版 blockedPackages（无证据）；不视为 error",
        evidenceLevel: "legacy-heuristic",
        evidenceRef: CONFIG_BASENAME,
      });
    }
  }

  return findings;
}

function summarizeFixed(findings, strict, strictHeuristic) {
  const errors = findings.filter((f) => f.level === "error");
  const warns = findings.filter((f) => f.level === "warn");
  const heuristicCodes = new Set(["HEURISTIC_BINDING_GYP", "HEURISTIC_DOT_NODE"]);
  if (strict && strictHeuristic) {
    return { errors, warns, fail: errors.length > 0 || warns.length > 0 };
  }
  if (strict) {
    const fail = errors.length > 0 || warns.some((w) => !heuristicCodes.has(w.code));
    return { errors, warns, fail };
  }
  return { errors, warns, fail: errors.length > 0 };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  let auditCfg;
  try {
    auditCfg = loadAuditConfig(CONFIG_PATH);
  } catch (e) {
    console.error(String(e?.message || e));
    process.exit(2);
  }

  if (auditCfg.migrationHint && !args.json) {
    console.warn(`openclaw-browser-audit: ${auditCfg.migrationHint}`);
  }

  const projectCfg = loadProjectAuditConfig(args.root);
  for (const p of projectCfg.allowLockfilePackages) args.allowLockfilePackages.add(p);

  const findings = args.lockfileOnly
    ? auditLockfileOnly(args.root, [...args.allowLockfilePackages], auditCfg)
    : auditResolveMode(args.root, args.includeDev, auditCfg);

  const { errors, warns, fail } = summarizeFixed(findings, args.strict, args.strictHeuristic);

  if (args.json) {
    const payload = {
      schemaVersion: "2",
      blocklistSource: CONFIG_BASENAME,
      root: args.root,
      findings,
      errors: errors.length,
      warns: warns.length,
      fail,
    };
    if (auditCfg.migrationHint) payload.migrationHint = auditCfg.migrationHint;
    console.log(JSON.stringify(payload, null, 2));
  } else {
    if (auditCfg.migrationHint) console.warn(`openclaw-browser-audit: ${auditCfg.migrationHint}`);
    console.log(`openclaw-browser-audit: root=${args.root} mode=${args.lockfileOnly ? "lockfile-only" : "resolve"}`);
    for (const f of findings) {
      console.log(`[${f.level.toUpperCase()}] ${f.code} ${f.package} (${f.via})`);
      if (f.detail) console.log(`       ${f.detail}`);
    }
    console.log(`--- errors=${errors.length} warns=${warns.length} fail=${fail}`);
  }

  process.exit(fail ? 1 : 0);
}

function isCliInvocation() {
  try {
    const argv1 = process.argv[1];
    if (!argv1) return false;
    const resolvedArg = fs.realpathSync(path.resolve(argv1));
    const resolvedSelf = fs.realpathSync(fileURLToPath(import.meta.url));
    return resolvedArg === resolvedSelf;
  } catch {
    return false;
  }
}

if (isCliInvocation()) {
  main();
}
