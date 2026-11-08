import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node } from "@tsonic/tsts";
import { sourceCallableRoles, sourceEnclosing } from "./callable-boundaries.js";

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/roles.ts": `
    declare function key(value: string): "method";
    function outer() {
      class Owner {
        [key("computed")](value?: string): number;
        [key("implementation")](value = key("default")): number { return value.length; }
        field = key("instance");
        static field = key("static");
        static { key("block"); }
      }
      const stored = (value = key("arrow-default")) => key("arrow-body");
      function named(value = key("named-default")) { return key("named-body"); }
      return { Owner, stored, named };
    }
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "role controls are valid checked source");
  const { ast } = checked;
  const file = checked.getSourceFile("/src/roles.ts")!;
  const nodes: Node[] = [];
  const pending: Node[] = [file];
  while (pending.length > 0) {
    const node = pending.pop()!;
    nodes.push(node);
    ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  const outer = nodes.find(node => ast.is.IsFunctionDeclaration(node) && ast.text(ast.name(node)) === "outer")!;
  const call = (label: string): Node => {
    const selected = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.arguments(node)[0]) === label);
    assert.equal(selected !== undefined, true, `${label}: exact original call exists`);
    if (selected === undefined) throw new Error(`Missing ${label} call.`);
    return selected;
  };
  return { ast, nodes, outer, call, file };
}

test("bodyless computed names retain outer execution while defaults enter actual callable activation", () => {
  const { ast, nodes, outer, call } = fixture();
  for (const label of ["computed", "implementation"]) {
    for (const role of ["execution", "deferred"] as const) {
      assert.equal(sourceEnclosing(ast, call(label), role) === outer, true, `${label}: computed name is outside the method`);
    }
  }
  for (const label of ["default", "arrow-default", "arrow-body", "named-default", "named-body"]) {
    const owner = sourceEnclosing(ast, call(label), "execution");
    assert.equal(owner !== undefined && sourceCallableRoles(ast, owner).body, true, `${label}: exact callable activation`);
    assert.equal(sourceEnclosing(ast, call(label), "deferred") === owner, true, `${label}: named and stored activations are symmetric`);
  }
  const overload = nodes.find(node => ast.is.IsMethodDeclaration(node) && ast.body(node) === undefined)!;
  assert.equal(sourceCallableRoles(ast, overload).signature && !sourceCallableRoles(ast, overload).execution, true,
    "a bodyless overload is a signature, never an execution root");
});

test("class initializer execution retains original static barriers and per-instance deferred regions", () => {
  const { ast, outer, call } = fixture();
  for (const [label, kind, deferred] of [["instance", "KindPropertyDeclaration", true],
    ["static", "KindPropertyDeclaration", false], ["block", "KindClassStaticBlockDeclaration", false]] as const) {
    const owner = sourceEnclosing(ast, call(label), "execution");
    assert.equal(owner !== undefined && ast.kindName(owner) === kind, true, `${label}: original execution barrier`);
    assert.equal(owner !== undefined && sourceCallableRoles(ast, owner).deferred === deferred, true, `${label}: exact deferral role`);
    assert.equal(sourceEnclosing(ast, call(label), "body") === undefined, true, `${label}: no borrowed enclosing body`);
    assert.equal(sourceEnclosing(ast, call(label), "deferred") === (deferred ? owner : outer), true, `${label}: actual deferred owner`);
  }
});

test("enclosing is exclusive, signature-only syntax never creates execution, and malformed roles fail invariant", () => {
  const { ast, nodes, outer, file } = fixture();
  assert.equal(sourceEnclosing(ast, outer, "execution") === file, true, "callable creation belongs to the outer region");
  assert.equal(sourceEnclosing(ast, undefined, "execution") === undefined, true, "absent syntax has no owner");
  const type = nodes.find(node => ast.is.IsKeywordTypeNode(node));
  assert.equal(type !== undefined, true, "an original type-only component exists");
  if (type === undefined) throw new Error("Missing original type component.");
  assert.equal(sourceEnclosing(ast, type, "execution") === undefined, true, "type-only syntax never borrows a runtime root");
  assert.throws(() => Reflect.apply(sourceEnclosing, undefined, [ast, outer, "fallback"]), /exact callable role/u);
  const cyclic = { ...ast, parent: () => outer };
  assert.throws(() => sourceEnclosing(cyclic, outer, "execution"), /acyclic original parent chain/u);
  assert.equal(Object.isFrozen(sourceCallableRoles(ast, outer)), true, "role facts are immutable");
});
