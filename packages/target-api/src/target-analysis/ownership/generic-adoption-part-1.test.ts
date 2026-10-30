import assert from "node:assert/strict";
import test from "node:test";
import { Node_Initializer } from "../../source-navigation/index.js";
import { assertDeclaredAdoption, nativeEntryFixture, fixture } from './generic-adoption-fixtures.js';

for (const timing of ["synchronous", "deferred", undefined] as const) {
  for (const ordinary of [false, true]) {
    test("native callback resolver sensitivity preserves " + timing + "/" + (ordinary ? "ordinary" : "adopting") + " actual", () => {
      const current = nativeEntryFixture(`
        declare function nativeInvoke(callback: () => void): void;
        function wrap<Value>(value: Value): Promise<Value> {
          return new Promise<Value>(resolve => { nativeInvoke(() => { resolve(value); }); });
        }
        ${ordinary
          ? "export function use(value: number): void { void wrap(value); }"
          : "export function use(value: Promise<number>): void { void wrap(value); }"}
      `, timing);
      assertDeclaredAdoption(current, ordinary ? 0 : 1, "wrap(value)");
    });
  }
}

for (const ordinary of [false, true]) {
  test(`known aliased callback producers preserve same-activation execution uncertainty (${ordinary})`, () => {
    const current = nativeEntryFixture(`
      declare function nativeInvoke(callback: () => void): void;
      function wrap<Value>(value: Value): Promise<Value> {
        return new Promise<Value>(resolve => {
          const callback = (): void => { resolve(value); };
          const alias = callback;
          nativeInvoke(alias);
        });
      }
      export function use(value: ${ordinary ? "number" : "Promise<number>"}): void { void wrap(value); }
    `);
    assertDeclaredAdoption(current, ordinary ? 0 : 1, "wrap(value)");
  });
}

test("uncertainty in one callback activation does not erase an independent checked resolving operation", () => {
  const current = nativeEntryFixture(`
    declare function nativeInvoke(callback: () => void): void;
    function wrap<Value>(value: Value): Promise<Value> {
      return new Promise<Value>(resolve => {
        const ready = value;
        nativeInvoke(() => { resolve(value); });
        resolve(ready);
      });
    }
    export function use(value: Promise<number>): void { void wrap(value); }
  `);
  assertDeclaredAdoption(current, 1, "wrap(value)");
});

for (const reversed of [false, true]) {
  test("native helper callback/value rows stay correlated in source admission, order=" + reversed, () => {
    const current = nativeEntryFixture(`
      declare function nativeInvoke(callback: () => void): void;
      function deliver<Part>(callback: (value: Part) => void, value: Part): void {
        nativeInvoke(() => { callback(value); });
      }
      function wrap<Value>(value: Value): Promise<number> {
        return new Promise<number>(resolve => {
          const observer = (actual: Value): void => { void actual; };
          ${reversed ? "deliver(resolve, 7); deliver(observer, value);" : "deliver(observer, value); deliver(resolve, 7);"}
        });
      }
      export function use(value: Promise<number>): void { void wrap(value); }
    `, "synchronous");
    const selected = current.query();
    assert.equal(selected.kind, "resolved", "actual source entries and existing equations are complete");
    if (selected.kind === "resolved") assert.equal(selected.issues.length, 0,
      "only resolver/number is sensitive; observer/Promise must not taint the helper binder globally");
  });
}

test("an uncalled nested callback does not create native resolver adoption", () => {
  const current = nativeEntryFixture(`
    declare function nativeInvoke(callback: () => void): void;
    function wrap<Value>(value: Value): Promise<Value> {
      return new Promise<Value>((resolve, reject) => {
        function unused(): void { nativeInvoke(() => { resolve(value); }); }
        reject(new Error("expected"));
      });
    }
    export function use(value: Promise<number>): void { void wrap(value); }
  `, "synchronous");
  assertDeclaredAdoption(current, 1, "wrap(value)");
});

test("a foreign same-spelled source body does not acquire a native callback contract", () => {
  const current = fixture(`
    function nativeInvoke(callback: () => void): void { void callback; }
    function wrap<Value>(value: Value): Promise<Value> {
      return new Promise<Value>((resolve, reject) => {
        nativeInvoke(() => { resolve(value); });
        reject(new Error("expected"));
      });
    }
    export function use(value: Promise<number>): void { void wrap(value); }
  `);
  assertDeclaredAdoption(current, 1, "wrap(value)");
});

test("a foreign Promise constructor is not a native executor or resolver by spelling", () => {
  const current = fixture(`
    export function use<Value>(value: Value): void {
      class Promise<Part> { constructor(executor: (resolve: (value: Part) => void) => void) { void executor; } }
      void new Promise<Value>(resolve => { resolve(value); });
    }
    export function run(promised: Promise<number>): void { use(promised); }
  `);
  const selected = current.query();
  assert.equal(selected.kind, "resolved", "actual checked foreign constructor is distinct");
  if (selected.kind === "resolved") assert.equal(selected.issues.length, 0, "no native resolver is invented for a source constructor");
});

test("a native default initializer does not taint a proven present ordinary callback input", () => {
  const current = fixture(`
    declare function nativeInvoke(values: number[], callback: (value: number) => void): void;
    function wrap<Value>(value: Value): Promise<number | Value> {
      return new Promise<number | Value>(resolve => {
        nativeInvoke([7], (actual: number | Value = value) => { resolve(actual); });
      });
    }
    export function run(promised: Promise<number>): void { void wrap(promised); }
  `);
  const { source, nodes } = current;
  const native = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) &&
    source.ast.text(source.ast.name(node)) === "nativeInvoke");
  assert.equal(native !== undefined && source.ast.body(native) === undefined, true,
    "the original checked native declaration remains the selected contract, without a callback-execution hook");
  assertDeclaredAdoption(current, 1, "wrap(promised)");
});

for (const ordinary of [false, true]) {
  test("native contextual input bounds qualify the same generic source callback: ordinary=" + ordinary, () => {
    const current = fixture(`
      declare function nativeInvoke<Part>(values: Part[], callback: (actual: Part) => void): void;
      function wrap<Value>(value: Value): Promise<Value> {
        return new Promise<Value>(resolve => {
          function deliver<Actual extends Value>(actual: Actual): void { resolve(actual); }
          nativeInvoke([value], deliver);
        });
      }
      export function run(value: ${ordinary ? "number" : "Promise<number>"}): void { void wrap(value); }
    `);
    const { source, nodes } = current;
    const native = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) &&
      source.ast.text(source.ast.name(node)) === "nativeInvoke");
    assert.equal(native !== undefined && source.ast.body(native) === undefined, true,
      "the original checked native declaration remains the selected contract, without a callback-execution hook");
    const selected = current.query();
    assert.equal(selected.kind, "resolved", "the selected native signature is a checked input bound, not a value witness");
    if (selected.kind === "resolved") {
      assert.equal(selected.issues.length, ordinary ? 0 : 1, "only the actual outer adopting binder is refused");
      if (!ordinary) assert.equal(current.textFor(selected.issues[0]!.site), "wrap(value)", "original checked instantiation site");
    }
  });
}

for (const ordinary of [false, true]) {
  test("an actual native resolver with an opaque input bound stays demand-local: ordinary=" + ordinary, () => {
    const current = fixture(`
      declare function nativeInvoke(callback: (actual: any) => void): void;
      function wrap<Value>(value: Value): Promise<Value> {
        return new Promise<Value>(resolve => { nativeInvoke(resolve); });
      }
      export function run(value: ${ordinary ? "number" : "Promise<number>"}): void { void wrap(value); }
    `);
    const { source, nodes } = current;
    const native = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "nativeInvoke");
    assert.equal(native !== undefined && source.ast.body(native) === undefined, true,
      "the original checked native declaration remains the selected contract, without a callback-execution hook");
    assertDeclaredAdoption(current, ordinary ? 0 : 1, "wrap(value)");
  });
}

for (const withDefault of [false, true]) {
  test("zero-input native callback preserves actual absence and its real default: default=" + withDefault, () => {
    const current = nativeEntryFixture(`
      declare function nativeInvoke(callback: () => void): void;
      function wrap<Value>(value: Value): Promise<Value | undefined> {
        return new Promise<Value | undefined>(resolve => {
          nativeInvoke((${withDefault ? "actual: Value = value" : "actual?: Value"}) => { resolve(actual); });
        });
      }
      export function run(value: Promise<number>): void { void wrap(value); }
    `, "synchronous");
    const parameter = current.nodes.find(node => current.source.ast.is.IsParameterDeclaration(node) &&
      current.source.ast.text(current.source.ast.name(node)) === "actual");
    assert.equal(parameter !== undefined, true, "the original zero-input callback keeps its checked formal");
    assert.equal(parameter !== undefined && Node_Initializer(current.source.ast, parameter) !== undefined, withDefault,
      "the original omitted/default source distinction is retained without selecting callback executions");
    assertDeclaredAdoption(current, 1, "wrap(value)");
  });
}

for (const mapped of [false, true]) for (const ordinary of [false, true]) for (const forwarded of [false, true]) {
  test("native input callable payload retains captured resolver uncertainty: " + mapped + "/" + ordinary + "/" + forwarded, () => {
    const current = fixture(`
      declare function nativeInvoke<Part>(values: Part[], callback: (actual: Part) => void): void;
      function deliver(callback: () => void): void { callback(); }
      function wrap<Value>(value: Value): Promise<Value> {
        return new Promise<Value>(resolve => {
          const callback = (): void => { resolve(value); };
          nativeInvoke([callback], actual => { ${forwarded ? "deliver(actual);" : "actual();"} });
        });
      }
      export function run(value: ${ordinary ? "number" : "Promise<number>"}): void { void wrap(value); }
    `);
    const { source, nodes } = current;
    const native = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "nativeInvoke");
    assert.equal(native !== undefined && source.ast.body(native) === undefined, true,
      "the original checked native declaration remains the selected contract, without a callback-execution hook");
    assertDeclaredAdoption(current, ordinary ? 0 : 1, "wrap(value)");
  });
}

for (const [name, payload] of [
  ["map", "new Map<number, () => void>([[0, callback]])"],
  ["set", "new Set<() => void>([callback])"],
  ["object", "{ callback }"],
  ["class-field", "new Holder()"],
  ["returned-closure", "returned()"],
] as const) for (const ordinary of [false, true]) {
  test("native container payload callable is not silently absent: " + name + "/" + ordinary, () => {
    const current = fixture(`
      declare function nativeInvoke<Part>(payload: Part, callback: (actual: () => void) => void): void;
      function wrap<Value>(value: Value): Promise<Value> {
        return new Promise<Value>(resolve => {
          const callback = (): void => { resolve(value); };
          class Holder { callback = (): void => { resolve(value); }; }
          function returned(): () => void { return callback; }
          nativeInvoke(${payload}, actual => { actual(); });
        });
      }
      export function run(value: ${ordinary ? "number" : "Promise<number>"}): void { void wrap(value); }
    `);
    const { source, nodes } = current;
    const native = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "nativeInvoke");
    assert.equal(native !== undefined && source.ast.body(native) === undefined, true,
      "the original checked native declaration remains the selected contract, without a callback-execution hook");
    assertDeclaredAdoption(current, ordinary ? 0 : 1, "wrap(value)");
  });
}

for (const adopting of [false, true]) for (const reversed of [false, true]) {
  test("opaque native payloads keep actual returned-closure factory rows: " + adopting + "/" + reversed, () => {
    const current = fixture(`
      declare function nativeInvoke<Part>(values: Part[], callback: (actual: Part) => void): void;
      function make<Part>(done: (value: Part) => void, value: Part): () => void { return () => { done(value); }; }
      function wrap<Value>(value: Value): Promise<Value | number> {
        return new Promise<Value | number>(resolve => {
          const observer = make((actual: Value): void => { void actual; }, value);
          const completion = make(resolve, ${adopting ? "value" : "7"});
          ${reversed ? `${adopting ? "observer" : "completion"}(); nativeInvoke([${adopting ? "completion" : "observer"}], next => { next(); });`
            : `nativeInvoke([${adopting ? "completion" : "observer"}], next => { next(); }); ${adopting ? "observer" : "completion"}();`}
        });
      }
      export function run(value: Promise<number>): void { void wrap(value); }
    `);
    const { source, nodes } = current;
    const native = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "nativeInvoke");
    assert.equal(native !== undefined && source.ast.body(native) === undefined, true,
      "the original checked native declaration remains the selected contract, without a callback-execution hook");
    assertDeclaredAdoption(current, 1, "wrap(value)");
  });
}

test("a factory callee is not a returned native callback payload", () => {
  const current = fixture(`
    declare function nativeInvoke<Part>(values: Part[], callback: (actual: Part) => void): void;
    function make<Value>(value: Value, done: (actual: number) => void): () => void { done(7); return () => { void value; }; }
    function wrap<Value>(value: Value): Promise<Value | number> {
      return new Promise<Value | number>(resolve => { const observer = make(value, resolve); nativeInvoke([observer], next => { next(); }); });
    }
    export function run(value: Promise<number>): void { void wrap(value); }
  `);
  const { source, nodes } = current;
  const native = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "nativeInvoke");
  assert.equal(native !== undefined && source.ast.body(native) === undefined, true,
    "the original checked native declaration remains the selected contract, without a callback-execution hook");
  assertDeclaredAdoption(current, 1, "wrap(value)");
});
