import assert from "node:assert/strict";
import test from "node:test";
import { fieldFactKey, structFactKey, type ReadonlySourceFactResolver } from "@tsonic/tsts";
import { createHostSourceProgramFixture } from "../host-program-fixtures.js";
import { sourceTypeDescriptorStructure } from "@tsonic/target-api/source";
import { checkSource, createCleanSourceCoreSession } from "../extension/source-extension.fixtures.js";

function fixture(text: string) {
  const { session } = createCleanSourceCoreSession(`import { struct, field } from "@tsonic/core/lang.js";
    import type { int32, float32 } from "@tsonic/core/types.js"; ${text}`);
  const checked = checkSource(session);
  const source = createHostSourceProgramFixture(checked);
  const declaration = source.navigation.nodes.find(node => source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === "Point");
  if (declaration === undefined) throw new Error("The actual Point declaration is required.");
  const call = source.ast.as.AsVariableDeclaration(declaration)?.Initializer;
  const input = call === undefined ? undefined : source.ast.arguments(call)[0];
  if (call === undefined || input === undefined) throw new Error("The actual struct call and input are required.");
  const outcome = source.facts.values.type(declaration);
  assert.equal(outcome !== undefined && outcome.kind !== "refused", true, "the original declaration is resolved");
  if (outcome === undefined || outcome.kind === "refused") throw new Error("The selected outcome is required.");
  return { checked, source, declaration, call, input, outcome };
}

test("struct definitions retain original field order and exact annotated destination origins", () => {
  const current = fixture(`export const Point: { readonly second: float32; first: int32 } =
    struct({ first: field<int32>(), second: field<float32>() });`);
  const pairs = current.outcome.memberCorrespondence;
  const properties = current.source.ast.properties(current.input);
  const structure = sourceTypeDescriptorStructure(current.outcome.type);
  assert.equal(pairs?.length, 2);
  assert.equal(Object.isFrozen(pairs), true);
  assert.equal(pairs?.every((pair, index) => Object.isFrozen(pair) && pair.property === properties[index]), true,
    "the original field vector, not destination order, owns association order");
  assert.equal(structure.kind === "shape" && pairs?.every(pair => structure.members.some(member => member.origin === pair.origin)) === true, true,
    "every pair retains the actual canonical returned-member origin object");
  assert.equal(pairs?.every(pair => pair.origin.kind === "declared" && !properties.includes(pair.origin.declaration)), true,
    "the annotated destination differs from each original input property");
  assert.equal(structure.kind === "shape" && structure.members.some(member => member.readonly === true &&
    member.type.kind === "primitive" && member.type.primitive === "float32"), true);
});

test("unannotated struct origins remain their exact original field properties", () => {
  const current = fixture(`export const Point = struct({ value: field<int32>() });`);
  const pair = current.outcome.memberCorrespondence?.[0];
  assert.equal(current.outcome.memberCorrespondence?.length, 1);
  assert.equal(pair?.property === current.source.ast.properties(current.input)[0] && pair?.origin.kind === "declared" &&
    pair.origin.declaration === pair.property, true);
});

test("struct call and annotated declaration publications keep their different selected destinations", () => {
  const current = fixture(`export const Point: { value: int32 } = struct({ value: field<int32>() });`);
  const called = current.source.facts.values.type(current.call);
  const callPair = called === undefined || called.kind === "refused" ? undefined : called.memberCorrespondence?.[0];
  const declarationPair = current.outcome.memberCorrespondence?.[0];
  assert.equal(callPair !== undefined && declarationPair !== undefined && callPair.property === declarationPair.property &&
    callPair.origin !== declarationPair.origin && callPair.origin.kind === "declared" && callPair.origin.declaration === callPair.property, true,
    "the retained call result cannot replace an annotated declaration's destination origin");
});

for (const missing of ["call", "property", "struct-fields", "partial", "duplicate", "foreign"] as const) {
  test(`${missing} field authority cannot publish a partial or reconstructed struct association`, () => {
    const current = fixture(`export const Point: { first: int32; second: float32 } =
      struct({ first: field<int32>(), second: field<float32>() });
      const Foreign = struct({ first: field<int32>(), second: field<float32>() });`);
    const property = current.source.ast.properties(current.input)[0];
    const fields = current.source.sourceFacts.getFact(current.call, structFactKey)?.fields;
    const field = fields?.[0];
    const fieldCall = field === undefined ? undefined : current.source.ast.parent(field.type);
    const foreign = current.source.navigation.nodes.find(node => current.source.ast.is.IsVariableDeclaration(node) &&
      current.source.ast.text(current.source.ast.name(node)) === "Foreign");
    const foreignFields = foreign === undefined ? undefined : current.source.sourceFacts.getFact(foreign, structFactKey)?.fields;
    assert.equal(property !== undefined && fieldCall !== undefined && fields?.length === 2 && foreignFields?.length === 2, true);
    const sourceFacts: ReadonlySourceFactResolver = {
      getFacts: subject => current.checked.sourceFacts.getFacts(subject),
      getVirtualDeclarationDocument: name => current.checked.sourceFacts.getVirtualDeclarationDocument(name),
      getFact(subject, key) {
      const selectedKey: unknown = key;
      if (selectedKey === fieldFactKey && subject === (missing === "call" ? fieldCall : missing === "property" ? property : undefined)) return undefined;
      const fact = current.checked.sourceFacts.getFact(subject, key);
      if (selectedKey !== structFactKey || subject !== current.declaration && subject !== current.call) return fact;
      if (missing === "struct-fields") return { valueType: true } as unknown as typeof fact;
      if (missing === "partial") return { valueType: true, fields: [field] } as unknown as typeof fact;
      if (missing === "duplicate") return { valueType: true, fields: [field, field] } as unknown as typeof fact;
      if (missing === "foreign") return { valueType: true, fields: foreignFields } as unknown as typeof fact;
      return fact;
    } };
    const selected = createHostSourceProgramFixture({ ...current.checked, sourceFacts }).facts.values.type(current.declaration);
    assert.equal(selected !== undefined && selected.kind !== "refused" && selected.memberCorrespondence === undefined, true,
      "the same valid checked program cannot reconstruct missing original marker associations");
  });
}

test("empty canonical struct inventory publishes an immutable empty vector", () => {
  const current = fixture(`export const Point = struct({});`);
  assert.equal(current.outcome.memberCorrespondence?.length, 0);
  assert.equal(Object.isFrozen(current.outcome.memberCorrespondence), true);
});
