import assert from "node:assert/strict";

import test from "node:test";

import { defaultSourceDeclarationOwnershipLimits } from "./contracts.js";

import { fixture, identity, sourcePosition } from "./generic-adoption-fixtures.js";
import { checkedOperation } from "./generic-adoption-part-3-fixtures.js";

test("generic adoption provenance has one canonical Unicode/CRLF span and project-relative format", () => {
  const text = 'const marker = "界😀";\r\nasync function identity<Value>(value: Value) {\r\n\treturn value;\r\n}\r\n' +
    "export function reject(promised: Promise<number>): void {\r\n\tvoid identity(promised);\r\n}";
  const expectedSpan = { fileName: "index.ts", line: 6, column: 7, endLine: 6, endColumn: 25 };
  const expectedCoordinates = { declaration: { line: 2, column: 1 }, operation: { line: 3, column: 2 } };
  const results = ["/checkout/rust/src", "/another/csharp/src"].map(root => {
    const current = fixture(text, root);
    const selected = current.query();
    assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "complete provenance");
    if (selected.kind !== "resolved") return undefined;
    assert.equal(selected.issues.length, 0, `${root}: approved C1373, one supported original instantiation`);
    const operation = checkedOperation(current, "identity(promised)");
    const declaration = operation.declaration;
    const returned = current.nodes.find(node => current.source.ast.is.IsReturnStatement(node) &&
      current.textFor(node) === "return value;");
    assert.equal(declaration !== undefined && returned !== undefined, true, `${root}: original related nodes remain`);
    if (declaration === undefined || returned === undefined) return undefined;
    const coordinates = { declaration: sourcePosition(current.source, declaration),
      operation: sourcePosition(current.source, returned) };
    assert.deepEqual(operation.sourceSpan, expectedSpan, `${root}: UTF-8 offsets, scalar columns and CRLF lines`);
    assert.deepEqual(coordinates, expectedCoordinates, `${root}: exact original declaration and return coordinates`);
    assert.equal(Object.isFrozen(selected.issues), true, `${root}: immutable completed publication`);
    return { sourceSpan: operation.sourceSpan, coordinates };
  });
  assert.deepEqual(results[0], results[1], "a different target checkout cannot change diagnostic provenance bytes");
});

test("mutual generic forwarding uses one finite SCC and keeps exact actual instantiation sites", () => {
  const current = fixture(`
    async function left<T>(value: T, count: number): Promise<void> { if (count > 0) await right(value, count - 1); }
    async function right<U>(value: U, count: number): Promise<void> {
      if (count > 0) await left(value, count - 1); void Promise.resolve(value);
    }
    const promised = Promise.resolve(7); void left(7, 2); void left(promised, 2);
  `);
  for (let count = 0; count < 2; count++) {
    const selected = current.query();
    assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "finite mutually recursive summary");
    if (selected.kind !== "resolved") continue;
    assert.equal(selected.issues.length, 0, "approved C1373: recursive declarations retain supported native results");
    checkedOperation(current, "left(7, 2)");
    checkedOperation(current, "left(promised, 2)");
  }
  const exhausted = current.query(1);
  assert.equal(exhausted.kind === "unresolved" && exhausted.cause.kind === "resource-limit" &&
    exhausted.cause.category === "step" && exhausted.cause.limit === 1 &&
    current.nodes.includes(exhausted.cause.subject), true,
    "budget exhaustion publishes neither an empty safe summary nor a partial refusal set");
  assert.equal("issues" in exhausted, false, "an exhausted relation never publishes partial issues");
});

test("native payload containers, ordinary library generics and primitive constraints do not become generic adoption", () => {
  const current = fixture(`
    ${identity}
    async function primitive<T extends number>(value: T): Promise<T> { return value; }
    async function container<T>(value: T[]): Promise<T[]> { return value; }
    const promised = Promise.resolve(7);
    void identity(7); void identity("exact"); void primitive(7); void container([promised]);
    void [1, 2].map(async value => value); void Promise.all([promised]);
    async function library(): Promise<void> { await Promise.all([1, 2].map(async value => value)); }
  `);
  const selected = current.query();
  assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
    selected.kind === "unresolved" ? selected.reason : "native payload containers and ambient generic binders are not adoption sites");
});

test("unknown and any actuals keep their checked non-thenable boundary", () => {
  const current = fixture(`${identity}\ndeclare const unknownValue: unknown; declare const anyValue: any;
    void identity(unknownValue); void identity(anyValue);`);
  const selected = current.query();
  assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
    "the checker, not Promise-shaped spelling, owns the actual awaitable selection");
});

test("target-owned erased lifetime parameters use their exact declarations, never a parameter-name guess", () => {
  const current = fixture(`async function marker<Region>(value: Region) { return value; }
    const promised = Promise.resolve(7); void marker(promised);`);
  const parameter = current.nodes.find(node => current.source.ast.is.IsTypeParameterDeclaration(node));
  assert.equal(parameter !== undefined, true, "actual target-marked parameter");
  const selection = current.query(defaultSourceDeclarationOwnershipLimits.maximumSteps, node => node === parameter);
  assert.equal(selection.kind === "resolved" && selection.issues.length === 0, true, "one explicit target-owned erased marker");
  const ordinary = current.query();
  assert.equal(ordinary.kind === "resolved" && ordinary.issues.length === 0, true,
    "approved C1373: the original declared result is supported with or without an erased marker");
  checkedOperation(current, "marker(promised)");
  const used = fixture("async function marker<Region>(value: Region) { return await value; }");
  const marked = used.nodes.find(node => used.source.ast.is.IsTypeParameterDeclaration(node));
  assert.equal(marked !== undefined, true, "the local used-result control has its exact checked formal");
  const exempt = used.query(defaultSourceDeclarationOwnershipLimits.maximumSteps, node => node === marked);
  assert.equal(exempt.kind === "resolved" && exempt.issues.length === 0, true, "only the exact target-marked formal is exempt");
  const required = used.query();
  assert.equal(required.kind === "resolved" && required.issues.length === 1 &&
    required.issues[0]!.parameter === marked && used.textFor(required.issues[0]!.site) === "await value", true,
  "the same parameter name alone never exempts a used-result bare-parameter await");
});

test("a project member named Promise.resolve is not a native Promise resolving owner", () => {
  const current = fixture(`export {};
    const local = { resolve<Value>(value: Value): Value { return value; } };
    function wrap<T>(value: T): void { void local.resolve(value); }
    const promised = Promise.resolve(7); void wrap(promised);
  `);
  const selected = current.query();
  assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
    "only the actual checked configured-library/provider declaration owns Promise resolution");
});

for (const [name, body] of [
  ["unused-named", "async function unused() { return value; } return 1;"],
  ["discarded-arrow", "async () => value; return 1;"],
  ["type-only", "async function unused() { return value; } type OnlyType = typeof unused; return 1;"],
  ["erased-forwarding", "function unused() { return identity(value); } return 1;"],
]){
test(`generic adoption excludes only the canonical ${name} subtree`, () => {
    const current = fixture(`${identity}\nfunction consume<T>(value: T) { ${body} }
      const promised = Promise.resolve(1); void consume(promised);`);
    const selected = current.query();
    assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
      selected.kind === "unresolved" ? selected.reason : "an erased body has no runtime adoption operation");
  });
}

for (const [name, declaration, invoked] of [
  ["called-nested", "function consume<T>(value: T) { async function inner() { return value; } return inner(); }", "consume"],
  ["hoisted-call", "function consume<T>(value: T) { return inner(); async function inner() { return value; } }", "consume"],
  ["returned-arrow", "function consume<T>(value: T) { return async () => value; }", "consume"],
  ["stored-arrow", "function consume<T>(value: T) { const queue: (() => Promise<T>)[] = []; const later = async () => value; queue.push(later); }", "consume"],
  ["invoked-arrow", "function consume<T>(value: T) { return (async () => value)(); }", "consume"],
  ["overloaded", "function identity2<V>(value: V): Promise<V>; async function identity2<V>(value: V): Promise<V> { return value; }", "identity2"],
] as const){
test(`generic adoption retains the complete ${name} source domain`, () => {
    const current = fixture(`${declaration}\nconst promised = Promise.resolve(1); void ${invoked}(promised);`);
    const selected = current.query();
    assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : name);
    if (selected.kind !== "resolved") return;
    assert.equal(selected.issues.length, 0, "approved C1373: the complete declared source domain adopts natively");
    checkedOperation(current, `${invoked}(promised)`);
  });
}

test("interface and abstract generic signatures stay fail-closed without a source implementation", () => {
  const current = fixture(`
    interface Contract { identity<Value>(value: Value): Promise<Value>; }
    abstract class Base { abstract identity<Value>(value: Value): Promise<Value>; }
    function reject(contract: Contract, base: Base, promised: Promise<number>): void {
      void contract.identity(promised); void base.identity(promised);
    }
  `);
  const selected = current.query();
  assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "two unknown source contracts");
  if (selected.kind !== "resolved") return;
  assert.equal(selected.issues.length, 0, "both bodyless declarations keep their completed native signatures");
  for (const expression of ["base.identity(promised)", "contract.identity(promised)"]) {
    const call = current.nodes.find(node => current.source.ast.is.IsCallExpression(node) &&
      current.textFor(node) === expression);
    assert.equal(call !== undefined, true, "the original native generic call remains checked");
    if (call === undefined) continue;
    const semantics = current.source.semantics.forNode(call);
    const completed = semantics.operations.call(call);
    const nativeDeclaration = completed === undefined ? undefined :
      semantics.declarations.signatureDeclaration(completed.selectedSignature);
    assert.equal(nativeDeclaration !== undefined && current.nodes.includes(nativeDeclaration) &&
      current.source.ast.body(nativeDeclaration) === undefined, true, "the actual selected native declaration has no source body");
    const bindings = completed?.sourceSelectedMethodTypeArguments;
    assert.equal(bindings?.length === 1 && semantics.types.awaitedType(bindings[0]!.selectedType) !== undefined &&
      !semantics.types.isIdentical(semantics.types.awaitedType(bindings[0]!.selectedType)!, bindings[0]!.selectedType), true,
      "the native signature preserves the original Promise-valued generic argument");
    if (bindings?.length !== 1) continue;
    const symbol = semantics.declarations.typeSymbol(bindings[0]!.typeParameter);
    assert.equal(symbol !== undefined && semantics.declarations.symbolDeclarations(symbol)
      .some(parameter => current.nodes.includes(parameter) && current.source.ast.is.IsTypeParameterDeclaration(parameter)), true,
    "the generic argument remains bound to its original checked formal");
  }
});
