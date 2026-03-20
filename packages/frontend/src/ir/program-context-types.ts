/**
 * ProgramContext type definition and package-resolution helpers.
 *
 * Contains the ProgramContext type and helper functions for resolving
 * package roots, package info, and CLR metadata discovery.
 */

import * as fs from "node:fs";
import * as path from "path";
import * as ts from "typescript";
import type { Binding } from "./binding/index.js";
import type { TypeAuthority } from "./type-system/type-system.js";
import type { IrType } from "./types.js";
import type { DotnetMetadataRegistry } from "../dotnet-metadata.js";
import type { BindingRegistry } from "../program/bindings.js";
import type { ClrBindingsResolver } from "../resolver/clr-bindings-resolver.js";
import type { SurfaceMode } from "../program/types.js";
import type { Diagnostic } from "../types/diagnostic.js";

/**
 * ProgramContext — Per-compilation context owning all semantic state.
 *
 * This context object carries shared resources through the converter chain,
 * eliminating the need for global singletons.
 *
 * INVARIANT: One program → one context. No global state.
 */
export type ProgramContext = {
  /**
   * Project root used for package/module resolution.
   */
  readonly projectRoot: string;

  /**
   * Source root of the current app graph.
   */
  readonly sourceRoot: string;

  /**
   * Root namespace for generated module/type names.
   */
  readonly rootNamespace: string;

  /**
   * Selected language surface mode for this compilation.
   */
  readonly surface: SurfaceMode;

  /**
   * TypeScript checker for symbol-only queries in converter-time analyses.
   *
   * This must never be used for computed type inference APIs (getTypeAtLocation, etc.).
   */
  readonly checker: ts.TypeChecker;

  /**
   * Raw TypeScript compiler options for syntax-level module resolution helpers.
   */
  readonly tsCompilerOptions: ts.CompilerOptions;

  /**
   * Closed-world source files keyed by normalized absolute path.
   */
  readonly sourceFilesByPath: ReadonlyMap<string, ts.SourceFile>;

  /**
   * Binding layer for symbol resolution.
   *
   * Provides resolveIdentifier, resolveCallSignature, etc.
   */
  readonly binding: Binding;

  /**
   * TypeSystem for all type queries (Alice's spec).
   *
   * This is the ONLY source for type information. Converters should use
   * TypeSystem methods instead of accessing TypeRegistry/NominalEnv directly.
   */
  readonly typeSystem: TypeAuthority;

  /**
   * .NET metadata registry for imported types.
   */
  readonly metadata: DotnetMetadataRegistry;

  /**
   * CLR bindings from tsbindgen.
   */
  readonly bindings: BindingRegistry;

  /**
   * CLR namespace resolver for import-driven discovery.
   */
  readonly clrResolver: ClrBindingsResolver;

  /**
   * Lexical type environment for deterministic flow typing.
   *
   * Used for:
   * - Typing unannotated lambda parameters within their body (deterministic, TS-free)
   * - Flow narrowing (e.g. `instanceof`) within control-flow branches
   *
   * Keyed by DeclId.id (not by identifier text) so shadowing is always correct.
   */
  readonly typeEnv?: ReadonlyMap<number, IrType>;

  /**
   * Lexical flow environment for property / access-path narrowings.
   *
   * Keyed by a stable serialized access path (e.g. `decl:42.foo` or `this.bar`)
   * so negative-branch narrowing can survive for property reads like
   * `typeof this.value === "string"` or `Array.isArray(obj.items)`.
   */
  readonly accessEnv?: ReadonlyMap<string, IrType>;

  /**
   * IR conversion diagnostics emitted by converters (non-TypeSystem).
   *
   * Converters should record deterministic, airplane-grade failures here
   * instead of guessing (e.g., ambiguous CLR bindings).
   *
   * Collected by `buildIr()` and treated as compilation errors.
   */
  readonly diagnostics: Diagnostic[];

  /**
   * Synthetic `this` type for object-literal method/accessor conversion.
   *
   * When converting object literal behavior members, `this` does not refer to an
   * enclosing class. It refers to the synthesized object shape itself.
   */
  readonly objectLiteralThisType?: IrType;
};

export const getCommonAncestor = (
  leftPath: string,
  rightPath: string
): string => {
  const leftResolved = path.resolve(leftPath);
  const rightResolved = path.resolve(rightPath);
  const leftParts = leftResolved.split(path.sep).filter(Boolean);
  const rightParts = rightResolved.split(path.sep).filter(Boolean);
  const shared: string[] = [];

  for (
    let index = 0;
    index < Math.min(leftParts.length, rightParts.length);
    index += 1
  ) {
    const leftPart = leftParts[index];
    const rightPart = rightParts[index];
    if (leftPart === undefined || rightPart === undefined) break;
    if (leftPart !== rightPart) break;
    shared.push(leftPart);
  }

  if (shared.length === 0) {
    return path.parse(leftResolved).root;
  }

  return path.join(path.parse(leftResolved).root, ...shared);
};

export const findPackageRootForFile = (
  fileName: string,
  projectRootResolved: string,
  packageRootCache: Map<string, string | undefined>
): string | undefined => {
  const normalized = fileName.replace(/\\/g, "/");
  if (packageRootCache.has(normalized)) return packageRootCache.get(normalized);

  const resolvedFileName = path.resolve(fileName);
  const searchFloor = resolvedFileName.startsWith(
    `${projectRootResolved}${path.sep}`
  )
    ? projectRootResolved
    : getCommonAncestor(resolvedFileName, projectRootResolved);

  let dir = path.dirname(resolvedFileName);
  while (true) {
    const pkgJson = path.join(dir, "package.json");
    if (fs.existsSync(pkgJson)) {
      packageRootCache.set(normalized, dir);
      return dir;
    }
    if (dir === searchFloor) {
      packageRootCache.set(normalized, undefined);
      return undefined;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      packageRootCache.set(normalized, undefined);
      return undefined;
    }
    dir = parent;
  }
};

export const getPackageInfo = (
  pkgRoot: string,
  packageInfoCache: Map<
    string,
    | {
        readonly name: string | undefined;
        readonly keywords: readonly string[];
        readonly peerDependencies: Readonly<Record<string, string>>;
      }
    | undefined
  >
):
  | {
      readonly name: string | undefined;
      readonly keywords: readonly string[];
      readonly peerDependencies: Readonly<Record<string, string>>;
    }
  | undefined => {
  if (packageInfoCache.has(pkgRoot)) return packageInfoCache.get(pkgRoot);

  try {
    const raw = fs.readFileSync(path.join(pkgRoot, "package.json"), "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      packageInfoCache.set(pkgRoot, undefined);
      return undefined;
    }

    const name =
      typeof (parsed as { readonly name?: unknown }).name === "string"
        ? (parsed as { readonly name: string }).name
        : undefined;

    const keywordsRaw = (parsed as { readonly keywords?: unknown }).keywords;
    const keywords: readonly string[] = Array.isArray(keywordsRaw)
      ? keywordsRaw.filter((k): k is string => typeof k === "string")
      : [];

    const peerDepsRaw = (parsed as { readonly peerDependencies?: unknown })
      .peerDependencies;
    const peerDependencies: Readonly<Record<string, string>> =
      peerDepsRaw &&
      typeof peerDepsRaw === "object" &&
      !Array.isArray(peerDepsRaw)
        ? Object.fromEntries(
            Object.entries(peerDepsRaw as Record<string, unknown>).filter(
              (entry): entry is [string, string] =>
                typeof entry[0] === "string" && typeof entry[1] === "string"
            )
          )
        : {};

    const info = { name, keywords, peerDependencies };
    packageInfoCache.set(pkgRoot, info);
    return info;
  } catch {
    packageInfoCache.set(pkgRoot, undefined);
    return undefined;
  }
};

export const isTsonicClrPackage = (
  pkgRoot: string,
  packageInfoCache: Map<
    string,
    | {
        readonly name: string | undefined;
        readonly keywords: readonly string[];
        readonly peerDependencies: Readonly<Record<string, string>>;
      }
    | undefined
  >
): boolean => {
  const info = getPackageInfo(pkgRoot, packageInfoCache);
  if (!info) return false;

  if (info.name?.startsWith("@tsonic/")) return true;
  if (info.keywords.includes("tsonic")) return true;
  if (
    Object.prototype.hasOwnProperty.call(info.peerDependencies, "@tsonic/core")
  ) {
    return true;
  }

  return false;
};

export const packageHasClrMetadata = (
  pkgRoot: string,
  packageInfoCache: Map<
    string,
    | {
        readonly name: string | undefined;
        readonly keywords: readonly string[];
        readonly peerDependencies: Readonly<Record<string, string>>;
      }
    | undefined
  >,
  packageHasMetadataCache: Map<string, boolean>
): boolean => {
  // Only treat explicitly marked Tsonic packages as CLR bindings packages.
  if (!isTsonicClrPackage(pkgRoot, packageInfoCache)) return false;

  const cached = packageHasMetadataCache.get(pkgRoot);
  if (cached !== undefined) return cached;

  let found = false;
  const stack: string[] = [pkgRoot];

  while (stack.length > 0 && !found) {
    const currentDir = stack.pop();
    if (!currentDir) continue;

    try {
      for (const entry of fs.readdirSync(currentDir, {
        withFileTypes: true,
      })) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isFile() && entry.name === "bindings.json") {
          found = true;
          break;
        }
        if (entry.isDirectory()) {
          // Avoid descending into nested node_modules if present.
          if (entry.name === "node_modules") continue;
          stack.push(fullPath);
        }
      }
    } catch {
      // Ignore unreadable directories.
    }
  }

  packageHasMetadataCache.set(pkgRoot, found);
  return found;
};
