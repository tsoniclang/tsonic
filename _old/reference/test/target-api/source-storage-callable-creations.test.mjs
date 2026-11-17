import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/project",
    files: { "/project/index.ts": `
      function identity(value: () => number): () => number { return value; }
      const direct = () => 1;
      const local = identity(() => 2);
      const alternative = true ? (() => 3) : (() => 4);
      const alias = identity(direct);
      const primitive = 3;
      export function external(value: () => number): () => number { return identity(value); }
    ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "the source is valid without target annotations");
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/project/index.ts");
  const nodes = [];
  const pending = [file];
  while (pending.length !== 0) {
    const node = pending.pop();
    nodes.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  const initializer = name => Node_Initializer(source.ast, nodes.find(node => source.ast.is.IsVariableDeclaration(node) &&
    source.ast.text(source.ast.name(node)) === name));
  return { source, file, nodes, initializer, storage: createSourceStorageQuery(source, [file]) };
}

test("local callable creation retains exact original implementations through checked return transport", () => {
  const current = fixture();
  for (const [name, count] of [["direct", 1], ["local", 1], ["alternative", 2]]) {
    const expression = current.initializer(name);
    const selected = current.storage.localCallableCreationsFor(expression);
    assert.equal(selected.kind, "resolved", name);
    assert.equal(selected.nodes.length, count, "every exact possible original creation is retained");
    assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected.nodes), true);
    for (const node of selected.nodes) {
      assert.equal(current.nodes.includes(node), true, "original checked identity, not reconstructed syntax");
      assert.equal(current.source.ast.is.IsArrowFunction(node), true);
    }
  }
});

test("local creation rejects aliases, open inputs, noncallable and foreign expression graphs", () => {
  const current = fixture();
  for (const name of ["alias", "primitive"]) {
    assert.equal(current.storage.localCallableCreationsFor(current.initializer(name)).kind, "unresolved", name);
  }
  const externalCall = current.nodes.find(node => current.source.ast.is.IsCallExpression(node) &&
    current.source.ast.arguments(node).some(argument => current.source.ast.text(argument) === "value"));
  assert.equal(externalCall !== undefined, true);
  assert.equal(current.storage.localCallableCreationsFor(externalCall).kind, "unresolved", "open caller input");
  const foreign = fixture();
  assert.equal(current.storage.localCallableCreationsFor(foreign.initializer("local")).kind, "unresolved", "foreign checked graph");
});

test("callable creation uses the existing finite source-storage resource owner", () => {
  const current = fixture();
  const storage = createSourceStorageQuery(current.source, [current.file], { ...defaultSourceStorageLimits, maximumSteps: 1 });
  assert.equal(storage.localCallableCreationsFor(current.initializer("local")).kind, "unresolved");
  assert.equal(storage.failureReason() !== undefined, true, "budget exhaustion remains observable and fail-closed");
});
