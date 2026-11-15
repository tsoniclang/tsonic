import assert from "node:assert/strict";
import { test } from "node:test";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";

async function captured(source, sourceFiles = { "main.ts": source }) {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const opened = fixture.openAndCapture(fixture.projectSnapshot({ sourceFiles,
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] }));
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const result = fixture.front.captureModule(opened.deps, opened.program, module);
  assert.equal(result.kind, "ok");
  const definitions = fixture.front.lowerModuleDefinitions({ module: result.value, componentRoots: result.value.types.components.map(component => component.root).filter(root => root.module === result.value.module) });
  assert.equal(definitions.kind, "ok");
  const conversion = await import("../../packages/host/dist/front/type-conversion.js");
  return { fixture, raw: result.value, definitions: definitions.value, source, conversion, opened };
}

function rejects(actual, raw, root, pattern, overrides = {}) {
  const types = actual.fixture.types.createTypeInterner();
  actual.fixture.types.internType(types, { kind: "string" });
  const table = actual.fixture.types.viewTypes(types);
  const previous = [...table.terms];
  const deps = { ...actual.fixture.lowerDepsFor(actual.definitions, types, actual.source), ...overrides };
  const conversion = actual.conversion.createTypeConversion(deps, raw);
  assert.throws(() => root.kind === "type" ? actual.conversion.convertRawType(conversion, root.id)
    : actual.conversion.signatureOf(conversion, root.id), pattern);
  assert.equal(actual.fixture.types.viewTypes(types) === table, true);
  assert.equal(table.terms.length, previous.length);
  assert.equal(table.terms.every((row, index) => row === previous[index]), true);
  assert.equal(table.signatures.length, 0);
  assert.equal(conversion.convertedTypes.size, 0);
  assert.equal(conversion.convertedSignatures.size, 0);
}

test("actual graph result projections require their selected type and signature mappings", async () => {
  const actual = await captured("export function value(input:boolean):boolean{return input;}");
  const types = actual.fixture.types.createTypeInterner();
  const deps = actual.fixture.lowerDepsFor(actual.definitions, types, actual.source);
  const conversion = actual.conversion.createTypeConversion(deps, actual.raw);
  const signature = actual.raw.types.signatures.find(candidate => candidate.declaration?.node === actual.raw.tree.statements.nodes[0].id);
  assert.equal(signature !== undefined, true);
  const converted = actual.conversion.signatureOf(conversion, signature.id);
  assert.equal(converted.kind, "complete");
  const selected = actual.fixture.types.readSignature(types, converted.value);
  const { id: publishedSignature, ...input } = selected;
  assert.equal(publishedSignature, converted.value);
  const target = actual.fixture.types.createTypeInterner();
  const result = actual.fixture.types.internTypeGraph({ types: target,
    work: actual.fixture.types.createTypePublicationWork(deps.typePublication) },
  { typeBase: 0, signatureBase: 0, terms: [{ kind: "primitive", primitive: "bool" }],
    signatures: [{ ...input, parameters: input.parameters.map(parameter => ({ ...parameter, type: actual.fixture.ids.tyId(0) })),
      result: actual.fixture.ids.tyId(0) }] });
  assert.equal(result.kind, "complete");
  const evidence = conversion.convertedTypes.get(signature.result.value).evidence;
  const mapped = actual.conversion.mapTypeResult(result.value, 0, evidence);
  assert.equal(mapped.type, result.value.types[0]);
  assert.equal(mapped.evidence.type, result.value.types[0]);
  assert.equal(mapped.evidence.component === evidence.component, true);
  assert.equal(actual.conversion.mapSignatureResult(result.value, 0), result.value.signatures[0]);
  const originalType = evidence.type;
  for (const missing of [[], new Array(1)]) {
    assert.throws(() => actual.conversion.mapTypeResult({ ...result.value, types: missing }, 0, evidence),
      /completed graph must retain every staged type mapping/u);
    assert.throws(() => actual.conversion.mapSignatureResult({ ...result.value, signatures: missing }, 0),
      /completed graph must retain every staged signature mapping/u);
  }
  assert.equal(evidence.type, originalType);
});

test("an unavailable actual first parameter precedes the genuine later result declaration reader", async () => {
  const actual = await captured("export declare const key:unique symbol;export declare function value(first:boolean,second:string):typeof key;");
  const signature = actual.raw.types.signatures.find(candidate => candidate.declaration?.node === actual.raw.tree.statements.nodes[1].id);
  assert.equal(signature !== undefined, true);
  const first = actual.raw.types.types[signature.parameters[0].type];
  const second = actual.raw.types.types[signature.parameters[1].type];
  const result = actual.raw.types.types[signature.result.value];
  assert.equal(new Set([first.id, second.id, result.id]).size, 3);
  assert.equal(result.literal.value.kind, "symbol");
  const resultDeclaration = result.literal.value.declaration;
  const original = new Error("the genuine later result declaration reader failed");
  const run = raw => {
    const types = actual.fixture.types.createTypeInterner();
    const deps = actual.fixture.lowerDepsFor(actual.definitions, types, actual.source);
    const reads = [];
    let resultReads = 0;
    const conversion = actual.conversion.createTypeConversion({ ...deps, sourceOccurrenceOf(reference) {
      reads.push(reference);
      return deps.sourceOccurrenceOf(reference);
    }, definitionOf(reference) {
      if (reference.module === resultDeclaration.module && reference.node === resultDeclaration.node) {
        resultReads += 1;
        throw original;
      }
      return deps.definitionOf(reference);
    } }, raw);
    return { types, conversion, reads, resultReads: () => resultReads };
  };
  const rows = [...actual.raw.types.types];
  rows[first.id] = { ...first, form: { kind: "unavailable", reason: "not-provided", causes: [] } };
  const refused = run({ ...actual.raw, types: { ...actual.raw.types, types: rows } });
  assert.throws(() => actual.conversion.signatureOf(refused.conversion, signature.id),
    /actual captured component\/error association \(not-provided\)/u);
  assert.equal(refused.reads.length, 0);
  assert.equal(refused.resultReads(), 0);
  assert.equal(actual.fixture.types.viewTypes(refused.types).terms.length, 0);
  assert.equal(actual.fixture.types.viewTypes(refused.types).signatures.length, 0);
  assert.equal(refused.conversion.convertedTypes.size, 0);
  assert.equal(refused.conversion.convertedSignatures.size, 0);
  const available = run(actual.raw);
  assert.throws(() => actual.conversion.signatureOf(available.conversion, signature.id), error => error === original);
  assert.deepEqual(available.reads, [first, second].map(row => actual.raw.types.components[row.component].root));
  assert.equal(available.resultReads(), 1);
  assert.equal(actual.fixture.types.viewTypes(available.types).terms.length, 0);
  assert.equal(available.conversion.convertedTypes.size, 0);
  assert.equal(available.conversion.convertedSignatures.size, 0);
});

test("actual dependencies retain depth-first indexes, members, calls and constructs", async () => {
  for (const [source, selectedDependencies] of [
    ["export type Outer={first:{nested:string;other:boolean};last:string};", actual => {
      const root = actual.raw.types.types.find(row => row.authoredTypeNode?.node === actual.raw.tree.statements.nodes[0].type.id);
      const outer = actual.raw.types.members[root.form.value.inventory];
      const nested = actual.raw.types.types[outer.members[0].read.value];
      const inner = actual.raw.types.members[nested.form.value.inventory];
      return [root.id, inner.members[0].read.value, outer.members[1].read.value];
    }],
    ["export type Shape={[index:number]:symbol;flag:boolean;():bigint;new():object;};", actual => {
      const root = actual.raw.types.types.find(row => row.authoredTypeNode?.node === actual.raw.tree.statements.nodes[0].type.id);
      const inventory = actual.raw.types.members[root.form.value.inventory];
      return [root.id, inventory.indexes[0].key, inventory.indexes[0].value];
    }],
    ["export type Shape={[index:number]:symbol;flag:boolean;():bigint;new():object;};", actual => {
      const root = actual.raw.types.types.find(row => row.authoredTypeNode?.node === actual.raw.tree.statements.nodes[0].type.id);
      const inventory = actual.raw.types.members[root.form.value.inventory];
      return [root.id, inventory.indexes[0].value, inventory.members[0].read.value];
    }],
    ["export type Accessor={get flag():boolean;set flag(value:boolean|string);};", actual => {
      const root = actual.raw.types.types.find(row => row.authoredTypeNode?.node === actual.raw.tree.statements.nodes[0].type.id);
      const inventory = actual.raw.types.members[root.form.value.inventory];
      return [root.id, inventory.members[0].read.value, inventory.members[0].write.value];
    }],
    ["export type Shape={flag:boolean;():bigint;new():object;};", actual => {
      const root = actual.raw.types.types.find(row => row.authoredTypeNode?.node === actual.raw.tree.statements.nodes[0].type.id);
      const inventory = actual.raw.types.members[root.form.value.inventory];
      return [root.id, inventory.members[0].read.value, actual.raw.types.signatures[inventory.calls[0]].result.value];
    }],
    ["export type Factory={():bigint;new():object;};", actual => {
      const root = actual.raw.types.types.find(row => row.authoredTypeNode?.node === actual.raw.tree.statements.nodes[0].type.id);
      const inventory = actual.raw.types.members[root.form.value.inventory];
      return [root.id, actual.raw.types.signatures[inventory.calls[0]].result.value,
        actual.raw.types.signatures[inventory.constructs[0]].result.value];
    }],
    ["interface Pair<First,Last>{first:First;last:Last;}export type Applied=Pair<boolean,string>;", actual => {
      const root = actual.raw.types.types.find(row => row.authoredTypeNode?.node === actual.raw.tree.statements.nodes[1].type.id);
      return [root.id, root.form.value.arguments[0].argument.value, root.form.value.arguments[1].argument.value];
    }],
    ["export type Choice=boolean|string;", actual => {
      const root = actual.raw.types.types.find(row => row.authoredTypeNode?.node === actual.raw.tree.statements.nodes[0].type.id);
      return [root.id, root.form.value.members[0], root.form.value.members[1]];
    }],
    ["export type Both={first:boolean}&{last:string};", actual => {
      const root = actual.raw.types.types.find(row => row.authoredTypeNode?.node === actual.raw.tree.statements.nodes[0].type.id);
      return [root.id, root.form.value.members[0], root.form.value.members[1]];
    }],
  ]) {
    const actual = await captured(source);
    const [root, first, later] = selectedDependencies(actual);
    assert.notEqual(first, later);
    const rows = [...actual.raw.types.types];
    rows[first] = { ...rows[first], form: { kind: "unavailable", reason: "not-provided", causes: [] } };
    rows[later] = { ...rows[later], form: { kind: "unavailable", reason: "incomplete-association", causes: [] } };
    rejects(actual, { ...actual.raw, types: { ...actual.raw.types, types: rows } }, { kind: "type", id: root },
      /actual captured component\/error association \(not-provided\)/u);
    rows[first] = actual.raw.types.types[first];
    rejects(actual, { ...actual.raw, types: { ...actual.raw.types, types: rows } }, { kind: "type", id: root },
      /actual captured component\/error association \(incomplete-association\)/u);
  }
});

test("captured type boundary failures do not publish an invented graph or mutate a populated arena", async () => {
  const actual = await captured("export type Flag=boolean;");
  const node = actual.raw.tree.statements.nodes[0].type;
  const row = actual.raw.types.types.find(candidate => candidate.authoredTypeNode?.node === node.id);
  assert.equal(row !== undefined, true);
  const unavailable = { kind: "unavailable", reason: "not-provided", causes: [] };
  for (const [replacement, pattern] of [
    [undefined, /raw type must name its captured form/u],
    [{ ...row, form: unavailable }, /actual captured component\/error association/u],
    [{ ...row, literal: unavailable }, /actual captured literal association/u],
    [{ ...row, literal: { kind: "available", value: { kind: "absence", spelling: "null" } } }, /checked literal conversion of absence/u],
    [{ ...row, form: { kind: "available", value: { kind: "array", readonly: false, element: row.id } } }, /checker type form array/u],
    [{ ...row, form: { kind: "available", value: { kind: "union", members: [undefined] } } }, /composite type cannot lose a member/u],
    [{ ...row, component: actual.raw.types.components.length }, /actual captured type and component/u],
  ]) {
    const types = [...actual.raw.types.types];
    types[row.id] = replacement;
    rejects(actual, { ...actual.raw, types: { ...actual.raw.types, types } }, { kind: "type", id: row.id }, pattern);
  }
  rejects(actual, actual.raw, { kind: "type", id: row.id }, /actual qualified source occurrence/u, { sourceOccurrenceOf: () => null });
});

test("captured structure inventory failures retain their original boundary before any graph publication", async () => {
  const actual = await captured("export type Shape={flag:boolean;[key:string]:boolean};");
  const node = actual.raw.tree.statements.nodes[0].type;
  const row = actual.raw.types.types.find(candidate => candidate.authoredTypeNode?.node === node.id);
  assert.equal(row.form.value.kind, "structure");
  const inventory = actual.raw.types.members[row.form.value.inventory];
  const unavailable = { kind: "unavailable", reason: "not-provided", causes: [] };
  for (const [replacement, pattern] of [
    [undefined, /captured member inventory/u],
    [{ ...inventory, members: [undefined] }, /member inventory must retain every actual row/u],
    [{ ...inventory, members: [{ ...inventory.members[0], read: unavailable }] }, /member conversion requires its actual captured type association/u],
    [{ ...inventory, indexes: [undefined] }, /index inventory must retain every actual row/u],
  ]) {
    const members = [...actual.raw.types.members];
    members[inventory.id] = replacement;
    rejects(actual, { ...actual.raw, types: { ...actual.raw.types, members } }, { kind: "type", id: row.id }, pattern);
  }
});

test("captured callable boundary failures cannot become a signature or a partial type graph", async () => {
  const actual = await captured("export function value(input:boolean):boolean{return input;}");
  const signature = actual.raw.types.signatures.find(candidate => candidate.parameters.length === 1
    && candidate.declaration?.node === actual.raw.tree.statements.nodes[0].id);
  assert.equal(signature !== undefined, true);
  const unavailable = { kind: "unavailable", reason: "not-provided", causes: [] };
  for (const [replacement, pattern] of [
    [undefined, /callable inventory must name its captured signature/u],
    [{ ...signature, result: unavailable }, /unavailable callable result/u],
    [{ ...signature, parameters: [undefined] }, /captured parameter inventory must be dense/u],
    [{ ...signature, typeParameters: unavailable }, /generic or receiver-bearing/u],
    [{ ...signature, receiver: unavailable }, /generic or receiver-bearing/u],
    [{ ...signature, typeParameters: { kind: "available", value: [signature.declaration] } }, /generic or receiver-bearing/u],
    [{ ...signature, receiver: { kind: "available", value: signature.parameters[0] } }, /generic or receiver-bearing/u],
    [{ ...signature, composition: { kind: "union", signatures: [signature.id] } }, /composed callable signature/u],
    [{ ...signature, declaration: null }, /declarationless callable signature/u],
    [{ ...signature, parameters: [{ ...signature.parameters[0], declaration: null }] }, /declarationless callable parameter/u],
    [{ ...signature, parameters: [{ ...signature.parameters[0], kind: "variadic" }] }, /variadic callable parameter/u],
    [{ ...signature, parameters: [{ ...signature.parameters[0], passing: unavailable }] }, /captured passing mode is unavailable/u],
  ]) {
    const signatures = [...actual.raw.types.signatures];
    signatures[signature.id] = replacement;
    rejects(actual, { ...actual.raw, types: { ...actual.raw.types, signatures } }, { kind: "signature", id: signature.id }, pattern);
  }
});

test("declared arguments and extents require actual available associations before graph admission", async () => {
  const actual = await captured("interface Box<T>{value:T;}export type Applied=Box<boolean>;");
  const node = actual.raw.tree.statements.nodes[1].type;
  const row = actual.raw.types.types.find(candidate => candidate.authoredTypeNode?.node === node.id);
  assert.equal(row.form.value.kind, "declared");
  const form = row.form.value;
  assert.equal(form.arguments.length, 1);
  const unavailable = { kind: "unavailable", reason: "not-provided", causes: [] };
  for (const [replacement, pattern] of [
    [{ ...form, arguments: [undefined] }, /actual selected checked argument/u],
    [{ ...form, arguments: [{ ...form.arguments[0], argument: unavailable }] }, /actual selected checked argument/u],
    [{ ...form, extent: unavailable }, /actual selected extent association/u],
    [{ ...form, extent: { kind: "available", value: { length: 1n, runtimeBase: "number" } } }, /actual selected extent association/u],
  ]) {
    const types = [...actual.raw.types.types];
    types[row.id] = { ...row, form: { kind: "available", value: replacement } };
    rejects(actual, { ...actual.raw, types: { ...actual.raw.types, types } }, { kind: "type", id: row.id }, pattern);
  }
});

test("a missing or non-index source occurrence cannot become an index origin", async () => {
  const actual = await captured("export type Indexed={[key:string]:boolean};");
  const node = actual.raw.tree.statements.nodes[0].type;
  const row = actual.raw.types.types.find(candidate => candidate.authoredTypeNode?.node === node.id);
  assert.equal(row.form.value.kind, "structure");
  const origin = actual.definitions.sourceOccurrences.find(candidate => candidate.kind === "IndexSignature");
  assert.equal(origin !== undefined, true);
  const sources = new Map(actual.definitions.sourceOccurrences.map(candidate => [candidate.node, candidate]));
  for (const source of [null, { ...origin, kind: "ExportSpecifier" }]) {
    rejects(actual, actual.raw, { kind: "type", id: row.id }, /index requires its genuine declared or mapped source occurrence/u,
      { sourceOccurrenceOf: reference => reference.node === origin.node ? source : sources.get(reference.node) ?? null });
  }
});

test("a foreign captured component cannot borrow the current module's same-numbered body node", async () => {
  const source = "export type Flag=boolean;";
  const actual = await captured(source, { "main.ts": source, "other.ts": source });
  const module = actual.fixture.moduleOf(actual.fixture.packageOf("/project"), "src/other.ts");
  const foreign = actual.fixture.front.captureModule(actual.opened.deps, actual.opened.program, module);
  assert.equal(foreign.kind, "ok");
  const node = actual.raw.tree.statements.nodes[0].type;
  const row = actual.raw.types.types.find(candidate => candidate.authoredTypeNode?.node === node.id);
  const foreignRow = foreign.value.types.types.find(candidate => candidate.authoredTypeNode?.node === node.id);
  const component = actual.raw.types.components[row.component];
  const foreignComponent = foreign.value.types.components[foreignRow.component];
  assert.equal(component.root.node, foreignComponent.root.node);
  assert.notEqual(component.root.module, foreignComponent.root.module);
  const components = [...actual.raw.types.components];
  components[row.component] = foreignComponent;
  const sources = new Map(actual.definitions.sourceOccurrences.map(candidate => [candidate.node, candidate]));
  rejects(actual, { ...actual.raw, types: { ...actual.raw.types, components } }, { kind: "type", id: row.id },
    /actual qualified source occurrence/u,
    { sourceOccurrenceOf: reference => reference.module === actual.raw.module ? sources.get(reference.node) ?? null : null });
});

test("a callable default cannot borrow an initializer occurrence from another actual module", async () => {
  const source = "export function value(input:boolean=true):boolean{return input;}";
  const actual = await captured(source, { "main.ts": source, "other.ts": source });
  const module = actual.fixture.moduleOf(actual.fixture.packageOf("/project"), "src/other.ts");
  const foreign = actual.fixture.front.captureModule(actual.opened.deps, actual.opened.program, module);
  assert.equal(foreign.kind, "ok");
  const owner = actual.raw.tree.statements.nodes[0].id;
  const signature = actual.raw.types.signatures.find(candidate => candidate.declaration?.node === owner);
  const foreignSignature = foreign.value.types.signatures.find(candidate => candidate.declaration?.node === owner);
  assert.equal(signature !== undefined && foreignSignature !== undefined, true);
  const initializer = signature.parameters[0].initializer;
  const foreignInitializer = foreignSignature.parameters[0].initializer;
  assert.equal(initializer.node, foreignInitializer.node);
  assert.notEqual(initializer.module, foreignInitializer.module);
  const signatures = [...actual.raw.types.signatures];
  signatures[signature.id] = { ...signature, parameters: [{ ...signature.parameters[0], initializer: foreignInitializer }] };
  rejects(actual, { ...actual.raw, types: { ...actual.raw.types, signatures } }, { kind: "signature", id: signature.id },
    /default initializer must retain its parameter's actual source module/u);
});
