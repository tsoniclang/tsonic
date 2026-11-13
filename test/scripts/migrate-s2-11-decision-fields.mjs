// One-time migration of case files for amendment S2-11 (check and failure fields on decision records).
//
// Rewrites JSON case files that hold decision records written before the fields existed. A record is recognised by its
// complete earlier field set and receives exactly one appended field:
//
//   { kind: "conversion", conversion, proof }                       -> check: { kind: "none" }
//   { kind: "narrowed", source, result, proof }                     -> failure: "unwind"
//   { kind: "selected", operation, operands, result }               -> execution: { kind: "pure" }
//   { candidate, advertised, api, bindings, implementationBindings,
//     parameters, completion, result }                              -> activation: null
//   { key, origins, selectedDeclarations, primary, read, write,
//     getter, setter, bindings }                                    -> location: { kind: "accessor" } when getter or setter is
//                                                                      not null, otherwise
//                                                                      { kind: "data", check: { kind: "none" }, receiver: "in-place" }
//
// These are the values of fixtures that never stated the new facts: no check, a pure computation, no handle activation,
// a narrowing that fails by unwinding, a data member read in place. They are fixture values, not a rule of the compiler.
//
// A file is rewritten only when it is compact JSON followed by one newline, so that the rewrite changes nothing else.
// A file that holds a record to migrate in another layout is an error. Records that already have the field are left alone.
//
// Usage: node test/scripts/migrate-s2-11-decision-fields.mjs [--check] <directory>...
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const sameKeys = (value, names) => Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
const forms = [
  ["conversion", value => value.kind === "conversion" && sameKeys(value, ["kind", "conversion", "proof"]),
    value => { value.check = { kind: "none" }; }],
  ["narrowed", value => value.kind === "narrowed" && sameKeys(value, ["kind", "source", "result", "proof"]),
    value => { value.failure = "unwind"; }],
  ["selected", value => value.kind === "selected" && sameKeys(value, ["kind", "operation", "operands", "result"]),
    value => { value.execution = { kind: "pure" }; }],
  ["application", value => sameKeys(value, ["candidate", "advertised", "api", "bindings", "implementationBindings", "parameters", "completion", "result"]),
    value => { value.activation = null; }],
  ["member", value => sameKeys(value, ["key", "origins", "selectedDeclarations", "primary", "read", "write", "getter", "setter", "bindings"]),
    value => {
      value.location = value.getter !== null || value.setter !== null ? { kind: "accessor" }
        : { kind: "data", check: { kind: "none" }, receiver: "in-place" };
    }],
];

const check = process.argv.includes("--check");
const roots = process.argv.slice(2).filter(argument => argument !== "--check");
if (roots.length === 0) throw new Error("usage: migrate-s2-11-decision-fields.mjs [--check] <directory>...");
const totals = new Map(forms.map(([name]) => [name, 0]));
let files = 0;
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
      if (!Array.isArray(value)) for (const [form, matches, migrate] of forms) {
        if (!matches(value)) continue;
        migrate(value); changed += 1; totals.set(form, totals.get(form) + 1);
        break;
      }
      for (const child of Object.values(value)) pending.push(child);
    }
    if (changed === 0) continue;
    if (`${JSON.stringify(JSON.parse(raw))}\n` !== raw) throw new Error(`${path}: holds ${changed} records to migrate but is not compact JSON with one final newline`);
    files += 1;
    if (!check) writeFileSync(path, `${JSON.stringify(document)}\n`);
  }
}
console.log(`${check ? "would rewrite" : "rewrote"} ${files} files; records: ${[...totals].map(([name, count]) => `${name} ${count}`).join(", ")}`);
