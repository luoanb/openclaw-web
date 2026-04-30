import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");
const db = new Database(":memory:");
db.exec("SELECT 1");
console.log("unexpected: better-sqlite3 loaded");
