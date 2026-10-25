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

async function inheritedNativeMemberFixture(name, body, admitted = true) {
  const checked = await checkedSource(name, {
    "globals.d.ts": `
      interface Object {} interface Function {} interface CallableFunction extends Function {}
      interface NewableFunction extends Function {} interface IArguments {} interface Boolean {}
      interface Number {} interface String {} interface RegExp {}
      interface Array<T> { [index: number]: T; length: number; }
      interface ReadonlyArray<T> { readonly [index: number]: T; readonly length: number; }
      ${sourceErrorDeclarations}
    `,
    "src/index.ts": `export {}; ${body} const created = new Retained(); const observed = created.message;`,
  });
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics, "/src"));
  const source = createTargetSourceProgram(checked);
  const file = projectSourceFile(source, "src/index.ts");
  const globals = projectSourceFile(source, "globals.d.ts");
  const error = namedDeclaration(source.ast, globals, "Error");
  const owner = namedDeclaration(source.ast, globals, "ErrorConstructor");
  const constructors = source.ast.members(owner).filter(source.ast.is.IsConstructSignatureDeclaration);
  const effects = createSourceGlobalCallStorageEffects(source, () => undefined, declaration =>
    admitted && constructors.includes(declaration)
      ? jsSourceNativeConstructorStorage({ ownerName: "ErrorConstructor", memberName: "constructor", declaration }) : undefined);
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const transport = createSourceStorageTransport(source, source.navigation.sourceFiles, budget, effects);
  const invocation = Node_Initializer(source.ast, namedVariable(source.ast, file, "created"));
  const lineages = transport.constructionLineagesFor(invocation, undefined, "heritage");
  const field = source.ast.members(error).find(member => source.ast.text(source.ast.name(member)) === "message");
  const destination = source.semantics.forNode(error).declarations.declaredType(error);
  assert.equal(field !== undefined && destination !== undefined, true, "the actual checked native member and instance contract");
  return { source, file, budget, transport, lineages, field, destination, constructors };
}

for (const [name, body, overrides] of [
  ["native base", `class Retained extends Error { constructor() { super("original"); this.message = "changed"; } }`, false],
  ["project intermediate", `class Middle extends Error {} class Retained extends Middle {
    constructor() { super("original"); this.message = "changed"; }
  }`, false],
  ["generic project intermediate", `class Middle<T> extends Error { constructor(readonly value: T) { super("original"); } }
    class Retained extends Middle<number> { constructor() { super(1); this.message = "changed"; } }`, false],
  ["source override", `class Retained extends Error { message = "own"; }`, true],
]) test(`native member lineage retains exact physical ownership through ${name}`, async () => {
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
  assert.equal(transport.memberFlow.membersInLineage({ ...lineage, complete: false }, current.field, current.destination), undefined,
    "incomplete inheritance is not a native storage proof");
  if (!overrides) {
    assert.equal(transport.memberFlow.membersInLineage({ ...lineage, nativeBase: undefined }, current.field, current.destination), undefined,
      "a member's presence in a derived type is not sufficient without the original native constructor");
    assert.equal(transport.memberFlow.membersInLineage({ ...lineage,
      nativeBase: { ...lineage.nativeBase, constructors: [] } }, current.field, current.destination), undefined,
    "missing selected native signatures cannot become an empty physical owner");
    const constructor = source.ast.members(retained).find(source.ast.is.IsConstructorDeclaration);
    if (constructor !== undefined) assert.equal(transport.memberFlow.membersInLineage({ ...lineage,
      nativeBase: { ...lineage.nativeBase, constructors: [constructor] } }, current.field, current.destination), undefined,
    "an ordinary constructor body is not a native construct-signature return contract");
  }
  assert.equal(current.budget.failure(), undefined, "original finite work accounting remains active");
});

test("unregistered native construction never supplies a physical inherited member guarantee", async () => {
  const current = await inheritedNativeMemberFixture("unregistered-native-member-lineage",
    `class Retained extends Error { constructor() { super("original"); this.message = "changed"; } }`, false);
  assert.equal(current.lineages?.length, 1, "the original project inheritance remains observable");
  const lineage = current.lineages[0];
  assert.equal(lineage.complete, false, "an opaque constructor cannot prove the native terminal");
  assert.equal(lineage.nativeBase, undefined, "no native proof is manufactured from declared shape");
  assert.equal(current.transport.memberFlow.membersInLineage(lineage, current.field, current.destination), undefined,
    "unknown construction stays unresolved, not empty or writable");
});

test("native member lineage refuses foreign selected signatures and an exhausted original budget", async () => {
  const body = `class Retained extends Error { constructor() { super("original"); this.message = "changed"; } }`;
  const current = await inheritedNativeMemberFixture("native-member-lineage-foreign-current", body);
  const foreign = await inheritedNativeMemberFixture("native-member-lineage-foreign-other", body);
  const lineage = current.lineages[0];
  assert.equal(current.transport.memberFlow.membersInLineage({ ...lineage,
    nativeBase: { ...lineage.nativeBase, constructors: foreign.constructors } }, current.field, current.destination), undefined,
  "a foreign checked signature cannot prove this physical native declaration");
  current.budget.reject("test original finite refusal");
  assert.equal(current.transport.memberFlow.membersInLineage(lineage, current.field, current.destination), undefined,
    "existing finite exhaustion dominates otherwise valid native correspondence");
  assert.equal(current.budget.failure(), "test original finite refusal", "the original exact refusal is unchanged");
});

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
    const boundaries = result.boundaries?.slice(0, 8).map(boundary =>
      `${boundary.kind}:${source.ast.text(source.ast.name(boundary.subject.node))}:${boundary.subject.kind}:${source.ast.kindName(boundary.exposure)}`);
    assert.equal(result.kind === "complete", true, `${name}: complete selected member evidence (${result.kind}; ${result.reason ?? ""}; ${boundaries?.join(",") ?? ""})`);
    assert.equal(storage.failureReason() === undefined, true, `${name}: no missing owner evidence`);
    return result.origins;
  };
  return { source, storage, variable, initializer, origins };
}

for (const [name, writes, expected] of [
  ["uninitialized", "", ["fallback"]],
  ["direct write", "missing.callback = replacement;", ["fallback", "replacement"]],
  ["aliased write", "const alias = missing; alias.callback = replacement;", ["fallback", "replacement"]],
]) test(`contextual optional physical slots retain ${name} absence without inventing a value`, () => {
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

for (const computed of [false, true]) {
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

for (const recursion of [false, true]) for (const selection of ["return value.items[0];", "const items = value.items; return items[0];"]) {
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

for (const selection of [
  "return value instanceof List ? value as List : undefined;",
  "if (value instanceof List) return value; return undefined;",
  "if (!(value instanceof List)) return undefined; return value;",
]) {
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

for (const absence of ["null", "undefined"]) {
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
]) {
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

for (const input of ["value: Base", "[value]: [Base]"]) {
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

for (const mutable of [false, true]) {
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
  "const published = new List([token]); export function cached(): List { return published; }"]) {
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
    "exact native method provenance remains open for an external declaration without inventing a source implementation");
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
