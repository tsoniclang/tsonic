import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createCompilerSessionFromFiles,
  formatDiagnostics,
  TstsSourceProviderContractVersion,
} from "@tsonic/tsts";
import type { Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "./target-source-program.js";

test("intrinsic selections do not fabricate ordinary parameter or result evidence", () => {
  const moduleSpecifier = "test:intrinsic-selection";
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: {
      "/src/index.ts": `import { expand } from "${moduleSpecifier}"; expand(missing());`,
    },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    extensionHostOptions: { extensions: [{
      identity: { id: "test.intrinsic-selection", version: "1" },
      initialize(context) {
        context.registerSourceDeclarationProvider({
          identity: {
            id: "test.intrinsic-selection.provider", version: "1",
            extensionContractVersion: TstsSourceProviderContractVersion,
          },
          declarationMaterialization: "complete",
          ownsModule: specifier => ({ kind: specifier === moduleSpecifier ? "owned" : "unowned" }),
          resolveModule: specifier => ({
            kind: "virtual", moduleSpecifier: specifier,
            providerModuleId: "test.intrinsic-selection", virtualFileName: "/virtual/intrinsic.d.ts",
          }),
          getDeclarationModel: () => ({
            moduleSpecifier, providerModuleId: "test.intrinsic-selection",
            exports: [{ id: "native.expand", name: "expand", kind: "intrinsic" }],
          }),
        });
      },
    }] },
  }).checkSource();
  assert.deepEqual(checked.extensionDiagnostics, []);
  const diagnostics = formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src");
  assert.match(diagnostics, /Cannot find name 'missing'/u);
  assert.match(diagnostics, /not callable/u);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const semantics = source.semantics.forFile(file);
  const calls: Node[] = [];
  const visit = (node: Node): void => {
    if (source.ast.is.IsCallExpression(node)) calls.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.equal(calls.length, 2);
  const invocation = calls[0];
  assert.ok(invocation);
  const selected = semantics.operations.call(invocation);
  assert.equal(selected?.outcome, "intrinsic");
  assert.equal(semantics.operations.callParameterSlots(selected), undefined);
  assert.equal(semantics.operations.callResult(selected), undefined);
});
