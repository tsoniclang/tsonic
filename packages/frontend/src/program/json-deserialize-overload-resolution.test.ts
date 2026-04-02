import { describe, it } from "mocha";
import { expect } from "chai";
import * as path from "node:path";
import { buildModuleDependencyGraph } from "./dependency-graph.js";
import { materializeFrontendFixture } from "../testing/filesystem-fixtures.js";
import type {
  IrFunctionDeclaration,
  IrModule,
  IrReturnStatement,
} from "../ir/types.js";

const findModuleByFilePath = (
  modules: readonly IrModule[],
  filePath: string
): IrModule | undefined => {
  const normalizedTarget = filePath.replace(/\\/g, "/");
  const relativeTarget = path.basename(normalizedTarget);
  return modules.find((module) => {
    const normalizedModulePath = module.filePath.replace(/\\/g, "/");
    return (
      normalizedModulePath === normalizedTarget ||
      normalizedModulePath === relativeTarget
    );
  });
};

describe("Dependency Graph", function () {
  this.timeout(60_000);

  it("keeps explicit generic CLR member returns on imported overload families", () => {
    const fixture = materializeFrontendFixture(
      "program/json-deserialize-overload"
    );

    try {
      const tempDir = fixture.path("app");
      const entryPath = fixture.path("app/src/index.ts");
      const result = buildModuleDependencyGraph(entryPath, {
        projectRoot: tempDir,
        sourceRoot: path.join(tempDir, "src"),
        rootNamespace: "App",
        surface: "@tsonic/js",
        verbose: false,
      });

      expect(
        result.ok,
        result.ok
          ? undefined
          : result.error
              .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
              .join("\n")
      ).to.equal(true);
      if (!result.ok) {
        return;
      }

      const entryModule = findModuleByFilePath(result.value.modules, entryPath);
      expect(entryModule).to.not.equal(undefined);
      if (!entryModule) {
        return;
      }

      const parseFn = entryModule.body.find(
        (statement): statement is IrFunctionDeclaration =>
          statement.kind === "functionDeclaration" && statement.name === "parse"
      );
      expect(parseFn).to.not.equal(undefined);
      if (!parseFn) {
        return;
      }

      const returnStmt = parseFn.body.statements.find(
        (statement): statement is IrReturnStatement =>
          statement.kind === "returnStatement"
      );
      const returnExpression = returnStmt?.expression;
      expect(returnExpression).to.not.equal(undefined);
      expect(returnExpression?.inferredType?.kind).to.not.equal("unknownType");
    } finally {
      fixture.cleanup();
    }
  });
});
