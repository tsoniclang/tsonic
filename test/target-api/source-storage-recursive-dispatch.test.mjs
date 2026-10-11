import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { namedVariable } from "../fixtures/source-navigation.mjs";

function fixture(body, options = {}) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `export {}; ${body}` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles,
    { ...defaultSourceStorageLimits, maximumSteps: 65_536, ...options.limits });
  const initializer = name => Node_Initializer(source.ast, namedVariable(source.ast, file, name));
  const query = name => {
    const selected = storage.subjectFor(initializer(name));
    return selected.kind === "resolved" ? storage.closedOriginsFor(selected.subject) : selected;
  };
  const expect = (name, expected) => {
    const selected = query(name);
    assert.equal(selected.kind === "complete", true, `${name}: ${storage.failureReason() ?? selected.kind}`);
    assert.equal(selected.origins.length === expected.length && expected.every(origin =>
      selected.origins.some(value => value.subject.node === initializer(origin))), true,
    `${name}: only exact original producers ${expected.join(", ")}`);
    assert.equal(storage.failureReason() === undefined, true, "unchanged finite work and storage guards");
  };
  return { source, storage, query, expect };
}

for (const allocation of ["{ token }", "new Box(token)"]) for (const call of [
  "context.scope.select", '(context.scope.select)', 'context.scope["select"]',
]) for (const reverse of [false, true]) {
  test(`recursive dispatch retains fresh ${allocation} arguments through ${call} (${reverse ? "reverse" : "forward"} query order)`, () => {
    const current = fixture(`
      declare const stop: boolean;
      class Box { constructor(readonly token: object) {} }
      class Scope { select(box: Box): Box { return box; } }
      class Context { constructor(readonly scope: Scope) {} }
      function pipeline(scope: Scope, token: object): Box { return command(new Context(scope), token); }
      function command(context: Context, token: object): Box {
        if (stop) return ${call}(${allocation});
        return pipeline(context.scope, token);
      }
      const left = {}; const right = {};
      const first = pipeline(new Scope(), left).token;
      const second = pipeline(new Scope(), right).token;
    `);
    const selections = [["first", "left"], ["second", "right"]];
    for (const [name, expected] of reverse ? selections.reverse() : selections) current.expect(name, [expected]);
  });
}

test("context-independent method code retains the actual receiver at each call", () => {
  const current = fixture(`
    declare const stop: boolean;
    class Scope { constructor(readonly token: object) {} select(unused: object): object { return this.token; } }
    class Context { constructor(readonly scope: Scope) {} }
    function pipeline(scope: Scope): object { return command(new Context(scope)); }
    function command(context: Context): object {
      if (stop) return context.scope.select({});
      return pipeline(context.scope);
    }
    const left = {}; const right = {};
    const first = pipeline(new Scope(left)); const second = pipeline(new Scope(right));
  `);
  current.expect("first", ["left"]);
  current.expect("second", ["right"]);
});

test("a class method authored in a factory retains its own lexical capture", () => {
  const current = fixture(`
    function create(token: object) {
      return new class { select(): object { return token; } }();
    }
    const left = {}; const right = {};
    const leftScope = create(left); const rightScope = create(right);
    const first = leftScope.select(); const second = rightScope.select();
  `);
  current.expect("first", ["left"]);
  current.expect("second", ["right"]);
});

test("a module block method retains a non-module lexical binding", () => {
  const current = fixture(`
    const left = {};
    {
      const captured = left;
      class Scope { select(): object { return captured; } }
      const result = new Scope().select();
    }
  `);
  current.expect("result", ["left"]);
});

test("method overrides do not become one context-independent implementation", () => {
  const current = fixture(`
    const left = {}; const right = {};
    class Base { select(): object { return left; } }
    class Derived extends Base { select(): object { return right; } }
    function select(scope: Base): object { return scope.select(); }
    const first = select(new Base()); const second = select(new Derived());
  `);
  current.expect("first", ["left"]);
  current.expect("second", ["right"]);
});

test("a replaced callable field retains every authored supplier rather than only the original method body", () => {
  const current = fixture(`
    const left = {}; const right = {};
    class Scope { select(): object { return left; } }
    const scope = new Scope();
    scope.select = () => right;
    const result = scope.select();
  `);
  current.expect("result", ["left", "right"]);
});

for (const target of ["firstScope.select", 'alias["select"]', "view.select"]) {
  test(`method replacement through ${target} preserves physical receiver separation`, () => {
    const current = fixture(`
      const original = {}; const replacement = {};
      class Scope { select(): object { return original; } }
      const firstScope = new Scope(); const secondScope = new Scope();
      const alias = firstScope;
      const view: { select(): object } = firstScope;
      ${target} = () => replacement;
      const first = firstScope.select(); const second = secondScope.select();
    `);
    current.expect("first", ["original", "replacement"]);
    current.expect("second", ["original"]);
  });
}

test("an inherited method replacement retains its selected receiver and actual closure capture", () => {
  const current = fixture(`
    const original = {}; const left = {}; const right = {};
    class Base { select(): object { return original; } }
    class Derived extends Base {}
    function replace(scope: Base, token: object): void { scope.select = () => token; }
    const leftScope = new Derived(); const rightScope = new Derived();
    replace(leftScope, left); replace(rightScope, right);
    const first = leftScope.select(); const second = rightScope.select();
  `);
  current.expect("first", ["original", "left"]);
  current.expect("second", ["original", "right"]);
});

test("a method supplier in an uninvoked writer does not become an executed replacement", () => {
  const current = fixture(`
    const original = {}; const foreign = {};
    class Scope { select(): object { return original; } }
    const scope = new Scope();
    function unused(): void { scope.select = () => foreign; }
    const result = scope.select();
  `);
  current.expect("result", ["original"]);
});

test("an unknown method supplier cannot become a certified original implementation", () => {
  const current = fixture(`
    declare const external: () => object;
    const original = {};
    class Scope { select(): object { return original; } }
    const scope = new Scope();
    scope.select = external;
    const result = scope.select();
  `);
  assert.equal(current.query("result").kind === "unresolved", true,
    "unknown actual dispatch cannot close using its one known original body");
});
