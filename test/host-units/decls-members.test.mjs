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
    const result = declarations.memberTypeOf(deps, { receiver, member, access: "read-write" });
    assert.equal(result.kind, "done");
    assert.equal(result.value.kind, "ok");
    assert.deepEqual(result.value.positions, [{ position: { kind: "result" }, error: null }]);
    assert.deepEqual(result.value.diagnostics, []);
    assert.deepEqual(result.value.emissions, []);
    const { access, read, write } = result.value.value;
    assert.equal(access, "read-write");
    assert.deepEqual(types.readType(actual.interner, read), expected);
    assert.equal(write, writable ? read : null);
  }
  const readonly = inventory.members.findIndex(candidate => candidate.key.value === "marker");
  const unwritable = declarations.memberTypeOf(deps, { receiver, member: readonly, access: "write" }).value;
  assert.equal(unwritable.kind, "ok");
  assert.deepEqual(unwritable.value, { access: "write", write: null });
  for (const member of [-0, -1, 0.5, inventory.members.length])
    assert.throws(() => declarations.memberTypeOf(deps, { receiver, member, access: "read" }), /actual member of the receiver inventory/);
  assert.throws(() => declarations.memberTypeOf(deps, { receiver, member: 0 }), /requires its exact access/);
});

test("memberTypeOf does not guess an inference result, unretained association, or missing original error cause", async () => {
  const fixture = await loadFrontFixture();
  const actual = fixture.checkedModuleOf("export type Box={flag:boolean;};");
  const alias = actual.checked.tree.statements.nodes[0];
  const receiver = alias.type.tsonic.type.value;
  const shape = types.readType(actual.interner, receiver);
  const nodes = fixture.hir.indexSyntaxTree(actual.checked.tree);
  const deps = { modules: [{ module: actual.checked, nodes }], types: actual.interner, typeWork: fixtureTypeWork(types), typeExpansion: expansion };
  const flag = shape.members.findIndex(member => member.key.value === "flag");
  const declaration = nodes.find(node => node.kind === "PropertySignature");
  assert.equal(flag >= 0 && declaration !== undefined, true);
  const answerFor = member => {
    const source = insertFixtureType(types, actual.interner, { ...shape,
      members: shape.members.map((row, index) => index === flag ? { ...row, ...member } : row) });
    return declarations.memberTypeOf(deps, { receiver: source, member: flag, access: "read-write" });
  };
  const inferredReceiver = { ...deps, modules: [{ module: actual.checked, nodes: nodes.map(node =>
    node === declaration ? { ...node, type: null } : node) }] };
  assert.throws(() => declarations.memberTypeOf(inferredReceiver, { receiver, member: flag, access: "read" }), /declaration or inferred part/);
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
  assert.throws(() => declarations.memberTypeOf(deps, { receiver: unavailable, member: 0, access: "read" }), /actual retained typed member inventory/);
  const table = types.viewTypes(actual.interner);
  const withheld = table.terms[receiver].members[flag];
  delete table.terms[receiver].members[flag];
  try {
    assert.throws(() => declarations.memberTypeOf(deps, { receiver, member: flag, access: "read" }), /missing from its canonical inventory/);
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
    const completed = declarations.memberTypeOf(deps, { receiver, member: 0, access: "read-write" });
    assert.equal(completed.kind, "done");
    assert.equal(completed.value.kind, "ok");
    const { read, write } = completed.value.value;
    assert.equal(read, write);
    return types.readType(actual.interner, read);
  });
  assert.deepEqual(results, [{ kind: "primitive", primitive: "bool" }, { kind: "string" }]);
});

test("source environment accesses open only their qualified intrinsic or declared origin", async () => {
  const fixture = await loadFrontFixture();
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const input = analysisInput(fixture, "sdk-minimal", "export type Environment = typeof globalThis;");
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok", JSON.stringify(captured.diagnostics));
  const { modules, types: interner, typeWork, interfaceDescriptionOf } = captured.value;
  const { module } = modules.find(row => row.module.module === input.snapshot.entryPoint);
  const receiver = module.tree.statements.nodes[0].type.tsonic.type.value;
  const deps = { modules, types: interner, typeWork, interfaceDescriptionOf, typeExpansion: expansion };
  const term = types.readType(interner, receiver);
  assert.equal(term.kind, "source-environment");
  const select = (name, access, opposite) => {
    const member = term.members.findIndex(row => row.key.kind === "text" && row.key.value === name);
    const row = term.members[member];
    assert.ok(row);
    const original = Object.getOwnPropertyDescriptor(row, opposite);
    Object.defineProperty(row, opposite, { get() { assert.fail("the unrequested origin must stay unopened"); } });
    try {
      const value = declarations.memberTypeOf(deps, { receiver, member, access }).value;
      assert.equal(value.kind, "ok");
      assert.deepEqual(Object.keys(value.value), ["access", access]);
      return { row, type: value.value[access] };
    } finally { Object.defineProperty(row, opposite, original); }
  };
  assert.equal(select("globalThis", "read", "writeOrigins").type, receiver);
  const absence = select("undefined", "read", "writeOrigins");
  assert.deepEqual(types.readType(interner, absence.type), { kind: "intrinsic", intrinsic: "absence" });
  assert.equal(select("undefined", "write", "readOrigins").type, absence.row.readonly ? null : absence.type);
  let actual;
  for (const [access, opposite] of [["read", "writeOrigins"], ["write", "readOrigins"]]) {
    const selected = select("Symbol", access, opposite);
    assert.equal(selected.row.readonly, false);
    const [origin] = selected.row[access === "read" ? "readOrigins" : "writeOrigins"];
    assert.equal(origin.kind, "declared");
    const owner = fixture.ids.decodeDefId(origin.declaration).value.module;
    const declared = modules.find(row => row.module.module === owner);
    const { node } = declared.module.items.find(row => row.definition === origin.declaration);
    const checked = declared.nodes[node];
    assert.equal(checked.kind, "VariableDeclaration");
    assert.equal(checked.tsonic.declaredType.kind, "available");
    assert.equal(selected.type, checked.tsonic.declaredType.value);
    if (access === "read") actual = selected.type;
    else assert.equal(selected.type, actual);
  }
});

test("a checked interface member opens only its requested value arms under the original publication account", async tester => {
  const fixture = await loadFrontFixture();
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { pipelineWiring } = await import("../../packages/host/dist/pipeline/wiring.js");
  const { usedPublicationWork } = await import("../../packages/host/dist/ir-types/work.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    interface Holder<T> { value: T }
    interface Holder<T> { readonly unused: T }
    export type Bound = Holder<boolean>;
  `);
  let current;
  const capture = pipelineWiring.front.captureModules;
  tester.mock.method(pipelineWiring.front, "captureModules", (...args) => {
    const result = capture(...args);
    if (result.kind !== "ok") return result;
    const raw = result.value.find(row => row.module === input.snapshot.entryPoint);
    assert.equal(raw.types.interfaceDescriptions.length, 1);
    const { shape } = raw.types.interfaceDescriptions[0];
    const inventory = raw.types.members[raw.types.types[shape].form.value.inventory];
    const target = inventory.members.find(member => member.name === "value");
    const unused = inventory.members.find(member => member.name === "unused");
    for (const role of ["read", "write"]) {
      const value = target[role];
      Object.defineProperty(target, role, { get() {
        assert.ok(current.work !== undefined, "source capture must not open the selected value");
        current.observed.push([role, usedPublicationWork(current.work)]);
        return value;
      } });
      Object.defineProperty(unused, role, { get() { assert.fail("another member's value must stay unopened"); } });
    }
    return result;
  });
  const select = (access, maximumWork = input.limits.instantiation.maximumWork) => {
    current = { work: undefined, observed: [] };
    const instantiation = { ...input.limits.instantiation, maximumWork };
    const captured = captureSourceBarrier({ ...input, limits: { ...input.limits, instantiation } });
    assert.equal(captured.kind, "ok", JSON.stringify(captured.diagnostics));
    const { modules, types: interner, typeWork, interfaceDescriptionOf } = captured.value;
    current.work = typeWork;
    const { module } = modules.find(row => row.module.module === input.snapshot.entryPoint);
    const receiver = module.tree.statements.nodes.at(-1).type.tsonic.type.value;
    const deps = { modules, types: interner, typeWork, interfaceDescriptionOf, typeExpansion: instantiation.typeExpansion };
    const member = answer(deps, receiver).members.findIndex(row => row.key.kind === "text" && row.key.value === "value");
    assert.ok(member >= 0);
    assert.deepEqual(current.observed, []);
    const request = { receiver, member, access };
    const { value } = declarations.memberTypeOf(deps, request);
    return { deps, request, value, observed: current.observed };
  };
  for (const [access, roles] of [["read", ["read"]], ["write", ["write"]], ["read-write", ["read", "write"]]]) {
    const actual = select(access);
    assert.equal(actual.value.kind, "ok");
    assert.equal(actual.value.value.access, access);
    assert.deepEqual(Object.keys(actual.value.value), ["access", ...roles]);
    assert.deepEqual(actual.observed.map(([role]) => role), roles);
    for (const role of roles)
      assert.deepEqual(types.readType(actual.deps.types, actual.value.value[role]), { kind: "primitive", primitive: "bool" });
  }
  const admitted = select("read-write");
  const [[, beforeRead], [, beforeWrite]] = admitted.observed;
  assert.ok(beforeRead < beforeWrite);
  const term = types.readType(admitted.deps.types, admitted.request.receiver);
  const definition = term.definitions[0];
  const description = admitted.deps.interfaceDescriptionOf(definition);
  const writeRequest = { ...admitted.request, access: "write" };
  const requestUnit = { query: "memberTypeOf", key: types.memberTypeRequestData(writeRequest) };
  const write = description.recipe.member(requestUnit, writeRequest.member, writeRequest.access);
  assert.equal(write.kind, "ok");
  assert.equal(write.value.access, "write");
  assert.throws(() => description.recipe.member(requestUnit, writeRequest.member), /requires its exact requested access/);
  const crossed = { ...admitted.deps, interfaceDescriptionOf: actual => actual === definition
    ? { ...description, recipe: { ...description.recipe, member: () => write } } : null };
  assert.throws(() => declarations.memberTypeOf(crossed, { ...writeRequest, access: "read" }), /retain its exact requested access/);
  for (const [cap, reached] of [[beforeRead - 1, []], [beforeWrite - 1, ["read"]]]) {
    const stopped = select("read-write", cap);
    assert.equal(stopped.value.kind, "refused");
    assert.strictEqual(stopped.value, types.typePublicationRefusalOf(stopped.deps.typeWork));
    assert.deepEqual(stopped.observed.map(([role]) => role), reached);
    assert.strictEqual(declarations.memberTypeOf(stopped.deps, { ...stopped.request, access: "write" }).value, stopped.value);
    assert.deepEqual(stopped.observed.map(([role]) => role), reached);
  }
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

test("memberTypeOf opens exactly the original checked getter and setter arms", async () => {
  const fixture = await loadFrontFixture();
  const actual = fixture.checkedModuleOf(`export type Fields = {
    get flag(): boolean; set flag(value: boolean | null);
    get readable(): boolean;
    set writable(value: boolean | null);
  };`);
  const [alias] = actual.checked.tree.statements.nodes;
  const receiver = alias.type.tsonic.type.value;
  const nodes = fixture.hir.indexSyntaxTree(actual.checked.tree);
  const deps = { modules: [{ module: actual.checked, nodes }], types: actual.interner,
    typeWork: fixtureTypeWork(types), typeExpansion: expansion };
  const inventory = answer(deps, receiver);
  const member = inventory.members.findIndex(row => row.key.value === "flag");
  const row = types.readType(actual.interner, receiver).members[member];
  const [getterOrigin] = inventory.members[member].readOrigins;
  const [setterOrigin] = inventory.members[member].writeOrigins;
  const getter = nodes.find(node => node.kind === "GetAccessor" && node.tsonic.definition === getterOrigin.declaration);
  const setter = nodes.find(node => node.kind === "SetAccessor" && node.tsonic.definition === setterOrigin.declaration);
  const read = types.readSignature(actual.interner, getter.tsonic.signatures[0].signature).result;
  const write = types.readSignature(actual.interner, setter.tsonic.signatures[0].signature).parameters[0].type;
  assert.notEqual(read, write);
  const reads = [];
  let retainedRead = read;
  Object.defineProperties(row, {
    read: { get() { reads.push("read"); return retainedRead; } },
    write: { get() { reads.push("write"); return write; } },
  });
  const request = { receiver, member, access: "read-write" };
  for (const [access, expected] of [["read", { read }], ["write", { write }], ["read-write", { read, write }]]) {
    reads.length = 0;
    const value = declarations.memberTypeOf(deps, { ...request, access }).value;
    assert.equal(value.kind, "ok");
    assert.deepEqual(value.value, { access, ...expected });
    assert.deepEqual(reads, Object.keys(expected), "only the selected fields are read in order");
  }
  for (const [name, expected] of [["readable", { read, write: null }], ["writable", { read: null, write }]]) {
    const ordinal = inventory.members.findIndex(row => row.key.value === name);
    const value = declarations.memberTypeOf(deps, { ...request, member: ordinal }).value;
    assert.deepEqual(value.value, { access: "read-write", ...expected });
  }
  const readCost = 1 + getterOrigin.declaration.length;
  const writeCost = 1 + setterOrigin.declaration.length;
  for (const [maximumWork, reached, expectedOrigin] of [[readCost - 1, [], getter.origin],
    [readCost + writeCost - 1, ["read"], setter.origin], [readCost + writeCost, ["read", "write"], null]]) {
    reads.length = 0;
    const typeWork = types.createTypePublicationWork({ maximumWork, maximumCreatedRecords: 0 });
    const limited = { ...deps, typeWork };
    const value = declarations.memberTypeOf(limited, request).value;
    assert.deepEqual(reads, reached);
    if (expectedOrigin === null) assert.equal(value.kind, "ok");
    else {
      assert.strictEqual(value, types.typePublicationRefusalOf(typeWork));
      assert.equal(value.kind, "refused");
      assert.deepEqual(value.diagnostics[0].site, { kind: "source", origin: expectedOrigin });
      const unopened = new Proxy({}, { get() { assert.fail("A previous resource stop does not reopen any accessor arm."); } });
      assert.strictEqual(declarations.memberTypeOf(limited, unopened).value, value);
      const unopenedInventory = { ...limited,
        get types() { return assert.fail("An exhausted member producer cannot reopen the receiver inventory."); } };
      assert.equal(declarations.membersOf(unopenedInventory, receiver).value === value, true);
    }
  }
  Object.defineProperty(row, "readOrigins", { value: [setterOrigin] });
  assert.throws(() => declarations.memberTypeOf(deps, { ...request, access: "read" }), /declaration of its requested arm/);
  Object.defineProperty(row, "readOrigins", { value: [{ kind: "intrinsic", symbol: "unqualified" }] });
  assert.throws(() => declarations.memberTypeOf(deps, { ...request, access: "read" }), /actual declared origin/);
  Object.defineProperty(row, "readOrigins", { value: [getterOrigin] });
  for (const type of [null, insertFixtureType(types, actual.interner, { kind: "error" })]) {
    retainedRead = type;
    reads.length = 0;
    assert.throws(() => declarations.memberTypeOf(deps, request), /declared accessor arm requires its actual checked type/);
    assert.deepEqual(reads, ["read"]);
  }
});

test("memberTypeOf keeps independently bound accessor values on the same checked declaration", async () => {
  const fixture = await loadFrontFixture();
  const actual = fixture.checkedModuleOf("export type Holder<T> = { get flag(): T; set flag(value: T | null); };");
  const [alias] = actual.checked.tree.statements.nodes;
  const nodes = fixture.hir.indexSyntaxTree(actual.checked.tree);
  const scope = fixture.hir.deriveDeclarationScopes(actual.checked, nodes).bindingScopeOf(alias.tsonic.definition);
  const [parameter] = scope.classParameters;
  const original = alias.type.tsonic.type.value;
  const deps = { modules: [{ module: actual.checked, nodes }], types: actual.interner,
    typeWork: fixtureTypeWork(types), typeExpansion: expansion };
  const originalInventory = answer(deps, original);
  const originalValue = declarations.memberTypeOf(deps, { receiver: original, member: 0, access: "read" }).value;
  assert.equal(originalValue.kind, "ok");
  assert.deepEqual(types.readType(actual.interner, originalValue.value.read), { kind: "param", parameter });
  const applied = [];
  for (const term of [{ kind: "string" }, { kind: "primitive", primitive: "bool" }]) {
    const bound = types.internType(actual.interner, term);
    const bindings = { ...types.rigidBindings(scope), classBindings: [{ kind: "bound", parameter, type: bound }] };
    const sealed = types.substitute(actual.interner, [original], bindings, expansion, deps.typeWork);
    assert.equal(sealed.kind, "complete");
    const [receiver] = sealed.value;
    assert.deepEqual(answer(deps, receiver).accessors, originalInventory.accessors);
    const value = declarations.memberTypeOf(deps, { receiver, member: 0, access: "read-write" }).value;
    assert.equal(value.kind, "ok");
    assert.equal(value.value.read, bound);
    assert.deepEqual(types.readType(actual.interner, value.value.write), { kind: "optional", value: bound });
    applied.push(receiver);
  }
  assert.notEqual(applied[0], applied[1]);
  assert.deepEqual(declarations.memberTypeOf(deps, { receiver: original, member: 0, access: "read" }).value, originalValue);
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
