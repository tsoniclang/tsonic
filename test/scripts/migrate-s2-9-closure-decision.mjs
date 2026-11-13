// One-time migration of case files for amendment S2-9 (the closure decision on a typed closure).
//
// A typed closure payload written before the field existed is recognised by its complete earlier field set
// { type, convertedType, conversion, narrowing, evidenceIndex, demand, callable, captures } and receives one appended field:
//
//   closure: { kind: "decided", decision: { carrier: <its type>, captures: one "captured-location" per captured local,
//                                           execution: { kind: "pure" } } }
//
// These are fixture values for payloads that never stated the decision: the carrier is the value's own type, every
// capture is a captured location, and creation is a pure computation. They are not a rule of the compiler.
//
// A file is rewritten only when it is compact JSON followed by one newline. Payloads that already have the field are left
// alone, so a second run rewrites nothing.
//
// Usage: node test/scripts/migrate-s2-9-closure-decision.mjs [--check] <directory>...
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const earlier = ["type", "convertedType", "conversion", "narrowing", "evidenceIndex", "demand", "callable", "captures"];
const check = process.argv.includes("--check");
const roots = process.argv.slice(2).filter(argument => argument !== "--check");
if (roots.length === 0) throw new Error("usage: migrate-s2-9-closure-decision.mjs [--check] <directory>...");
let files = 0;
let records = 0;
const pendingDirectories = [...roots];
for (let directory = pendingDirectories.pop(); directory !== undefined; directory = pendingDirectories.pop()) {
  for (const name of readdirSync(directory).sort()) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) { pendingDirectories.push(path); continue; }
    if (!name.endsWith(".json")) continue;
    const raw = readFileSync(path, "utf8");
    const document = JSON.parse(raw);
    let changed = 0;
    const pending = [document];
    for (let value = pending.pop(); value !== undefined; value = pending.pop()) {
      if (value === null || typeof value !== "object") continue;
      if (!Array.isArray(value) && Object.keys(value).length === earlier.length && earlier.every(field => Object.hasOwn(value, field))) {
        value.closure = { kind: "decided", decision: { carrier: value.type, captures: value.captures.map(() => "captured-location"), execution: { kind: "pure" } } };
        changed += 1;
      }
      for (const child of Object.values(value)) pending.push(child);
    }
    if (changed === 0) continue;
    if (`${JSON.stringify(JSON.parse(raw))}\n` !== raw) throw new Error(`${path}: holds ${changed} payloads to migrate but is not compact JSON with one final newline`);
    files += 1; records += changed;
    if (!check) writeFileSync(path, `${JSON.stringify(document)}\n`);
  }
}
console.log(`${check ? "would rewrite" : "rewrote"} ${files} files; typed closure payloads: ${records}`);
