import assert from "node:assert/strict";
import test from "node:test";
import type { Node } from "@tsonic/tsts";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram, sourceNodeIdentity, generatedTypeParameterNames, authoredTypeParameterNames, sourceEnclosingGenericParameters } from "../public/source.js";

test("generated binder naming reserves authored and preferred names without changing identity", () => {
  const parameters = [
    { identity: "outer", name: "T" }, { identity: "inner", name: "T" },
    { identity: "preferred", name: "CapturedT" }, { identity: "outer", name: "T" },
  ];
  assert.deepEqual([...generatedTypeParameterNames(parameters, ["T", "CapturedT2"])], [
    ["outer", "CapturedT3"], ["inner", "CapturedT4"], ["preferred", "CapturedT"],
  ]);
  assert.equal(parameters[0]?.name, "T");
  assert.deepEqual([...generatedTypeParameterNames(parameters, [])], [
    ["outer", "T"], ["inner", "CapturedT2"], ["preferred", "CapturedT"],
  ]);
});

test("authored binder inventory excludes only selected declaration identities", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    files: { "/src/index.ts": `class Box<T> { first<U>(value: U): U { return value; } second<T>(value: T): T { return value; } }` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  }).checkSource();
  assert.deepEqual(checked.diagnostics, []);
  const { ast } = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const declaration = ast.statements(file)[0];
  assert.ok(declaration);
  const parameter = ast.typeParameters(declaration)[0];
  assert.ok(parameter);
  const identity = sourceNodeIdentity(ast, parameter);
  assert.ok(identity);
  assert.deepEqual(authoredTypeParameterNames(declaration, ast), ["T", "U"]);
  assert.deepEqual(authoredTypeParameterNames(declaration, ast, new Set([identity])), ["U", "T"]);
});

test("enclosing binder inventory retains unused original owners, not invocation binders or sibling names", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    files: { "/src/index.ts": `class Box<Outer> {
      make<Outer>() { return <Invocation>(value: Invocation): Invocation => value; }
      sibling<Other>(value: Other): Other { return value; }
    }` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "the original shadowed and unused enclosing binders are valid checked source");
  const { ast } = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.equal(file !== undefined, true, "the exact checked source file is present");
  if (file === undefined) return;
  const owner = ast.statements(file)[0];
  assert.equal(owner !== undefined, true, "the original outer class owns one binder");
  if (owner === undefined) return;
  let arrow: Node | undefined;
  let method: Node | undefined;
  const visit = (node: Node): void => {
    if (ast.is.IsArrowFunction(node)) arrow = node;
    if (ast.is.IsMethodDeclaration(node) && ast.text(ast.name(node)) === "make") method = node;
    ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(owner);
  assert.equal(arrow !== undefined && method !== undefined, true, "the actual nested factory and expression are retained");
  if (arrow === undefined || method === undefined) return;
  const parameters = sourceEnclosingGenericParameters(arrow, ast);
  assert.equal(parameters !== undefined && parameters.length === 2, true, "both unused enclosing generic identities survive");
  if (parameters === undefined) return;
  assert.equal(parameters[0] === ast.typeParameters(method)[0] &&
    parameters[1] === ast.typeParameters(owner)[0], true, "shadowed names keep the exact distinct original declaration objects");
  assert.equal(parameters[0] !== parameters[1] && Object.isFrozen(parameters), true,
    "the inventory is immutable, not a name-based merged binding or a source capture");
  assert.equal(sourceEnclosingGenericParameters(owner, ast)?.length, 0, "a declaration's own invocation binders are not enclosing inputs");
  assert.equal(sourceEnclosingGenericParameters(arrow, { ...ast, parent: () => arrow }) === undefined, true,
    "cyclic ancestry is not an invented empty environment");
});
