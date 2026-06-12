import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as ts from "typescript";
import type { TsonicProgram } from "../program.js";
import { validateProgram } from "../validator.js";
import { ExternalMetadataRegistry } from "../external-metadata.js";
import { BindingRegistry } from "../program/bindings.js";
import { createExternalBindingsResolver } from "../resolver/external-bindings-resolver.js";
import { createBinding } from "../ir/binding/index.js";
import {
  createEmptyTstsSourceProgramForTests,
  createTypeScriptSemanticView,
} from "../source-frontend/index.js";

export { describe, it } from "mocha";
export { expect };

export const createTestProgram = (
  source: string,
  fileName = "/test/index.ts",
  extraFiles: Readonly<Record<string, string>> = {},
  options: Partial<TsonicProgram["options"]> = {}
): TsonicProgram => {
  const allFiles = new Map<string, string>([
    [fileName, source],
    ...Object.entries(extraFiles),
  ]);

  const sourceFiles = new Map<string, ts.SourceFile>(
    Array.from(allFiles.entries(), ([name, text]) => [
      name,
      ts.createSourceFile(
        name,
        text,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
      ),
    ])
  );

  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
  };

  const host = ts.createCompilerHost(compilerOptions);
  const originalGetSourceFile = host.getSourceFile;
  const originalFileExists = host.fileExists;
  const originalReadFile = host.readFile;
  host.getSourceFile = (
    name: string,
    languageVersionOrOptions: ts.ScriptTarget | ts.CreateSourceFileOptions,
    onError?: (message: string) => void,
    shouldCreateNewSourceFile?: boolean
  ) => {
    const normalized = name.replace(/\\/g, "/");
    const file = sourceFiles.get(normalized);
    if (file) {
      return file;
    }
    return originalGetSourceFile.call(
      host,
      name,
      languageVersionOrOptions,
      onError,
      shouldCreateNewSourceFile
    );
  };
  host.fileExists = (name: string) =>
    sourceFiles.has(name.replace(/\\/g, "/")) || originalFileExists(name);
  host.readFile = (name: string) => {
    const normalized = name.replace(/\\/g, "/");
    return allFiles.get(normalized) ?? originalReadFile(name);
  };

  const program = ts.createProgram(
    Array.from(allFiles.keys()),
    compilerOptions,
    host
  );
  const checker = program.getTypeChecker();

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
    sourceFiles: Array.from(sourceFiles.values()),
    declarationSourceFiles: [],
    sourceProgram: createEmptyTstsSourceProgramForTests(),
    sourceSemantics: createTypeScriptSemanticView(checker),
    metadata: new ExternalMetadataRegistry(),
    bindings: new BindingRegistry(),
    externalResolver: createExternalBindingsResolver("/test"),
    binding: createBinding(createTypeScriptSemanticView(checker)),
  };
};

export const collectCodes = (
  source: string,
  extraFiles: Readonly<Record<string, string>> = {},
  options: Partial<TsonicProgram["options"]> = {}
): readonly string[] =>
  validateProgram(
    createTestProgram(source, "/test/index.ts", extraFiles, options)
  ).diagnostics.map((d) => d.code);

export const hasCode = (
  source: string,
  code: string,
  extraFiles: Readonly<Record<string, string>> = {},
  options: Partial<TsonicProgram["options"]> = {}
): boolean => collectCodes(source, extraFiles, options).includes(code);

export const collectCodesInTempProject = (
  source: string,
  extraFiles: Readonly<Record<string, string>> = {}
): readonly string[] => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "tsonic-maximus-dynamic-import-")
  );

  try {
    const entryPath = path.join(tempDir, "src", "index.ts");
    fs.mkdirSync(path.dirname(entryPath), { recursive: true });
    fs.writeFileSync(entryPath, source);

    const rootNames = [entryPath];
    for (const [relativePath, content] of Object.entries(extraFiles)) {
      const fullPath = path.join(tempDir, relativePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
      rootNames.push(fullPath);
    }

    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
    };

    const program = ts.createProgram(rootNames, compilerOptions);
    const checker = program.getTypeChecker();
    return validateProgram({
      program,
      tsCompilerOptions: program.getCompilerOptions(),
      options: {
        projectRoot: tempDir,
        sourceRoot: path.join(tempDir, "src"),
        rootNamespace: "TestApp",
        strict: true,
      },
      sourceFiles: rootNames
        .filter((filePath) => !filePath.endsWith(".d.ts"))
        .map((filePath) => program.getSourceFile(filePath))
        .filter(
          (candidate): candidate is ts.SourceFile => candidate !== undefined
        ),
      declarationSourceFiles: rootNames
        .filter((filePath) => filePath.endsWith(".d.ts"))
        .map((filePath) => program.getSourceFile(filePath))
        .filter(
          (candidate): candidate is ts.SourceFile => candidate !== undefined
        ),
      sourceProgram: createEmptyTstsSourceProgramForTests(),
      sourceSemantics: createTypeScriptSemanticView(checker),
      metadata: new ExternalMetadataRegistry(),
      bindings: new BindingRegistry(),
      externalResolver: createExternalBindingsResolver(tempDir),
      binding: createBinding(createTypeScriptSemanticView(checker)),
    }).diagnostics.map((diagnostic) => diagnostic.code);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};
