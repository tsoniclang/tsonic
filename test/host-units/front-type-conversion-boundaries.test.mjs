import assert from "node:assert/strict";
import { test } from "node:test";
import { captureSingleModule, identifySingleModule, loadFrontFixture } from "./fixtures/front/checked-module.mjs";

async function captured(source, sourceFiles = { "main.ts": source }) {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const opened = fixture.openAndCapture(fixture.projectSnapshot({ sourceFiles,
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] }));
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const result = captureSingleModule(fixture.front, opened.deps, opened.program, module);
  assert.equal(result.kind, "ok");
  const definitions = identifySingleModule(fixture.front, { module: result.value, componentRoots: result.value.types.components.map(component => component.root).filter(root => root.module === result.value.module) });
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

test("an authored numeric union cannot borrow an equal native answer from another operand", async () => {
  const actual = await captured("export type Exact = 9007199254740992 | 9007199254740993;");
  const declaration = actual.raw.tree.statements.nodes[0];
  const row = actual.raw.types.types.find(entry => entry.authoredTypeNode?.node === declaration.type.id);
  assert.equal(row.form.value.kind, "union");
  assert.deepEqual(row.form.value.numericOrigin, { kind: "authored", annotation: { module: actual.raw.module, node: declaration.type.id } });
  const [first, second] = row.form.value.members;
  const crossed = structuredClone(actual.raw);
  crossed.types.types[row.id].form.value.members = [second, first];
  rejects(actual, crossed, { kind: "type", id: row.id }, /actual ordered constituent positions/u);
  const approximated = structuredClone(actual.raw);
  approximated.types.types[second].literal.value.value = { kind: "checker-value", value: 9007199254740992 };
  rejects(actual, approximated, { kind: "type", id: row.id }, /actual exact singleton operands/u);
  const types = actual.fixture.types.createTypeInterner();
  const deps = actual.fixture.lowerDepsFor(actual.definitions, types, actual.source, { maximumWork: 0 });
  const stopped = actual.conversion.createTypeConversion(deps, actual.raw);
  assert.deepEqual(actual.conversion.convertRawType(stopped, row.id), { kind: "resource-limit", dimension: "work", maximum: 0 });
  assert.equal(actual.fixture.types.viewTypes(types).terms.length, 0);
});

test("a closed numeric indexed result verifies the actual selected source vector", async () => {
  const actual = await captured(`
    export type Read = { left: 9007199254740992; right: 9007199254740993 }["left" | "right"];
    export type Partial = { left: 1; right?: 2 }["left" | "right"];
  `);
  const [read, partial] = actual.raw.tree.statements.nodes;
  const row = actual.raw.types.types.find(entry => entry.authoredTypeNode?.node === read.type.id);
  const value = row.form.value;
  assert.equal(value.kind, "union");
  assert.equal(value.numericOrigin.kind, "indexed-read");
  assert.deepEqual(value.numericOrigin.annotation, { module: actual.raw.module, node: read.type.id });
  const sources = read.type.objectType.members.nodes.map(member => ({ module: actual.raw.module, node: member.type.id }));
  assert.deepEqual(new Set(value.numericOrigin.sources.map(source => source.node)), new Set(sources.map(source => source.node)));
  assert.deepEqual(value.members.map(id => actual.raw.types.types[id].authoredTypeNode), value.numericOrigin.sources);
  assert.equal(actual.raw.types.types.find(entry => entry.authoredTypeNode?.node === partial.type.id).form.value.numericOrigin, undefined);
  for (const change of [
    origin => { origin.sources.reverse(); },
    origin => { origin.annotation = { ...origin.annotation, node: read.type.objectType.id }; },
    origin => { origin.sources[0] = { ...origin.sources[0], module: "foreign" }; },
  ]) {
    const crossed = structuredClone(actual.raw);
    change(crossed.types.types[row.id].form.value.numericOrigin);
    rejects(actual, crossed, { kind: "type", id: row.id }, /actual ordered constituent positions/u);
  }
});

test("original signatures retain authored operator syntax separately from their real parameter and result positions", async () => {
  const actual = await captured(`
    export declare function conditional<T>(value: T extends string ? boolean : number): T extends string ? number : boolean;
    export declare function indexed<T extends {flag: boolean}>(value: T["flag"]): T["flag"];
  `);
  for (const [index, name] of ["conditional", "indexed"].entries()) {
    const declaration = actual.raw.tree.statements.nodes[index];
    const signature = actual.raw.types.signatures.find(candidate => candidate.declaration?.node === declaration.id);
    assert.ok(signature);
    const formal = signature.parameters[0];
    const parameter = actual.raw.types.types[formal.type];
    const result = actual.raw.types.types[signature.result.value];
    for (const [position, component] of [[parameter, "parameter"], [result, "result"]]) {
      const raw = actual.raw.types.components[position.component];
      assert.equal(raw.path.step.kind, component);
      assert.equal(raw.path.step.signature, signature.id);
      assert.notEqual(raw.root.node, position.form.value.operator.node);
      assert.deepEqual(position.authoredTypeNode, position.form.value.operator);
    }
    const types = actual.fixture.types.createTypeInterner();
    const deps = actual.fixture.lowerDepsFor(actual.definitions, types, actual.source);
    const converted = actual.conversion.signatureOf(actual.conversion.createTypeConversion(deps, actual.raw), signature.id);
    assert.equal(converted.kind, "complete");
    const checked = actual.fixture.types.readSignature(types, converted.value);
    for (const type of [checked.parameters[0].type, checked.result]) {
      const term = actual.fixture.types.readType(types, type);
      assert.equal(term.kind, "projection");
      assert.equal(term.projection.kind, name);
    }
    for (const [position, substitute] of [[parameter, result], [result, parameter]]) {
      const crossed = structuredClone(actual.raw);
      const operator = substitute.form.value.operator;
      crossed.types.types[position.id].authoredTypeNode = operator;
      crossed.types.types[position.id].form.value.operator = operator;
      rejects(actual, crossed, { kind: "signature", id: signature.id }, /projection requires its actual checked operator component/u);
    }
    const wrongSlot = structuredClone(actual.raw);
    wrongSlot.types.components[formal.component].path.step.index = 1;
    rejects(actual, wrongSlot, { kind: "signature", id: signature.id }, /projection requires its actual checked operator component/u);
  }
});

test("an authored conditional keeps its native substitution under the exact true-branch index", async () => {
  const actual = await captured(`
    export type Selected<T, P> = P extends keyof T ? T[P] : never;
    export type Other<T, P> = P extends keyof T ? T[P] : never;
  `);
  const [selected, other] = actual.raw.tree.statements.nodes.map(row => row.type.id);
  const substitutions = actual.raw.types.types.filter(row => row.form.kind === "available" && row.form.value.kind === "substitution");
  const owned = substitutions.find(row => row.form.value.operator.node === selected);
  const unrelated = substitutions.find(row => row.form.value.operator.node === other);
  assert.ok(owned && unrelated);
  const types = actual.fixture.types.createTypeInterner();
  const deps = actual.fixture.lowerDepsFor(actual.definitions, types, actual.source);
  const conversion = actual.conversion.createTypeConversion(deps, actual.raw);
  const converted = actual.conversion.convertRawType(conversion, owned.id);
  assert.equal(converted.kind, "complete");
  const term = actual.fixture.types.readType(types, converted.value.type);
  assert.equal(term.projection.kind, "substitution");
  assert.equal(actual.fixture.types.readType(types, term.source).kind, "param");
  assert.equal(actual.fixture.types.readType(types, term.projection.constraint).projection.kind, "keyof");
  for (const replacement of [
    { constraint: unrelated.form.value.constraint },
    { base: unrelated.form.value.base },
    { operator: unrelated.form.value.operator },
  ]) {
    const crossed = structuredClone(actual.raw);
    Object.assign(crossed.types.types[owned.id].form.value, replacement);
    rejects(actual, crossed, { kind: "type", id: owned.id }, /actual conditional and ordered checked operands/u);
  }
  const crossedTarget = structuredClone(actual.raw);
  const key = crossedTarget.types.types[owned.form.value.constraint].form.value;
  key.target = crossedTarget.types.types[unrelated.form.value.constraint].form.value.target;
  rejects(actual, crossedTarget, { kind: "type", id: owned.id }, /actual checked keyof operator and target components/u);
  rejects(actual, actual.raw, { kind: "type", id: owned.id }, /actual checked index occurrence/u, {
    sourceOccurrenceOf: reference => {
      const value = deps.sourceOccurrenceOf(reference);
      return value?.typeSyntax?.kind === "indexed" ? { ...value, typeSyntax: { ...value.typeSyntax, index: value.node } } : value;
    },
  });
});

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
    work: actual.fixture.lowerDepsFor(actual.definitions, target, actual.source).typeWork },
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
    [{ ...signature, typeParameters: unavailable }, /incomplete or receiver-bearing/u],
    [{ ...signature, receiver: unavailable }, /incomplete or receiver-bearing/u],
    [{ ...signature, typeParameters: { kind: "available", value: [signature.parameters[0].type] } }, /actual captured parameter type/u],
    [{ ...signature, receiver: { kind: "available", value: signature.parameters[0] } }, /incomplete or receiver-bearing/u],
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
    [{ ...form, arguments: [undefined] }, /actual ordered parameter associations/u],
    [{ ...form, arguments: [{ ...form.arguments[0], argument: unavailable }] }, /actual selected checked argument/u],
    [{ ...form, extent: unavailable }, /actual selected extent association/u],
    [{ ...form, extent: { kind: "available", value: { length: 1n, runtimeBase: "number" } } }, /actual selected extent association/u],
  ]) {
    const types = [...actual.raw.types.types];
    types[row.id] = { ...row, form: { kind: "available", value: replacement } };
    rejects(actual, { ...actual.raw, types: { ...actual.raw.types, types } }, { kind: "type", id: row.id }, pattern);
  }
});

test("declared arguments retain ordered qualified parameter associations before publication", async () => {
  const actual = await captured("export interface Pair<First,Second>{first:First;second:Second;}export type Current=Pair<boolean,string>;");
  const node = actual.raw.tree.statements.nodes[1].type;
  const row = actual.raw.types.types.find(candidate => candidate.authoredTypeNode?.node === node.id);
  assert.equal(row.form.value.kind, "declared");
  const form = row.form.value;
  assert.equal(form.parameters.length, 2);
  const replace = value => {
    const types = [...actual.raw.types.types];
    types[row.id] = { ...row, form: { kind: "available", value } };
    return { ...actual.raw, types: { ...actual.raw.types, types } };
  };
  const arena = actual.fixture.types.createTypeInterner();
  const equivalent = replace({ ...form, parameters: form.parameters.map(parameter => ({ ...parameter })),
    arguments: form.arguments.map(argument => ({ ...argument, parameter: { ...argument.parameter } })) });
  const conversion = actual.conversion.createTypeConversion(
    actual.fixture.lowerDepsFor(actual.definitions, arena, actual.source), equivalent);
  assert.equal(actual.conversion.convertRawType(conversion, row.id).kind, "complete");
  for (const value of [
    { ...form, arguments: form.arguments.slice(1) },
    { ...form, parameters: [...form.parameters, form.parameters[0]] },
    { ...form, parameters: [undefined, form.parameters[1]] },
    { ...form, arguments: [{ ...form.arguments[0], parameter: form.parameters[1] }, form.arguments[1]] },
    { ...form, arguments: [form.arguments[1], form.arguments[0]] },
    { ...form, arguments: [{ ...form.arguments[0], parameter: {
      ...form.parameters[0], module: actual.fixture.moduleOf(actual.fixture.packageOf("/project"), "src/foreign.ts"),
    } }, form.arguments[1]] },
  ]) rejects(actual, replace(value), { kind: "type", id: row.id }, /actual ordered parameter associations/u);
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
  const foreign = captureSingleModule(actual.fixture.front, actual.opened.deps, actual.opened.program, module);
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
  const foreign = captureSingleModule(actual.fixture.front, actual.opened.deps, actual.opened.program, module);
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
