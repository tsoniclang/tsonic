/**
 * Program creation
 */

import * as ts from "typescript";
import * as path from "node:path";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { Result, ok, error } from "../types/result.js";
import { DiagnosticsCollector } from "../types/diagnostic.js";
import { CompilerOptions, TsonicProgram } from "./types.js";
import { defaultTsConfig } from "./config.js";
import { loadDotnetMetadata } from "./metadata.js";
import { loadBindings } from "./bindings.js";
import { collectTsDiagnostics } from "./diagnostics.js";
import { createClrBindingsResolver } from "../resolver/clr-bindings-resolver.js";
import { createBinding } from "../ir/binding/index.js";
import {
  hasResolvedSurfaceProfile,
  resolveSurfaceCapabilities,
} from "../surface/profiles.js";
import { resolveSourcePackageImport } from "../resolver/source-package-resolution.js";
import {
  addDiagnostic,
  createDiagnostic,
  createDiagnosticsCollector,
} from "../types/diagnostic.js";

const CORE_GLOBALS_DECLARATIONS = `
declare global {
  class Error {
    name: string;
    message: string;
    stack?: string;
    constructor(message?: string);
  }

  interface Function {
    prototype: any;
  }

  interface CallableFunction extends Function {}
  interface NewableFunction extends Function {}
  interface IArguments {
    readonly length: number;
    readonly [index: number]: unknown;
  }
  interface RegExp {}
  interface ImportMeta {}

  interface String {
    readonly [n: number]: string;
  }
  interface Number {}
  interface Boolean {}

  interface Object {
    constructor: Function;
  }

  interface SymbolConstructor {
    readonly iterator: symbol;
    readonly asyncIterator: symbol;
    readonly hasInstance: symbol;
    readonly isConcatSpreadable: symbol;
    readonly species: symbol;
    readonly toPrimitive: symbol;
    readonly toStringTag: symbol;
  }

  const Symbol: SymbolConstructor;

  type PropertyKey = string | number | symbol;

  interface Array<T> {
    [n: number]: T;
    readonly length: number;
    [Symbol.iterator](): IterableIterator<T>;
  }

  interface ReadonlyArray<T> {
    readonly [n: number]: T;
    readonly length: number;
    [Symbol.iterator](): IterableIterator<T>;
  }

  interface ArrayConstructor {
    new <T>(size?: number): T[];
  }

  const Array: ArrayConstructor;

  type Partial<T> = { [P in keyof T]?: T[P] };
  type Required<T> = { [P in keyof T]-?: T[P] };
  type Readonly<T> = { readonly [P in keyof T]: T[P] };
  type Pick<T, K extends keyof T> = { [P in K]: T[P] };
  type Record<K extends keyof any, T> = { [P in K]: T };
  type Exclude<T, U> = T extends U ? never : T;
  type Extract<T, U> = T extends U ? T : never;
  type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;
  type NonNullable<T> = T extends null | undefined ? never : T;
  type Parameters<T extends (...args: any) => any> = T extends (...args: infer P) => any ? P : never;
  type ConstructorParameters<T extends new (...args: any) => any> = T extends new (...args: infer P) => any ? P : never;
  type ReturnType<T extends (...args: any) => any> = T extends (...args: any) => infer R ? R : any;
  type InstanceType<T extends new (...args: any) => any> = T extends new (...args: any) => infer R ? R : any;
  type Awaited<T> = T extends PromiseLike<infer U> ? Awaited<U> : T;

  interface Promise<T> {
    then(): Promise<T>;
    then<TResult1>(
      onfulfilled: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null
    ): Promise<TResult1>;
    then<TResult1, TResult2>(
      onfulfilled: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
      onrejected: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
    ): Promise<TResult1 | TResult2>;
    catch(): Promise<T>;
    catch<TResult>(
      onrejected: ((reason: unknown) => TResult | PromiseLike<TResult>) | undefined | null
    ): Promise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
  }

  interface PromiseLike<T> {
    then(): PromiseLike<T>;
    then<TResult1>(
      onfulfilled: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null
    ): PromiseLike<TResult1>;
    then<TResult1, TResult2>(
      onfulfilled: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
      onrejected: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
    ): PromiseLike<TResult1 | TResult2>;
  }

  interface PromiseConstructor {
    new <T>(executor: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: unknown) => void) => void): Promise<T>;
    resolve(): Promise<void>;
    resolve<T>(value: T | PromiseLike<T>): Promise<T>;
    reject<T>(reason?: unknown): Promise<T>;
    reject(reason?: unknown): Promise<unknown>;
    all<T>(values: readonly (T | PromiseLike<T>)[]): Promise<T[]>;
    race<T>(values: readonly (T | PromiseLike<T>)[]): Promise<T>;
  }

  const Promise: PromiseConstructor;

  interface Iterator<T, TReturn = any, TNext = undefined> {
    next(...args: [] | [TNext]): IteratorResult<T, TReturn>;
    return?(value?: TReturn): IteratorResult<T, TReturn>;
    throw?(e?: any): IteratorResult<T, TReturn>;
  }

  interface IteratorResult<T, TReturn = any> {
    done: boolean;
    value: T | TReturn;
  }

  interface IteratorYieldResult<T> {
    done: false;
    value: T;
  }

  interface IteratorReturnResult<TReturn> {
    done: true;
    value: TReturn;
  }

  interface Iterable<T, TReturn = any, TNext = undefined> {
    [Symbol.iterator](): Iterator<T, TReturn, TNext>;
  }

  interface IterableIterator<T, TReturn = any, TNext = undefined>
    extends Iterator<T, TReturn, TNext> {
    [Symbol.iterator](): IterableIterator<T, TReturn, TNext>;
  }

  interface AsyncIterator<T, TReturn = any, TNext = undefined> {
    next(...args: [] | [TNext]): Promise<IteratorResult<T, TReturn>>;
    return?(value?: TReturn | PromiseLike<TReturn>): Promise<IteratorResult<T, TReturn>>;
    throw?(e?: any): Promise<IteratorResult<T, TReturn>>;
  }

  interface AsyncIterable<T, TReturn = any, TNext = undefined> {
    [Symbol.asyncIterator](): AsyncIterator<T, TReturn, TNext>;
  }

  interface AsyncIterableIterator<T, TReturn = any, TNext = undefined>
    extends AsyncIterator<T, TReturn, TNext> {
    [Symbol.asyncIterator](): AsyncIterableIterator<T, TReturn, TNext>;
  }

  interface Generator<T = unknown, TReturn = any, TNext = unknown>
    extends Iterator<T, TReturn, TNext> {
    next(...args: [] | [TNext]): IteratorResult<T, TReturn>;
    return(value: TReturn): IteratorResult<T, TReturn>;
    throw(e: any): IteratorResult<T, TReturn>;
    [Symbol.iterator](): Generator<T, TReturn, TNext>;
  }

  interface AsyncGenerator<T = unknown, TReturn = any, TNext = unknown>
    extends AsyncIterator<T, TReturn, TNext> {
    next(...args: [] | [TNext]): Promise<IteratorResult<T, TReturn>>;
    return(value: TReturn | PromiseLike<TReturn>): Promise<IteratorResult<T, TReturn>>;
    throw(e: any): Promise<IteratorResult<T, TReturn>>;
    [Symbol.asyncIterator](): AsyncGenerator<T, TReturn, TNext>;
  }

  interface TemplateStringsArray extends ReadonlyArray<string> {
    readonly raw: readonly string[];
  }

  type Uppercase<S extends string> = intrinsic;
  type Lowercase<S extends string> = intrinsic;
  type Capitalize<S extends string> = intrinsic;
  type Uncapitalize<S extends string> = intrinsic;
}

export {};
`.trim();

/**
 * Recursively scan a directory for .d.ts files
 */
const scanForDeclarationFiles = (dir: string): readonly string[] => {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Never crawl dependency trees from a sibling checkout's node_modules.
      // In noLib mode, accidentally pulling in TypeScript's lib.*.d.ts (or other
      // ambient types) will silently change the language surface and break
      // determinism (e.g., `string.indexOf` becomes JS `number` instead of CLR `int`).
      if (entry.name === "node_modules" || entry.name === ".git") {
        continue;
      }
      results.push(...scanForDeclarationFiles(fullPath));
    } else if (
      entry.name.endsWith(".d.ts") &&
      entry.name !== "core-globals.d.ts"
    ) {
      results.push(fullPath);
    }
  }

  return results;
};

const collectProjectIncludedDeclarationFiles = (
  projectRoot: string,
  compilerOptions: ts.CompilerOptions
): readonly string[] => {
  const configPath = path.join(projectRoot, "tsconfig.json");
  if (!fs.existsSync(configPath)) {
    return [];
  }

  const configResult = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configResult.error) {
    return [];
  }

  const parsed = ts.parseJsonConfigFileContent(
    configResult.config,
    ts.sys,
    projectRoot,
    {
      ...compilerOptions,
      noEmit: true,
    },
    configPath
  );

  return parsed.fileNames
    .filter((fileName) => fileName.endsWith(".d.ts"))
    .map((fileName) => path.resolve(fileName));
};

/**
 * Create TypeScript compiler options from Tsonic options
 * Exported for use by dependency graph builder
 */
export const createCompilerOptions = (
  options: CompilerOptions
): ts.CompilerOptions => {
  const surfaceCapabilities = resolveSurfaceCapabilities(
    options.surface ?? "clr",
    { projectRoot: options.projectRoot }
  );
  const resolveCommonRootDir = (...paths: readonly string[]): string => {
    const [first, ...rest] = paths.map((filePath) => path.resolve(filePath));
    let current = first ?? path.resolve(options.projectRoot);

    for (;;) {
      const containsAll = rest.every((candidate) => {
        const relative = path.relative(current, candidate);
        return (
          relative === "" ||
          (!relative.startsWith("..") && !path.isAbsolute(relative))
        );
      });

      if (containsAll) {
        return current;
      }

      const parent = path.dirname(current);
      if (parent === current) {
        return current;
      }
      current = parent;
    }
  };
  const findNearestNodeModulesRoot = (start: string): string | undefined => {
    let current = path.resolve(start);
    for (;;) {
      if (fs.existsSync(path.join(current, "node_modules"))) {
        return current;
      }
      const parent = path.dirname(current);
      if (parent === current) {
        return undefined;
      }
      current = parent;
    }
  };
  const nodeModulesRoot = findNearestNodeModulesRoot(options.projectRoot);
  const baseConfig: ts.CompilerOptions = {
    ...defaultTsConfig,
    ...(options.strict === undefined ? {} : { strict: options.strict }),
    // rootDir must include both the workspace sourceRoot and any installed
    // source-package code under projectRoot/node_modules. In normal project
    // layouts sourceRoot sits under projectRoot, so this resolves to
    // projectRoot. For tests or tooling that compile temp source trees against
    // the repo's installed type roots, widen to the nearest common ancestor
    // instead of incorrectly forcing source files under projectRoot.
    rootDir: nodeModulesRoot
      ? resolveCommonRootDir(
          options.sourceRoot,
          options.projectRoot,
          nodeModulesRoot
        )
      : resolveCommonRootDir(options.sourceRoot, options.projectRoot),
  };

  if (options.useStandardLib || surfaceCapabilities.useStandardLib) {
    return {
      ...baseConfig,
      noLib: false,
      types: undefined, // Use default type resolution
    };
  }

  return baseConfig;
};

/**
 * Create a Tsonic program from TypeScript source files
 */
export const createProgram = (
  filePaths: readonly string[],
  options: CompilerOptions
): Result<TsonicProgram, DiagnosticsCollector> => {
  const surface = options.surface ?? "clr";
  if (
    surface !== "clr" &&
    !hasResolvedSurfaceProfile(surface, {
      projectRoot: options.projectRoot,
    })
  ) {
    return error(
      addDiagnostic(
        createDiagnosticsCollector(),
        createDiagnostic(
          "TSN1004",
          "error",
          `Surface '${surface}' is not a valid ambient surface package.`,
          undefined,
          "Custom surfaces must provide tsonic.surface.json. Use '@tsonic/js' for JS ambient APIs, and add normal packages separately."
        )
      )
    );
  }
  const surfaceCapabilities = resolveSurfaceCapabilities(surface, {
    projectRoot: options.projectRoot,
  });
  const absolutePaths = filePaths.map((fp) => path.resolve(fp));
  const compilerContainingFile = fileURLToPath(import.meta.url);
  // creation.ts lives at: <repoRoot>/packages/frontend/src/program/creation.ts
  // repoRoot is 4 levels up from this file's directory.
  const repoRoot = path.resolve(
    path.join(path.dirname(compilerContainingFile), "../../../..")
  );

  const require = createRequire(import.meta.url);

  const readPackageName = (pkgJsonPath: string): string | undefined => {
    if (!fs.existsSync(pkgJsonPath)) return undefined;
    try {
      const parsed = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8")) as {
        readonly name?: unknown;
      };
      return typeof parsed.name === "string" ? parsed.name : undefined;
    } catch {
      return undefined;
    }
  };

  const packageRootNamespaceCache = new Map<string, string | null>();
  const readPackageRootNamespace = (
    packageRoot: string
  ): string | undefined => {
    const cached = packageRootNamespaceCache.get(packageRoot);
    if (cached !== undefined) {
      return cached ?? undefined;
    }

    const candidates = [
      path.join(packageRoot, "index", "bindings.json"),
      path.join(packageRoot, "bindings.json"),
    ];

    for (const candidate of candidates) {
      if (!fs.existsSync(candidate)) continue;
      try {
        const parsed = JSON.parse(fs.readFileSync(candidate, "utf-8")) as {
          readonly namespace?: unknown;
        };
        if (
          typeof parsed.namespace === "string" &&
          parsed.namespace.length > 0
        ) {
          packageRootNamespaceCache.set(packageRoot, parsed.namespace);
          return parsed.namespace;
        }
      } catch {
        // Ignore malformed/non-namespace bindings candidates and continue.
      }
    }

    packageRootNamespaceCache.set(packageRoot, null);
    return undefined;
  };

  const parseTsonicModuleRequest = (
    moduleName: string
  ):
    | {
        packageName: string;
        pkgDirName: string;
        subpath: string | undefined;
      }
    | undefined => {
    const match = moduleName.match(/^@tsonic\/([^/]+)(?:\/(.+))?$/);
    if (!match) return undefined;

    const pkgDirName = match[1];
    if (!pkgDirName) return undefined;

    return {
      packageName: `@tsonic/${pkgDirName}`,
      pkgDirName,
      subpath: match[2],
    };
  };

  const resolveModuleFromPackageRoot = (
    packageRoot: string,
    subpath: string | undefined
  ): ts.ResolvedModuleFull | undefined => {
    const buildCandidates = (
      candidateSubpath: string | undefined
    ): readonly string[] => {
      if (!candidateSubpath || candidateSubpath.length === 0) {
        return [
          path.join(packageRoot, "index.d.ts"),
          path.join(packageRoot, "index.js"),
        ];
      }

      const basePath = path.join(packageRoot, candidateSubpath);
      if (candidateSubpath.endsWith(".d.ts")) {
        return [basePath];
      }
      if (candidateSubpath.endsWith(".js")) {
        return [basePath.replace(/\.js$/, ".d.ts"), basePath];
      }

      return [
        `${basePath}.d.ts`,
        `${basePath}.js`,
        path.join(basePath, "index.d.ts"),
        path.join(basePath, "index.js"),
      ];
    };

    const remappedRootNamespaceSubpath = (() => {
      if (!subpath || subpath.length === 0) return undefined;

      const rootNamespace = readPackageRootNamespace(packageRoot);
      if (!rootNamespace) return undefined;

      if (
        subpath === `${rootNamespace}.js` ||
        subpath === `${rootNamespace}.d.ts`
      ) {
        return "index.js";
      }

      if (subpath.startsWith(`${rootNamespace}/`)) {
        return `index/${subpath.slice(rootNamespace.length + 1)}`;
      }

      return undefined;
    })();

    const candidates = [
      ...buildCandidates(subpath),
      ...buildCandidates(remappedRootNamespaceSubpath),
    ];
    const seenCandidates = new Set<string>();

    for (const candidate of candidates) {
      if (seenCandidates.has(candidate)) continue;
      seenCandidates.add(candidate);
      if (!fs.existsSync(candidate)) continue;

      const extension = candidate.endsWith(".d.ts")
        ? ts.Extension.Dts
        : candidate.endsWith(".js")
          ? ts.Extension.Js
          : candidate.endsWith(".ts")
            ? ts.Extension.Ts
            : undefined;
      if (!extension) continue;

      return {
        resolvedFileName: candidate,
        extension,
        isExternalLibraryImport: true,
      };
    }

    return undefined;
  };

  const resolveSiblingTsonicPackageRoot = (
    pkgDirName: string
  ): string | undefined => {
    const expectedName = `@tsonic/${pkgDirName}`;
    const siblingRepoRoot = path.resolve(path.join(repoRoot, "..", pkgDirName));

    const repoPackageName = readPackageName(
      path.join(siblingRepoRoot, "package.json")
    );
    if (repoPackageName === expectedName) return siblingRepoRoot;

    const versionsRoot = path.join(siblingRepoRoot, "versions");
    if (!fs.existsSync(versionsRoot)) return undefined;

    const versionDirs = fs
      .readdirSync(versionsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => {
        const leftNum = Number.parseInt(left, 10);
        const rightNum = Number.parseInt(right, 10);
        const leftIsNum = Number.isFinite(leftNum);
        const rightIsNum = Number.isFinite(rightNum);
        if (leftIsNum && rightIsNum) return rightNum - leftNum;
        if (leftIsNum) return -1;
        if (rightIsNum) return 1;
        return right.localeCompare(left);
      });

    for (const versionDir of versionDirs) {
      const candidateRoot = path.join(versionsRoot, versionDir);
      const candidateName = readPackageName(
        path.join(candidateRoot, "package.json")
      );
      if (candidateName === expectedName) return candidateRoot;
    }

    return undefined;
  };

  const resolveTsonicPackageRoot = (pkgDirName: string): string | undefined => {
    const siblingRoot = resolveSiblingTsonicPackageRoot(pkgDirName);
    if (siblingRoot) return siblingRoot;

    // Fall back to compiler-owned installation (keeps stdlib typings coherent)
    try {
      const installedPkgJson = require.resolve(
        `@tsonic/${pkgDirName}/package.json`
      );
      return path.dirname(installedPkgJson);
    } catch {
      // Package not found.
    }

    return undefined;
  };

  // Get declaration files from type roots.
  const userTypeRoots = options.typeRoots ?? [];
  const requestedTypeRoots = Array.from(
    new Set<string>([
      ...userTypeRoots,
      ...surfaceCapabilities.requiredTypeRoots,
    ])
  );
  const resolvedRequestedTypeRoots = requestedTypeRoots.map((typeRoot) => {
    const absoluteRoot = path.isAbsolute(typeRoot)
      ? typeRoot
      : path.resolve(options.projectRoot, typeRoot);

    // For @tsonic/* type roots, prefer compiler-owned package roots (sibling
    // checkout or compiler installation) so the active compiler and language
    // surfaces stay coherent during development and test runs.
    //
    // If no compiler-owned package is available, fall back to the project's
    // resolved node_modules path.
    const match = typeRoot.match(
      /(?:^|[/\\\\])node_modules[/\\\\]@tsonic[/\\\\]([^/\\\\]+)[/\\\\]?$/
    );
    if (match) {
      const pkgDirName = match[1];
      if (pkgDirName) {
        const compilerOwned = resolveTsonicPackageRoot(pkgDirName);
        if (compilerOwned) return compilerOwned;
      }
    }

    if (fs.existsSync(absoluteRoot)) return absoluteRoot;
    return absoluteRoot;
  });
  const typeRoots = resolvedRequestedTypeRoots;
  const authoritativeTsonicPackageRoots = new Map<string, string>();
  for (const typeRoot of typeRoots) {
    const packageName = readPackageName(path.join(typeRoot, "package.json"));
    if (packageName?.startsWith("@tsonic/")) {
      authoritativeTsonicPackageRoots.set(packageName, typeRoot);
    }
  }

  // Debug log typeRoots
  if (options.verbose && typeRoots.length > 0) {
    console.log(`TypeRoots: ${typeRoots.join(", ")}`);
  }

  const declarationFiles: string[] = [];

  for (const typeRoot of typeRoots) {
    const absoluteRoot = path.resolve(typeRoot);
    declarationFiles.push(...scanForDeclarationFiles(absoluteRoot));
  }

  // Add the main index.d.ts files for .NET namespaces directly to the file list
  const namespaceIndexFiles: string[] = [];
  for (const typeRoot of typeRoots) {
    const absoluteRoot = path.resolve(typeRoot);
    if (options.verbose) {
      console.log(
        `Checking typeRoot: ${absoluteRoot}, exists: ${fs.existsSync(absoluteRoot)}`
      );
    }
    if (fs.existsSync(absoluteRoot)) {
      const entries = fs.readdirSync(absoluteRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (
          entry.isDirectory() &&
          !entry.name.startsWith("_") &&
          !entry.name.startsWith("internal")
        ) {
          const indexPath = path.join(absoluteRoot, entry.name, "index.d.ts");
          if (fs.existsSync(indexPath)) {
            namespaceIndexFiles.push(indexPath);
            if (options.verbose) {
              console.log(`  Found namespace: ${entry.name} -> ${indexPath}`);
            }
          }
        }
      }
    }
  }

  const tsOptions = createCompilerOptions(options);
  const projectDeclarationFiles = collectProjectIncludedDeclarationFiles(
    options.projectRoot,
    tsOptions
  );

  const coreGlobalsVirtualPath = path.join(
    options.projectRoot,
    ".tsonic",
    "__core_globals__.d.ts"
  );
  const virtualDeclarationSources = new Map<string, string>([
    [path.resolve(coreGlobalsVirtualPath), CORE_GLOBALS_DECLARATIONS],
  ]);
  const virtualDeclarationFiles = Array.from(virtualDeclarationSources.keys());

  // Combine source files, declaration files, namespace index files, and
  // compiler-owned virtual declarations.
  const allFiles = Array.from(
    new Set([
      ...absolutePaths,
      ...projectDeclarationFiles,
      ...declarationFiles,
      ...namespaceIndexFiles,
      ...virtualDeclarationFiles,
    ])
  );

  // Create custom compiler host with virtual .NET module declarations
  const host = ts.createCompilerHost(tsOptions);
  const normalizeVirtualFilePath = (filePath: string): string =>
    path.resolve(filePath);
  const isPackageCoreGlobalsFile = (filePath: string): boolean =>
    path.basename(filePath) === "core-globals.d.ts";
  const getVirtualDeclarationText = (filePath: string): string | undefined =>
    virtualDeclarationSources.get(normalizeVirtualFilePath(filePath));

  const originalFileExists = host.fileExists;
  host.fileExists = (fileName: string): boolean => {
    if (getVirtualDeclarationText(fileName) !== undefined) return true;
    return originalFileExists(fileName);
  };

  const originalReadFile = host.readFile;
  host.readFile = (fileName: string): string | undefined => {
    const virtualText = getVirtualDeclarationText(fileName);
    if (virtualText !== undefined) return virtualText;
    if (isPackageCoreGlobalsFile(fileName)) return "export {};\n";
    return originalReadFile(fileName);
  };

  // Map of .NET namespace names to their declaration file paths
  const namespaceFiles = new Map<string, string>();
  for (const indexFile of namespaceIndexFiles) {
    // Extract namespace name from path (e.g., /path/to/System/index.d.ts -> System)
    const dirName = path.basename(path.dirname(indexFile));
    namespaceFiles.set(dirName, indexFile);
  }

  // Log namespace mappings when verbose
  if (options.verbose && namespaceFiles.size > 0) {
    console.log(`Found ${namespaceFiles.size} .NET namespace declarations`);
    for (const [ns, file] of namespaceFiles) {
      console.log(`  ${ns} -> ${file}`);
    }
  }

  // Override getSourceFile to provide virtual module declarations
  const originalGetSourceFile = host.getSourceFile;
  host.getSourceFile = (
    fileName: string,
    languageVersion: ts.ScriptTarget,
    onError?: (message: string) => void,
    shouldCreateNewSourceFile?: boolean
  ): ts.SourceFile | undefined => {
    const virtualText = getVirtualDeclarationText(fileName);
    if (virtualText !== undefined) {
      return ts.createSourceFile(fileName, virtualText, languageVersion, true);
    }
    if (isPackageCoreGlobalsFile(fileName)) {
      return ts.createSourceFile(
        fileName,
        "export {};\n",
        languageVersion,
        true
      );
    }

    // Check if this is a .NET namespace being imported
    const baseName = path.basename(fileName, path.extname(fileName));
    const declarationPath = namespaceFiles.get(baseName);
    if (declarationPath !== undefined && fileName.endsWith(".ts")) {
      // Create a virtual source file that exports from the actual declaration
      const virtualContent = `export * from '${declarationPath.replace(/\.d\.ts$/, "")}';`;
      return ts.createSourceFile(
        fileName,
        virtualContent,
        languageVersion,
        true
      );
    }

    return originalGetSourceFile.call(
      host,
      fileName,
      languageVersion,
      onError,
      shouldCreateNewSourceFile
    );
  };

  // Override resolveModuleNames to handle .NET imports
  const hostWithResolve = host as ts.CompilerHost & {
    resolveModuleNames: (
      moduleNames: string[],
      containingFile: string
    ) => (ts.ResolvedModule | undefined)[];
  };
  hostWithResolve.resolveModuleNames = (
    moduleNames: string[],
    containingFile: string
  ): (ts.ResolvedModule | undefined)[] => {
    return moduleNames.map((moduleName) => {
      // Debug log
      if (options.verbose) {
        console.log(`Resolving module: ${moduleName} from ${containingFile}`);
      }

      // Check if this is a .NET namespace
      const resolvedFile = namespaceFiles.get(moduleName);
      if (resolvedFile !== undefined) {
        if (options.verbose) {
          console.log(
            `  Resolved .NET namespace ${moduleName} to ${resolvedFile}`
          );
        }
        return {
          resolvedFileName: resolvedFile,
          isExternalLibraryImport: true,
        };
      }

      // @tsonic/* packages must stay on a single coherent package graph for the
      // active compilation. Mixing:
      //   - compiler/typeRoot-owned declarations, and
      //   - project-local installed copies
      // produces nominal identity splits inside TypeScript (e.g. two different
      // Task / Stream / Exception hierarchies), which then surface as impossible
      // overload failures and self-incompatible types.
      if (moduleName.startsWith("@tsonic/")) {
        const request = parseTsonicModuleRequest(moduleName);

        // 1) If this package is already part of the active type-root/surface
        // graph, always resolve to that exact root — even for user source files.
        if (request) {
          const authoritativeRoot = authoritativeTsonicPackageRoots.get(
            request.packageName
          );
          if (authoritativeRoot) {
            const resolved = resolveModuleFromPackageRoot(
              authoritativeRoot,
              request.subpath
            );
            if (resolved) return resolved;
          }
        }

        // 2) In local monorepo / compiler-install development, prefer the
        // compiler-owned sibling package graph before consulting the project's
        // installed copy. This keeps direct source imports coherent with surface
        // declarations that already came from sibling roots.
        if (request) {
          const compilerOwnedRoot = resolveTsonicPackageRoot(
            request.pkgDirName
          );
          if (compilerOwnedRoot) {
            const resolved = resolveModuleFromPackageRoot(
              compilerOwnedRoot,
              request.subpath
            );
            if (resolved) return resolved;
          }
        }

        // 3) Fall back to the project's installed dependency graph when no
        // authoritative / compiler-owned root is available.
        // Note: containingFile can be a declaration file coming from a sibling
        // checkout during development; resolving relative to that path would skip
        // the project's node_modules entirely.
        const projectResolveFile = path.join(
          options.projectRoot,
          "__tsonic_resolver__.ts"
        );
        const projectResult = ts.resolveModuleName(
          moduleName,
          projectResolveFile,
          tsOptions,
          host
        );
        if (projectResult.resolvedModule) return projectResult.resolvedModule;

        // Final resolution fallback through the compiler's own module graph.
        const result = ts.resolveModuleName(
          moduleName,
          compilerContainingFile,
          tsOptions,
          host
        );
        if (result.resolvedModule) return result.resolvedModule;

        return undefined;
      }

      const sourcePackage = resolveSourcePackageImport(
        moduleName,
        containingFile,
        options.surface,
        options.projectRoot
      );
      if (!sourcePackage.ok) {
        return undefined;
      }
      if (sourcePackage.value) {
        return {
          resolvedFileName: sourcePackage.value.resolvedPath,
          extension: sourcePackage.value.resolvedPath.endsWith(".mts")
            ? ts.Extension.Mts
            : sourcePackage.value.resolvedPath.endsWith(".cts")
              ? ts.Extension.Cts
              : ts.Extension.Ts,
          isExternalLibraryImport: false,
        };
      }

      // Use default resolution for other modules
      const result = ts.resolveModuleName(
        moduleName,
        containingFile,
        tsOptions,
        host
      );
      return result.resolvedModule;
    });
  };

  const program = ts.createProgram(allFiles, tsOptions, host);

  const diagnostics = collectTsDiagnostics(program);

  if (diagnostics.hasErrors) {
    return error(diagnostics);
  }

  // User source files (non-declaration files from input paths)
  const sourceFiles = program
    .getSourceFiles()
    .filter(
      (sf) => !sf.isDeclarationFile && absolutePaths.includes(sf.fileName)
    );

  // Declaration files for TypeRegistry:
  // include all declarations in the program. ProgramContext later filters out
  // CLR metadata packages that are represented in the CLR catalog.
  // This keeps surface support generic: custom non-@tsonic surface packages are
  // available to the frontend without any package-name allowlist.
  const declarationSourceFiles = program
    .getSourceFiles()
    .filter((sf) => sf.isDeclarationFile);

  // Load .NET metadata files
  const metadata = loadDotnetMetadata(typeRoots);

  // Load binding manifests (from typeRoots - for ambient globals)
  const bindings = loadBindings(typeRoots);
  // Compiler-owned builtin: map TS `Error` to CLR `System.Exception`.
  // This keeps `throw new Error(...)` usable in noLib mode without requiring
  // consumers to import Exception explicitly.
  if (!bindings.getBinding("Error")) {
    bindings.addBindings("tsonic:builtins", {
      bindings: {
        Error: {
          kind: "global",
          assembly: "System.Private.CoreLib",
          type: "System.Exception",
          typeSemantics: {
            contributesTypeIdentity: true,
          },
        },
      },
    });
  }

  // Create resolver for import-driven CLR namespace discovery
  // Uses projectRoot (not sourceRoot) to resolve packages from node_modules
  const clrResolver = createClrBindingsResolver(options.projectRoot);

  // Create binding layer for symbol resolution
  // This replaces direct checker API calls throughout the pipeline
  const checker = program.getTypeChecker();
  const binding = createBinding(checker);

  return ok({
    program,
    checker,
    options,
    sourceFiles,
    declarationSourceFiles,
    metadata,
    bindings,
    clrResolver,
    binding,
  });
};
