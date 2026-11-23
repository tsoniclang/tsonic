import { fixtureTypeWork, insertFixtureType, insertFixtureSignature } from "./fixtures/types-construction.mjs";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector";
import { fileURLToPath } from "node:url";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";

const expansion = { maximumDepth: 64, maximumVisits: 10000, maximumUnionMembers: 1000, maximumIntersectionMembers: 1000 };
const session = new Session();
const post = (method, parameters = {}) => new Promise((resolve, reject) => {
  session.post(method, parameters, (error, result) => error === null ? resolve(result) : reject(error));
});
let declarations;
let types;
let ids;
let definition;
let origin;
let source;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  session.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  declarations = await import("../../packages/host/dist/decls/index.js");
  types = await import("../../packages/host/dist/ir-types/index.js");
  ids = await import("../../packages/host/dist/ids/index.js");
  const module = ids.encodeModuleId({ package: ids.encodePackageId("/inventory"), path: "main.ts" });
  definition = ids.encodeDefId({ module, segments: [] });
  origin = { kind: "declared", declaration: definition };
  source = { kind: "item", value: { owner: definition, node: ids.nodeId(0) } };
});

after(async () => {
  try {
    const capture = await post("Profiler.takePreciseCoverage");
    const url = new URL("../../packages/host/dist/decls/members.js", import.meta.url);
    const result = capture.result.filter(script => script.url === url.href);
    const sources = [];
    for (const script of result) {
      const actual = await post("Debugger.getScriptSource", { scriptId: script.scriptId });
      sources.push({ scriptId: script.scriptId, url: script.url, text: actual.scriptSource });
    }
    await post("Profiler.stopPreciseCoverage");
    const report = checkCoverage({ canonical: realpathSync, readText: path => readFileSync(path, "utf8"), parse: parseSources,
      project: (scriptUrl, text) => ({ path: fileURLToPath(scriptUrl), text }) }, [fileURLToPath(url)], [{ ...capture, result, sources }]);
    const directory = new URL("../../.temp/decls-members-coverage/", import.meta.url);
    mkdirSync(directory, { recursive: true });
    writeFileSync(new URL("report.json", directory), `${JSON.stringify(report, null, 2)}\n`);
    assert.equal(result.length, 1);
    assert.equal(report.status, "passed", JSON.stringify(report.findings).slice(0, 6000));
    for (const file of report.files) {
      assert.equal(file.lines, 100);
      assert.equal(file.branches, 100);
      assert.equal(file.functions, 100);
    }
  } finally { session.disconnect(); }
});

function answer(deps, receiver) {
  const result = declarations.membersOf(deps, receiver);
  assert.equal(result.kind, "done");
  assert.equal(result.value.kind, "ok");
  assert.deepEqual(result.value.positions, [{ position: { kind: "result" }, error: null }]);
  assert.deepEqual(result.value.diagnostics, []);
  assert.deepEqual(result.value.emissions, []);
  return result.value.value;
}

test("membersOf returns only inventory metadata without reading member types, checked modules or call signature answers", () => {
  const interner = types.createTypeInterner();
  const boolean = insertFixtureType(types, interner, { kind: "primitive", primitive: "bool" });
  const call = insertFixtureSignature(types, interner, { declaration: null, owner: null, composition: null, kind: "call",
    typeParameters: [], receiver: null, parameters: [], result: boolean });
  const receiver = insertFixtureType(types, interner, { kind: "shape", members: [{ key: { kind: "text", value: "flag" },
    origins: [origin], readOrigins: [origin], writeOrigins: [], kind: "property", read: boolean, write: null,
    optional: true, readonly: true }], indexes: [{ origin: source, key: boolean, read: boolean, write: null, readonly: true }],
    calls: [call], constructs: [] });
  const term = types.readType(interner, receiver);
  const table = types.viewTypes(interner);
  const unexpected = () => { throw new Error("a typed position was read"); };
  Object.defineProperty(term.members[0], "read", { get: unexpected });
  Object.defineProperty(term.members[0], "write", { get: unexpected });
  Object.defineProperty(term.indexes[0], "read", { get: unexpected });
  Object.defineProperty(term.indexes[0], "write", { get: unexpected });
  Object.defineProperty(table.signatures, call, { get: unexpected });
  const deps = { types: interner, typeWork: fixtureTypeWork(types), get modules() { throw new Error("checked modules were read"); },
    get typeExpansion() { throw new Error("type expansion was requested"); } };
  const inventory = answer(deps, receiver);
  assert.deepEqual(inventory, { receiver, members: [{ key: { kind: "text", value: "flag" }, origins: [origin],
    readOrigins: [origin], writeOrigins: [], kind: "property", optional: true, readonly: true }],
    indexes: [{ origin: source, key: boolean, readonly: true }], calls: [call], constructs: [], accessors: [], constructors: [],
    completeness: { kind: "complete" } });
  assert.equal("read" in inventory.members[0] || "write" in inventory.members[0], false);
  assert.equal("read" in inventory.indexes[0] || "write" in inventory.indexes[0], false);
});

test("membersOf preserves callable identity and reports only genuine open parameter or dynamic reasons", () => {
  const interner = types.createTypeInterner();
  const deps = { types: interner, typeWork: fixtureTypeWork(types), modules: [], typeExpansion: expansion };
  const callable = insertFixtureType(types, interner, { kind: "callable", calls: [], constructs: [] });
  const inventory = answer(deps, callable);
  assert.deepEqual(inventory.members, []);
  assert.deepEqual(inventory.completeness, { kind: "complete" });
  for (const [term, reason] of [[{ kind: "param", parameter: definition }, { kind: "parameter", parameter: definition }],
    [{ kind: "intrinsic", intrinsic: "any" }, { kind: "dynamic" }],
    [{ kind: "intrinsic", intrinsic: "unknown" }, { kind: "dynamic" }]]) {
    const receiver = insertFixtureType(types, interner, term);
    assert.deepEqual(answer(deps, receiver).completeness, { kind: "open", reasons: [reason] });
  }
  const declared = insertFixtureType(types, interner, { kind: "declared", definition, arguments: [], facet: "instance", extent: null });
  assert.throws(() => declarations.membersOf(deps, declared), /actual retained checker inventory for declared/);
});

test("memberTypeOf reads only the requested declared structural member, without choosing a receiver representation", async () => {
  const fixture = await loadFrontFixture();
  const actual = fixture.checkedModuleOf("export type Box={flag:boolean; note:string; readonly marker:string;};");
  const alias = actual.checked.tree.statements.nodes[0];
  const receiver = alias.type.tsonic.type.value;
  const nodes = fixture.hir.indexSyntaxTree(actual.checked.tree);
  const deps = { modules: [{ module: actual.checked, nodes }], types: actual.interner, typeWork: fixtureTypeWork(types),
    get typeExpansion() { throw new Error("a closed declaration component was substituted again"); } };
  const inventory = answer(deps, receiver);
  const type = types.readType(actual.interner, receiver);
  const note = type.members.find(member => member.key.value === "note");
  assert.notEqual(note, undefined);
  Object.defineProperty(note, "read", { get() { throw new Error("an unrelated member type was demanded"); } });
  Object.defineProperty(note, "write", { get() { throw new Error("an unrelated member type was demanded"); } });
  for (const [name, expected, writable] of [["flag", { kind: "primitive", primitive: "bool" }, true],
    ["marker", { kind: "string" }, false]]) {
    const member = inventory.members.findIndex(candidate => candidate.key.value === name);
    assert.notEqual(member, -1);
    const result = declarations.memberTypeOf(deps, { receiver, member });
    assert.equal(result.kind, "done");
    assert.equal(result.value.kind, "ok");
    assert.deepEqual(result.value.positions, [{ position: { kind: "result" }, error: null }]);
    assert.deepEqual(result.value.diagnostics, []);
    assert.deepEqual(result.value.emissions, []);
    const { read, write } = result.value.value;
    assert.deepEqual(types.readType(actual.interner, read), expected);
    assert.equal(write, writable ? read : null);
  }
  for (const member of [-0, -1, 0.5, inventory.members.length])
    assert.throws(() => declarations.memberTypeOf(deps, { receiver, member }), /actual member of the receiver inventory/);
});

test("memberTypeOf does not guess an inference result, unretained association, or missing original error cause", async () => {
  const fixture = await loadFrontFixture();
  const actual = fixture.checkedModuleOf("export type Box={flag:boolean;get enabled():boolean;};");
  const alias = actual.checked.tree.statements.nodes[0];
  const receiver = alias.type.tsonic.type.value;
  const shape = types.readType(actual.interner, receiver);
  const nodes = fixture.hir.indexSyntaxTree(actual.checked.tree);
  const deps = { modules: [{ module: actual.checked, nodes }], types: actual.interner, typeWork: fixtureTypeWork(types), typeExpansion: expansion };
  const flag = shape.members.findIndex(member => member.key.value === "flag");
  const getter = shape.members.findIndex(member => member.key.value === "enabled");
  const declaration = nodes.find(node => node.kind === "PropertySignature");
  assert.equal(flag >= 0 && getter >= 0 && declaration !== undefined, true);
  const answerFor = member => {
    const source = insertFixtureType(types, actual.interner, { ...shape,
      members: shape.members.map((row, index) => index === flag ? { ...row, ...member } : row) });
    return declarations.memberTypeOf(deps, { receiver: source, member: flag });
  };
  const inferredReceiver = { ...deps, modules: [{ module: actual.checked, nodes: nodes.map(node =>
    node === declaration ? { ...node, type: null } : node) }] };
  assert.throws(() => declarations.memberTypeOf(inferredReceiver, { receiver, member: flag }), /declaration or inferred part/);
  assert.throws(() => declarations.memberTypeOf(deps, { receiver, member: getter }), /type producer for this member kind/);
  assert.throws(() => answerFor({ origins: [] }), /type producer for this member kind/);
  assert.throws(() => answerFor({ origins: [{ kind: "mapped", owner: source, key: { kind: "text", value: "flag" } }] }),
    /type producer for this member origin/);
  assert.throws(() => answerFor({ origins: [{ kind: "declared", declaration: alias.tsonic.definition }] }),
    /declaration or inferred part/);
  const error = insertFixtureType(types, actual.interner, { kind: "error" });
  assert.throws(() => answerFor({ read: error }), /error type without its actual cause/);
  assert.throws(() => answerFor({ write: error }), /error type without its actual cause/);
  const unavailable = insertFixtureType(types, actual.interner, { kind: "declared",
    definition: alias.tsonic.definition, arguments: [], facet: "instance", extent: null });
  assert.throws(() => declarations.memberTypeOf(deps, { receiver: unavailable, member: 0 }), /actual retained typed member inventory/);
  const table = types.viewTypes(actual.interner);
  const withheld = table.terms[receiver].members[flag];
  delete table.terms[receiver].members[flag];
  try {
    assert.throws(() => declarations.memberTypeOf(deps, { receiver, member: flag }), /missing from its canonical inventory/);
  } finally { table.terms[receiver].members[flag] = withheld; }
  assert.throws(() => answerFor({ read: null }), /requires its actual read type/);
});

test("memberTypeOf keeps the selected receiver binding for the same actual generic declaration member", async () => {
  const fixture = await loadFrontFixture();
  const actual = fixture.checkedModuleOf("export type Box<T>={value:T;}; export type Flag=Box<boolean>; export type Text=Box<string>;");
  const [generic, flag, text] = actual.checked.tree.statements.nodes;
  const deps = { modules: [{ module: actual.checked, nodes: fixture.hir.indexSyntaxTree(actual.checked.tree) }],
    types: actual.interner, typeWork: fixtureTypeWork(types), typeExpansion: expansion };
  const genericRow = answer(deps, generic.type.tsonic.type.value).members[0];
  const receivers = [flag.type.tsonic.type.value, text.type.tsonic.type.value];
  assert.notEqual(receivers[0], receivers[1]);
  const results = receivers.map(receiver => {
    const inventory = answer(deps, receiver);
    assert.deepEqual(inventory.members[0].origins, genericRow.origins);
    const completed = declarations.memberTypeOf(deps, { receiver, member: 0 });
    assert.equal(completed.kind, "done");
    assert.equal(completed.value.kind, "ok");
    const { read, write } = completed.value.value;
    assert.equal(read, write);
    return types.readType(actual.interner, read);
  });
  assert.deepEqual(results, [{ kind: "primitive", primitive: "bool" }, { kind: "string" }]);
});

test("membersOf projects real checked accessor origins and construct endpoints without demanding their value types", async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const actual = fixture.checkedModuleOf("export type Fields={get flag():boolean;set flag(value:boolean);new():boolean;};");
  const alias = actual.checked.tree.statements.nodes[0];
  const receiver = alias.type.tsonic.type.value;
  const nodes = fixture.hir.indexSyntaxTree(actual.checked.tree);
  const deps = { modules: [{ module: actual.checked, nodes }], types: actual.interner, typeWork: fixtureTypeWork(types), typeExpansion: expansion };
  const inventory = answer(deps, receiver);
  assert.equal(inventory.members.length, 1);
  assert.equal(inventory.accessors.length, 2);
  const getter = nodes.find(node => node.kind === "GetAccessor");
  const setter = nodes.find(node => node.kind === "SetAccessor");
  assert.equal(getter !== undefined && setter !== undefined, true);
  assert.equal(inventory.accessors.some(row => row.getter === getter.tsonic.definition && row.setter === null), true);
  assert.equal(inventory.accessors.some(row => row.setter === setter.tsonic.definition && row.getter === null), true);
  assert.equal(inventory.constructs.length, 1);
  assert.equal(inventory.constructors.length, 1);
  const constructor = nodes.find(node => node.kind === "ConstructSignature");
  assert.equal(constructor !== undefined, true);
  assert.deepEqual(inventory.constructors[0], { signature: inventory.constructs[0], declaration: constructor.tsonic.definition, body: null });
});

test("membersOf consumes construct correspondence metadata but never a constructor parameter or result type", () => {
  const interner = types.createTypeInterner();
  const boolean = insertFixtureType(types, interner, { kind: "primitive", primitive: "bool" });
  const construct = insertFixtureSignature(types, interner, { declaration: null, owner: null, composition: null, kind: "construct",
    typeParameters: [], receiver: null, parameters: [], result: boolean });
  const receiver = insertFixtureType(types, interner, { kind: "callable", calls: [], constructs: [construct] });
  const signature = types.readSignature(interner, construct);
  const unexpected = () => { throw new Error("a constructor type position was read"); };
  Object.defineProperty(signature, "parameters", { get: unexpected });
  Object.defineProperty(signature, "result", { get: unexpected });
  const inventory = answer({ types: interner, typeWork: fixtureTypeWork(types), modules: [], typeExpansion: expansion }, receiver);
  assert.deepEqual(inventory.constructors, [{ signature: construct, declaration: null, body: null }]);
});

test("membersOf rejects missing, foreign and crossed real correspondence associations instead of fabricating them", async () => {
  const fixture = await loadFrontFixture();
  const actual = fixture.checkedModuleOf("export type Fields={plain:boolean;get flag():boolean;set flag(value:boolean);new():boolean;};");
  const alias = actual.checked.tree.statements.nodes[0];
  const receiver = alias.type.tsonic.type.value;
  const term = types.readType(actual.interner, receiver);
  const nodes = fixture.hir.indexSyntaxTree(actual.checked.tree);
  const deps = { modules: [{ module: actual.checked, nodes }], types: actual.interner, typeWork: fixtureTypeWork(types), typeExpansion: expansion };
  const accessor = term.members.find(member => member.kind === "accessor");
  const property = term.members.find(member => member.kind === "property");
  assert.equal(accessor !== undefined && property !== undefined, true);
  const altered = origins => insertFixtureType(types, actual.interner, { ...term,
    members: term.members.map(member => member === accessor ? { ...member, origins } : member) });
  assert.throws(() => declarations.membersOf(deps, altered(property.origins)), /actual getter or setter declaration/);
  assert.throws(() => declarations.membersOf(deps, altered([{ kind: "mapped", owner: source, key: accessor.key }])),
    /actual checked origin correspondence/);
  assert.throws(() => declarations.membersOf(deps, altered([origin])), /module is not a checked module/);
  const getter = nodes.find(node => node.kind === "GetAccessor");
  assert.equal(getter !== undefined, true);
  const withoutGetter = { ...deps, modules: [{ module: { ...actual.checked,
    items: actual.checked.items.filter(item => item.definition !== getter.tsonic.definition) }, nodes }] };
  assert.throws(() => declarations.membersOf(withoutGetter, receiver), /actual checked declaration/);
  const wrongNode = { ...deps, modules: [{ module: actual.checked,
    nodes: nodes.map(node => node === getter ? { ...node, id: ids.nodeId(nodes.length) } : node) }] };
  assert.throws(() => declarations.membersOf(wrongNode, receiver), /actual checked declaration/);
  const constructor = nodes.find(node => node.kind === "ConstructSignature");
  assert.equal(constructor !== undefined, true);
  const withConstructor = tsonic => ({ ...deps, modules: [{ module: actual.checked,
    nodes: nodes.map(node => node === constructor ? { ...node, tsonic } : node) }] });
  assert.throws(() => declarations.membersOf(withConstructor(null), receiver), /actual checked endpoint/);
  assert.throws(() => declarations.membersOf(withConstructor(property.tsonic ?? {}), receiver), /actual checked endpoint/);
  assert.throws(() => declarations.membersOf(withConstructor({ ...constructor.tsonic, signatures: [] }), receiver),
    /one agreeing actual body association/);
  const otherBody = actual.checked.bodies[0].body;
  assert.throws(() => declarations.membersOf(withConstructor({ ...constructor.tsonic, signatures: [
    ...constructor.tsonic.signatures, { ...constructor.tsonic.signatures[0], body: otherBody }] }), receiver),
  /one agreeing actual body association/);
  const boolean = insertFixtureType(types, actual.interner, { kind: "primitive", primitive: "bool" });
  const call = insertFixtureSignature(types, actual.interner, { declaration: null, owner: null, composition: null, kind: "call",
    typeParameters: [], receiver: null, parameters: [], result: boolean });
  const wrongKind = insertFixtureType(types, actual.interner, { kind: "callable", calls: [], constructs: [call] });
  assert.throws(() => declarations.membersOf(deps, wrongKind), /actual construct signature/);
});
