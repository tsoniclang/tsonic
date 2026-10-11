import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { createSourceStorageGuardedMembers } from "../../packages/target-api/dist/target-analysis/source-storage/guarded-members.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";
import { namedVariable } from "../fixtures/source-navigation.mjs";

function fixture(body, extraFiles = {}) {
  const files = { "/src/index.ts": `export {}; ${body}`, ...extraFiles };
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files,
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics, "/src"));
  assert.equal(checked.extensionDiagnostics.length, 0);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const storage = createSourceStorageQuery(source, Object.keys(files).map(name => checked.getSourceFile(name)));
  const variable = name => namedVariable(source.ast, file, name);
  const initializer = name => Node_Initializer(source.ast, variable(name));
  const origins = name => {
    const selected = storage.subjectFor(variable(name));
    assert.equal(selected.kind === "resolved", true, `${name}: exact source subject`);
    const result = storage.closedOriginsFor(selected.subject);
    assert.equal(result.kind === "complete", true, `${name}: complete selected member evidence`);
    assert.equal(storage.failureReason() === undefined, true, `${name}: no missing owner evidence`);
    return result.origins;
  };
  return { source, storage, variable, initializer, origins };
}

for (const access of ["value.items", 'value["items"]']) {
  test(`narrowed member ${access} excludes exact sibling allocations without converting their absent field`, () => {
    const current = fixture(`
      class Base { kind: string = "base"; }
      const foreign = {};
      class Scalar extends Base { readonly value: {} = foreign; }
      class List extends Base { constructor(readonly items: {}) { super(); } }
      const token = {};
      function parse(mode: boolean): Base { return mode ? new List(token) : new Scalar(); }
      function select(value: Base): {} {
        if (!(value instanceof List)) return {};
        return ${access};
      }
      const result = select(parse(true));
    `);
    const origins = current.origins("result");
    assert.equal(origins.some(origin => origin.subject.node === current.initializer("token")), true,
      "the surviving exact list constructor input remains observable");
    assert.equal(origins.some(origin => origin.subject.node === current.initializer("foreign")), false,
      "the excluded sibling's initializer cannot contribute through an absent field");
  });
}

test("cross-file immutable class aliases retain exact producer selection and inherited members", () => {
  const current = fixture(`
    import { Base, List, Scalar } from "./models.js";
    const constructor = Scalar;
    const token = {};
    const foreign = {};
    function parse(mode: boolean): Base { return mode ? new List(token) : new constructor(foreign); }
    function select(value: Base): {} {
      if (value instanceof List) return value.items;
      return {};
    }
    const result = select(parse(true));
  `, { "/src/models.ts": `
    export class Base { kind: string = "base"; }
    class Items extends Base { constructor(readonly items: {}) { super(); } }
    export class List extends Items {}
    export class Scalar extends Base { constructor(readonly value: {}) { super(); } }
  ` });
  const origins = current.origins("result");
  assert.equal(origins.some(origin => origin.subject.node === current.initializer("token")), true);
  assert.equal(origins.some(origin => origin.subject.node === current.initializer("foreign")), false);
});

test("selected structural adaptation still preserves real members from a distinct exact class", () => {
  const current = fixture(`
    class Actual { constructor(readonly items: {}) {} }
    class View { constructor(readonly items: {}) {} }
    const token = {};
    const actual = new Actual(token);
    const view: View = actual;
    const result = view.items;
  `);
  const origins = current.origins("result");
  assert.equal(origins.length === 1 && origins[0].subject.node === current.initializer("token"), true,
    "distinct nominal declarations are not by themselves impossible structural selections");
});

test("nominal guards exclude sibling allocations even when both classes have the selected member", () => {
  const current = fixture(`
    class Base { kind: string = "base"; }
    class Selected extends Base { constructor(readonly items: {}) { super(); } }
    class Sibling extends Base { constructor(readonly items: {}) { super(); } }
    const token = {};
    const foreign = {};
    function parse(mode: boolean): Base { return mode ? new Selected(token) : new Sibling(foreign); }
    function select(value: Base): {} {
      if (value instanceof Selected) return value.items;
      return {};
    }
    const result = select(parse(true));
  `);
  const origins = current.origins("result");
  assert.equal(origins.some(origin => origin.subject.node === current.initializer("token")), true);
  assert.equal(origins.some(origin => origin.subject.node === current.initializer("foreign")), false,
    "a structural field correspondence does not discharge a nominal branch condition");
});

for (const condition of ["value instanceof alias", "value instanceof alias && enabled",
  "value instanceof alias || value instanceof Derived"]) {
  test(`checked condition ${condition} preserves subclasses and excludes structurally identical siblings`, () => {
    const current = fixture(`
      class Base { kind: string = "base"; }
      class Selected extends Base { constructor(readonly items: {}) { super(); } }
      class Derived extends Selected {}
      class Sibling extends Base { constructor(readonly items: {}) { super(); } }
      const alias = Selected;
      const token = {};
      const foreign = {};
      function parse(mode: boolean): Base { return mode ? new Derived(token) : new Sibling(foreign); }
      function select(value: Base, enabled: boolean): {} {
        if (${condition}) return value.items;
        return {};
      }
      const result = select(parse(true), true);
    `);
    const origins = current.origins("result");
    assert.equal(origins.some(origin => origin.subject.node === current.initializer("token")), true);
    assert.equal(origins.some(origin => origin.subject.node === current.initializer("foreign")), false);
  });
}

test("a different receiver's nominal guard cannot filter the selected member's actual producer", () => {
  const current = fixture(`
    class Base { constructor(readonly items: {}) {} }
    class Selected extends Base {}
    class Sibling extends Base {}
    const token = {};
    const foreign = {};
    function parse(mode: boolean): Base { return mode ? new Selected(token) : new Sibling(foreign); }
    function select(value: Base, other: Base): {} {
      if (other instanceof Selected) return value.items;
      return {};
    }
    const result = select(parse(true), new Selected({}));
  `);
  const origins = current.origins("result");
  assert.equal(origins.some(origin => origin.subject.node === current.initializer("token")), true);
  assert.equal(origins.some(origin => origin.subject.node === current.initializer("foreign")), true,
    "only the checked guard's exact binding may acquire its nominal constraint");
});

test("writes after a nominal guard invalidate its constraint without discarding the new producer", () => {
  const current = fixture(`
    class Base { constructor(readonly items: {}) {} }
    class Selected extends Base {}
    class Sibling extends Base {}
    const token = {};
    const foreign = {};
    function select(value: Base): {} {
      if (value instanceof Selected) {
        value = new Sibling(foreign);
        return value.items;
      }
      return {};
    }
    const result = select(new Selected(token));
  `);
  assert.equal(current.origins("result").some(origin => origin.subject.node === current.initializer("foreign")), true,
    "an earlier guard cannot certify a subsequently replaced binding");
});

test("exact nominal member selection preserves independent finite work and hierarchy-row guards", () => {
  const current = fixture(`
    class Base {}
    class Selected extends Base { readonly items: {} = {}; }
    class Sibling extends Base { readonly items: {} = {}; }
    const actual = new Sibling();
    function select(value: Base): {} {
      if (value instanceof Selected) {
        const read = value.items;
        return read;
      }
      return {};
    }
  `);
  const selected = current.storage.subjectFor(current.initializer("actual"));
  assert.equal(selected.kind === "resolved", true);
  const access = current.initializer("read");
  const receiver = current.source.ast.as.AsPropertyAccessExpression(access).Expression;
  for (const limits of [{ maximumSteps: 1 }, { maximumTransportRows: 1 }]) {
    const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
    const guarded = createSourceStorageGuardedMembers(current.source, budget);
    assert.equal(guarded(selected.subject, receiver) === undefined, true, "no result publishes around independent exhaustion");
    assert.equal(budget.failure() !== undefined, true, "the failed proof preserves its owning resource diagnostic");
  }
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 2 });
  const guarded = createSourceStorageGuardedMembers(current.source, budget);
  for (let replay = 0; replay < 100; replay += 1) {
    assert.equal(guarded(selected.subject, receiver), false);
  }
  assert.equal(budget.failure() === undefined, true, "completed temporary hierarchy reservations release after every proof");
});

test("opaque missing members are not silently certified as an impossible allocated alternative", () => {
  const current = fixture(`
    class Base { kind: string = "base"; }
    class List extends Base { constructor(readonly items: {}) { super(); } }
    declare const external: Base;
    function select(value: Base): {} {
      if (value instanceof List) return value.items;
      return {};
    }
    const result = select(external);
  `);
  const selected = current.storage.subjectFor(current.variable("result"));
  assert.equal(selected.kind === "resolved", true);
  const origins = current.storage.closedOriginsFor(selected.subject);
  assert.equal(origins.kind === "unresolved", true, "the opaque receiver has no exact allocated shape");
  assert.equal(current.storage.failureReason() === "Source storage members require exact checked correspondence.", true,
    "unavailable evidence remains an explicit failure, not an empty certificate");
});

test("mutable and opaque constructor bindings cannot certify an exact missing member", () => {
  for (const [name, constructor] of [
    ["mutable", "let constructor = Scalar; constructor = Scalar;"],
    ["opaque", "declare const constructor: new () => Scalar;"],
  ]) {
    const current = fixture(`
      class Base { kind: string = "base"; }
      class Scalar extends Base { readonly value: {} = {}; }
      class List extends Base { constructor(readonly items: {}) { super(); } }
      ${constructor}
      function select(value: Base): {} {
        if (value instanceof List) return value.items;
        return {};
      }
      const result = select(new constructor());
    `);
    const selected = current.storage.subjectFor(current.variable("result"));
    assert.equal(selected.kind === "resolved", true, name);
    const origins = current.storage.closedOriginsFor(selected.subject);
    assert.equal(origins.kind === "complete", false, `${name}: no exact project constructor evidence`);
  }
});
