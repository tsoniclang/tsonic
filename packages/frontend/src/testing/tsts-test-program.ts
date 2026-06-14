import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { TstsSourceFile } from "@tsonic/tsts";
import type { CompilerOptions, TsonicProgram } from "../program/types.js";
import {
  createTstsSemanticView,
  createTstsSourceProgram,
} from "../source-frontend/index.js";

export type TstsTestProgram = TsonicProgram & {
  readonly sourceFile: TstsSourceFile;
  readonly cleanup: () => void;
};

export type TstsTestProgramOptions = Partial<CompilerOptions> & {
  readonly fileName?: string;
  readonly rootNamespace?: string;
};

const activeTempRoots = new Set<string>();
let cleanupRegistered = false;

const registerTempRoot = (root: string): void => {
  activeTempRoots.add(root);
  if (cleanupRegistered) return;
  cleanupRegistered = true;
  process.once("exit", () => {
    for (const tempRoot of activeTempRoots) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
    activeTempRoots.clear();
  });
};

const releaseTempRoot = (root: string): void => {
  activeTempRoots.delete(root);
  fs.rmSync(root, { recursive: true, force: true });
};

const CANONICAL_CORE_PACKAGE_FILES: Readonly<Record<string, string>> = {
  "tsonic-std.d.ts": [
    "type PropertyKey = string | number | symbol;",
    "type Record<K extends PropertyKey, T> = { [P in K]: T };",
    "type Partial<T> = { [P in keyof T]?: T[P] };",
    "type Required<T> = { [P in keyof T]-?: T[P] };",
    "type Readonly<T> = { readonly [P in keyof T]: T[P] };",
    "type Pick<T, K extends keyof T> = { [P in K]: T[P] };",
    "type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;",
    "type Exclude<T, U> = T extends U ? never : T;",
    "type Extract<T, U> = T extends U ? T : never;",
    "type NonNullable<T> = T & {};",
    "type Parameters<T extends (...args: any) => any> = T extends (...args: infer P) => any ? P : never;",
    "type ReturnType<T extends (...args: any) => any> = T extends (...args: any) => infer R ? R : any;",
    "",
  ].join("\n"),
  "node_modules/@tsonic/core/package.json": JSON.stringify({
    name: "@tsonic/core",
    type: "module",
    exports: {
      "./types.js": {
        types: "./types.d.ts",
        default: "./types.js",
      },
      "./lang.js": {
        types: "./lang.d.ts",
        default: "./lang.js",
      },
    },
  }),
  "node_modules/@tsonic/core/types.js": "export {};\n",
  "node_modules/@tsonic/core/types.d.ts": [
    "export type bool = boolean;",
    "export type byte = number;",
    "export type sbyte = number;",
    "export type short = number;",
    "export type ushort = number;",
    "export type int = number;",
    "export type uint = number;",
    "export type long = number;",
    "export type ulong = number;",
    "export type nint = number;",
    "export type nuint = number;",
    "export type float = number;",
    "export type double = number;",
    "export type decimal = number;",
    "export type char = string;",
    "export type ptr<T> = T;",
    "export type out<T> = T;",
    "export type ref<T> = T;",
    "export type inref<T> = T;",
    "export type struct<T> = T;",
    "",
  ].join("\n"),
  "node_modules/@tsonic/core/lang.js": [
    "export const stackalloc = undefined;",
    "export const trycast = undefined;",
    "export const out = undefined;",
    "export const ref = undefined;",
    "export const inref = undefined;",
    "export const asinterface = undefined;",
    "export const istype = undefined;",
    "export const nameof = undefined;",
    "export const sizeof = undefined;",
    "export const defaultof = undefined;",
    "",
  ].join("\n"),
  "node_modules/@tsonic/core/lang.d.ts": [
    "export type thisarg<T> = T;",
    "export type field<T> = T;",
    "export type Interface<T> = T;",
    "export declare function stackalloc<T>(size: number): T;",
    "export declare function trycast<T>(value: unknown): T | undefined;",
    "export declare function out<T>(value: T): T;",
    "export declare function ref<T>(value: T): T;",
    "export declare function inref<T>(value: T): T;",
    "export declare function asinterface<T>(value: unknown): T;",
    "export declare function istype<T>(value: unknown): boolean;",
    "export declare function nameof(value: unknown): string;",
    "export declare function sizeof<T>(): import(\"./types.js\").int;",
    "export declare function defaultof<T>(): T;",
    "",
  ].join("\n"),
};

export const withCanonicalCorePackageFiles = (
  files: Readonly<Record<string, string>>
): Readonly<Record<string, string>> => ({
  ...CANONICAL_CORE_PACKAGE_FILES,
  ...files,
});

const writeTestFiles = (
  tempRoot: string,
  files: Readonly<Record<string, string>>
): readonly string[] => {
  const filePaths: string[] = [];
  for (const [relativePath, sourceText] of Object.entries(files)) {
    const absolutePath = path.join(tempRoot, relativePath.replace(/^\/*/, ""));
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, sourceText);
    if (/\.(?:ts|mts|cts|d\.ts)$/.test(relativePath)) {
      filePaths.push(absolutePath);
    }
  }
  return filePaths;
};

const findSourceFile = (
  sourceFiles: readonly TstsSourceFile[],
  filePath: string
): TstsSourceFile => {
  const resolved = path.resolve(filePath);
  const sourceFile = sourceFiles.find(
    (candidate) => path.resolve(candidate.FileName()) === resolved
  );
  if (!sourceFile) {
    throw new Error(`TSTS source file not found: ${filePath}`);
  }
  return sourceFile;
};

export const createTstsTestProgramFromFiles = (
  files: Readonly<Record<string, string>>,
  entryRelativePath: string,
  options: TstsTestProgramOptions = {}
): TstsTestProgram => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tsonic-tsts-test-"));
  registerTempRoot(tempRoot);
  const filePaths = writeTestFiles(
    tempRoot,
    withCanonicalCorePackageFiles(files)
  );
  const entryPath = path.join(tempRoot, entryRelativePath.replace(/^\/*/, ""));
  const sourceProgram = createTstsSourceProgram(filePaths, {
    projectRoot: options.projectRoot ?? tempRoot,
    runSemanticChecks: true,
  });
  const sourceFile = findSourceFile(sourceProgram.sourceFiles, entryPath);
  const sourceSemantics = sourceProgram.withSourceSemantics(
    sourceFile,
    (checker) =>
      createTstsSemanticView(checker, sourceProgram.extensionHost.facts)
  );
  const sourceFiles = sourceProgram.sourceFiles.filter(
    (candidate) => candidate.IsDeclarationFile !== true
  );
  const declarationSourceFiles = sourceProgram.sourceFiles.filter(
    (candidate) => candidate.IsDeclarationFile === true
  );
  const projectRoot = options.projectRoot ?? tempRoot;
  const sourceRoot = options.sourceRoot ?? tempRoot;

  return {
    options: {
      projectRoot,
      sourceRoot,
      rootNamespace: options.rootNamespace ?? "TestApp",
      strict: options.strict ?? true,
      surface: options.surface,
      typeRoots: options.typeRoots,
      backendCapabilities: options.backendCapabilities,
      backendTargetId: options.backendTargetId,
      programInputScope: options.programInputScope,
    },
    sourceProgram,
    sourceSemantics,
    sourceFiles,
    declarationSourceFiles,
    sourceFile,
    cleanup: () => releaseTempRoot(tempRoot),
  };
};

export const createInlineTstsTestProgram = (
  sourceText: string,
  options: TstsTestProgramOptions = {}
): TstsTestProgram => {
  const fileName = options.fileName ?? "test.ts";
  return createTstsTestProgramFromFiles(
    { [path.basename(fileName)]: sourceText },
    path.basename(fileName),
    options
  );
};
