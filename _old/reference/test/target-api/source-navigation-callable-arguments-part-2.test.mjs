import assert from "node:assert/strict";
import test from "node:test";
import { sourceExpressionCallArgument } from "../../packages/target-api/dist/source-navigation/callable-arguments.js";
import * as callableArguments from "../../packages/target-api/dist/source-navigation/callable-arguments.js";
import { fixture } from "./fixtures/source-navigation/callable-arguments-fixtures.mjs";

function resolved(result) {
  assert.equal(result.kind, "resolved", "the original argument question resolves without a Source refusal");
  return result.value;
}

function present(result) {
  const selected = resolved(result);
  assert.equal(selected.kind, "present", "the exact original argument slot is present");
  return selected.value;
}

function application(source, call) {
  return resolved(source.facts.applications.application(call));
}

function reader(source, applicationQuery = source.facts.applications.application) {
  return { ast: source.ast, facts: { ...source.facts, applications: { application: applicationQuery } } };
}

test("checked call arguments are selected independently of closed callable ABI eligibility", () => {
  for (const body of [
    "consume((value: unknown): void => {});",
    "consume((((value: unknown): void => {})));",
    "consume(((value: unknown): void => {}) satisfies ((value: unknown) => void));",
    "consume(function recurse(value: unknown): void { if (value !== undefined) recurse(undefined); });",
    "consume(function self(value: unknown): void { const alias = self; if (alias !== self) throw value; });",
  ]) {
    const current = fixture(body, true);
    const flow = current.source.facts.navigation.expressionValueFlow(current.expression);
    assert.equal(flow.aliasDeclarations.length, 0, body);
    assert.equal(flow.uses.length, 1, body);
    const selected = present(sourceExpressionCallArgument(flow.uses[0].reference, current.source));
    assert.equal(selected.argumentIndex, 0, body);
    const checked = application(current.source, selected.call);
    assert.equal(checked.sourceArguments[0]?.occurrence === selected.argument, true, body);
    assert.equal(Object.isFrozen(selected), true, body);
    assert.equal(current.select()?.length, 1, "approved C-1396: named and anonymous expressions keep the same direct slot");
    assert.equal("sourceClosedCallableArguments" in callableArguments, false,
      "the exact slot does not restore the deleted native ABI classifier");
    assert.deepEqual(Object.keys(selected).sort(), ["argument", "argumentIndex", "call"]);
  }
});

test("checked argument selection does not authorize mutable or named callable ABI transport", () => {
  for (const body of [
    "let callback = (value: unknown): void => {}; consume(callback);",
    "const callback = function recurse(value: unknown): void { if (value !== undefined) recurse(undefined); }; consume(callback);",
  ]) {
    const current = fixture(body);
    const arguments_ = current.source.facts.navigation.expressionValueFlow(current.expression).uses.filter(use => use.role === "argument");
    assert.equal(arguments_.length, 1, body);
    assert.equal(resolved(sourceExpressionCallArgument(arguments_[0].reference, current.source)).kind, "present", body);
    const selected = current.select();
    assert.equal(selected?.length, 1, `${body}: approved C-1396 raw slot, not native callable admission`);
    assert.deepEqual(Object.keys(selected[0]).sort(), ["argument", "argumentIndex", "call"]);
    assert.equal("sourceClosedCallableArguments" in callableArguments, false, "the removed selector is absent");
  }
});

test("checked argument selection rejects nontransparent, optional, spread and unchecked references", () => {
  for (const body of [
    "const callback = (value: unknown): void => {}; consume?.(callback);",
    "const callback = (value: unknown): void => {}; consume(callback as typeof callback);",
    "const callback = (value: unknown): void => {}; consume(callback!);",
    "const callback = (value: unknown): void => {}; consume(...[callback]);",
    "const callback = (value: unknown): void => {}; callback(1);",
  ]) {
    const current = fixture(body);
    const uses = current.source.facts.navigation.expressionValueFlow(current.expression).uses;
    assert.equal(uses.length > 0, true, body);
    for (const use of uses) {
      if (use.role === "storage") continue;
      assert.equal(resolved(sourceExpressionCallArgument(use.reference, current.source)).kind, "none", body);
    }
  }
  const current = fixture("consume((value: unknown): void => {});", true);
  const reference = current.source.facts.navigation.expressionValueFlow(current.expression).uses[0].reference;
  for (const checked of [undefined, { sourceArguments: [{ occurrence: current.expression }] }]) {
    assert.throws(() => sourceExpressionCallArgument(reference, reader(current.source,
      () => checked === undefined ? undefined : { kind: "resolved", value: checked })),
    /original published application result|exact original invocation/u, "a missing published application is an invariant, never invented absence");
  }
});

test("checked argument selection retains bounded grouping and exact call indexes", () => {
  const indexed = fixture(`declare function pair(prefix: string, callback: (value: unknown) => void): void;
    pair("prefix", (value: unknown): void => {});`, true);
  const selected = present(sourceExpressionCallArgument(indexed.expression, indexed.source));
  assert.equal(selected.argumentIndex, 1, "no assumed first-argument position");
  assert.equal(application(indexed.source, selected.call).sourceArguments[1]?.occurrence === selected.argument, true,
    "exact checked second-argument identity");
  const duplicated = { ...indexed.source, ast: { ...indexed.source.ast,
    arguments: node => node === selected.call ? [indexed.expression, indexed.expression] : indexed.source.ast.arguments(node),
  } };
  assert.equal(resolved(sourceExpressionCallArgument(indexed.expression, duplicated)).kind, "none", "unique AST argument position");
  const current = fixture("consume(" + "(".repeat(257) + "(value: unknown): void => {}" + ")".repeat(257) + ");", true);
  const reference = current.source.facts.navigation.expressionValueFlow(current.expression).uses[0].reference;
  assert.equal(resolved(sourceExpressionCallArgument(reference, current.source)).kind, "none", "bounded parent traversal");
});

test("checked argument selection consumes only the exact AST and semantic reader view", () => {
  for (const body of [
    "consume((value: unknown): void => {});",
    "consume((((value: unknown): void => {})));",
    "consume(((value: unknown): void => {}) satisfies ((value: unknown) => void));",
    "consume(function recurse(value: unknown): void { if (value !== undefined) recurse(undefined); });",
  ]) {
    const current = fixture(body, true);
    const view = Object.freeze({ ast: current.source.ast, facts: current.source.facts });
    const selected = present(sourceExpressionCallArgument(current.expression, view));
    const checked = application(current.source, selected.call);
    assert.equal(checked.sourceArguments[selected.argumentIndex]?.occurrence === selected.argument, true,
      "the structural reader retains exact original argument identity");
    assert.equal(checked.identity.signature === application(current.source, selected.call).identity.signature, true,
      "the original Source signature remains selected");
    assert.equal(Object.isFrozen(selected), true, "the shared result remains immutable");
    assert.equal("navigation" in view || "source" in view || "sourceFiles" in view, false,
      "no whole source program is fabricated to supply the exact reader");
  }
});

test("exact argument reader views preserve inverse identity, optional, spread and wrapper controls", () => {
  for (const body of [
    "const callback = (value: unknown): void => {}; consume?.(callback);",
    "const callback = (value: unknown): void => {}; consume(callback as typeof callback);",
    "const callback = (value: unknown): void => {}; consume(callback!);",
    "const callback = (value: unknown): void => {}; consume(...[callback]);",
  ]) {
    const current = fixture(body);
    const view = reader(current.source);
    for (const use of current.source.facts.navigation.expressionValueFlow(current.expression).uses) {
      if (use.role === "storage") continue;
      assert.equal(resolved(sourceExpressionCallArgument(use.reference, view)).kind, "none", body);
    }
  }
  const current = fixture("consume((value: unknown): void => {});", true);
  const selected = present(sourceExpressionCallArgument(current.expression, current.source));
  for (const missing of [false, true]) {
    const view = reader(current.source, node => {
      const actual = current.source.facts.applications.application(node);
      assert.equal(actual.kind, "resolved");
      return missing ? undefined : { kind: "resolved", value: { ...actual.value,
        sourceArguments: actual.value.sourceArguments.map(argument => ({ ...argument, occurrence: selected.call })),
      } };
    });
    assert.throws(() => sourceExpressionCallArgument(current.expression, view),
      /original published application result|complete original evaluation vector/u,
      missing ? "missing published application fails invariant" : "a different original Node cannot replace the exact argument");
  }
  const duplicated = { ast: { ...current.source.ast, arguments: node => node === selected.call
    ? [selected.argument, selected.argument] : current.source.ast.arguments(node) }, facts: current.source.facts };
  assert.equal(resolved(sourceExpressionCallArgument(current.expression, duplicated)).kind, "none",
    "an AST reader must still prove one unique argument slot");
});
