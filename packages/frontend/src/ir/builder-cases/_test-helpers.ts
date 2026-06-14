/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/**
 * Shared test helpers for IR Builder tests.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createProgramContext } from "../program-context.js";
import { createProgram } from "../../program/creation.js";
import { IrExpression } from "../types.js";
import { ExternalMetadataRegistry } from "../../external-metadata.js";
import { BindingRegistry } from "../../program/bindings.js";
import { createExternalBindingsResolver } from "../../resolver/external-bindings-resolver.js";
import { createBinding } from "../binding/index.js";
import {
  createTstsSemanticView,
  createTstsSourceProgram,
} from "../../source-frontend/index.js";
import type { TstsSourceFile } from "@tsonic/tsts";
import { withCanonicalCorePackageFiles } from "../../testing/tsts-test-program.js";

export { createProgram, createProgramContext };

export const unwrapTransparentExpression = (
  expression: IrExpression | undefined
): IrExpression | undefined => {
  let current = expression;
  while (
    current &&
    (current.kind === "typeAssertion" || current.kind === "numericNarrowing")
  ) {
    current = current.expression;
  }
  return current;
};

export const createTestProgram = (
  source: string,
  fileName = "/test/test.ts"
) => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "tsonic-builder-memory-")
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
    bindings: new BindingRegistry(),
    externalResolver: createExternalBindingsResolver("/test"),
    binding: createBinding(sourceSemantics),
  };

  // Create ProgramContext for the test
  const options = { sourceRoot: tempRoot, rootNamespace: "TestApp" };
  const ctx = createProgramContext(testProgram, options);

  return { testProgram, ctx, options };
};

export const createFilesystemTestProgram = (
  files: Record<string, string>,
  entryRelativePath: string
) => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "tsonic-builder-filesystem-")
  );
  const preparedFiles = withCanonicalCorePackageFiles(files);

  for (const [relativePath, contents] of Object.entries(preparedFiles)) {
    const absolutePath = path.join(tempDir, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, contents);
  }

  const rootNames = Object.keys(preparedFiles)
    .filter((relativePath) => /\.(?:ts|mts|cts|d\.ts)$/.test(relativePath))
    .map((relativePath) => path.join(tempDir, relativePath));

  const entryPath = path.join(tempDir, entryRelativePath);
  const sourceProgram = createTstsSourceProgram(rootNames, {
    projectRoot: tempDir,
    runSemanticChecks: true,
  });
  const sourceFile = sourceProgram.sourceFiles.find(
    (candidate) => path.resolve(candidate.FileName()) === entryPath
  );
  if (!sourceFile) {
    throw new Error(`Failed to create source file for ${entryRelativePath}`);
  }
  const sourceFiles = rootNames
    .filter((filePath) => !filePath.endsWith(".d.ts"))
    .map((filePath) =>
      sourceProgram.sourceFiles.find(
        (candidate) => path.resolve(candidate.FileName()) === filePath
      )
    )
    .filter((candidate): candidate is TstsSourceFile => candidate !== undefined);
  const declarationSourceFiles = sourceProgram.sourceFiles.filter(
    (candidate) => candidate.IsDeclarationFile === true
  );
  const sourceSemantics = sourceProgram.withSourceSemantics(
    sourceFile,
    (checker) =>
      createTstsSemanticView(checker, sourceProgram.extensionHost.facts)
  );

  const testProgram = {
    options: {
      projectRoot: tempDir,
      sourceRoot: path.join(tempDir, "src"),
      rootNamespace: "TestApp",
      strict: true,
    },
    sourceFiles,
    declarationSourceFiles,
    sourceProgram,
    sourceSemantics,
    metadata: new ExternalMetadataRegistry(),
    bindings: new BindingRegistry(),
    externalResolver: createExternalBindingsResolver(tempDir),
    binding: createBinding(sourceSemantics),
  };

  const options = {
    sourceRoot: path.join(tempDir, "src"),
    rootNamespace: "TestApp",
  };
  const ctx = createProgramContext(testProgram, options);

  return {
    tempDir,
    sourceFile,
    testProgram,
    ctx,
    options,
    cleanup: () => fs.rmSync(tempDir, { recursive: true, force: true }),
  };
};
