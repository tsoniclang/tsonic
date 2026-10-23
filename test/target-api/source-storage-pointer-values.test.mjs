import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, createSourceSemanticsExtension, formatDiagnostics } from "@tsonic/tsts";
import { createTsonicCoreSourceExtension, tsonicCoreSourceSemanticsModules } from "../../packages/source-core/dist/public/index.js";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { namedVariable } from "../fixtures/source-navigation.mjs";

function fixture(body) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
      import { addressof, allocateptr, bindptr, loadptr, projectptr, storeptr } from "@tsonic/core/lang.js";
      import type { Pointer } from "@tsonic/core/types.js";
      ${body}
    ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
    extensionHostOptions: { extensions: [createSourceSemanticsExtension({ modules: tsonicCoreSourceSemanticsModules() }),
      createTsonicCoreSourceExtension()] },
  }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  assert.equal(checked.extensionDiagnostics.length === 0, true, "native pointer operations have checked source evidence");
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const storage = createSourceStorageQuery(source, [file]);
  const initializer = name => Node_Initializer(source.ast, namedVariable(source.ast, file, name));
  const query = name => {
    const selected = storage.subjectFor(initializer(name));
    assert.equal(selected.kind === "resolved", true, `${name}: exact checked load subject`);
    return storage.closedOriginsFor(selected.subject);
  };
  const expect = (name, originals) => {
    const selected = query(name);
    assert.equal(selected.kind === "complete", true, `${name}: ${selected.reason ?? selected.kind}`);
    assert.equal(selected.origins.length === originals.length && originals.every(original =>
      selected.origins.some(value => value.subject.node === initializer(original))), true,
    `${name}: exact pointee producers ${originals.join(", ")}`);
    assert.equal(storage.failureReason() === undefined, true, "pointee evidence keeps the existing finite limits");
  };
  return { query, expect };
}

test("allocated pointees retain original callable values through source function returns", () => {
  const current = fixture(`
    const original = () => 1; const separate = () => 2;
    function create<Value>(value: Value): Pointer<Value> { return allocateptr(value); }
    const result = loadptr(create(original));
    const untouched = loadptr(create(separate));
  `);
  current.expect("result", ["original"]);
  current.expect("untouched", ["separate"]);
});

test("native pointer writes remain correlated to the selected allocation", () => {
  const current = fixture(`
    const original = () => 1; const replacement = () => 2; const separate = () => 3;
    const first = allocateptr<() => number>(original);
    const second = allocateptr<() => number>(separate);
    const alias = first;
    storeptr(alias, replacement);
    const result = loadptr(first);
    const untouched = loadptr(second);
  `);
  current.expect("result", ["original", "replacement"]);
  current.expect("untouched", ["separate"]);
});

test("a pointer supplied by an external caller never fabricates a callable producer", () => {
  const current = fixture(`
    export function inspect(pointer: Pointer<() => number>): void { const result = loadptr(pointer); }
  `);
  const selected = current.query("result");
  assert.equal(selected.kind !== "complete", true, "an unbound external pointee stays unproven");
});

test("addresses of the same backing cell share writes without an allocation-call identity", () => {
  const current = fixture(`
    const original = () => 1; const replacement = () => 2; const separate = () => 3;
    let cell: () => number = original; let other: () => number = separate;
    const first = addressof(cell); const alias = addressof(cell);
    storeptr(alias, replacement);
    const result = loadptr(first); const direct = cell; const untouched = loadptr(addressof(other));
  `);
  current.expect("result", ["original", "replacement"]);
  current.expect("direct", ["original", "replacement"]);
  current.expect("untouched", ["separate"]);
});

test("addressed member locations retain their actual object and projected field", () => {
  const current = fixture(`
    const original = () => 1; const replacement = () => 2; const separate = () => 3;
    const first = { value: original }; const second = { value: separate };
    const selected = addressof(first.value); const alias = first;
    storeptr(addressof(alias.value), replacement);
    const result = loadptr(selected); const direct = first.value; const untouched = second.value;
  `);
  current.expect("result", ["original", "replacement"]);
  current.expect("direct", ["original", "replacement"]);
  current.expect("untouched", ["separate"]);
});

test("bound pointer accessors execute only at their actual load and store", () => {
  const current = fixture(`
    const original = () => 1; const replacement = () => 2; const unused = () => 3;
    const backing = { value: original };
    const pointer = bindptr<() => number>(backing, () => backing.value, next => { backing.value = next; });
    function never(): void { storeptr(pointer, unused); }
    storeptr(pointer, replacement);
    const result = loadptr(pointer); const direct = backing.value;
  `);
  current.expect("result", ["original", "replacement"]);
  current.expect("direct", ["original", "replacement"]);
});

test("projected pointer accessors preserve their own conversion direction", () => {
  const current = fixture(`
    const original = () => 1; const replacement = () => 2;
    const pointer = allocateptr<() => number>(original);
    const view = projectptr<() => number, { readonly callback: () => number }>(pointer,
      value => ({ callback: value }), value => value.callback);
    storeptr(view, { callback: replacement });
    const result = loadptr(view).callback; const direct = loadptr(pointer);
  `);
  current.expect("result", ["original", "replacement"]);
  current.expect("direct", ["original", "replacement"]);
});

test("an unproved pointer accessor cannot fabricate its result producer", () => {
  const current = fixture(`
    declare function imported(): () => number;
    const identity = {};
    const pointer = bindptr<() => number>(identity, imported, next => {});
    const result = loadptr(pointer);
  `);
  assert.equal(current.query("result").kind === "unresolved", true, "opaque pointee accessors remain unproved");
});

test("addressed external backing does not manufacture an original callable", () => {
  const current = fixture(`
    export function inspect(backing: { value: () => number }): void {
      const result = loadptr(addressof(backing.value));
    }
  `);
  assert.equal(current.query("result").kind === "unresolved", true, "unknown backing values retain their external witness");
});

test("a projected pointer with an opaque conversion stays open", () => {
  const current = fixture(`
    const original = () => 1;
    declare function convert(value: () => number): { readonly callback: () => number };
    const pointer = allocateptr<() => number>(original);
    const view = projectptr<() => number, { readonly callback: () => number }>(pointer, convert, value => value.callback);
    const result = loadptr(view).callback;
  `);
  assert.equal(current.query("result").kind === "unresolved", true, "an unknown conversion cannot certify a stored callback");
});
