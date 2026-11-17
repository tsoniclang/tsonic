import assert from "node:assert/strict";
import test from "node:test";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { checkedSource, namedDeclaration, namedVariable, projectSourceFile } from "../fixtures/source-navigation.mjs";

const globals = `
interface Object {} interface Function {} interface CallableFunction extends Function {}
interface NewableFunction extends Function {} interface IArguments {} interface Boolean {}
interface Number {} interface String {} interface RegExp {}
interface Array<T> { [index: number]: T; length: number; }
`;

for (const arrow of [false, true]) {
  for (const escapes of [false, true]) {
    test(`a ${arrow ? "stored arrow" : "named function"} input keeps ${escapes ? "its returned callable exposure" : "its private local origin"}`, async () => {
      const declaration = arrow
        ? "const accept = (value: object): object => value;"
        : "function accept(value: object): object { return value; }";
      const body = escapes
        ? "export function retained(): (value: object) => object { accept({}); return accept; }"
        : "export function retained(): object { return accept({}); }";
      const checked = await checkedSource(`callable-exposure-${arrow}-${escapes}`, {
        "globals.d.ts": globals,
        "src/index.ts": `${declaration}\n${body}`,
      });
      assert.equal(checked.diagnostics.length, 0, "source is valid without extra annotations");
      assert.equal(checked.extensionDiagnostics.length, 0, "checked source facts are complete");
      const source = createTargetSourceProgram(checked);
      const file = projectSourceFile(source, "src/index.ts");
      const owner = arrow
        ? source.ast.as.AsVariableDeclaration(namedVariable(source.ast, file, "accept")).Initializer
        : namedDeclaration(source.ast, file, "accept");
      const parameter = source.ast.parameters(owner)[0];
      assert.equal(parameter !== undefined, true, "the original callable has its actual parameter");
      const storage = createSourceStorageQuery(source, source.navigation.sourceFiles);
      const subject = storage.subject(parameter, "input");
      assert.equal(subject.kind, "resolved", "the graph owns the original formal");
      const selected = storage.closedOriginsFor(subject.subject);
      assert.equal(selected.kind, escapes ? "open" : "complete", "observed local callers never erase external callable inputs");
      if (escapes) {
        const exposure = namedDeclaration(source.ast, file, "retained");
        assert.equal(selected.boundaries.some(boundary => boundary.kind === "external-input" && boundary.exposure === exposure), true,
          "the returned callable retains the exact public exposure");
      } else {
        assert.equal(selected.origins.length > 0 && selected.origins.every(origin => source.ast.is.IsObjectLiteralExpression(origin.subject.node)), true,
          "a nonescaping private helper retains only its actual local allocation");
      }
      assert.equal(storage.failureReason(), undefined, "no resource or missing-correspondence fallback is used");
    });
  }
}
