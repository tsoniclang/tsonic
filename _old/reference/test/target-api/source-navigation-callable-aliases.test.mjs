import assert from "node:assert/strict";
import test from "node:test";
import { sourceTypeFlowFixture } from "./fixtures/source-type-flow-fixture.mjs";
import { createSourceCallOnlyAliasQuery } from "../../packages/target-api/dist/source-navigation/callable-aliases.js";
import { TargetCompilerResourceLimitFailure } from "../../packages/target-api/dist/artifacts.js";

function selectedValue(result) {
  assert.equal(result.kind, "resolved", "the canonical callable query resolves without hiding a Source refusal");
  return result.value.kind === "present" ? result.value.value : undefined;
}

function fixture(body) {
  const { source, file } = sourceTypeFlowFixture(`export {};
declare function operation(value: number): number;
declare function operation(value: string): string;
${body}`);
  const declarations = new Map();
  const visit = node => {
    if (source.ast.is.IsVariableDeclaration(node)) declarations.set(source.ast.text(source.ast.name(node)), node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  assert.ok(file);
  visit(file);
  const query = createSourceCallOnlyAliasQuery(source);
  return { source, select(name = "alias") {
    const declaration = declarations.get(name);
    assert.ok(declaration);
    return selectedValue(query(declaration));
  } };
}

test("call-only alias closure retains original overloads, transitive aliases and deferred calls", () => {
  const current = fixture(`const first = operation; const alias = (first satisfies typeof operation);
function invoke(): boolean { return (alias)(2) === 2 && alias("text") === "text"; }
invoke();`);
  const alias = current.select();
  assert.ok(alias);
  assert.equal(alias === current.select("first"), true, "one immutable alias closure owns both original bindings");
  assert.equal(alias.declarations.length, 2);
  assert.equal(alias.calls.length, 2);
  assert.ok(Object.isFrozen(alias) && Object.isFrozen(alias.declarations) && Object.isFrozen(alias.calls));
  const selected = alias.calls.map(call => {
    const application = current.source.facts.applications.application(call);
    assert.equal(application.kind, "resolved", "the original invocation publishes its exact selected Source signature");
    return application.value.identity.signature.declaration;
  });
  assert.equal(selected[0] !== selected[1], true, "the original calls select distinct original overload declarations");
});

test("property origins retain exact receiver and method declarations without accessor evaluation", () => {
  const current = fixture(`interface Operations { execute(value: number): number; }
declare const operations: Operations;
const alias = operations.execute; alias(3);`);
  const alias = current.select();
  assert.equal(alias?.member.kind, "present", "the callable origin retains its canonical member use");
  assert.equal(current.source.ast.kindName(alias.selectedDeclaration), "KindMethodSignature");
  assert.equal(current.source.ast.text(current.source.ast.name(alias.receiverDeclaration)), "operations");
  for (const body of [
    "const holder = { get execute(): typeof operation { return operation; } }; const alias = holder.execute; alias(3);",
    "function holder(): { execute: typeof operation } { return { execute: operation }; } const alias = holder().execute; alias(3);",
  ]) assert.equal(fixture(body).select(), undefined, body);
});

test("aliases with storage mutation, identity, opaque casts or transport do not obtain an erasure proof", () => {
  for (const body of [
    "let alias = operation; alias(2);",
    "const first = operation; let alias = first; alias = operation; alias(2);",
    "const alias = operation; function escape() { return alias; } escape();",
    "const alias = operation; function use(value: typeof operation): void {} use(alias);",
    "const alias = operation; const same = alias === operation;",
    "const alias = operation as typeof operation; alias(2);",
    "const alias = operation!; alias(2);",
    "export const alias = operation; alias(2);",
    "const alias = operation; const holder = { alias };",
  ]) assert.equal(fixture(body).select(), undefined, body);
});

test("early deferred invocation and excessive alias closures fail closed", () => {
  assert.equal(fixture("invoke(); const alias = operation; function invoke(): number { return alias(2); }").select(), undefined);
  const declarations = ["const alias = operation;"];
  for (let index = 0; index < 1_025; index += 1) declarations.push(`const alias${index} = ${index === 0 ? "alias" : `alias${index - 1}`};`);
  assert.throws(() => fixture(declarations.join("\n") + "\nalias1024(2);").select(),
    (failure) => failure instanceof TargetCompilerResourceLimitFailure &&
      failure.diagnostic.code === "TSONIC_COMPILER_RESOURCE_LIMIT" && failure.diagnostic.evidence?.[0] === "declarations=1024");
});

test("object-member alias initialization follows the factory activation, not an unrelated class contract", () => {
  for (const body of [
    "const alias = operation; const holder = { invoke() { return alias(3); } }; holder.invoke();",
    "create().invoke(); function create() { const alias = operation; return { invoke() { return alias(3); } }; }",
    "invoke(); function invoke(): number { const alias = operation; const read = () => alias(3); return read(); }",
  ]) assert.ok(fixture(body).select(), body);
  for (const body of [
    "create().invoke(); const alias = operation; function create() { return { invoke() { return alias(3); } }; }",
    "function create() { const result = read(); const alias = operation; function read() { return alias(3); } return result; } create();",
  ]) assert.equal(fixture(body).select(), undefined, body);
});
