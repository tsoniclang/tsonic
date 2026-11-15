import assert from "node:assert/strict";
import { test } from "node:test";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";
import { checkedDomain } from "./fixtures/front/checked-domain.mjs";

async function conversionFor(source) {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const actual = fixture.checkedModuleOf(source);
  const domain = checkedDomain(actual.checked, fixture.hir);
  const bodyOf = new Map();
  for (const component of actual.raw.types.components) for (const body of actual.checked.bodies) {
    if (domain.nodeOf({ kind: "body", value: { body: body.body, node: component.root.node } }) !== null)
      bodyOf.set(component.root.node, body.body);
  }
  const types = fixture.types.createTypeInterner();
  const deps = fixture.lowerDepsFor(actual.definitions, types, source);
  const operations = await import("../../packages/host/dist/front/type-conversion.js");
  const conversion = operations.createTypeConversion(deps, actual.raw, bodyOf);
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
