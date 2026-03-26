/**
 * Core type declarations and compiler-option helpers for program creation.
 *
 * Contains the virtual global-declaration strings that Tsonic injects in noLib
 * mode, directory-scanning utilities for .d.ts files, and the
 * `createCompilerOptions` factory.
 */

import * as ts from "typescript";
import * as path from "node:path";
import * as fs from "node:fs";
import { CompilerOptions } from "./types.js";
import { defaultTsConfig } from "./config.js";
import { resolveSurfaceCapabilities } from "../surface/profiles.js";

export const CORE_GLOBALS_DECLARATIONS = `
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

export const JS_SURFACE_GLOBAL_AUGMENTATIONS = `
declare global {
  interface ArrayConstructor {
    readonly prototype: unknown[];
    new(arrayLength?: number): unknown[];
  }

  interface StringConstructor {
    readonly prototype: String;
  }

  interface NumberConstructor {
    readonly prototype: Number;
  }

  interface BooleanConstructor {
    readonly prototype: Boolean;
  }

  interface DateConstructor {
    readonly prototype: Date;
  }

  interface Uint8ArrayConstructor {
    readonly prototype: Uint8Array;
  }

  interface RegExpConstructor {
    readonly prototype: RegExp;
  }

  interface MapConstructor {
    readonly prototype: Map<unknown, unknown>;
  }

  interface SetConstructor {
    readonly prototype: Set<unknown>;
  }

  interface ObjectConstructor {
    readonly prototype: object;
  }
}

export {};
`.trim();

/**
 * Recursively scan a directory for .d.ts files
 */
export const scanForDeclarationFiles = (dir: string): readonly string[] => {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const scanRoot = path.resolve(dir);
  const sourcePackageRoot = fs.existsSync(
    path.join(scanRoot, "tsonic.package.json")
  )
    ? scanRoot
    : undefined;
  const results: string[] = [];
  const isLegacySourcePackageDeclaration = (candidatePath: string): boolean => {
    if (!sourcePackageRoot) {
      return false;
    }

    const relativePath = path
      .relative(sourcePackageRoot, candidatePath)
      .split(path.sep)
      .join("/");
    return (
      relativePath === "index/internal/index.d.ts" ||
      relativePath.startsWith("index/internal/")
    );
  };

  const visit = (currentDir: string): void => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        // Never crawl dependency trees from a sibling checkout's node_modules.
        // In noLib mode, accidentally pulling in TypeScript's lib.*.d.ts (or other
        // ambient types) will silently change the language surface and break
        // determinism (e.g., `string.indexOf` becomes JS `number` instead of CLR `int`).
        if (
          entry.name === "node_modules" ||
          entry.name === ".git" ||
          isLegacySourcePackageDeclaration(fullPath)
        ) {
          continue;
        }
        visit(fullPath);
      } else if (
        entry.name.endsWith(".d.ts") &&
        entry.name !== "core-globals.d.ts" &&
        !isLegacySourcePackageDeclaration(fullPath)
      ) {
        results.push(fullPath);
      }
    }
  };

  visit(scanRoot);

  return results;
};

export const collectProjectIncludedDeclarationFiles = (
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
  const canonicalizePath = (filePath: string): string => {
    const normalizedPath = path.resolve(filePath);
    try {
      return fs.realpathSync(normalizedPath);
    } catch {
      return normalizedPath;
    }
  };
  const resolveCommonRootDir = (...paths: readonly string[]): string => {
    const [first, ...rest] = paths.map(canonicalizePath);
    let current = first ?? canonicalizePath(options.projectRoot);

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
    preserveSymlinks: true,
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
