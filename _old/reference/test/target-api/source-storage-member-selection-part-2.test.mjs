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
import { inheritedNativeMemberFixture, fixture } from "./source-storage-member-selection-fixtures.mjs";

for (const access of ["value.items", 'value["items"]']){
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

for (const recursion of [false, true]){
for (const selection of ["return value.items[0];", "const items = value.items; return items[0];"]){
test(`nominal guards remain on the receiver when its selected field is projected (${recursion ? "recursive" : "direct"}; ${selection})`, () => {
    const current = fixture(`
      class Base {}
      class Empty extends Base {}
      class List extends Base { constructor(readonly items: readonly {}[]) { super(); } }
      const token = {};
      function parse(mode: boolean): Base { return mode ? new List([token]) : new Empty(); }
      function select(value: Base, depth = 0): {} | undefined {
        ${recursion ? "if (depth > 0) return select(value, depth - 1);" : ""}
        if (value instanceof Empty) { const visited = value; }
        if (value instanceof List) { ${selection} }
        return undefined;
      }
      const result = select(parse(true));
    `);
    assert.equal(current.origins("result").some(origin => origin.subject.node === current.initializer("token")), true,
      "the checked receiver guard precedes the independent stored-element projection");
  });
}
}

for (const selection of [
  "return value instanceof List ? value as List : undefined;",
  "if (value instanceof List) return value; return undefined;",
  "if (!(value instanceof List)) return undefined; return value;",
]){
test(`nominal selection survives a returned value before its method receiver (${selection})`, () => {
    const current = fixture(`
      class Base { kind: string = "base"; }
      const foreign = {};
      class Scalar extends Base { readonly value: {} = foreign; }
      class List extends Base {
        constructor(readonly items: {}[]) { super(); }
        read(): {} { return this.items[0]; }
      }
      const token = {};
      function parse(mode: boolean): Base { return mode ? new List([token]) : new Scalar(); }
      function select(value: Base): List | undefined { ${selection} }
      const selected = select(parse(true));
      const result = selected!.read();
    `);
    const origins = current.origins("result");
    assert.equal(origins.some(origin => origin.subject.node === current.initializer("token")), true);
    assert.equal(origins.some(origin => origin.subject.node === current.initializer("foreign")), false);
  });
}

for (const absence of ["null", "undefined"]){
test(`a returned ${absence} alternative retains completed receiver exclusion without inventing a value`, () => {
    const current = fixture(`
      class List {
        constructor(readonly items: readonly {}[]) {}
        read(): {} { return this.items[0]; }
      }
      const token = {};
      function select(value: List, keep: boolean): List | null | undefined { return keep ? value : ${absence}; }
      const selected = select(new List([token]), true);
      const result = selected!.read();
    `);
    const origins = current.origins("result");
    assert.equal(origins.length === 1 && origins[0].subject.node === current.initializer("token"), true,
      "the exact receiver's element is retained without a nullish or fabricated method result");
  });
}

for (const [name, recursion, helpers] of [
  ["rotated tuple", "select(other, value, depth - 1)", ""],
  ["mutual rotated tuple", "bridge(other, value, depth - 1)",
    "function bridge(value: Base, other: Base, depth: number): {} | undefined { return select(value, other, depth); }"],
  ["captured rotated tuple", "nest(() => select(other, value, depth - 1), depth)()",
    "function nest(read: () => {} | undefined, depth: number): () => {} | undefined { return depth <= 0 ? read : nest(() => read(), depth - 1); }"],
]){
test(`selected nominal receiver constraints survive symbolic ${name} continuation`, () => {
    const current = fixture(`
      class Base {}
      class Empty extends Base {}
      class List extends Base { constructor(readonly items: readonly {}[]) { super(); } }
      const token = {};
      function select(value: Base, other: Base, depth: number): {} | undefined {
        if (depth > 0) return ${recursion};
        if (value instanceof List) { const items = value.items; return items[0]; }
        return undefined;
      }
      ${helpers}
      const result = select(new List([token]), new Empty(), 3);
    `);
    assert.equal(current.origins("result").some(origin => origin.subject.node === current.initializer("token")), true,
      "concrete equation expansion must apply the retained checked receiver guard before selecting its field");
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
