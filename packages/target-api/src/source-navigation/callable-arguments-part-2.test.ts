import assert from "node:assert/strict";

import test from "node:test";

import type { Node } from "@tsonic/tsts";

import { sourceExpressionCallArgument } from "./callable-arguments.js";
import * as callableArguments from "./callable-arguments.js";

import { fixture } from "./callable-arguments-fixtures.js";

test("checked call arguments are selected independently of closed callable ABI eligibility", () => {
  for (const body of [
    "consume((value: unknown): void => {});",
    "consume((((value: unknown): void => {})));",
    "consume(((value: unknown): void => {}) satisfies ((value: unknown) => void));",
    "consume(function recurse(value: unknown): void { if (value !== undefined) recurse(undefined); });",
    "consume(function self(value: unknown): void { const alias = self; if (alias !== self) throw value; });",
  ]) {
    const current = fixture(body, true);
    const flow = current.source.navigation.expressionValueFlow(current.expression);
    assert.equal(flow.aliasDeclarations.length, 0, body);
    assert.equal(flow.uses.length, 1, body);
    const selected = sourceExpressionCallArgument(flow.uses[0]!.reference, current.source);
    assert.equal(selected !== undefined, true, body);
    assert.equal(selected!.argumentIndex, 0, body);
    assert.equal(current.source.semantics.forNode(selected!.call).operations.call(selected!.call)
      ?.sourceArguments[0]?.expression === selected!.argument, true, body);
    assert.equal(Object.isFrozen(selected), true, body);
    assert.equal(current.select()?.length, 1, "approved C-1396: named and anonymous expressions keep the same direct slot");
    assert.equal("sourceClosedCallableArguments" in callableArguments, false,
      "the exact slot does not restore the deleted native ABI classifier");
    assert.deepEqual(Object.keys(selected!).sort(), ["argument", "argumentIndex", "call"]);
  }
});

test("checked argument selection does not authorize mutable or named callable ABI transport", () => {
  for (const body of [
    "let callback = (value: unknown): void => {}; consume(callback);",
    "const callback = function recurse(value: unknown): void { if (value !== undefined) recurse(undefined); }; consume(callback);",
  ]) {
    const current = fixture(body);
    const arguments_ = current.source.navigation.expressionValueFlow(current.expression).uses.filter(use => use.role === "argument");
    assert.equal(arguments_.length, 1, body);
    assert.equal(sourceExpressionCallArgument(arguments_[0]!.reference, current.source) !== undefined, true, body);
    const selected = current.select();
    assert.equal(selected?.length, 1, `${body}: approved C-1396 raw slot, not native callable admission`);
    assert.deepEqual(Object.keys(selected![0]!).sort(), ["argument", "argumentIndex", "call"]);
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
    const uses = current.source.navigation.expressionValueFlow(current.expression).uses;
    assert.equal(uses.length > 0, true, body);
    for (const use of uses) {
      if (use.role === "storage") continue;
      assert.equal(sourceExpressionCallArgument(use.reference, current.source) === undefined, true, body);
    }
  }
  const current = fixture("consume((value: unknown): void => {});", true);
  const reference = current.source.navigation.expressionValueFlow(current.expression).uses[0]!.reference;
  for (const checked of [undefined, { sourceArguments: [{ expression: {} }] }]) {
    const source = { ...current.source, semantics: { ...current.source.semantics, forNode: () => ({
      operations: { call: () => checked },
    }) } } as unknown as typeof current.source;
    assert.equal(sourceExpressionCallArgument(reference, source) === undefined, true, "exact checked argument required");
  }
});

test("checked argument selection retains bounded grouping and exact call indexes", () => {
  const indexed = fixture(`declare function pair(prefix: string, callback: (value: unknown) => void): void;
    pair("prefix", (value: unknown): void => {});`, true);
  const selected = sourceExpressionCallArgument(indexed.expression, indexed.source);
  assert.equal(selected !== undefined, true, "exact second argument");
  assert.equal(selected!.argumentIndex, 1, "no assumed first-argument position");
  assert.equal(indexed.source.semantics.forNode(selected!.call).operations.call(selected!.call)
    ?.sourceArguments[1]?.expression === selected!.argument, true, "exact checked second-argument identity");
  const duplicated = { ...indexed.source, ast: { ...indexed.source.ast,
    arguments: (node: Node | undefined) => node === selected!.call ? [indexed.expression, indexed.expression] : indexed.source.ast.arguments(node),
  } };
  assert.equal(sourceExpressionCallArgument(indexed.expression, duplicated) === undefined, true, "unique AST argument position");
  const current = fixture("consume(" + "(".repeat(257) + "(value: unknown): void => {}" + ")".repeat(257) + ");", true);
  const reference = current.source.navigation.expressionValueFlow(current.expression).uses[0]!.reference;
  assert.equal(sourceExpressionCallArgument(reference, current.source) === undefined, true, "bounded parent traversal");
});

test("checked argument selection consumes only the exact AST and semantic reader view", () => {
  for (const body of [
    "consume((value: unknown): void => {});",
    "consume((((value: unknown): void => {})));",
    "consume(((value: unknown): void => {}) satisfies ((value: unknown) => void));",
    "consume(function recurse(value: unknown): void { if (value !== undefined) recurse(undefined); });",
  ]) {
    const current = fixture(body, true);
    const view: Parameters<typeof sourceExpressionCallArgument>[1] = Object.freeze({
      ast: current.source.ast,
      semantics: Object.freeze({ forNode: current.source.semantics.forNode }),
    });
    const selected = sourceExpressionCallArgument(current.expression, view);
    assert.equal(selected !== undefined, true, body);
    const checked = view.semantics.forNode(selected!.call).operations.call(selected!.call);
    assert.equal(checked?.sourceArguments[selected!.argumentIndex]?.expression === selected!.argument, true,
      "the structural reader retains exact checked argument identity");
    assert.equal(checked?.sourceSelectedSignatureKind, "resolved", "the original checked signature remains selected");
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
    const view: Parameters<typeof sourceExpressionCallArgument>[1] = {
      ast: current.source.ast, semantics: { forNode: current.source.semantics.forNode },
    };
    for (const use of current.source.navigation.expressionValueFlow(current.expression).uses) {
      if (use.role === "storage") continue;
      assert.equal(sourceExpressionCallArgument(use.reference, view) === undefined, true, body);
    }
  }
  const current = fixture("consume((value: unknown): void => {});", true);
  const selected = sourceExpressionCallArgument(current.expression, current.source);
  assert.equal(selected !== undefined, true, "the real source supplies the positive identity witness");
  for (const missing of [false, true]) {
    const view: Parameters<typeof sourceExpressionCallArgument>[1] = {
      ast: current.source.ast,
      semantics: { forNode(node: Node) {
        const actual = current.source.semantics.forNode(node);
        return { ...actual, operations: { ...actual.operations, call(call: Node) {
          const checked = actual.operations.call(call);
          return missing || checked === undefined ? undefined : { ...checked, sourceArguments: checked.sourceArguments.map(argument =>
            ({ ...argument, expression: selected!.call })) };
        } } };
      } },
    };
    assert.equal(sourceExpressionCallArgument(current.expression, view) === undefined, true,
      missing ? "missing checked call stays refused" : "a different real source node cannot replace the exact argument");
  }
  const duplicated: Parameters<typeof sourceExpressionCallArgument>[1] = {
    ast: { ...current.source.ast, arguments: node => node === selected!.call
      ? [selected!.argument, selected!.argument] : current.source.ast.arguments(node) },
    semantics: { forNode: current.source.semantics.forNode },
  };
  assert.equal(sourceExpressionCallArgument(current.expression, duplicated) === undefined, true,
    "an AST reader must still prove one unique argument slot");
});
