import assert from "node:assert/strict";
import test from "node:test";
import type { Node } from "@tsonic/tsts";
import { fixture, sourceSpan } from "./generic-adoption-fixtures.js";
import { analyzeSourceDeclarationGenericAdoption } from "./generic-adoption.js";
import { createSourceDeclarationOwnershipBudget, defaultSourceDeclarationOwnershipLimits,
  sourceDeclarationOwnershipUnresolved } from "./contracts.js";
import type { SourceDeclarationOwnershipLimits, SourceDeclarationOwnershipPremises } from "./model.js";

function select(current: ReturnType<typeof fixture>,
  completionFor: SourceDeclarationOwnershipPremises["completionFor"],
  limits: SourceDeclarationOwnershipLimits = defaultSourceDeclarationOwnershipLimits,
  nodes: readonly Node[] = current.nodes) {
  return analyzeSourceDeclarationGenericAdoption({ source: current.source, projectRoot: "/src", nodes,
    budget: createSourceDeclarationOwnershipBudget(nodes[0]!, limits), premises: { completionFor } });
}

for (const [label, body] of [
  ["assignment", "const value = await x; return value;"],
  ["return", "return await x;"],
] as const) {
  test("a used bare type-parameter await is diagnosed at its original " + label, () => {
    const current = fixture(`export async function use<T>(x: T) { ${body} }`);
    const selected = current.query();
    assert.equal(selected.kind, "resolved", "the declaration-local check is complete");
    if (selected.kind !== "resolved") return;
    assert.equal(selected.issues.length, 1, "exactly one F4 await, not a diagnostic per caller");
    const issue = selected.issues[0]!;
    const ast = current.source.ast;
    assert.equal(ast.is.IsAwaitExpression(issue.site) && current.nodes.includes(issue.site), true, "the original checked await is the subject");
    assert.equal(issue.operation === issue.site && ast.parent(issue.parameter) === issue.declaration, true,
      "the same actual generic formal and await own the diagnostic");
    assert.equal(current.textFor(issue.site), "await x");
    assert.equal(issue.message, "await of a value typed by the type parameter 'T' needs its Promise form declared. Declare it as 'x: T | Promise<T>'.");
    assert.deepEqual(issue.sourceSpan, sourceSpan(current.source, issue.site));
    assert.equal(Object.isFrozen(selected.issues) && Object.isFrozen(issue) && Object.isFrozen(issue.evidence) &&
      Object.isFrozen(issue.sourceSpan), true, "the complete diagnostic is immutable");
  });
}

test("a bare-await hint retains its actual checked type and operand names", () => {
  const current = fixture("export async function use<Value>(input: Value) { return await input; }");
  const selected = current.query();
  assert.equal(selected.kind === "resolved" && selected.issues.length === 1, true, "one exact used await");
  if (selected.kind !== "resolved" || selected.issues.length !== 1) return;
  assert.equal(selected.issues[0]!.message,
    "await of a value typed by the type parameter 'Value' needs its Promise form declared. Declare it as 'input: Value | Promise<Value>'.");
});

for (const body of ["await x;", "void (await x);", "(await x);"]) {
  test("an unused bare type-parameter await keeps native Task discard support: " + body, () => {
    const current = fixture(`export async function use<T>(x: T): Promise<void> { ${body} }`);
    const selected = current.query();
    assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true, "C1373 F3 does not require a generic result carrier");
  });
}

for (const [label, input] of [
  ["Promise", "Promise<T>"],
  ["value-or-Promise", "T | Promise<T>"],
  ["PromiseLike", "PromiseLike<T>"],
] as const) {
  test("a declared " + label + " input keeps the generic await result supported", () => {
    const current = fixture(`export async function use<T>(x: ${input}): Promise<T> { return await x; }`);
    const selected = current.query();
    assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true, "C1373 F1/F2 preserves its declared native form");
  });
}

test("a bare await never borrows a result form from its later generic calls", () => {
  const current = fixture("export async function use<T>(x: T) { return await x; } void use(7); void use(Promise.resolve(7));");
  const selected = current.query();
  assert.equal(selected.kind === "resolved" && selected.issues.length === 1, true, "one declaration-local F4 diagnosis for both actuals");
  if (selected.kind === "resolved" && selected.issues.length === 1)
    assert.equal(current.textFor(selected.issues[0]!.site), "await x");
});

test("a repeated source node cannot duplicate a bare-await diagnostic", () => {
  const current = fixture("export async function use<T>(x: T) { return await x; }");
  const awaited = current.nodes.find(node => current.source.ast.is.IsAwaitExpression(node))!;
  const selected = select(current, () => ({ kind: "not-async" }), defaultSourceDeclarationOwnershipLimits,
    [...current.nodes, awaited]);
  assert.equal(selected.kind === "unresolved" && selected.cause.kind === "required-fact" &&
    selected.at === current.nodes[0] && !("issues" in selected), true,
  "the canonical checked domain rejects duplicate input before any partial diagnostic publication");
});

for (const [category, limits] of [
  ["step", { ...defaultSourceDeclarationOwnershipLimits, maximumSteps: 1 }],
  ["row", { ...defaultSourceDeclarationOwnershipLimits, maximumTransportRows: 1 }],
] as const) {
  test("bare-await " + category + " exhaustion keeps exact resource evidence without partial issues", () => {
    const current = fixture("export async function use<T>(x: T) { return await x; }");
    const selected = select(current, () => ({ kind: "not-async" }), limits);
    assert.equal(selected.kind === "unresolved" && selected.cause.kind === "resource-limit" &&
      selected.cause.category === category && selected.cause.limit === 1 &&
      current.nodes.includes(selected.cause.subject) && !("issues" in selected), true, "finite exhaustion is not empty success");
    const complete = current.query();
    assert.equal(complete.kind === "resolved" && complete.issues.length === 1, true, "a failed query is never cached as successful");
  });
}

test("a missing native completion stays unresolved without a blanket adoption refusal", () => {
  const current = fixture("declare function native(): Promise<number>; void native();");
  const call = current.nodes.find(node => current.source.ast.is.IsCallExpression(node))!;
  const selected = select(current, node => sourceDeclarationOwnershipUnresolved(node, "missing exact native completion"));
  assert.equal(selected.kind === "unresolved" && selected.cause.kind === "required-fact" &&
    selected.at === call && !("issues" in selected), true, "supported adoption never discharges a missing native fact");
});

test("a foreign native completion cannot authorize an otherwise supported call", () => {
  const current = fixture("declare function native(): Promise<number>; void native();");
  const foreign = fixture("export function external(): Promise<number> { return Promise.resolve(7); }");
  const declaration = foreign.nodes.find(node => foreign.source.ast.is.IsFunctionDeclaration(node))!;
  const call = current.nodes.find(node => current.source.ast.is.IsCallExpression(node))!;
  const selected = select(current, (node, completed) => {
    assert.equal(node === call, true, "the attempted native proof belongs to the original call");
    return { kind: "async", resultPolicy: "must-observe", contract: { kind: "declaration", declaration,
      component: { selectedType: completed.sourceResultType, contextualCall: completed } } };
  });
  assert.equal(selected.kind === "unresolved" && selected.cause.kind === "required-fact" &&
    selected.at === call && !("issues" in selected), true, "a checked foreign declaration is not this call's native proof");
});
