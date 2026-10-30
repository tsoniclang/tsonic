import assert from "node:assert/strict";

import test from "node:test";

import { sourceClosedCallableArguments } from "./callable-arguments.js";

import { fixture } from "./callable-arguments.split-fixtures.js";

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
    assert.equal(sourceClosedCallableArguments(current.expression, source) === undefined, true,
      "a checked constructor cannot substitute a missing or different source argument");
  }
  for (const body of [
    "new construct(...[(value: unknown): void => {}]);",
    "new construct(function recurse(value: unknown): void { recurse(value); });",
  ]) assert.equal(fixture(body, true).select() === undefined, true, body);
});

test("inline callable context rejects named recursion, optional invocation and unchecked argument identity", () => {
  for (const body of [
    "consume(function recurse(value: unknown): void { recurse(value); });",
    "declare const optional: typeof consume | undefined; optional?.((value: unknown): void => {});",
    "consume(...[(value: unknown): void => {}]);",
  ]) assert.equal(fixture(body, true).select() === undefined, true, body);
  const current = fixture("consume((value: unknown): void => {});", true);
  const source = { ...current.source, semantics: { ...current.source.semantics, forNode: () => ({
    operations: { call: () => undefined },
  }) } } as unknown as typeof current.source;
  assert.equal(sourceClosedCallableArguments(current.expression, source) === undefined, true);
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
  ]) assert.equal(fixture(body).select() === undefined, true, body);
});
