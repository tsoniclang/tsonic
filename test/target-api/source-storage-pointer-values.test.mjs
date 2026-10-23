import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, createSourceSemanticsExtension, formatDiagnostics } from "@tsonic/tsts";
import { createTsonicCoreSourceExtension, tsonicCoreSourceSemanticsModules } from "../../packages/source-core/dist/public/index.js";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { selectJsSourceCallStorageEffect } from "../../packages/js-source-profile/dist/index.js";
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
  const storage = createSourceStorageQuery(source, [file], undefined, {
    call: (node, call) => {
      const declaration = source.semantics.forNode(node).declarations.signatureDeclaration(call.selectedSignature);
      const owner = declaration === undefined ? undefined : source.ast.parent(declaration);
      return selectJsSourceCallStorageEffect(owner === undefined ? undefined : { declaration,
        ownerName: source.ast.text(source.ast.name(owner)), memberName: source.ast.text(source.ast.name(declaration)) }, call)?.effect;
    },
  });
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
  const selected = current.query("result");
  assert.equal(selected.kind === "unresolved", true, `unknown backing values retain their external witness (${selected.kind})`);
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

test("bound pointer setter defaults receive the original single-absence actual", () => {
  const current = fixture(`
    const original = () => 1; const replacement = () => 2;
    const state: { value: (() => number) | undefined } = { value: original };
    const pointer = bindptr<(() => number) | undefined>(state, () => state.value,
      (next: (() => number) | undefined = replacement) => { state.value = next; });
    const missing: { callback?: () => number } = {};
    storeptr(pointer, missing.callback);
    const result = loadptr(pointer); const direct = state.value;
  `);
  current.expect("result", ["original", "replacement"]);
  current.expect("direct", ["original", "replacement"]);
});

test("projected pointer write defaults keep absent actuals in the same conversion frame", () => {
  const current = fixture(`
    const replacement = () => 2;
    const pointer = allocateptr<{ callback?: () => number }>({});
    const view = projectptr<{ callback?: () => number }, (() => number) | undefined>(pointer,
      value => value.callback,
      (next: (() => number) | undefined = replacement) => ({ callback: next }));
    const missing: { callback?: () => number } = {};
    storeptr(view, missing.callback);
    const result = loadptr(view); const direct = loadptr(pointer).callback;
  `);
  current.expect("result", ["replacement"]);
  current.expect("direct", ["replacement"]);
});

test("projected pointer read defaults keep absent pointees in the same conversion frame", () => {
  const current = fixture(`
    const replacement = () => 2;
    const pointer = allocateptr<(() => number) | undefined>(undefined);
    const view = projectptr<(() => number) | undefined, { callback: () => number }>(pointer,
      (value: (() => number) | undefined = replacement) => ({ callback: value }), value => value.callback);
    const result = loadptr(view).callback;
  `);
  current.expect("result", ["replacement"]);
});

for (const resumed of [false, true]) {
  test(`a generator pointer reader runs its body only on an actual resume (${resumed})`, () => {
    const current = fixture(`
      const original = () => 1; const replacement = () => 2;
      let cell = original;
      function* reader(): Generator<number, void, unknown> { cell = replacement; yield 1; }
      const pointer = bindptr<Generator<number, void, unknown>>({}, reader, next => {});
      const created = loadptr(pointer);
      ${resumed ? "created.next();" : ""}
      const result = cell;
    `);
    current.expect("result", resumed ? ["original", "replacement"] : ["original"]);
  });
}

test("pointer reader parameter defaults run at generator creation without running its body", () => {
  const current = fixture(`
    const original = () => 1; const parameter = () => 2; const deferred = () => 3;
    let cell = original;
    function* reader(value = (cell = parameter)): Generator<number, void, unknown> { cell = deferred; yield value(); }
    const pointer = bindptr<Generator<number, void, unknown>>({}, reader, next => {});
    const created = loadptr(pointer);
    const result = cell;
  `);
  current.expect("result", ["original", "parameter"]);
});

for (const projection of ["callback", "nested.callback", "items[0]"]) {
  test(`whole addressed aggregate writes retain the demanded ${projection} projection`, () => {
    const current = fixture(`
      const original = () => 1; const replacement = () => 2; const separate = () => 3;
      let cell = { callback: original, nested: { callback: original }, items: [original] };
      let other = { callback: separate, nested: { callback: separate }, items: [separate] };
      const pointer = addressof(cell);
      storeptr(pointer, { callback: replacement, nested: { callback: replacement }, items: [replacement] });
      const result = loadptr(pointer).${projection}; const direct = cell.${projection};
      const untouched = loadptr(addressof(other)).${projection};
    `);
    current.expect("result", ["original", "replacement"]);
    current.expect("direct", ["original", "replacement"]);
    current.expect("untouched", ["separate"]);
  });
}

test("pointer getter throws reach the actual caller catch with original factory correlation", () => {
  const current = fixture(`
    const firstError = { message: "first" }; const secondError = { message: "second" };
    function make(error: object): Pointer<number> { return bindptr<number>({}, () => { throw error; }, next => {}); }
    const first = make(firstError); const second = make(secondError);
    try { loadptr(first); } catch (error) { const firstObserved = error; }
    try { loadptr(second); } catch (error) { const secondObserved = error; }
  `);
  current.expect("firstObserved", ["firstError"]);
  current.expect("secondObserved", ["secondError"]);
});

for (const defaulted of [false, true]) {
  test(`pointer setter throws retain original actual and default parameter transport (${defaulted})`, () => {
    const current = fixture(`
      const defaultError = { message: "default" }; const actualError = { message: "actual" };
      const pointer = bindptr<object | undefined>({}, () => defaultError,
        (next: object | undefined = defaultError) => { throw next; });
      try { storeptr(pointer, ${defaulted ? "undefined" : "actualError"}); }
      catch (error) { const observed = error; }
    `);
    current.expect("observed", [defaulted ? "defaultError" : "actualError"]);
  });
}

test("projected pointer converter throws keep the original loaded object", () => {
  const current = fixture(`
    const originalError = { message: "converter" };
    const pointer = allocateptr<object>(originalError);
    const view = projectptr<object, number>(pointer, value => { throw value; }, value => originalError);
    try { loadptr(view); } catch (error) { const observed = error; }
  `);
  current.expect("observed", ["originalError"]);
});

test("a pointer exception preserves an opaque nested thrown-value witness", () => {
  const current = fixture(`
    declare function fail(): never;
    const pointer = bindptr<number>({}, () => fail(), next => {});
    try { loadptr(pointer); } catch (error) { const observed = error; }
  `);
  assert.equal(current.query("observed").kind !== "complete", true, "unproved external errors remain open rather than empty");
});

for (const projection of ["callback", "nested.callback", "items[0]"]) {
  test(`addressed member aggregate writes project the backing ${projection} suffix exactly once`, () => {
    const current = fixture(`
      const original = () => 1; const replacement = () => 2; const separate = () => 3;
      const box = { value: { callback: original, nested: { callback: original }, items: [original] } };
      const other = { value: { callback: separate, nested: { callback: separate }, items: [separate] } };
      const alias = box;
      const pointer = addressof(alias.value);
      storeptr(pointer, { callback: replacement, nested: { callback: replacement }, items: [replacement] });
      const result = loadptr(pointer).${projection}; const direct = box.value.${projection};
      const untouched = loadptr(addressof(other.value)).${projection};
    `);
    current.expect("result", ["original", "replacement"]);
    current.expect("direct", ["original", "replacement"]);
    current.expect("untouched", ["separate"]);
  });
}

test("addressed external member aggregates retain their original open backing witness", () => {
  const current = fixture(`
    export function inspect(box: { value: { callback: () => number } }): void {
      const result = loadptr(addressof(box.value)).callback;
    }
  `);
  assert.equal(current.query("result").kind !== "complete", true, "an external aggregate never invents a callable stored producer");
});
