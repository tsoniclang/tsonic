import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceGlobalCallStorageEffects, createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { jsSourceNativeConstructorStorage, sourceErrorDeclarations } from "../../packages/js-source-profile/dist/index.js";
import { createSourceStorageGuardedValues } from "../../packages/target-api/dist/target-analysis/source-storage/graph/guarded-values.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";
import { createSourceStorageTransport } from "../../packages/target-api/dist/target-analysis/source-storage/transport/transport.js";
import { createSourceStoragePhysicalMembers } from "../../packages/target-api/dist/target-analysis/source-storage/scoped/member-selection.js";
import { createSourceStorageSubjects } from "../../packages/target-api/dist/target-analysis/source-storage/model/subjects.js";
import { checkedSource, namedDeclaration, namedVariable, projectSourceFile } from "../fixtures/source-navigation.mjs";
import { inheritedNativeMemberFixture, fixture } from "./source-storage-member-selection.split-fixtures.mjs";

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

for (const input of ["value: Base", "[value]: [Base]"]){
test(`guarded aliases preserve returned selection from exact physical binding (${input})`, () => {
    const argument = input.startsWith("[") ? "[parse(true)]" : "parse(true)";
    const current = fixture(`
      class Base {}
      class List extends Base { constructor(readonly items: {}[]) { super(); } read(): {} { return this.items[0]; } }
      class Scalar extends Base { readonly value = {}; }
      const token = {};
      function parse(mode: boolean): Base { return mode ? new List([token]) : new Scalar(); }
      function select(${input}): List | undefined {
        if (value instanceof List) { const alias = value; return alias; }
        return undefined;
      }
      const result = select(${argument})!.read();
    `);
    assert.equal(current.origins("result").some(origin => origin.subject.node === current.initializer("token")), true);
  });
}

for (const mutable of [false, true]){
test(`cross-file generic returned guards retain exact same-shape nominal alternatives (${mutable ? "mutable" : "readonly"} backing)`, () => {
    const current = fixture(`
      import { Base, List, Sibling, select } from "./models.js";
      const token = {};
      const foreign = {};
      function parse(mode: boolean): Base { return mode ? new List([token]) : new Sibling([foreign]); }
      const result = select(parse(true))!.read();
    `, { "/src/models.ts": `
      export class Base {}
      export class List extends Base { constructor(readonly items: ${mutable ? "" : "readonly "}{}[]) { super(); } read(): {} { return this.items[0]; } }
      export class Sibling extends Base { constructor(readonly items: ${mutable ? "" : "readonly "}{}[]) { super(); } read(): {} { return this.items[0]; } }
      export function select<Value extends Base>(value: Value): List | undefined {
        if (value instanceof List) return value;
        return undefined;
      }
    ` });
    const subject = current.storage.subjectFor(current.variable("result"));
    assert.equal(subject.kind === "resolved", true);
    const selection = current.storage.closedOriginsFor(subject.subject);
    assert.equal(selection.kind === (mutable ? "open" : "complete"), true,
      `checked returned guard preserves the native public member contract (${selection.kind}; ${selection.reason ?? ""})`);
    if (mutable) assert.equal(selection.boundaries.some(boundary => boundary.kind === "external-write"), true);
    const origins = selection.origins;
    assert.equal(origins.some(origin => origin.subject.node === current.initializer("token")), true);
    assert.equal(origins.some(origin => origin.subject.node === current.initializer("foreign")), false);
  });
}

test("a replaced returned binding is not filtered using an invalidated nominal guard", () => {
  const current = fixture(`
    class Base {}
    class List extends Base { constructor(readonly items: {}[]) { super(); } read(): {} { return this.items[0]; } }
    class Sibling extends Base { constructor(readonly items: {}[]) { super(); } read(): {} { return this.items[0]; } }
    const token = {};
    const foreign = {};
    function select(value: Base): List | undefined {
      if (value instanceof List) { value = new Sibling([foreign]); return value as List; }
      return undefined;
    }
    const result = select(new List([token]))!.read();
  `);
  assert.equal(current.origins("result").some(origin => origin.subject.node === current.initializer("foreign")), true);
});

test("returned nominal selection keeps an opaque writer's admitted backing-slot evidence", () => {
  const current = fixture(`
    class Base {}
    class List extends Base { constructor(readonly items: {}[]) { super(); } read(): {} { return this.items[0]; } }
    class Scalar extends Base { readonly value = {}; }
    declare function mutate(value: List): void;
    const token = {};
    function parse(mode: boolean): Base { return mode ? new List([token]) : new Scalar(); }
    function select(value: Base): List | undefined {
      if (value instanceof List) { mutate(value); return value; }
      return undefined;
    }
    const result = select(parse(true))!.read();
  `);
  const subject = current.storage.subjectFor(current.variable("result"));
  assert.equal(subject.kind === "resolved", true);
  const selected = current.storage.closedOriginsFor(subject.subject);
  assert.equal(selected.kind === "open", true, `nominal selection does not certify mutable contents after an opaque call (${selected.kind}; ${selected.reason ?? ""})`);
  assert.equal(selected.boundaries.some(boundary => boundary.kind === "opaque-write"), true);
  assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("token")), true);
});

test("symbolic nominal continuation retains an admitted opaque writer's physical array backing", () => {
  const current = fixture(`
    class Base {}
    class Empty extends Base {}
    class List extends Base { constructor(readonly items: {}[]) { super(); } }
    declare function mutate(value: List): void;
    const token = {};
    function select(value: Base, other: Base, depth: number): {} | undefined {
      if (depth > 0) return select(other, value, depth - 1);
      if (value instanceof List) { mutate(value); return value.items[0]; }
      return undefined;
    }
    const result = select(new List([token]), new Empty(), 3);
  `);
  const subject = current.storage.subjectFor(current.variable("result"));
  assert.equal(subject.kind === "resolved", true);
  const selected = current.storage.closedOriginsFor(subject.subject);
  assert.equal(selected.kind === "open", true, "a retained nominal guard does not close writable element contents");
  assert.equal(selected.boundaries.some(boundary => boundary.kind === "opaque-write"), true,
    "conditional inputs are observed without erasing the admitted writer's storage witness");
  assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("token")), true);
  assert.equal(current.storage.failureReason() === undefined, true);
});

test("an unqualified returned class value also retains opaque contained element writers", () => {
  const current = fixture(`
    class List { constructor(readonly items: {}[]) {} read(): {} { return this.items[0]; } }
    declare function mutate(value: List): void;
    const token = {};
    function select(value: List): List { mutate(value); return value; }
    const result = select(new List([token])).read();
  `);
  const subject = current.storage.subjectFor(current.variable("result"));
  assert.equal(subject.kind === "resolved", true);
  const selected = current.storage.closedOriginsFor(subject.subject);
  assert.equal(selected.kind === "open", true, `original unqualified publication (${selected.kind}; ${selected.reason ?? ""})`);
  assert.equal(selected.boundaries.some(boundary => boundary.kind === "opaque-write"), true);
});

for (const publication of ["export const published = new List([token]);",
  "const published = new List([token]); export function cached(): List { return published; }"]){
test(`real published class instances retain their exact exposed backing writers (${publication})`, () => {
    const current = fixture(`
      export class List { constructor(readonly items: {}[]) {} read(): {} { return this.items[0]; } }
      const token = {};
      ${publication}
      const result = published.read();
    `);
    const subject = current.storage.subjectFor(current.variable("result"));
    assert.equal(subject.kind === "resolved", true);
    const selected = current.storage.closedOriginsFor(subject.subject);
    assert.equal(selected.kind === "open", true);
    assert.equal(selected.boundaries.some(boundary => boundary.kind === "external-write"), true);
    assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("token")), true);
  });
}

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

for (const [name, type, value] of [
  ["array", "readonly {}[]", "[foreign]"],
  ["function", "(() => {})", "() => foreign"],
  ["structural object", "{ read(): {} }", "{ read() { return foreign; } }"],
]){
test("nominal receiver guards exclude original non-instance " + name + " allocations", () => {
    const current = fixture(`
      const token = {};
      const foreign = {};
      const fallback = {};
      class Selected { read(): {} { return token; } }
      function choose(condition: boolean): Selected | ${type} {
        return condition ? new Selected() : ${value};
      }
      function select(value: Selected | ${type}): {} {
        if (value instanceof Selected) return value.read();
        return fallback;
      }
      const result = select(choose(true));
    `);
    const origins = current.origins("result");
    assert.equal(origins.some(origin => origin.subject.node === current.initializer("token")), true,
      "the actual checked instance retains its member value");
    assert.equal(origins.some(origin => origin.subject.node === current.initializer("fallback")), true,
      "the non-instance alternative retains the real fallback");
    assert.equal(origins.some(origin => origin.subject.node === current.initializer("foreign")), false,
      "a non-instance cannot acquire the guarded class method through structural shape");
  });
}

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
  "value instanceof alias || value instanceof Derived"]){
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
  const classValues = createSourceStorageTransport(current.source, current.source.navigation.sourceFiles,
    createSourceStorageBudget(defaultSourceStorageLimits)).classLineagesFor;
  for (const limits of [{ maximumSteps: 1 }, { maximumTransportRows: 1 }]) {
    const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
    const guarded = createSourceStorageGuardedValues(current.source, budget, classValues);
    assert.equal(guarded.admits(selected.subject, receiver) === undefined, true, "no result publishes around independent exhaustion");
    assert.equal(budget.failure() !== undefined, true, "the failed proof preserves its owning resource diagnostic");
  }
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 2 });
  const guarded = createSourceStorageGuardedValues(current.source, budget, classValues);
  for (let replay = 0; replay < 100; replay += 1) {
    assert.equal(guarded.admits(selected.subject, receiver), false);
  }
  assert.equal(budget.failure() === undefined, true, "completed temporary hierarchy reservations release after every proof");
});

test("a chained primitive result retains its exact declared method without a fabricated object carrier", () => {
  const current = fixture(`
    declare global { interface String { alter(search: string, replacement: string): string; } }
    const first = "seed".alter("s", "S");
    const read = first.alter;
  `);
  const access = current.initializer("read");
  const declaration = current.source.semantics.forNode(access).operations.propertyAccess(access)?.selectedDeclaration;
  assert.equal(declaration !== undefined, true, "the original source checker selects an exact primitive method");
  const selected = current.storage.subjectFor(access);
  assert.equal(selected.kind === "resolved", true);
  const origins = current.storage.closedOriginsFor(selected.subject);
  assert.equal(origins.kind === "open" && origins.origins.length === 1 && origins.origins[0].subject.node === declaration, true,
    `exact native method provenance remains open for an external declaration without inventing a source implementation (${origins.kind}; ${origins.origins?.length ?? 0}; ${origins.reason ?? ""})`);
  assert.equal(current.storage.failureReason() === undefined, true);
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
  const type = current.storage.typeFor(selected.subject);
  assert.equal(type.kind === "resolved", true, "a checked storage type does not claim closed physical provenance");
  const incoming = current.storage.incomingFor(selected.subject);
  assert.equal(incoming.kind === "resolved" && incoming.subjects.length !== 0, true,
    "exact immediate edges do not claim closed transitive producers");
  assert.equal(current.storage.failureReason() === undefined, true, "inventory queries do not execute unknown members");
  const origins = current.storage.closedOriginsFor(selected.subject);
  assert.equal(origins.kind === "unresolved", true, "the opaque receiver has no exact allocated shape");
  assert.equal(current.storage.failureReason() === "Source storage members require exact checked correspondence.", true,
    "unavailable evidence remains an explicit failure, not an empty certificate");
});

test("constructor bindings certify missing members only for closed checked writes", () => {
  for (const [name, constructor] of [
    ["mutable", "let constructor = Scalar; constructor = Scalar;"],
    ["opaque", "declare const constructor: new () => Scalar;"],
    ["conditional", "declare const flag: boolean; declare const other: new () => Scalar; let constructor = Scalar; if (flag) constructor = other;"],
  ]) {
    const current = fixture(`
      class Base { kind: string = "base"; }
      class Scalar extends Base { readonly value: {} = {}; }
      class List extends Base { constructor(readonly items: {}) { super(); } }
      ${constructor}
      const fallback = {};
      function select(value: Base): {} {
        if (value instanceof List) return value.items;
        return fallback;
      }
      const result = select(new constructor());
    `);
    const selected = current.storage.subjectFor(current.variable("result"));
    assert.equal(selected.kind === "resolved", true, name);
    const origins = current.storage.closedOriginsFor(selected.subject);
    if (name === "mutable") {
      assert.equal(origins.kind === "complete" && origins.origins.length === 1 &&
        origins.origins[0].subject.node === current.initializer("fallback"), true,
      "the identical checked Scalar writes retain the exact fallback producer");
    } else {
      assert.equal(origins.kind === "unresolved" &&
        origins.reason === "Source storage members require exact checked correspondence.", true,
      `${name}: no exact project constructor evidence`);
    }
  }
});
