#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const os = require("os");

const ANSI = {
  reset: "\x1b[0m",
  dir: "\x1b[1;94m",
  link: "\x1b[36m",
  exe: "\x1b[32m",
};

function parseArgs(argv) {
  const opt = {
    one: false,
    all: false,
    almostAll: false,
    byLines: false,
    dirOnly: false,
    followAll: false,
    followCmd: false,
    recursive: false,
    slashDirs: false,
    classify: false,
    long: false,
    inode: false,
    numeric: false,
    blocks: false,
    ctime: false,
    atime: false,
    fullTime: false,
    human: false,
    groupDirsFirst: false,
    sort: "name",
    reverse: false,
    width: process.stdout.columns || 80,
    color: "auto",
  };
  const paths = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") {
      paths.push(...argv.slice(i + 1));
      break;
    } else if (a === "--full-time") opt.fullTime = true;
    else if (a === "--group-directories-first") opt.groupDirsFirst = true;
    else if (a.startsWith("--color"))
      opt.color = a.includes("=") ? a.split("=")[1] : "always";
    else if (a === "-w") opt.width = Number(argv[++i]) || opt.width;
    else if (a.startsWith("-w") && a.length > 2)
      opt.width = Number(a.slice(2)) || opt.width;
    else if (a.startsWith("-") && a !== "-") {
      for (let j = 1; j < a.length; j++) {
        const ch = a[j];
        if (ch === "1") opt.one = true;
        else if (ch === "a") opt.all = true;
        else if (ch === "A") opt.almostAll = true;
        else if (ch === "x") opt.byLines = true;
        else if (ch === "d") opt.dirOnly = true;
        else if (ch === "L") opt.followAll = true;
        else if (ch === "H") opt.followCmd = true;
        else if (ch === "R") opt.recursive = true;
        else if (ch === "p") opt.slashDirs = true;
        else if (ch === "F") opt.classify = true;
        else if (ch === "l") opt.long = true;
        else if (ch === "i") opt.inode = true;
        else if (ch === "n") opt.numeric = true;
        else if (ch === "s") opt.blocks = true;
        else if (ch === "h") opt.human = true;
        else if (ch === "S") opt.sort = "size";
        else if (ch === "X") opt.sort = "ext";
        else if (ch === "v") opt.sort = "version";
        else if (ch === "t") opt.sort = "mtime";
        else if (ch === "r") opt.reverse = true;
        else if (ch === "c") {
          opt.ctime = true;
          opt.sort = "ctime";
        } else if (ch === "u") {
          opt.atime = true;
          opt.sort = "atime";
        }
      }
    } else {
      paths.push(a);
    }
  }

  return { opt, paths: paths.length ? paths : ["."] };
}

function loadNames(file, key) {
  try {
    const out = {};
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      if (!line || line.startsWith("#")) continue;
      const p = line.split(":");
      out[p[key]] = p[0];
    }
    return out;
  } catch {
    return {};
  }
}

const userNames = loadNames("/etc/passwd", 2);
const groupNames = loadNames("/etc/group", 2);

function statOf(p, follow) {
  return follow ? fs.statSync(p) : fs.lstatSync(p);
}

function modeString(st) {
  const t = st.isDirectory()
    ? "d"
    : st.isSymbolicLink()
      ? "l"
      : st.isCharacterDevice()
        ? "c"
        : st.isBlockDevice()
          ? "b"
          : st.isFIFO()
            ? "p"
            : st.isSocket()
              ? "s"
              : "-";
  const bits = [
    [0o400, "r"],
    [0o200, "w"],
    [0o100, "x"],
    [0o040, "r"],
    [0o020, "w"],
    [0o010, "x"],
    [0o004, "r"],
    [0o002, "w"],
    [0o001, "x"],
  ];
  return t + bits.map(([b, c]) => (st.mode & b ? c : "-")).join("");
}

function human(n) {
  const units = ["B", "K", "M", "G", "T"];
  let i = 0,
    v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return i === 0 ? String(v) : `${v.toFixed(v < 10 ? 1 : 0)}${units[i]}`;
}

function timeOf(st, opt) {
  const d = opt.ctime ? st.ctime : opt.atime ? st.atime : st.mtime;
  return opt.fullTime
    ? d.toISOString().replace("T", " ").replace("Z", "")
    : d.toLocaleString();
}

function displayName(e, opt) {
  let n = e.name;
  if (opt.classify) {
    if (e.stat.isDirectory()) n += "/";
    else if (e.stat.isSymbolicLink()) n += "@";
    else if (e.stat.mode & 0o111) n += "*";
  } else if (opt.slashDirs && e.stat.isDirectory()) {
    n += "/";
  }

  const useColor =
    opt.color === "always" || (opt.color === "auto" && process.stdout.isTTY);
  if (!useColor) return n;
  if (e.stat.isDirectory()) return ANSI.dir + n + ANSI.reset;
  if (e.stat.isSymbolicLink()) return ANSI.link + n + ANSI.reset;
  if (e.stat.mode & 0o111) return ANSI.exe + n + ANSI.reset;
  return n;
}

function makeEntry(parent, name, opt, cmdPathFollow) {
  const full = parent ? path.join(parent, name) : name;
  const follow = opt.followAll || cmdPathFollow;
  const st = statOf(full, follow);
  return { name, full, stat: st };
}

function listTarget(target, opt, header) {
  const cmdFollow = opt.followCmd;
  const st = statOf(target, opt.followAll || cmdFollow);

  if (opt.dirOnly || !st.isDirectory()) {
    const e = { name: target, full: target, stat: st };
    printEntries([e], opt);
    return;
  }

  if (header) console.log(`${target}:`);

  let names = fs.readdirSync(target);
  if (!opt.all)
    names = names.filter((n) =>
      opt.almostAll ? n !== "." && n !== ".." : !n.startsWith(".")
    );

  const entries = [];
  for (const n of names) {
    try {
      entries.push(makeEntry(target, n, opt, false));
    } catch (err) {
      console.error(`uls: cannot access '${n}': ${err.message}`);
    }
  }

  sortEntries(entries, opt);
  printEntries(entries, opt);

  if (opt.recursive) {
    for (const e of entries) {
      if (e.stat.isDirectory() && e.name !== "." && e.name !== "..") {
        console.log("");
        listTarget(e.full, opt, true);
      }
    }
  }
}

function sortEntries(entries, opt) {
  const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
  });
  entries.sort((a, b) => {
    if (opt.groupDirsFirst && a.stat.isDirectory() !== b.stat.isDirectory()) {
      return a.stat.isDirectory() ? -1 : 1;
    }
    if (opt.sort === "size") return b.stat.size - a.stat.size;
    if (opt.sort === "ext")
      return (
        collator.compare(path.extname(a.name), path.extname(b.name)) ||
        collator.compare(a.name, b.name)
      );
    if (opt.sort === "version") return collator.compare(a.name, b.name);
    if (opt.sort === "ctime") return b.stat.ctimeMs - a.stat.ctimeMs;
    if (opt.sort === "atime") return b.stat.atimeMs - a.stat.atimeMs;
    if (opt.sort === "mtime") return b.stat.mtimeMs - a.stat.mtimeMs;
    return collator.compare(a.name, b.name);
  });
  if (opt.reverse) entries.reverse();
}

function printEntries(entries, opt) {
  if (opt.long) {
    for (const e of entries) {
      const st = e.stat;
      const user = opt.numeric ? st.uid : userNames[st.uid] || st.uid;
      const group = opt.numeric ? st.gid : groupNames[st.gid] || st.gid;
      const size = opt.human ? human(st.size) : String(st.size);
      const blocks = opt.blocks ? `${st.blocks || 0} ` : "";
      const inode = opt.inode ? `${st.ino} ` : "";
      console.log(
        `${inode}${blocks}${modeString(st)} ${st.nlink} ${user} ${group} ${size} ${timeOf(st, opt)} ${displayName(e, opt)}`
      );
    }
    return;
  }

  const lines = entries.map((e) => {
    const inode = opt.inode ? `${e.stat.ino} ` : "";
    const blocks = opt.blocks ? `${e.stat.blocks || 0} ` : "";
    return inode + blocks + displayName(e, opt);
  });

  if (opt.one || opt.byLines || !process.stdout.isTTY) {
    for (const l of lines) console.log(l);
    return;
  }

  for (const l of lines) console.log(l);
}

const { opt, paths } = parseArgs(process.argv.slice(2));
const multi = paths.length > 1;
for (let i = 0; i < paths.length; i++) {
  if (i > 0) console.log("");
  try {
    listTarget(paths[i], opt, multi);
  } catch (err) {
    console.error(`uls: cannot access '${paths[i]}': ${err.message}`);
    process.exitCode = 1;
  }
}
