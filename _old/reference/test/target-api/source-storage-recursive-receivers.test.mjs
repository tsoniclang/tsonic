import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { namedVariable } from "../fixtures/source-navigation.mjs";

function fixture(body, extraFiles = {}) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    files: { "/src/index.ts": `export {}; ${body}`, ...extraFiles },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics, "/src"));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles, {
    ...defaultSourceStorageLimits, maximumSteps: 65_536,
  });
  const initializer = name => Node_Initializer(source.ast, namedVariable(source.ast, file, name));
  const origins = (name, kind) => {
    const subject = storage.subjectFor(initializer(name));
    assert.equal(subject.kind === "resolved", true, `${name}: checked source identity`);
    const result = storage.closedOriginsFor(subject.subject);
    assert.equal(result.kind === kind, true, `${name}: ${result.kind}; ${storage.failureReason() ?? "no resource failure"}`);
    if (kind === "open") assert.equal(result.boundaries.some(boundary => boundary.kind === "external-input"), true,
      "an exported member's external-input evidence remains visible independently of exact selected origins");
    assert.equal(storage.failureReason() === undefined, true, "all independent guards remain enabled");
    return result.origins;
  };
  const expect = (name, expected, kind = "complete") => {
    const values = origins(name, kind);
    assert.equal(values.length === expected.length && expected.every(origin =>
      values.some(value => value.subject.node === initializer(origin))), true, `${name}: exact original producers ${expected.join(", ")}`);
  };
  return { expect };
}

for (const selected of ["context.scope.select(token)", 'context.scope["select"](token)', "context.scope.select(token, count)",
  "(context.scope.select)(token)"]) {
  test(`recursive context projections preserve exact method operands for ${selected}`, () => {
    const current = fixture(`
      declare const stop: boolean;
      class Scope { select(token: object, unused: number = 0): object { return token; } }
      class Context { constructor(readonly scope: Scope) {} }
      function pipeline(scope: Scope, token: object, count: number): object {
        return command(new Context(scope), token, count);
      }
      function command(context: Context, token: object, count: number): object {
        if (stop) return ${selected};
        return pipeline(context.scope, token, count - 1);
      }
      const leftToken = {}; const rightToken = {};
      const left = pipeline(new Scope(), leftToken, 4);
      const right = pipeline(new Scope(), rightToken, 5);
    `);
    current.expect("left", ["leftToken"]);
    current.expect("right", ["rightToken"]);
  });
}

test("recursive exported receiver projection retains exact overrides and independent publication evidence", () => {
  const current = fixture(`
    import { Scope, Context, Alternate } from "./model.js";
    declare const stop: boolean;
    function pipeline(scope: Scope, token: object): object { return command(new Context(scope), token); }
    function command(context: Context, token: object): object {
      if (stop) return context.scope.select(token);
      return pipeline(context.scope, token);
    }
    const own = {}; const replacement = {}; const forbidden = {};
    const first = pipeline(new Scope(), own);
    const second = pipeline(new Alternate(replacement), forbidden);
  `, { "/src/model.ts": `
    export class Scope { select(token: object): object { return token; } }
    export class Alternate extends Scope {
      constructor(readonly value: object) { super(); }
      select(token: object): object { return this.value; }
    }
    export class Context { constructor(readonly scope: Scope) {} }
  ` });
  current.expect("first", ["own"], "open");
  current.expect("second", ["replacement"]);
});

test("a property-held foreign method retains the actual invocation receiver, not the callee's original owner", () => {
  const current = fixture(`
    class Box { constructor(readonly value: object) {} read(): object { return this.value; } }
    interface Reader { readonly value: object; read(): object; }
    function invoke(reader: Reader): object { return reader.read(); }
    const foreign = {}; const own = {}; const other = {};
    const source = new Box(foreign);
    const first = { value: own, read: source.read };
    const second = { value: other, read: source.read };
    const left = invoke(first); const right = invoke(second);
  `);
  current.expect("left", ["own"]);
  current.expect("right", ["other"]);
});

for (const access of ["factory.slot", 'factory["slot"]']) {
  test(`separate ${access} activations cannot share a getter-created mutable capture`, () => {
    const current = fixture(`
      const original = {}; const replacement = {};
      class Factory {
        get slot() {
          let value = original;
          return { read: () => value, write: (next: object) => { value = next; } };
        }
      }
      const factory = new Factory();
      function spawn() { return ${access}; }
      const first = spawn(); const second = spawn();
      first.write(replacement);
      const written = first.read(); const selected = second.read();
    `);
    current.expect("written", ["original", "replacement"]);
    current.expect("selected", ["original"]);
  });
}

test("getter member identity retains the actual object's captured declaration environment", () => {
  const current = fixture(`
    function factory(token: object) {
      class Factory { get value(): object { return token; } }
      return new Factory();
    }
    function read(box: { readonly value: object }): object { return box.value; }
    const own = {}; const foreign = {};
    const left = read(factory(own)); const right = read(factory(foreign));
  `);
  current.expect("left", ["own"]);
  current.expect("right", ["foreign"]);
});

test("selected method-valued storage preserves actual replacements instead of acquiring a declaration leaf", () => {
  const current = fixture(`
    interface Reader { read(): object; }
    const original = {}; const replacement = {}; const unrelated = {};
    const selected: Reader = { read: () => original };
    const separate: Reader = { read: () => unrelated };
    selected.read = () => replacement;
    const written = selected.read(); const untouched = separate.read();
  `);
  current.expect("written", ["original", "replacement"]);
  current.expect("untouched", ["unrelated"]);
});

test("getter execution preserves its exact receiver mutation without changing another instance", () => {
  const current = fixture(`
    const original = {}; const replacement = {};
    class Box {
      constructor(public value: object) {}
      get update(): object { this.value = replacement; return this.value; }
    }
    function invoke(box: Box): object { return box.update; }
    const first = new Box(original); const second = new Box(original);
    const executed = invoke(first);
    const written = first.value; const untouched = second.value;
  `);
  current.expect("written", ["original", "replacement"]);
  current.expect("untouched", ["original"]);
});
