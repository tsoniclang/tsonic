import assert from "node:assert/strict";

import test from "node:test";

import * as callableArguments from "./callable-arguments.js";
import { sourceExpressionCallArgument } from "./callable-arguments.js";
import { sourceMayReadBeforeInitialization } from "./initialization-uses.js";

import { fixture } from "./callable-arguments-fixtures.js";

test("closed callable arguments preserve exact checked calls through stable aliases and grouping", () => {
  const current = fixture(`const callback = (value: unknown): void => {};
const alias = callback;
consume((((alias))));
consume(callback satisfies typeof callback);`);
  const selected = current.select();
  assert.equal(selected?.length, 2);
  assert.equal(Object.isFrozen(selected), true);
  for (const item of selected ?? []) {
    assert.equal(Object.isFrozen(item), true);
    const call = current.source.semantics.forNode(item.call).operations.call(item.call);
    assert.equal(call?.sourceArguments[item.argumentIndex]?.expression === item.argument, true);
    assert.equal(item.argumentIndex, 0);
  }
});

test("inline callable arguments retain their single exact checked invocation without requiring a binding", () => {
  for (const body of [
    "consume((value: unknown): void => {});",
    "consume((((value: unknown): void => {})));",
    "consume(function(value: unknown): void {});",
  ]) {
    const current = fixture(body, true);
    const selected = current.select();
    assert.equal(selected?.length, 1, body);
    assert.equal(Object.isFrozen(selected), true);
    assert.equal(Object.isFrozen(selected![0]), true);
    const argument = selected![0]!;
    const checked = current.source.semantics.forNode(argument.call).operations.call(argument.call);
    assert.equal(checked?.sourceArguments[argument.argumentIndex]?.expression === argument.argument, true);
  }
});

test("checked constructor arguments retain the same original source-use identity as calls", () => {
  for (const body of [
    "new construct((value: unknown): void => {});",
    "new construct((((value: unknown): void => {})));",
    "new construct(function(value: unknown): void {});",
    "new construct(((value: unknown): void => {}) satisfies ((value: unknown) => void));",
  ]) {
    const current = fixture(body, true);
    const selected = current.select();
    assert.equal(selected?.length, 1, body);
    const argument = selected![0]!;
    assert.equal(current.source.ast.is.IsNewExpression(argument.call), true, body);
    assert.equal(current.source.semantics.forNode(argument.call).operations.call(argument.call)
      ?.sourceArguments[argument.argumentIndex]?.expression === argument.argument, true,
    "the constructor's actual checked source slot, not a reconstructed callback context");
    assert.equal(Object.isFrozen(selected) && Object.isFrozen(argument), true, body);
  }
  const current = fixture(`const callback = (value: unknown): void => {};
const alias = callback;
new construct(alias);
consume(callback);`);
  const selected = current.select();
  assert.equal(selected?.length, 2, "one stable callable retains both exact call and construction uses");
  assert.equal(selected!.filter(argument => current.source.ast.is.IsNewExpression(argument.call)).length, 1,
    "the original constructor use is included once");
});

test("checked constructor contexts reject missing and unrelated argument correspondence", () => {
  const current = fixture("new construct((value: unknown): void => {});", true);
  const argument = current.select()![0]!;
  const checked = current.source.semantics.forNode(argument.call).operations.call(argument.call)!;
  for (const selected of [undefined, { ...checked, sourceArguments: [] },
    { ...checked, sourceArguments: [{ ...checked.sourceArguments[0]!, expression: argument.call }] }]) {
    const source = { ...current.source, semantics: { ...current.source.semantics,
      forNode: () => ({ operations: { call: () => selected } }) } } as unknown as typeof current.source;
    assert.equal(sourceExpressionCallArgument(current.expression, source) === undefined, true,
      "a checked constructor cannot substitute a missing or different source argument");
  }
  for (const body of [
    "new construct(...[(value: unknown): void => {}]);",
    "new construct(function recurse(value: unknown): void { recurse(value); });",
  ]) {
    const current = fixture(body, true);
    const recursive = current.source.ast.is.IsFunctionExpression(current.expression);
    assert.equal(current.select() === undefined, !recursive,
      `${body}: approved C-1396 direct checked slot, not closed native ABI eligibility`);
    assert.equal("sourceClosedCallableArguments" in callableArguments, false, "the removed selector is absent");
  }
});

test("inline callable context rejects named recursion, optional invocation and unchecked argument identity", () => {
  for (const body of [
    "consume(function recurse(value: unknown): void { recurse(value); });",
    "declare const optional: typeof consume | undefined; optional?.((value: unknown): void => {});",
    "consume(...[(value: unknown): void => {}]);",
  ]) {
    const current = fixture(body, true);
    const recursive = current.source.ast.is.IsFunctionExpression(current.expression);
    assert.equal(current.select() === undefined, !recursive,
      `${body}: approved C-1396 named expression keeps its slot; optional/spread stay rejected`);
    assert.equal("sourceClosedCallableArguments" in callableArguments, false, "the removed selector is absent");
  }
  const current = fixture("consume((value: unknown): void => {});", true);
  const source = { ...current.source, semantics: { ...current.source.semantics, forNode: () => ({
    operations: { call: () => undefined },
  }) } } as unknown as typeof current.source;
  assert.equal(sourceExpressionCallArgument(current.expression, source) === undefined, true);
});

test("closed callable arguments reject every unproven transport or mutable alias", () => {
  for (const body of [
    "let callback = (value: unknown): void => {}; consume(callback);",
    "const callback = (value: unknown): void => {}; let alias = callback; consume(alias);",
    "export const callback = (value: unknown): void => {}; consume(callback);",
    "const callback = (value: unknown): void => {}; function escape() { return callback; } consume(callback);",
    "const callback = (value: unknown): void => {}; const holder = { callback }; consume(callback);",
    "const callback = (value: unknown): void => {}; const same = callback === callback; consume(callback);",
    "const callback = (value: unknown): void => {}; callback(3); consume(callback);",
    "const callback = (value: unknown): void => {}; consume(callback as typeof callback);",
    "const callback = (value: unknown): void => {}; consume(callback!);",
    "const callback = (value: unknown): void => {}; const alias: typeof callback = callback; consume(alias);",
    "const callback = function recurse(value: unknown): void { recurse(value); }; consume(callback);",
    "start(); const callback = (value: unknown): void => {}; function start() { consume(callback); }",
  ]) {
    const current = fixture(body);
    const selected = current.select();
    const nontransparent = body.includes("callback as typeof") || body.includes("callback!");
    assert.equal(selected === undefined, nontransparent,
      `${body}: approved C-1396 exact checked slot grants no ABI or ownership authority`);
    assert.equal("sourceClosedCallableArguments" in callableArguments, false, "the removed selector is absent");
    for (const argument of selected ?? []) {
      assert.deepEqual(Object.keys(argument).sort(), ["argument", "argumentIndex", "call"]);
      assert.equal(current.source.semantics.forNode(argument.call).operations.call(argument.call)
        ?.sourceArguments[argument.argumentIndex]?.expression === argument.argument, true, "the same original checked source slot");
    }
    const declaration = current.declarations.get("callback")!;
    const summary = current.source.navigation.declarationUseSummary(declaration);
    const flow = current.source.navigation.expressionValueFlow(current.expression);
    assert.equal(summary.declaration === declaration && flow.expression === current.expression, true,
      "source use and mutation facts keep the original binding, not a copied native ABI");
    if (body.startsWith("let callback")) assert.equal(current.source.ast.variableDeclarationKind(declaration), "let");
    if (body.includes("let alias")) assert.equal(current.source.ast.variableDeclarationKind(current.declarations.get("alias")!), "let");
    if (body.startsWith("export")) assert.equal(flow.exported, true, "the original export remains observed");
    if (body.includes("return callback")) assert.equal(flow.returned, true, "the original return remains observed");
    if (body.includes("const holder")) assert.equal(flow.storedOutsideBinding, true, "the original storage remains observed");
    if (body.includes("same = callback")) assert.equal(flow.identityCompared, true, "the original identity comparison remains observed");
    if (body.startsWith("start();")) assert.equal(sourceMayReadBeforeInitialization(declaration,
      current.source.ast, current.source.navigation), true, "the original early read stays a separate canonical initialization failure");
  }
});

test("closed callable argument accounting rejects an excessive alias closure", () => {
  const bindings = ["const callback = (value: unknown): void => {};"];
  for (let index = 0; index < 1_024; index += 1) bindings.push(`const alias${index} = ${index === 0 ? "callback" : `alias${index - 1}`};`);
  const current = fixture(bindings.join("\n") + "\nconsume(alias1023);");
  const selected = current.select();
  assert.equal(selected?.length, 1, "approved C-1396: one direct slot, no alias walker or raised graph cap");
  assert.equal(selected !== undefined && current.source.navigation.sourceReferenceFor(selected[0]!.argument)?.declaration ===
    current.declarations.get("alias1023"), true, "the original final alias read retains its exact checked declaration");
  assert.equal("sourceClosedCallableArguments" in callableArguments, false, "the removed selector is absent");
});
