/**
 * Shared helper for validator test modules.
 *
 * Provides `createTestProgram` which constructs a TsonicProgram from
 * an inline source string, suitable for feeding into `validateProgram`.
 */

import * as ts from "typescript";
import * as path from "node:path";
import { TsonicProgram } from "../program.js";
import { ExternalMetadataRegistry } from "../external-metadata.js";
import { BindingRegistry } from "../program/bindings.js";
import { createExternalBindingsResolver } from "../resolver/external-bindings-resolver.js";
import { createBinding } from "../ir/binding/index.js";
import {
  createSourceSemanticFactStore,
  createTypeScriptSemanticView,
  projectTstsFactsToTypeScriptSource,
} from "../source-frontend/index.js";
import type { TstsSourceProgram } from "../source-frontend/index.js";
import { createExtensionHost, parseTstsSourceFile } from "@tsonic/tsts";
import {
  createTsonicNumericPrimitiveExtension,
  createTsonicSourceSemanticsExtension,
} from "../tsonic-extension/index.js";

export const createTestProgram = (
  source: string,
  fileName = "test.ts",
  options: Partial<TsonicProgram["options"]> = {}
): TsonicProgram => {
  const resolvedFileName = fileName.startsWith("/")
    ? fileName
    : path.resolve(".temp/validator-cases", fileName);
  const sourceFile = ts.createSourceFile(
    resolvedFileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    strict: true,
    noEmit: true,
  };

  const host = ts.createCompilerHost(compilerOptions);
  const originalGetSourceFile = host.getSourceFile;
  host.getSourceFile = (
    name: string,
    languageVersionOrOptions: ts.ScriptTarget | ts.CreateSourceFileOptions,
    onError?: (message: string) => void,
    shouldCreateNewSourceFile?: boolean
  ) => {
    if (name === resolvedFileName) {
      return sourceFile;
    }
    return originalGetSourceFile.call(
      host,
      name,
      languageVersionOrOptions,
      onError,
      shouldCreateNewSourceFile
    );
  };

  const program = ts.createProgram([resolvedFileName], compilerOptions, host);
  const checker = program.getTypeChecker();
  const sourceFacts = createSourceSemanticFactStore<ts.Node>();
  const sourceSemantics = createTypeScriptSemanticView(checker, sourceFacts);
  const extensionHost = createExtensionHost([
    createTsonicNumericPrimitiveExtension(),
    createTsonicSourceSemanticsExtension(),
  ]);
  const tstsSourceFile = parseTstsSourceFile(source, {
    fileName: resolvedFileName,
  });
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
      throw new Error("In-memory validator test program has no TSTS checker.");
    },
  };
  projectTstsFactsToTypeScriptSource(sourceProgram, [sourceFile], sourceFacts);

  return {
    program,
    tsCompilerOptions: program.getCompilerOptions(),
    options: {
      projectRoot: "/test",
      sourceRoot: "/test",
      rootNamespace: "TestApp",
      strict: true,
      ...options,
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
};
