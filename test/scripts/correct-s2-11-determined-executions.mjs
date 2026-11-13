// Correction to the S2-11 case-file migration: execution values that the operation record itself determines.
//
// The migration wrote `execution: { kind: "pure" }` on every selected operation. For two operation identities the record
// already says that is wrong:
//
//   pointer-write   an operation that writes through a pointer is an invocation that writes existing storage
//                   -> { kind: "invocation", writesStorage: true, failure: "none" }
//   library         a library operation without exact native evidence is an ordinary invocation with no purity promise
//                   (COMPONENTS section 3, R-10) -> { kind: "invocation", writesStorage: true, failure: "unwind" }
//
// What the record determines is the execution class and, for the pointer write, that storage is written. The failure kind
// of the pointer write and the two attributes of the library invocation are not determined by the record: they are the
// values that promise nothing, and stay fixture debt until Rules fills them from native facts.
//
// Only a record whose execution is exactly the migrated default is changed; a second run changes nothing.
//
// Usage: node test/scripts/correct-s2-11-determined-executions.mjs [--check] <directory>...
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const corrected = new Map([
  ["pointer-write", { kind: "invocation", writesStorage: true, failure: "none" }],
  ["library", { kind: "invocation", writesStorage: true, failure: "unwind" }],
]);
const check = process.argv.includes("--check");
const roots = process.argv.slice(2).filter(argument => argument !== "--check");
if (roots.length === 0) throw new Error("usage: correct-s2-11-determined-executions.mjs [--check] <directory>...");
const totals = new Map([...corrected.keys()].map(kind => [kind, 0]));
let files = 0;
const pendingDirectories = [...roots];
for (let directory = pendingDirectories.pop(); directory !== undefined; directory = pendingDirectories.pop()) {
  for (const name of readdirSync(directory).sort()) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) { pendingDirectories.push(path); continue; }
    if (!name.endsWith(".json")) continue;
    const raw = readFileSync(path, "utf8");
    if (!raw.includes('"execution"')) continue;
    const document = JSON.parse(raw);
    let changed = 0;
    const pending = [document];
    for (let value = pending.pop(); value !== undefined; value = pending.pop()) {
      if (value === null || typeof value !== "object") continue;
      if (!Array.isArray(value) && value.kind === "selected" && value.operation !== null && typeof value.operation === "object" &&
        corrected.has(value.operation.kind) && value.execution !== null && typeof value.execution === "object" &&
        value.execution.kind === "pure" && Object.keys(value.execution).length === 1) {
        value.execution = { ...corrected.get(value.operation.kind) };
        totals.set(value.operation.kind, totals.get(value.operation.kind) + 1);
        changed += 1;
      }
      for (const child of Object.values(value)) pending.push(child);
    }
    if (changed === 0) continue;
    if (`${JSON.stringify(JSON.parse(raw))}\n` !== raw) throw new Error(`${path}: holds ${changed} records to correct but is not compact JSON with one final newline`);
    files += 1;
    if (!check) writeFileSync(path, `${JSON.stringify(document)}\n`);
  }
}
console.log(`${check ? "would rewrite" : "rewrote"} ${files} files; operations: ${[...totals].map(([kind, count]) => `${kind} ${count}`).join(", ")}`);
