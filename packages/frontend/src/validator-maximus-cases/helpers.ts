import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as ts from "typescript";
import type { TsonicProgram } from "../program.js";
import { validateProgram } from "../validator.js";
import { DotnetMetadataRegistry } from "../dotnet-metadata.js";
import { BindingRegistry } from "../program/bindings.js";
import { createClrBindingsResolver } from "../resolver/clr-bindings-resolver.js";
import { createBinding } from "../ir/binding/index.js";

export { describe, it } from "mocha";
export { expect };

export const createTestProgram = (
  source: string,
  fileName = "/test/index.ts",
  extraFiles: Readonly<Record<string, string>> = {}
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
    checker,
    options: {
      projectRoot: "/test",
      sourceRoot: "/test",
      rootNamespace: "Test",
    },
    sourceFiles: Array.from(sourceFiles.keys())
      .map((name) => program.getSourceFile(name))
      .filter((file): file is ts.SourceFile => file !== undefined),
    declarationSourceFiles: [],
    metadata: new DotnetMetadataRegistry(),
    bindings: new BindingRegistry(),
    clrResolver: createClrBindingsResolver("/test"),
    binding: createBinding(checker),
  };
};

export const collectCodes = (
  source: string,
  extraFiles: Readonly<Record<string, string>> = {}
): readonly string[] =>
  validateProgram(
    createTestProgram(source, "/test/index.ts", extraFiles)
  ).diagnostics.map((d) => d.code);

export const hasCode = (
  source: string,
  code: string,
  extraFiles: Readonly<Record<string, string>> = {}
): boolean => collectCodes(source, extraFiles).includes(code);

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
      checker,
      options: {
        projectRoot: tempDir,
        sourceRoot: path.join(tempDir, "src"),
        rootNamespace: "Test",
      },
      sourceFiles: rootNames
        .map((fileName) => program.getSourceFile(fileName))
        .filter((file): file is ts.SourceFile => file !== undefined),
      declarationSourceFiles: [],
      metadata: new DotnetMetadataRegistry(),
      bindings: new BindingRegistry(),
      clrResolver: createClrBindingsResolver(tempDir),
      binding: createBinding(checker),
    }).diagnostics.map((diagnostic) => diagnostic.code);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};
