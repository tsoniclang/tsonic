import assert from "node:assert/strict";
import test from "node:test";
import { sourceCallArgumentCorrespondences, sourceExpressionCallArgument } from "../../packages/target-api/dist/source-navigation/callable-arguments.js";
import { sourceCallableSignatures } from "../../packages/target-api/dist/source-navigation/callable-parameters.js";
import { fixture } from "./fixtures/source-navigation/callable-arguments-fixtures.mjs";

function resolved(result) {
  assert.equal(result.kind, "resolved", "the original Source question resolves");
  return result.value;
}

function selected(body) {
  const current = fixture(body, true);
  const location = resolved(sourceExpressionCallArgument(current.expression, current.source));
  assert.equal(location.kind, "present", "the original argument location is present");
  const application = resolved(current.source.facts.applications.application(location.value.call));
  return { ...current, application, context: { ast: current.source.ast, facts: current.source.facts } };
}

function admitted(current, application) {
  return { ast: current.source.ast, facts: { ...current.source.facts,
    applications: { application: () => ({ kind: "resolved", value: application }) } } };
}

test("checked correspondence retains original call, formal, binding and vector identities", () => {
  for (const body of [
    "consume((value: unknown): void => {});",
    "consume((((value: unknown): void => {})));",
    "consume(((value: unknown): void => {}) satisfies ((value: unknown) => void));",
    "new construct((value: unknown): void => {});",
  ]) {
    const current = selected(body);
    const rows = resolved(sourceCallArgumentCorrespondences(current.context, current.application));
    assert.equal(rows.length, 1, body);
    const row = rows[0];
    assert.equal(row.bindingIndex, 0, body);
    assert.equal(row.binding === current.application.arguments[0], true, body);
    assert.equal(row.argument === current.application.sourceArguments[0], true, body);
    assert.equal(row.parameter === row.binding.parameter && row.parameter.signature === current.application.identity.signature, true, body);
    const formal = row.binding.destination.declaration.origin;
    assert.equal(formal.kind === "parameter" && formal.index === row.parameter.index &&
      formal.declaration === row.parameter.declaration && formal.signature === row.parameter.signature, true, body);
    assert.equal(row.argument.occurrence === current.source.ast.arguments(current.application.identity.invocation)[0], true, body);
    assert.equal(Object.isFrozen(row) && Object.isFrozen(rows), true, body);
  }
});

test("checked correspondence keeps source and effective indexes distinct for spread elements", () => {
  const current = selected("declare function many(callback: () => void, ...values: number[]): void; many(() => {}, ...[1, 2] as const);");
  const rows = resolved(sourceCallArgumentCorrespondences(current.context, current.application));
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(row => row.bindingIndex), [0, 1, 2]);
  assert.deepEqual(rows.map(row => row.binding.sourceArgumentIndex), [0, 1, 1]);
  assert.deepEqual(rows.map(row => row.binding.effectiveArgumentIndex), [0, 1, 2]);
  assert.deepEqual(rows.map(row => row.binding.sourceForm), ["value", "spread-element", "spread-element"]);
  assert.deepEqual(rows.map(row => row.binding.spreadElementIndex), [undefined, 0, 1]);
  assert.equal(rows[1].argument === rows[2].argument, true, "one original spread, two effective elements");
  const signatures = resolved(sourceCallableSignatures(current.source, current.application.callee.value, () => {}))
    .filter(row => row.signature.identity === current.application.identity.signature);
  assert.equal(signatures.length, 1);
  assert.equal(signatures[0].signature.parameters.length, 2, "the original rest formal is never expanded");
  const rest = signatures[0].signature.parameters[1];
  assert.equal(rest.kind, "rest");
  assert.equal(rows[1].parameter.signature === rows[2].parameter.signature &&
    rows[1].parameter.index === rows[2].parameter.index && rows[1].parameter.declaration === rest.declaration &&
    rows[2].parameter.declaration === rest.declaration, true, "both effective elements retain the one original rest formal");
});

test("checked correspondence refuses invalid source, effective and selected-formal indexes", () => {
  const current = selected("consume((value: unknown): void => {});");
  const binding = current.application.arguments[0];
  for (const [caseIndex, invalid] of [
    { sourceArgumentIndex: -1 }, { sourceArgumentIndex: 0.5 }, { sourceArgumentIndex: 1 },
    { effectiveArgumentIndex: -1 }, { effectiveArgumentIndex: 0.5 },
    { parameter: { ...binding.parameter, index: -1 } },
    { parameter: { ...binding.parameter, index: 0.5 } },
    { parameter: { ...binding.parameter, index: 1 } },
    { sourceForm: "spread-element" }, { spreadElementIndex: 0 },
  ].entries()) {
    const malformed = { ...current.application, arguments: [{ ...binding, ...invalid }] };
    assert.throws(() => sourceCallArgumentCorrespondences(admitted(current, malformed), malformed),
      /exact original argument, formal and spread occurrence/u, `invalid original binding ${caseIndex}`);
  }
});

test("checked correspondence refuses foreign expressions, duplicate effective slots and foreign formals", () => {
  const current = selected("consume((value: unknown): void => {});");
  const binding = current.application.arguments[0];
  for (const malformed of [
    { ...current.application, sourceArguments: [{ ...current.application.sourceArguments[0], occurrence: current.application.identity.invocation }] },
    { ...current.application, sourceArguments: [] },
    { ...current.application, arguments: [binding, binding] },
    { ...current.application, arguments: [{ ...binding, parameter: { ...binding.parameter, index: 1 } }] },
    { ...current.application, kind: "untyped" },
  ]) {
    assert.throws(() => sourceCallArgumentCorrespondences(admitted(current, malformed), malformed),
      /original selected application kind|complete original evaluation vector|exact original argument, formal and spread occurrence/u,
      "no missing, foreign, duplicate or unselected correspondence");
  }
});

test("checked correspondence does not authorize an optional callback consumer", () => {
  const current = fixture("consume?.((value: unknown): void => {});", true);
  const parent = current.source.ast.parent(current.expression);
  assert.equal(parent !== undefined, true);
  const application = resolved(current.source.facts.applications.application(parent));
  assert.equal(resolved(sourceCallArgumentCorrespondences(current.source, application)).length, 1,
    "the original relation exists independently of native callback policy");
  assert.equal(resolved(sourceExpressionCallArgument(current.expression, current.source)).kind, "none",
    "the location consumer keeps its original optional-call refusal");
});

test("checked correspondence distinguishes foreign records from inconsistent admitted facts", () => {
  const current = selected("consume((value: unknown): void => {});");
  const foreign = selected("consume((value: unknown): void => {});");
  assert.throws(() => sourceCallArgumentCorrespondences(current.context, foreign.application),
    /original invocation/u, "a different program cannot supply this context's application");
  assert.throws(() => sourceCallArgumentCorrespondences(current.context, { ...current.application }),
    /exact published application/u, "a copied record is not the selected original application");
  const binding = current.application.arguments[0];
  for (const inconsistent of [
    { ...current.application, sourceArguments: [] },
    { ...current.application, arguments: [binding, binding] },
    { ...current.application, arguments: [{ ...binding, parameter: { ...binding.parameter, index: 1 } }] },
  ]) {
    assert.throws(() => sourceCallArgumentCorrespondences(admitted(current, inconsistent), inconsistent),
      /complete original evaluation vector|exact original argument, formal and spread occurrence/u,
      "an admitted inconsistent fact must not silently become an unsupported input");
  }
});
