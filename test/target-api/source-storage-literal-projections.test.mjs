import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { namedVariable } from "../fixtures/source-navigation.mjs";

function fixture(body) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    files: { "/src/index.ts": `export {}; ${body}` } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics, "/src"));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const storage = createSourceStorageQuery(source, [file]);
  const variable = name => namedVariable(source.ast, file, name);
  const initializer = name => Node_Initializer(source.ast, variable(name));
  const subject = name => {
    const selected = storage.subjectFor(variable(name));
    assert.equal(selected.kind === "resolved", true, name);
    return selected.subject;
  };
  return { source, storage, variable, initializer, subject };
}

test("an empty array allocation has container identity but no manufactured projected element", () => {
  const current = fixture(`const values: {}[] = []; const read = values[0];`);
  const identity = current.storage.closedOriginsFor(current.subject("values"));
  assert.equal(identity.kind === "complete" && identity.origins.length === 1 &&
    identity.origins[0].subject.node === current.initializer("values"), true);
  const contents = current.storage.originsFor(current.subject("read"));
  assert.equal(contents.kind === "resolved" && contents.origins.length === 0, true,
    "an initial element cannot be invented from the empty container's identity");
  assert.equal(current.storage.closedOriginsFor(current.subject("read")).kind === "unresolved", true,
    "an empty element domain cannot certify an actual closed value");
  assert.equal(current.storage.failureReason() === undefined, true);
});

test("nested empty literal projections do not become element values while nonempty siblings survive", () => {
  const current = fixture(`const token = {}; const values: {}[][] = [[], [token]]; const read = values[0][0];`);
  const selected = current.storage.closedOriginsFor(current.subject("read"));
  assert.equal(selected.kind === "complete" && selected.origins.length === 1 &&
    selected.origins[0].subject.node === current.initializer("token"), true,
    "only real nested element producers survive the exact array projection");
  assert.equal(current.storage.failureReason() === undefined, true);
});

test("later indexed writes retain actual contents without reviving an empty initial producer", () => {
  const current = fixture(`const token = {}; const values: {}[] = []; values[0] = token; const read = values[0];`);
  const selected = current.storage.closedOriginsFor(current.subject("read"));
  assert.equal(selected.kind === "complete" && selected.origins.length === 1 &&
    selected.origins[0].subject.node === current.initializer("token"), true);
  assert.equal(current.storage.failureReason() === undefined, true);
});

test("class member transport consumes real projected contents rather than an empty array seed", () => {
  const current = fixture(`
    class Base {}
    class Entry extends Base { constructor(readonly token: {}) { super(); } }
    const token = {};
    const values: Base[] = [];
    values[0] = new Entry(token);
    function select(value: Base): {} { if (value instanceof Entry) return value.token; return {}; }
    const read = select(values[0]);
  `);
  const selected = current.storage.closedOriginsFor(current.subject("read"));
  assert.equal(selected.kind === "complete", true);
  assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("token")), true);
  assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("values")), false);
  assert.equal(current.storage.failureReason() === undefined, true);
});

test("external element writers remain open even when the allocation was initially empty", () => {
  const current = fixture(`const token = {}; export const values: {}[] = []; values[0] = token; const read = values[0];`);
  const selected = current.storage.closedOriginsFor(current.subject("read"));
  assert.equal(selected.kind === "open", true,
    `discarding an empty seed is not proof against external writes (${selected.kind}; ${selected.reason ?? ""})`);
  assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("token")), true);
  assert.equal(selected.boundaries.some(boundary => boundary.kind === "external-write"), true);
  assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("values")), false);
});

test("physical element writes preserve possible initial contents as well as replacement producers", () => {
  const current = fixture(`const initial = {}; const replacement = {}; const values: {}[] = [initial];
    values[0] = replacement; const read = values[0];`);
  const selected = current.storage.closedOriginsFor(current.subject("read"));
  assert.equal(selected.kind === "complete", true);
  for (const name of ["initial", "replacement"]) {
    assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer(name)), true, name);
  }
  assert.equal(selected.origins.length, 2);
  assert.equal(current.storage.failureReason() === undefined, true);
});

test("publication through an alias retains an empty backing slot's external writer evidence", () => {
  const current = fixture(`const token = {}; const values: {}[] = []; export const exposed = values;
    values[0] = token; const read = values[0];`);
  const selected = current.storage.closedOriginsFor(current.subject("read"));
  assert.equal(selected.kind === "open", true);
  assert.equal(selected.boundaries.some(boundary => boundary.kind === "external-write"), true);
  assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("token")), true);
  assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("values")), false);
});

test("opaque element writers are not closed by a later local write to an empty array", () => {
  const current = fixture(`declare function mutate(values: {}[]): void;
    const token = {}; const values: {}[] = []; mutate(values); values[0] = token; const read = values[0];`);
  const selected = current.storage.closedOriginsFor(current.subject("read"));
  assert.equal(selected.kind === "open", true);
  assert.equal(selected.boundaries.some(boundary => boundary.kind === "opaque-write"), true);
  assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("token")), true);
  assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("values")), false);
});

test("a rootless recursive value remains unresolved rather than becoming proven empty contents", () => {
  const current = fixture(`function recurse<Value>(value: Value): Value { return recurse(value); }
    const read = recurse({});`);
  assert.equal(current.storage.closedOriginsFor(current.subject("read")).kind === "unresolved", true);
  assert.equal(current.storage.failureReason() === undefined, true);
});
