import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram, sourceNodeIdentity, generatedTypeParameterNames, authoredTypeParameterNames } from "../public/source.js";

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
