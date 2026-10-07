import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";
import { sourceCallableDefinitionIsDiscarded } from "./expression-use.js";

test("discarded callable creation includes nested definitions but not invoked or retained bodies", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `
      export function run() {
        (() => { const erased = () => 1; return erased; });
        void (async () => { const asyncErased = () => 2; return asyncErased; });
        const retained = () => { const retainedNested = () => 3; return retainedNested; };
        (() => { const invokedNested = () => 4; return invokedNested(); })();
        const { selected = () => 5 } = { selected: undefined };
        return retained()() + selected();
      }
    `,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  const diagnostics = checked.diagnostics.filter(diagnostic => diagnostic !== undefined);
  assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics).slice(0, 1024));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.equal(file !== undefined, true, "exact checked file");
  const results = new Map<string, boolean>();
  const visit = (node: Node): void => {
    if (source.ast.is.IsVariableDeclaration(node) || source.ast.is.IsBindingElement(node)) {
      const name = source.ast.name(node);
      const initializer = source.ast.is.IsVariableDeclaration(node)
        ? source.ast.as.AsVariableDeclaration(node)?.Initializer
        : source.ast.as.AsBindingElement(node)?.Initializer;
      if (name !== undefined && initializer !== undefined && source.ast.is.IsArrowFunction(initializer)) {
        results.set(source.ast.text(name), sourceCallableDefinitionIsDiscarded(initializer, source.ast));
      }
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file!);
  assert.deepEqual([...results], [
    ["erased", true], ["asyncErased", true], ["retained", false], ["retainedNested", false],
    ["invokedNested", false], ["selected", false],
  ]);
  assert.equal(sourceCallableDefinitionIsDiscarded(file!, source.ast), false);
  assert.throws(() => sourceCallableDefinitionIsDiscarded(file!, { ...source.ast, parent: () => file! }),
    /finite acyclic source boundary/u);
});
