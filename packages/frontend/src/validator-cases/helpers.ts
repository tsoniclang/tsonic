/**
 * Shared helper for validator test modules.
 *
 * Provides `createTestProgram` which constructs a TsonicProgram from
 * an inline source string, suitable for feeding into `validateProgram`.
 */

import * as ts from "typescript";
import { TsonicProgram } from "../program.js";
import { DotnetMetadataRegistry } from "../dotnet-metadata.js";
import { BindingRegistry } from "../program/bindings.js";
import { createClrBindingsResolver } from "../resolver/clr-bindings-resolver.js";
import { createBinding } from "../ir/binding/index.js";

export const createTestProgram = (
  source: string,
  fileName = "test.ts"
): TsonicProgram => {
  const sourceFile = ts.createSourceFile(
    fileName,
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
    if (name === fileName) {
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

  const program = ts.createProgram([fileName], compilerOptions, host);
  const checker = program.getTypeChecker();

  return {
    program,
    checker,
    options: {
      projectRoot: "/test",
      sourceRoot: "/test",
      rootNamespace: "Test",
    },
    sourceFiles: [sourceFile],
    declarationSourceFiles: [],
    metadata: new DotnetMetadataRegistry(),
    bindings: new BindingRegistry(),
    clrResolver: createClrBindingsResolver("/test"),
    binding: createBinding(checker),
  };
};
