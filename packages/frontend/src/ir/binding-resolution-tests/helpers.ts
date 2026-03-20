/**
 * Shared test helpers for binding resolution tests.
 */

import * as ts from "typescript";
import { createProgramContext } from "../program-context.js";
import { DotnetMetadataRegistry } from "../../dotnet-metadata.js";
import { BindingRegistry } from "../../program/bindings.js";
import { createClrBindingsResolver } from "../../resolver/clr-bindings-resolver.js";
import { createBinding } from "../binding/index.js";
import type { DeclId } from "../type-system/types.js";

export { buildIrModule } from "../builder.js";
export { createProgramContext } from "../program-context.js";
export { BindingRegistry } from "../../program/bindings.js";
export type { IrIdentifierExpression } from "../types.js";
export { extractTypeName } from "../converters/expressions/access/member-resolution.js";
export { resolveHierarchicalBinding } from "../converters/expressions/access/binding-resolution.js";

export const createTestDeclId = (id: number): DeclId => ({
  __brand: "DeclId",
  id,
});

export const createTestProgram = (
  source: string,
  bindings?: BindingRegistry,
  fileName = "/test/sample.ts"
) => {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS
  );

  const program = ts.createProgram(
    [fileName],
    {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
    {
      getSourceFile: (name) => (name === fileName ? sourceFile : undefined),
      writeFile: () => {},
      getCurrentDirectory: () => "/test",
      getDirectories: () => [],
      fileExists: () => true,
      readFile: () => source,
      getCanonicalFileName: (f) => f,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => "\n",
      getDefaultLibFileName: (_options) => "lib.d.ts",
    }
  );

  const checker = program.getTypeChecker();

  const testProgram = {
    program,
    checker,
    options: {
      projectRoot: "/test",
      sourceRoot: "/test",
      rootNamespace: "TestApp",
      strict: true,
    },
    sourceFiles: [sourceFile],
    declarationSourceFiles: [],
    metadata: new DotnetMetadataRegistry(),
    bindings: bindings || new BindingRegistry(),
    clrResolver: createClrBindingsResolver("/test"),
    binding: createBinding(checker),
  };

  // Create ProgramContext for the test
  const options = { sourceRoot: "/test", rootNamespace: "TestApp" };
  const ctx = createProgramContext(testProgram, options);

  return { testProgram, ctx, options };
};
