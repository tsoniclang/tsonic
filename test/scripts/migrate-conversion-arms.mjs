// One-time migration of case files to the single statement of a conversion's embedding.
//
// Earlier typed form:  conversion: { kind: "convert", role, embedding, operation }   with any operation identity.
// Now:
//   convert { role, operation }                  the operation is the identity `conversion`, which carries the embedding
//   backed-convert { role, embedding, operation } the operation is a core or library identity; the embedding stands beside it
//
// What the migration does with an earlier arm, by the identity of its operation:
//
//   conversion        the outer embedding is removed. It must equal the identity's own embedding; a file where the two
//                     differ is an error, not a choice.
//   library, core     the arm becomes backed-convert with the same three fields.
//   any other         the arm was only a vehicle that carried an arbitrary operation through the codec on a numeric
//                     literal. A conversion cannot be carried out by such an operation, so the vehicle changes: the
//                     literal X becomes the operand of a prefix unary expression that takes X's node identity and typed
//                     value and holds the operation in its own operation field, with an identity conversion. X gets the
//                     next node identity, and every later node of the same tree moves up by one, as an authored
//                     `+X` would number them. A document that refers to a moved node by number is an error.
//
// A file is rewritten only when it is compact JSON followed by one newline. A second run rewrites nothing.
//
// Usage: node test/scripts/migrate-conversion-arms.mjs [--check] <directory>...
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
const earlierArm = value => isRecord(value) && value.kind === "convert" && Object.keys(value).length === 4 &&
  Object.hasOwn(value, "role") && Object.hasOwn(value, "embedding") && Object.hasOwn(value, "operation");
const isNode = value => isRecord(value) && Object.hasOwn(value, "id") && Object.hasOwn(value, "parent") && Object.hasOwn(value, "kind") &&
  Object.hasOwn(value, "origin") && Object.hasOwn(value, "loc");
const totals = { conversion: 0, backed: 0, vehicle: 0 };

function shiftLater(tree, after) {
  const pending = [tree];
  for (let value = pending.pop(); value !== undefined; value = pending.pop()) {
    if (value === null || typeof value !== "object") continue;
    if (isNode(value)) {
      if (value.id > after) value.id += 1;
      if (typeof value.parent === "number" && value.parent > after) value.parent += 1;
    } else if (isRecord(value) && typeof value.node === "number" && value.node > after) {
      throw new Error(`a reference to moved node ${value.node}`);
    }
    for (const child of Object.values(value)) pending.push(child);
  }
}

function migrateTree(tree, path) {
  // Arms that only change shape.
  const pending = [tree];
  const vehicles = [];
  for (let value = pending.pop(); value !== undefined; value = pending.pop()) {
    if (value === null || typeof value !== "object") continue;
    if (isNode(value) && isRecord(value.tsonic) && earlierArm(value.tsonic.conversion)) {
      const arm = value.tsonic.conversion;
      const identity = arm.operation.decision.operation;
      if (identity.kind === "conversion") {
        if (JSON.stringify(identity.embedding) !== JSON.stringify(arm.embedding)) throw new Error(`${path}: outer and nested embedding differ at node ${value.id}`);
        value.tsonic.conversion = { kind: "convert", role: arm.role, operation: arm.operation };
        totals.conversion += 1;
      } else if (identity.kind === "library" || identity.kind === "core") {
        value.tsonic.conversion = { kind: "backed-convert", role: arm.role, embedding: arm.embedding, operation: arm.operation };
        totals.backed += 1;
      } else {
        if (value.kind !== "NumericLiteral") throw new Error(`${path}: a vehicle arm on ${value.kind} at node ${value.id}`);
        if (arm.embedding.kind !== "identity") throw new Error(`${path}: a vehicle arm with a ${arm.embedding.kind} embedding at node ${value.id}`);
        vehicles.push(value);
      }
    }
    for (const child of Object.values(value)) pending.push(child);
  }
  // Vehicles, from the last in the tree to the first, so that an earlier shift does not move a later vehicle twice.
  for (const literal of vehicles.sort((left, right) => right.id - left.id)) {
    const arm = literal.tsonic.conversion;
    shiftLater(tree, literal.id);
    const operand = { id: literal.id + 1, origin: literal.origin, parent: literal.id, flags: literal.flags, loc: literal.loc,
      kind: "NumericLiteral", text: literal.text, tokenFlags: literal.tokenFlags,
      tsonic: { type: literal.tsonic.type, convertedType: literal.tsonic.type, conversion: { kind: "identity" }, narrowing: null,
        evidenceIndex: null, demand: { kind: "always" }, role: literal.tsonic.role, value: literal.tsonic.value } };
    const typed = { type: literal.tsonic.type, convertedType: literal.tsonic.convertedType, conversion: { kind: "identity" },
      narrowing: literal.tsonic.narrowing, evidenceIndex: literal.tsonic.evidenceIndex, demand: literal.tsonic.demand,
      role: "value", operation: { kind: "decided", decision: arm.operation } };
    const header = { id: literal.id, origin: literal.origin, parent: literal.parent, flags: literal.flags, loc: literal.loc };
    for (const key of Object.keys(literal)) delete literal[key];
    Object.assign(literal, header, { kind: "PrefixUnaryExpression", operator: "PlusToken", operand, tsonic: typed });
    totals.vehicle += 1;
  }
}

const check = process.argv.includes("--check");
const roots = process.argv.slice(2).filter(argument => argument !== "--check");
if (roots.length === 0) throw new Error("usage: migrate-conversion-arms.mjs [--check] <directory>...");
let files = 0;
const pendingDirectories = [...roots];
for (let directory = pendingDirectories.pop(); directory !== undefined; directory = pendingDirectories.pop()) {
  for (const name of readdirSync(directory).sort()) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) { pendingDirectories.push(path); continue; }
    if (!name.endsWith(".json")) continue;
    const raw = readFileSync(path, "utf8");
    if (!raw.includes('"convert"')) continue;
    const document = JSON.parse(raw);
    const before = totals.conversion + totals.backed + totals.vehicle;
    // Each syntax tree of the document is migrated on its own: node identities are local to a tree.
    const pending = [document];
    for (let value = pending.pop(); value !== undefined; value = pending.pop()) {
      if (value === null || typeof value !== "object") continue;
      if (isNode(value) && value.parent === null) { migrateTree(value, path); continue; }
      for (const child of Object.values(value)) pending.push(child);
    }
    if (totals.conversion + totals.backed + totals.vehicle === before) continue;
    if (`${JSON.stringify(JSON.parse(raw))}\n` !== raw) throw new Error(`${path}: holds arms to migrate but is not compact JSON with one final newline`);
    files += 1;
    if (!check) writeFileSync(path, `${JSON.stringify(document)}\n`);
  }
}
console.log(`${check ? "would rewrite" : "rewrote"} ${files} files; arms: conversion ${totals.conversion}, backed ${totals.backed}, vehicle ${totals.vehicle}`);
