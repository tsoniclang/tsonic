/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/**
 * Shared test helpers for IR Builder tests.
 */

import * as ts from "typescript";
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
  createSourceSemanticFactStore,
  createTstsSourceProgram,
  createTypeScriptSemanticView,
  projectTstsFactsToTypeScriptSource,
} from "../../source-frontend/index.js";
import type { TstsSourceProgram } from "../../source-frontend/index.js";
import { createExtensionHost, parseTstsSourceFile } from "@tsonic/tsts";
import {
  createTsonicNumericPrimitiveExtension,
  createTsonicSourceSemanticsExtension,
} from "../../tsonic-extension/index.js";

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
  const sourceFacts = createSourceSemanticFactStore<ts.Node>();
  const sourceSemantics = createTypeScriptSemanticView(checker, sourceFacts);
  const extensionHost = createExtensionHost([
    createTsonicNumericPrimitiveExtension(),
    createTsonicSourceSemanticsExtension(),
  ]);
  const tstsSourceFile = parseTstsSourceFile(source, { fileName });
  if (!tstsSourceFile) {
    throw new Error(`TSTS parser did not create ${fileName}`);
  }
  extensionHost.configure();
  extensionHost.afterParseSourceFile(tstsSourceFile);
  const sourceProgram: TstsSourceProgram = {
    engine: "tsts",
    sourceFiles: [tstsSourceFile],
    extensionHost,
    diagnostics: extensionHost.diagnostics.all(),
    compilerDiagnostics: [],
    withSourceSemantics: () => {
      throw new Error("In-memory builder test program has no TSTS checker.");
    },
  };
  projectTstsFactsToTypeScriptSource(sourceProgram, [sourceFile], sourceFacts);

  const testProgram = {
    program,
    checker,
    tsCompilerOptions: program.getCompilerOptions(),
    options: {
      projectRoot: "/test",
      sourceRoot: "/test",
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
  const options = { sourceRoot: "/test", rootNamespace: "TestApp" };
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

  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(tempDir, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, contents);
  }

  const rootNames = Object.keys(files)
    .filter((relativePath) => /\.(?:ts|mts|cts|d\.ts)$/.test(relativePath))
    .map((relativePath) => path.join(tempDir, relativePath));

  const tsProgram = ts.createProgram(rootNames, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
  });

  const checker = tsProgram.getTypeChecker();
  const entryPath = path.join(tempDir, entryRelativePath);
  const sourceFile = tsProgram.getSourceFile(entryPath);
  if (!sourceFile) {
    throw new Error(`Failed to create source file for ${entryRelativePath}`);
  }
  const sourceFiles = rootNames
    .filter((filePath) => !filePath.endsWith(".d.ts"))
    .map((filePath) => tsProgram.getSourceFile(filePath))
    .filter(
      (candidate): candidate is ts.SourceFile => candidate !== undefined
    );
  const declarationSourceFiles = rootNames
    .filter((filePath) => filePath.endsWith(".d.ts"))
    .map((filePath) => tsProgram.getSourceFile(filePath))
    .filter(
      (candidate): candidate is ts.SourceFile => candidate !== undefined
    );
  const sourceProgram = createTstsSourceProgram(
    sourceFiles.map((candidate) => candidate.fileName),
    { projectRoot: tempDir }
  );
  const sourceFacts = createSourceSemanticFactStore<ts.Node>();
  projectTstsFactsToTypeScriptSource(sourceProgram, sourceFiles, sourceFacts);
  const sourceSemantics = createTypeScriptSemanticView(checker, sourceFacts);

  const testProgram = {
    program: tsProgram,
    checker,
    tsCompilerOptions: tsProgram.getCompilerOptions(),
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
