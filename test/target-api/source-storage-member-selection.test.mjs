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

for (const [name, body, overrides] of [
  ["native base", `class Retained extends Error { constructor() { super("original"); this.message = "changed"; } }`, false],
  ["project intermediate", `class Middle extends Error {} class Retained extends Middle {
    constructor() { super("original"); this.message = "changed"; }
  }`, false],
  ["generic project intermediate", `class Middle<T> extends Error { constructor(readonly value: T) { super("original"); } }
    class Retained extends Middle<number> { constructor() { super(1); this.message = "changed"; } }`, false],
  ["source override", `class Retained extends Error { message = "own"; }`, true],
]){
test(`native member lineage retains exact physical ownership through ${name}`, async () => {
  const current = await inheritedNativeMemberFixture(`native-member-lineage-${name.replaceAll(" ", "-")}`, body);
  const { source, transport, lineages } = current;
  assert.equal(lineages?.length, 1, "one actual construction alternative");
  const lineage = lineages[0];
  assert.equal(lineage.complete, true, "all project inheritance and the selected native terminal are checked");
  assert.equal(lineage.classes.every(value => source.navigation.isProjectDeclaration(value.subject.node)), true,
    "native construction is not inserted into project body execution");
  assert.equal(lineage.nativeBase !== undefined && lineage.nativeBase.constructors.length === current.constructors.length &&
    lineage.nativeBase.constructors.every(declaration => current.constructors.includes(declaration)), true,
  "the exact original selected native signatures are retained without an invented source body");
  assert.equal(Object.isFrozen(lineage) && Object.isFrozen(lineage.nativeBase), true, "immutable one-owner lineage evidence");
  const selected = transport.memberFlow.membersInLineage(lineage, current.field, current.destination);
  assert.equal(selected !== undefined && !selected.absent && selected.members.length === 1, true,
    "the actual native or overridden physical declaration is proven, not closed-empty");
  const retained = namedDeclaration(source.ast, current.file, "Retained");
  const original = overrides ? source.ast.members(retained).find(member => source.ast.text(source.ast.name(member)) === "message")
    : current.field;
  assert.equal(selected.members[0].declaration === original, true, "source overriding wins; otherwise retain the exact native original");
  assert.equal(selected.members[0].bindings === (overrides ? lineage.classes[0].bindings : lineage.nativeBase.bindings), true,
    "the chosen physical owner retains its actual captured binding context");
  assert.equal(transport.memberFlow.membersInLineage({ ...lineage, complete: false }, current.field, current.destination) === undefined, true,
    "incomplete inheritance is not a native storage proof");
  if (!overrides) {
    assert.equal(transport.memberFlow.membersInLineage({ ...lineage, nativeBase: undefined }, current.field, current.destination) === undefined, true,
      "a member's presence in a derived type is not sufficient without the original native constructor");
    assert.equal(transport.memberFlow.membersInLineage({ ...lineage,
      nativeBase: { ...lineage.nativeBase, constructors: [] } }, current.field, current.destination) === undefined, true,
    "missing selected native signatures cannot become an empty physical owner");
    const constructor = source.ast.members(retained).find(source.ast.is.IsConstructorDeclaration);
    if (constructor !== undefined) assert.equal(transport.memberFlow.membersInLineage({ ...lineage,
      nativeBase: { ...lineage.nativeBase, constructors: [constructor] } }, current.field, current.destination) === undefined, true,
    "an ordinary constructor body is not a native construct-signature return contract");
  }
  assert.equal(current.budget.failure(), undefined, "original finite work accounting remains active");
});
}

test("unregistered native construction never supplies a physical inherited member guarantee", async () => {
  const current = await inheritedNativeMemberFixture("unregistered-native-member-lineage",
    `class Retained extends Error { constructor() { super("original"); this.message = "changed"; } }`, false);
  assert.equal(current.lineages?.length, 1, "the original project inheritance remains observable");
  const lineage = current.lineages[0];
  assert.equal(lineage.complete, false, "an opaque constructor cannot prove the native terminal");
  assert.equal(lineage.nativeBase === undefined, true, "no native proof is manufactured from declared shape");
  assert.equal(current.transport.memberFlow.membersInLineage(lineage, current.field, current.destination) === undefined, true,
    "unknown construction stays unresolved, not empty or writable");
});

test("native member lineage refuses foreign selected signatures and an exhausted original budget", async () => {
  const body = `class Retained extends Error { constructor() { super("original"); this.message = "changed"; } }`;
  const current = await inheritedNativeMemberFixture("native-member-lineage-foreign-current", body);
  const foreign = await inheritedNativeMemberFixture("native-member-lineage-foreign-other", body);
  const lineage = current.lineages[0];
  assert.equal(current.transport.memberFlow.membersInLineage({ ...lineage,
    nativeBase: { ...lineage.nativeBase, constructors: foreign.constructors } }, current.field, current.destination) === undefined, true,
  "a foreign checked signature cannot prove this physical native declaration");
  assert.equal(current.transport.memberFlow.membersInLineage({ ...lineage,
    nativeBase: { ...lineage.nativeBase, constructors: [...lineage.nativeBase.constructors, ...foreign.constructors] } },
  current.field, current.destination) === undefined, true,
  "every selected native signature must prove the same declaration, not merely the first signature");
  current.budget.reject("test original finite refusal");
  assert.equal(current.transport.memberFlow.membersInLineage(lineage, current.field, current.destination) === undefined, true,
    "existing finite exhaustion dominates otherwise valid native correspondence");
  assert.equal(current.budget.failure(), "test original finite refusal", "the original exact refusal is unchanged");
});

test("ordinary implicit and explicit absent declarations select only the actual default producer", () => {
  const current = fixture(`
    const fallback = {};
    let implicit: object | undefined;
    let explicit: object | undefined = undefined;
    function select(value: object | undefined = fallback): object { return value; }
    const implicitResult = select(implicit);
    const explicitResult = select(explicit);
  `);
  for (const name of ["implicitResult", "explicitResult"]) {
    const origins = current.origins(name);
    assert.equal(origins.length === 1 && origins[0].subject.node === current.initializer("fallback"), true,
      `${name}: absence invokes the exact default without a fabricated declaration allocation`);
  }
});

test("implicit initial absence retains every actual direct and captured write producer", () => {
  const current = fixture(`
    const first = {}; const second = {}; const unrelated = {};
    let value: object | undefined;
    value = first;
    function replace(): void { value = second; }
    replace();
    const result = value;
  `);
  const origins = current.origins("result");
  assert.equal(origins.length === 2 && ["first", "second"].every(name =>
    origins.some(origin => origin.subject.node === current.initializer(name))), true,
    "all real writes remain in the same physical storage family without an unrelated producer");
  assert.equal(origins.some(origin => origin.subject.node === current.initializer("unrelated")), false,
    "a complete absent initial state cannot admit an unrelated allocation");
});

test("implicit declaration absence and captured writes remain correlated per owning activation", () => {
  const current = fixture(`
    function retain(input: object): object | undefined {
      let value: object | undefined;
      const write = (): void => { value = input; };
      write();
      return value;
    }
    const left = {}; const right = {};
    const first = retain(left); const second = retain(right);
  `);
  for (const [result, input] of [["first", "left"], ["second", "right"]]) {
    const origins = current.origins(result);
    assert.equal(origins.length === 1 && origins[0].subject.node === current.initializer(input), true,
      `${result}: the creator's initial absence cannot merge independent invocation allocations`);
  }
});

test("ambient and declaration-file bindings never become closed implicit local absence", () => {
  const current = fixture(`
    declare let external: object | undefined;
    declare namespace Foreign { let ambientMember: object | undefined; }
    const first = external; const second = Foreign.ambientMember; const third = fromFile;
  `, { "/src/input.d.ts": "declare let fromFile: object | undefined;" });
  for (const name of ["external", "ambientMember", "fromFile"]) {
    const declaration = current.storage.nodes.find(node => current.source.ast.is.IsVariableDeclaration(node) &&
      current.source.ast.text(current.source.ast.name(node)) === name);
    assert.equal(declaration !== undefined, true, `${name}: the original external declaration is checked`);
    const selected = current.storage.subjectFor(declaration);
    assert.equal(selected.kind, "resolved", `${name}: external identity is not fabricated`);
    const origins = current.storage.closedOriginsFor(selected.subject);
    assert.equal(origins.kind === "open" || origins.kind === "unresolved" && typeof origins.reason === "string" && origins.reason.length > 0, true,
      `${name}: missing external producer evidence remains open or precisely unresolved`);
  }
});

for (const [name, writes, expected] of [
  ["uninitialized", "", ["fallback"]],
  ["direct write", "missing.callback = replacement;", ["fallback", "replacement"]],
  ["aliased write", "const alias = missing; alias.callback = replacement;", ["fallback", "replacement"]],
]){
test(`contextual optional physical slots retain ${name} absence without inventing a value`, () => {
  const current = fixture(`
    const fallback = () => 1; const replacement = () => 2;
    const missing: { callback?: () => number } = {};
    ${writes}
    function select(value: (() => number) | undefined = fallback) { return value; }
    const result = select(missing.callback);
  `);
  const origins = current.origins("result");
  assert.equal(origins.length === expected.length && expected.every(name =>
    origins.some(origin => origin.subject.node === current.initializer(name))), true,
  `${name}: only the actual default and original written callables are possible`);
});
}

test("a physically present contextual optional initializer does not invent a default", () => {
  const current = fixture(`
    const fallback = () => 1; const original = () => 2;
    const present: { callback?: () => number } = { callback: original };
    function select(value: (() => number) | undefined = fallback) { return value; }
    const result = select(present.callback);
  `);
  const origins = current.origins("result");
  assert.equal(origins.length === 1 && origins[0].subject.node === current.initializer("original"), true,
    "a checked present field supplies its original callable, never the unrelated fallback");
});

test("checked setter metadata admits its exact physical write while retaining the read refusal", () => {
  const current = fixture(`
    interface Destination { value: () => number; }
    const actual = { set value(next: () => number) {} };
    const destination: Destination = actual;
  `);
  const { source } = current;
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const transport = createSourceStorageTransport(source, source.navigation.sourceFiles, budget);
  const allocation = current.initializer("actual");
  const subject = transport.subjectFor(allocation);
  assert.equal(subject !== undefined, true, "the receiver is the original checked allocation");
  const semantics = source.semantics.forNode(current.variable("destination"));
  const type = semantics.declarations.declaredValueType(current.variable("destination"));
  const properties = semantics.types.propertyInfos(type);
  assert.equal(properties.length, 1, "the actual interface has one exact selected member");
  const declarations = semantics.declarations.symbolDeclarations(properties[0].symbol);
  assert.equal(declarations.length, 1, "the selected declaration belongs to the checked destination");
  const setter = source.ast.properties(allocation)[0];
  assert.equal(source.ast.is.IsSetAccessorDeclaration(setter), true, "the physical original is setter-only");
  const scope = Object.freeze({ kind: "frame", entries: new Map(), parents: Object.freeze([]) });
  const receiver = Object.freeze({ kind: "leaf", subject, scope });
  const physicalMembers = createSourceStoragePhysicalMembers(source, budget, transport, {
    symbolic: () => false,
    read: () => assert.fail("a checked literal receiver does not require constructor supplier evidence"),
    lineages: () => assert.fail("a checked literal receiver does not invent construction lineages"),
  });
  let write;
  for (const mode of ["read", "write", "read", "write"]) {
    const selected = physicalMembers(receiver, declarations[0], type, mode, subject);
    assert.equal(selected?.kind, "known", `${mode}: physical correspondence completes`);
    assert.equal(selected.absent || selected.excluded, false, `${mode}: a setter is not an absent or excluded field`);
    if (mode === "read") {
      assert.equal(selected.members.length, 0, "a setter cannot supply a physical read");
      assert.equal(selected.reason, "Source storage correspondence does not provide the actual checked member operation mode.");
    } else {
      assert.equal(selected.reason === undefined && selected.members.length === 1 &&
        selected.members[0].subject.node === setter && selected.members[0].bindings === scope, true,
      "the original setter and exact receiver scope own the write");
      if (write !== undefined) assert.equal(selected.members[0].subject === write, true,
        "alternating read refusal never changes the canonical physical write subject");
      write = selected.members[0].subject;
    }
  }
  assert.equal(budget.failure() === undefined, true, "metadata and mode admission retain the existing finite guards");
});

test("physical exclusion remains explicit when a completed alternative grows alongside a productive one", () => {
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const subject = createSourceStorageSubjects(budget.subject, budget.reject);
  const allocation = {}, operand = {}, included = {}, excluded = {}, declaration = {}, contract = {};
  const scope = Object.freeze({ kind: "frame", entries: new Map(), parents: Object.freeze([]) });
  const receiver = Object.freeze({ kind: "leaf", subject: subject(allocation), scope });
  const selected = Object.freeze({ kind: "leaf", subject: subject(included), scope });
  const rejected = Object.freeze({ kind: "leaf", subject: subject(excluded), scope });
  const suppliers = new Set();
  let available = true;
  let complete = true;
  const source = {
    ast: { is: { IsNewExpression: node => node === allocation,
      IsClassDeclaration: node => node === included || node === excluded, IsClassExpression: () => false,
      IsTypeLiteralNode: () => false, IsObjectLiteralExpression: () => false,
      IsPropertyDeclaration: () => false, IsPropertySignatureDeclaration: () => false,
      IsPropertyAssignment: () => false, IsShorthandPropertyAssignment: () => false,
      IsSetAccessorDeclaration: () => false, IsGetAccessorDeclaration: () => false },
      parent: node => node === declaration ? included : undefined, kindName: () => "test-member" },
    navigation: { isProjectDeclaration: () => true },
    semantics: { forNode: () => ({ declarations: { declaredType: () => contract } }) },
  };
  const transport = { subject, invocationImplementations: () => new Set([included]),
    invocationTargets: new Map([[allocation, subject(operand)]]), memberFlow: {
      membersInLineage(lineage) {
        return { members: lineage.classes[0].subject.node === included ? [{ declaration, bindings: scope }] : [], absent: false };
      },
    } };
  const physicalMembers = createSourceStoragePhysicalMembers(source, budget, transport, {
    symbolic: () => false,
    read: request => {
      assert.equal(request.subject === subject(operand) && request.scope === scope, true, "the exact constructor supplier is selected");
      return available ? suppliers : undefined;
    },
    lineages: value => [{ classes: [{ subject: value.subject, bindings: value.scope }], complete,
      implementation: undefined, nativeBase: undefined }],
  });
  const select = () => physicalMembers(receiver, declaration, contract, "read", receiver.subject);
  assert.equal(select()?.kind === "pending", true, "an unfinished empty supplier set has no exclusion proof");
  suppliers.add(rejected);
  const onlyExcluded = select();
  assert.equal(onlyExcluded?.kind === "known" && onlyExcluded.excluded && !onlyExcluded.absent &&
    onlyExcluded.members.length === 0 && onlyExcluded.reason === undefined, true, "one completed excluded alternative is explicit");
  suppliers.add(selected);
  const mixed = select();
  assert.equal(mixed?.kind === "known" && mixed.excluded && mixed.members.length === 1 &&
    mixed.members[0].subject.node === declaration && mixed.members[0].bindings === scope, true,
  "the excluded branch survives alongside the exact productive branch, without retracting its proof");
  complete = false;
  const incomplete = select();
  assert.equal(incomplete?.kind === "known" && !incomplete.excluded && incomplete.reason !== undefined, true,
    "incomplete lineages never become excluded alternatives");
  available = false;
  assert.equal(select() === undefined, true, "missing supplier evidence is not empty proof");
  assert.equal(budget.failure() === undefined, true, "ordinary finite guards remain enabled");
});

for (const computed of [false, true]){
test(`contextual optional native slots retain independent physical writers (${computed ? "computed" : "named"})`, () => {
    const access = owner => computed ? `${owner}["item"]` : `${owner}.item`;
    const current = fixture(`
      interface Slot { item?: {}; }
      const left = {}; const right = {};
      const first: Slot = {}; const second: Slot = {};
      ${access("first")} = left;
      ${access("second")} = right;
      const seenFirst = ${access("first")};
      const seenSecond = ${access("second")};
    `);
    for (const [name, original, excluded] of [["seenFirst", "left", "right"], ["seenSecond", "right", "left"]]) {
      const origins = current.origins(name);
      assert.equal(origins.some(origin => origin.subject.node === current.initializer(original)), true, "the selected writer remains exact");
      assert.equal(origins.some(origin => origin.subject.node === current.initializer(excluded)), false, "the same interface does not merge receiver allocations");
    }
  });
}

test("contextual optional slots preserve authored getter implementations", () => {
  const current = fixture(`
    interface Slot { item?: {}; readonly original: {}; }
    const token = {}; const assigned = {};
    const holder: Slot = { get original() { return token; } };
    holder.item = assigned;
    const result = holder.original;
  `);
  const origins = current.origins("result");
  assert.equal(origins.some(origin => origin.subject.node === current.initializer("token")), true,
    "contextual declarations do not replace an existing accessor body");
});

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
