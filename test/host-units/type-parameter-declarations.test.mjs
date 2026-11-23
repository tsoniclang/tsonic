import { insertFixtureType, insertFixtureSignature } from "./fixtures/types-construction.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { encodeDefId, encodeModuleId, encodePackageId } from "../../packages/host/dist/ids/index.js";
import * as types from "../../packages/host/dist/ir-types/index.js";
import { accountFailure, chargeResultEntries, chargeWork, createAccount, refuseAccount } from "../../packages/host/dist/dataflow/index.js";
import { publicationFixture } from "./fixtures/program-publication.mjs";
import { parseProgramIndex, printProgramIndex } from "../../packages/host/dist/ir-program/index.js";

const module = encodeModuleId({ package: encodePackageId("/parameters"), path: "aliases.ts" });
const alias = encodeDefId({ module, segments: [{ name: "Alias", ordinal: 0 }] });
const declaration = (name, ordinal) => encodeDefId({ module, segments: [{ name: "Alias", ordinal: 0 }, { name, ordinal }] });
const outer = declaration("T", 0);
const firstMapped = declaration("K", 0);
const nestedMapped = declaration("K", 1);
const emptyBindings = () => ({ classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] });
const scope = () => ({ classParameters: [outer], methodParameters: [firstMapped], capturedParameters: [nestedMapped], selfOwners: [alias] });
const capacity = { maximumDepth: 100, maximumVisits: 100000, maximumUnionMembers: 100, maximumIntersectionMembers: 100 };
const publication = { maximumWork: 100000, maximumCreatedRecords: 100000 };

function fixture() {
  const interner = types.createTypeInterner();
  const bool = insertFixtureType(types, interner, { kind: "primitive", primitive: "bool" });
  const string = insertFixtureType(types, interner, { kind: "string" });
  const parameters = [outer, firstMapped, nestedMapped].map(parameter => insertFixtureType(types, interner, { kind: "param", parameter }));
  const result = insertFixtureType(types, interner, { kind: "tuple", readonly: false,
    elements: parameters.map(type => ({ kind: "required", type, declaration: null })) });
  const signature = insertFixtureSignature(types, interner, { kind: "call", declaration: alias, owner: null, composition: null,
    typeParameters: [{ declaration: nestedMapped, constraint: parameters[0], default: parameters[0] }],
    receiver: null, parameters: [], result });
  return { interner, bool, string, parameters, result, signature };
}

test("sole parameter declarations distinguish alias and nested mapped parameters without a mapped binder", () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const current = fixture();
  assert.equal(new Set(current.parameters).size, 3);
  for (const [index, parameter] of [outer, firstMapped, nestedMapped].entries())
    assert.deepEqual(types.readType(current.interner, current.parameters[index]), { kind: "param", parameter });
  const generic = types.readSignature(current.interner, current.signature);
  assert.deepEqual(generic.typeParameters, [{ declaration: nestedMapped, constraint: current.parameters[0], default: current.parameters[0] }]);
  assert.equal(Object.hasOwn(generic.typeParameters[0], "identity"), false);
  assert.equal(types.rigidBindings(scope()).capturedBindings[0].parameter, nestedMapped);
  assert.notEqual(types.bindingVectorKey({ ...emptyBindings(), classBindings: [{ kind: "rigid", parameter: firstMapped }] }),
    types.bindingVectorKey({ ...emptyBindings(), classBindings: [{ kind: "rigid", parameter: nestedMapped }] }));
});

test("substitution uses actual declaration membership and shields only the actual nested signature binder", () => {
  const current = fixture();
  const bindings = { classBindings: [{ kind: "bound", parameter: outer, type: current.bool }],
    methodBindings: [{ kind: "bound", parameter: firstMapped, type: current.string }],
    capturedBindings: [{ kind: "bound", parameter: nestedMapped, type: current.bool }], selfBindings: [] };
  const result = types.substituteSignature(current.interner, [current.signature], bindings, capacity, "lexical", types.createTypePublicationWork({ maximumWork: 100000, maximumCreatedRecords: 100000 }));
  assert.equal(result.kind, "complete");
  const selected = types.readSignature(current.interner, result.value[0]);
  assert.deepEqual(selected.typeParameters, [{ declaration: nestedMapped, constraint: current.bool, default: current.bool }]);
  assert.deepEqual(types.readType(current.interner, selected.result).elements.map(element => element.type),
    [current.bool, current.string, current.parameters[2]]);
  const roots = types.substitute(current.interner, current.parameters, bindings, capacity, types.createTypePublicationWork({ maximumWork: 100000, maximumCreatedRecords: 100000 }));
  assert.deepEqual(roots, { kind: "complete", value: [current.bool, current.string, current.bool] });
  const unrelated = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter: declaration("Other", 0), type: current.bool }] };
  assert.deepEqual(types.substitute(current.interner, current.parameters, unrelated, capacity, types.createTypePublicationWork({ maximumWork: 100000, maximumCreatedRecords: 100000 })), { kind: "complete", value: current.parameters });
});

test("canonical scope order and family authority do not follow declaration spelling or vector position as identity", () => {
  const admitted = scope();
  const vector = types.rigidBindings(admitted);
  const verify = value => types.verifyBindings([{ vector: value, scope: admitted }], 1, () => null);
  assert.deepEqual(verify(vector), { kind: "complete", violations: [] });
  const swapped = { ...vector, methodBindings: vector.capturedBindings, capturedBindings: vector.methodBindings };
  assert.deepEqual(verify(swapped).violations.map(row => row.rule), ["binding-vector-complete", "binding-vector-complete"]);
  const missing = { ...vector, classBindings: [] };
  assert.deepEqual(verify(missing).violations.map(row => row.rule), ["binding-vector-complete"]);
  const ordered = { classParameters: [nestedMapped, firstMapped], methodParameters: [], capturedParameters: [], selfOwners: [] };
  const bindings = types.rigidBindings(ordered);
  assert.equal(bindings.classBindings[0].parameter, nestedMapped);
  assert.equal(bindings.classBindings[1].parameter, firstMapped);
  assert.deepEqual(types.verifyBindings([{ vector: bindings, scope: ordered }], 0, () => null), { kind: "complete", violations: [] });
  assert.equal(types.verifyBindings([{ vector: { ...bindings, classBindings: [...bindings.classBindings].reverse() }, scope: ordered }], 0,
    () => null).violations.length, 2);
});

test("parameter and embedded Program codecs retain declarations and reject retired identity records", () => {
  const current = fixture();
  const table = types.viewTypes(current.interner);
  const document = types.printTypes(table);
  assert.equal(document.includes("TypeParameterIdentity("), false);
  assert.equal(document.includes("identity="), false);
  assert.deepEqual(types.parseTypes(document), { kind: "parsed", value: table });
  const retired = `TypeParameterIdentity(owner=def:${JSON.stringify(alias)}, index=0)`;
  assert.equal(document.includes(`parameter=def:${JSON.stringify(outer)}`), true);
  assert.equal(types.parseTypes(document.replace(`parameter=def:${JSON.stringify(outer)}`, `parameter=${retired}`)).kind, "invalid-text");
  assert.equal(types.parseTypes(document.replace("TypeParameter(declaration=", `TypeParameter(identity=${retired}, declaration=`)).kind, "invalid-text");
  const program = publicationFixture().index;
  const retained = { ...program, types: table };
  const programText = printProgramIndex(retained);
  const decoded = parseProgramIndex(programText);
  assert.equal(decoded.kind, "parsed", decoded.kind === "invalid-text"
    ? JSON.stringify({ expected: decoded.expected, at: programText.slice(Math.max(0, decoded.offset - 30), decoded.offset + 30) }) : "actual Program codec");
  assert.deepEqual(decoded.value, retained);
  assert.equal(parseProgramIndex(programText.replace("TypeParameter(declaration=", `TypeParameter(identity=${retired}, declaration=`)).kind, "invalid-text");
});

test("publication and transport preserve sole declarations through type permutations and genuine original resource cuts", () => {
  const build = reverse => {
    const interner = types.createTypeInterner();
    const parameters = reverse ? [nestedMapped, firstMapped, outer] : [outer, firstMapped, nestedMapped];
    for (const parameter of parameters) insertFixtureType(types, interner, { kind: "param", parameter });
    return interner;
  };
  const original = types.exportTypes(build(false), publication);
  assert.equal(original.kind, "complete");
  assert.deepEqual(types.exportTypes(build(true), publication).table, original.table);
  for (const dimension of ["maximumWork", "maximumCreatedRecords"]) {
    let boundary;
    for (let maximum = 0; maximum < 200; maximum++) {
      const result = types.exportTypes(build(false), { ...publication, [dimension]: maximum });
      if (result.kind === "complete") { boundary = maximum; break; }
      assert.equal(result.kind, "resource-limit");
      assert.equal(result.maximum, maximum);
    }
    assert.equal(Number.isSafeInteger(boundary), true, "each actual dimension reaches its independent exact boundary");
  }
});

test("the same binding account preserves both exact dimensions, sticky original stop and no post-stop input read", () => {
  const value = { vector: types.rigidBindings(scope()), scope: scope() };
  const run = (maximumWork, maximumResultEntries, bindings = [value]) => {
    const account = createAccount({ maximumWork, maximumResultEntries });
    const result = types.verifyBindings(bindings, 0, (work, entries) => chargeWork(account, work) ?? chargeResultEntries(account, entries));
    return { account, result };
  };
  for (const dimension of ["work", "entries"]) {
    let boundary;
    for (let maximum = 0; maximum < 2000; maximum++) {
      const current = run(dimension === "work" ? maximum : 100000, dimension === "entries" ? maximum : 100000);
      if (current.result.kind === "complete") { boundary = maximum; break; }
      assert.equal(current.result.kind, "resource-stop");
      assert.equal(current.result.stop, accountFailure(current.account));
      assert.equal(types.verifyBindings(null, 0, () => chargeWork(current.account, 1)).stop, current.result.stop);
    }
    assert.equal(Number.isSafeInteger(boundary), true);
  }
  const account = createAccount({ maximumWork: 1000, maximumResultEntries: 1000 });
  const original = refuseAccount(account, { kind: "refused", diagnostics: [] });
  let reads = 0;
  const unread = new Proxy([], { get() { reads++; throw new Error("original refusal precedes binding input access"); } });
  assert.equal(types.verifyBindings(unread, 0, (work, entries) => chargeWork(account, work) ?? chargeResultEntries(account, entries)).stop, original);
  assert.equal(reads, 0);
});
