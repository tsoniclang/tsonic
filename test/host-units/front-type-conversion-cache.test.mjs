import assert from "node:assert/strict";
import { test } from "node:test";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";

async function conversionFor(source) {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const actual = fixture.checkedModuleOf(source);
  const types = fixture.types.createTypeInterner();
  const deps = fixture.lowerDepsFor(actual.definitions, types, source);
  const operations = await import("../../packages/host/dist/front/type-conversion.js");
  const conversion = operations.createTypeConversion(deps, actual.raw);
  return { fixture, actual, types, conversion, operations };
}

test("completed graph references reuse actual signature and type mappings without another publication", async () => {
  const { fixture, actual, types, conversion, operations: { convertRawType, signatureOf } } = await conversionFor(
    "export function value(input:boolean):boolean{return input;}export const selected=value;");
  const signature = actual.raw.types.signatures.find(candidate => candidate.declaration?.node === actual.raw.tree.statements.nodes[0].id);
  assert.equal(signature !== undefined, true);
  const first = signatureOf(conversion, signature.id);
  assert.equal(first.kind, "complete");
  const table = fixture.types.viewTypes(types);
  const previousTypes = [...table.terms];
  const previousSignatures = [...table.signatures];
  const again = signatureOf(conversion, signature.id);
  assert.deepEqual(again, first);
  const result = convertRawType(conversion, signature.result.value);
  assert.equal(result.kind, "complete");
  assert.equal(result.value.type, table.signatures[first.value].result);
  assert.equal(convertRawType(conversion, signature.result.value).value === result.value, true);
  assert.equal(table.terms.length, previousTypes.length);
  assert.equal(table.terms.every((row, index) => row === previousTypes[index]), true);
  assert.equal(table.signatures.length, previousSignatures.length);
  assert.equal(table.signatures.every((row, index) => row === previousSignatures[index]), true);
  const callable = actual.raw.types.types.find(row => row.form.kind === "available" && row.form.value.kind === "structure"
    && actual.raw.types.members[row.form.value.inventory].calls.includes(signature.id));
  assert.equal(callable !== undefined, true);
  const completed = convertRawType(conversion, callable.id);
  assert.equal(completed.kind, "complete");
  const term = fixture.types.readType(types, completed.value.type);
  assert.equal(term.kind, "callable");
  assert.deepEqual(term.calls, [first.value]);
  assert.equal(table.signatures.length, previousSignatures.length);
});

test("existing scalar keyword projections retain their actual captured categories", async () => {
  for (const category of ["bigint", "object"]) {
    const { fixture, actual, types, conversion, operations } = await conversionFor(`export type Marker=${category};`);
    const alias = actual.checked.tree.statements.nodes[0];
    const row = actual.raw.types.types.find(candidate => candidate.authoredTypeNode?.node === alias.type.id);
    assert.equal(row !== undefined, true);
    const converted = operations.convertRawType(conversion, row.id);
    assert.equal(converted.kind, "complete");
    assert.deepEqual(converted.value.evidence.category, { kind: "known", category });
    assert.deepEqual(fixture.types.readType(types, converted.value.type),
      fixture.types.readType(actual.interner, alias.type.tsonic.type.value));
  }
});

test("an actual construct signature retains its qualified declaration and checked parameter and result", async () => {
  const { fixture, actual, types, conversion, operations } = await conversionFor(
    "export type Factory={new(input:boolean):boolean;};");
  const row = actual.raw.types.types.find(candidate => candidate.form.kind === "available"
    && candidate.form.value.kind === "structure" && actual.raw.types.members[candidate.form.value.inventory].constructs.length === 1);
  assert.equal(row !== undefined, true);
  const inventory = actual.raw.types.members[row.form.value.inventory];
  const capturedSignature = actual.raw.types.signatures[inventory.constructs[0]];
  const converted = operations.convertRawType(conversion, row.id);
  assert.equal(converted.kind, "complete");
  const term = fixture.types.readType(types, converted.value.type);
  assert.equal(term.kind, "callable");
  assert.equal(term.calls.length, 0);
  assert.equal(term.constructs.length, 1);
  const signature = fixture.types.readSignature(types, term.constructs[0]);
  const definition = actual.definitions.rows.find(candidate => candidate.node === capturedSignature.declaration.node);
  assert.equal(definition !== undefined, true);
  assert.equal(signature.declaration, definition.definition);
  assert.equal(signature.kind, capturedSignature.kind);
  assert.equal(signature.parameters.length, 1);
  assert.equal(signature.parameters[0].type, signature.result);
  assert.deepEqual(fixture.types.readType(types, signature.result), { kind: "primitive", primitive: "bool" });
});

test("callable graph refusal retains each original publication dimension without caching a signature", async () => {
  const { fixture, actual, operations } = await conversionFor("export function value(input:boolean):boolean{return input;}");
  const signature = actual.raw.types.signatures.find(candidate => candidate.declaration?.node === actual.raw.tree.statements.nodes[0].id);
  assert.equal(signature !== undefined, true);
  for (const [dimension, field] of [["work", "maximumWork"], ["created-records", "maximumCreatedRecords"]]) {
    const types = fixture.types.createTypeInterner();
    const deps = fixture.lowerDepsFor(actual.definitions, types, "export function value(input:boolean):boolean{return input;}", { [field]: 0 });
    const conversion = operations.createTypeConversion(deps, actual.raw);
    const result = operations.signatureOf(conversion, signature.id);
    assert.deepEqual(result, { kind: "resource-limit", dimension, maximum: 0 });
    assert.equal(conversion.convertedTypes.size, 0);
    assert.equal(conversion.convertedSignatures.size, 0);
    assert.equal(fixture.types.viewTypes(types).terms.length, 0);
    assert.equal(fixture.types.viewTypes(types).signatures.length, 0);
  }
});

test("an actual readonly index retains its write absence rather than a mutable value projection", async () => {
  const { fixture, actual } = await conversionFor("export type Indexed={readonly [key:string]:boolean};");
  const type = actual.checked.tree.statements.nodes[0].type.tsonic.type.value;
  const term = fixture.types.readType(actual.interner, type);
  assert.equal(term.kind, "shape");
  assert.equal(term.indexes.length, 1);
  assert.equal(term.indexes[0].readonly, true);
  assert.equal(term.indexes[0].write, null);
});
