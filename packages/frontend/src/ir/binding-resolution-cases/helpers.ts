/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/**
 * Shared test helpers for binding resolution tests.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createProgramContext } from "../program-context.js";
import { ExternalMetadataRegistry } from "../../external-metadata.js";
import { BindingRegistry } from "../../program/bindings.js";
import { createExternalBindingsResolver } from "../../resolver/external-bindings-resolver.js";
import { createBinding } from "../binding/index.js";
import type { DeclId } from "../type-system/types.js";
import {
  createTstsSemanticView,
  createTstsSourceProgram,
} from "../../source-frontend/index.js";
import { withCanonicalCorePackageFiles } from "../../testing/tsts-test-program.js";

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
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "tsonic-binding-memory-")
  );
  const relativeFileName = path.basename(fileName).replace(/^\/*/, "");
  const absoluteFileName = path.join(tempRoot, relativeFileName);
  for (const [relativePath, contents] of Object.entries(
    withCanonicalCorePackageFiles({ [relativeFileName]: source })
  )) {
    const absolutePath = path.join(tempRoot, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, contents);
  }
  const sourceProgram = createTstsSourceProgram([absoluteFileName], {
    projectRoot: tempRoot,
    runSemanticChecks: true,
  });
  const sourceFile = sourceProgram.sourceFiles.find(
    (candidate) => path.resolve(candidate.FileName()) === absoluteFileName
  );
  if (!sourceFile) {
    throw new Error(`TSTS parser did not create ${absoluteFileName}`);
  }
  const sourceSemantics = sourceProgram.withSourceSemantics(
    sourceFile,
    (checker) =>
      createTstsSemanticView(checker, sourceProgram.extensionHost.facts)
  );
  const testProgram = {
    options: {
      projectRoot: tempRoot,
      sourceRoot: tempRoot,
      rootNamespace: "TestApp",
      strict: true,
    },
    sourceFiles: [sourceFile],
    declarationSourceFiles: [],
    sourceProgram,
    sourceSemantics,
    metadata: new ExternalMetadataRegistry(),
    bindings: bindings || new BindingRegistry(),
    externalResolver: createExternalBindingsResolver("/test"),
    binding: createBinding(sourceSemantics),
  };

  // Create ProgramContext for the test
  const options = { sourceRoot: tempRoot, rootNamespace: "TestApp" };
  const ctx = createProgramContext(testProgram, options);

  return { testProgram, ctx, options };
};
