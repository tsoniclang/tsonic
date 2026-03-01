/**
 * ProgramContext — Per-compilation context for all semantic state
 *
 * This is the ONLY place where internal registries are constructed and wired together.
 * All converters and builder helpers receive context explicitly — no global state.
 *
 * Phase 6: NominalEnv is now TypeId-based, using UnifiedTypeCatalog.
 */

import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "path";
import * as ts from "typescript";
import type { Binding, BindingInternal } from "./binding/index.js";
import type { TypeAuthority } from "./type-system/type-system.js";
import type { IrType } from "./types.js";
import type { DotnetMetadataRegistry } from "../dotnet-metadata.js";
import type { BindingRegistry } from "../program/bindings.js";
import type { ClrBindingsResolver } from "../resolver/clr-bindings-resolver.js";
import type { TsonicProgram } from "../program.js";
import type { IrBuildOptions } from "./builder/types.js";
import type { Diagnostic } from "../types/diagnostic.js";
import { buildNominalEnv } from "./type-system/internal/nominal-env.js";
import { convertCapturedTypeNode } from "./type-system/internal/type-converter.js";
import { createTypeSystem } from "./type-system/type-system.js";
import {
  buildAliasTable,
  buildSourceCatalog,
  buildUnifiedUniverse,
  loadClrCatalog,
} from "./type-system/internal/universe/index.js";

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
   * TypeScript checker for symbol-only queries in converter-time analyses.
   *
   * This must never be used for computed type inference APIs (getTypeAtLocation, etc.).
   */
  readonly checker: ts.TypeChecker;

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
   * IR conversion diagnostics emitted by converters (non-TypeSystem).
   *
   * Converters should record deterministic, airplane-grade failures here
   * instead of guessing (e.g., ambiguous CLR bindings).
   *
   * Collected by `buildIr()` and treated as compilation errors.
   */
  readonly diagnostics: Diagnostic[];
};

/**
 * Create a ProgramContext for a compilation.
 *
 * This factory is the ONLY place that wires together the internal registries.
 * It performs the full setup:
 * 1. Build SourceCatalog / TypeRegistry using two-pass builder
 * 2. Build CLR catalog from node_modules
 * 3. Build UnifiedUniverse merging source and CLR types
 * 4. Build NominalEnv from UnifiedTypeCatalog (TypeId-based)
 * 5. Construct TypeSystem as single source of truth
 *
 * @param program - The TsonicProgram with type checker and bindings
 * @param options - Build options (sourceRoot, rootNamespace)
 */
export const createProgramContext = (
  program: TsonicProgram,
  options: IrBuildOptions
): ProgramContext => {
  // Build TypeRegistry from all source files INCLUDING declaration files from typeRoots
  // Declaration files contain globals (String, Array, etc.) needed for method resolution
  //
  // PHASE 4 (Alice's spec): Use buildSourceCatalog with two-pass build.
  // Pass A: Register all type names (skeleton)
  // Pass B: Convert all type annotations (with stable resolution)
  const packageRootCache = new Map<string, string | undefined>();
  const packageInfoCache = new Map<
    string,
    | {
        readonly name: string | undefined;
        readonly keywords: readonly string[];
        readonly peerDependencies: Readonly<Record<string, string>>;
      }
    | undefined
  >();
  const packageHasMetadataCache = new Map<string, boolean>();

  const findPackageRootForFile = (fileName: string): string | undefined => {
    const normalized = fileName.replace(/\\/g, "/");
    if (packageRootCache.has(normalized))
      return packageRootCache.get(normalized);

    let dir = path.dirname(fileName);
    while (true) {
      const pkgJson = path.join(dir, "package.json");
      if (fs.existsSync(pkgJson)) {
        packageRootCache.set(normalized, dir);
        return dir;
      }
      const parent = path.dirname(dir);
      if (parent === dir) {
        packageRootCache.set(normalized, undefined);
        return undefined;
      }
      dir = parent;
    }
  };

  const getPackageInfo = (
    pkgRoot: string
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

  const isTsonicClrPackage = (pkgRoot: string): boolean => {
    const info = getPackageInfo(pkgRoot);
    if (!info) return false;

    if (info.name?.startsWith("@tsonic/")) return true;
    if (info.keywords.includes("tsonic")) return true;
    if (
      Object.prototype.hasOwnProperty.call(
        info.peerDependencies,
        "@tsonic/core"
      )
    ) {
      return true;
    }

    return false;
  };

  const packageHasClrMetadata = (pkgRoot: string): boolean => {
    // Only treat explicitly marked Tsonic packages as CLR bindings packages.
    // Many third-party npm packages can ship random JSON files; scanning and excluding
    // them would incorrectly drop their declaration files from SourceCatalog.
    if (!isTsonicClrPackage(pkgRoot)) return false;

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

  const declarationSourceFiles = program.declarationSourceFiles.filter((sf) => {
    const pkgRoot = findPackageRootForFile(sf.fileName);
    if (!pkgRoot) return true;

    // tsbindgen-generated CLR declarations live in packages that include bindings.json
    // and are already represented in the CLR catalog. Including them in SourceCatalog
    // creates tsName collisions (e.g., `IEnumerable_1`) that break nominal resolution.
    return !packageHasClrMetadata(pkgRoot);
  });

  const allSourceFiles = [...program.sourceFiles, ...declarationSourceFiles];
  const { typeRegistry } = buildSourceCatalog({
    sourceFiles: allSourceFiles,
    checker: program.checker,
    sourceRoot: options.sourceRoot,
    rootNamespace: options.rootNamespace,
    binding: program.binding,
  });

  // Load assembly type catalog for CLR stdlib types.
  const nodeModulesPath = path.resolve(
    program.options.projectRoot,
    "node_modules"
  );
  const require = createRequire(import.meta.url);
  const findSiblingTsonicPackage = (
    startDir: string,
    dirName: string,
    expectedPackageName: string
  ): string | undefined => {
    let dir = startDir;
    while (true) {
      const candidateRoot = path.join(dir, dirName);
      const pkgJson = path.join(candidateRoot, "package.json");
      if (fs.existsSync(pkgJson)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(pkgJson, "utf-8")) as {
            readonly name?: unknown;
          };
          if (parsed.name === expectedPackageName) {
            return candidateRoot;
          }
        } catch {
          // Ignore invalid package.json and keep searching.
        }
      }

      const parent = path.dirname(dir);
      if (parent === dir) return undefined;
      dir = parent;
    }
  };

  const resolveTsonicPackageRoot = (
    dirName: string,
    expectedPackageName: string
  ): string | undefined => {
    const projectPkgJson = path.join(
      nodeModulesPath,
      "@tsonic",
      dirName,
      "package.json"
    );
    if (fs.existsSync(projectPkgJson)) {
      return path.dirname(projectPkgJson);
    }

    try {
      const pkgJson = require.resolve(`@tsonic/${dirName}/package.json`);
      return path.dirname(pkgJson);
    } catch {
      // Fall through to sibling lookup.
    }

    return findSiblingTsonicPackage(
      program.options.projectRoot,
      dirName,
      expectedPackageName
    );
  };

  const extraPackageRoots: string[] = [];

  // Ensure stdlib metadata is available even when the project has no node_modules
  // (e.g., in a multi-repo workspace). dotnet provides CLR surface area for
  // primitives (System.String, etc.) and core provides @tsonic/core aliases.
  const dotnetInstalled = fs.existsSync(
    path.join(nodeModulesPath, "@tsonic", "dotnet", "package.json")
  );
  if (!dotnetInstalled) {
    const dotnetRoot = resolveTsonicPackageRoot("dotnet", "@tsonic/dotnet");
    if (dotnetRoot) extraPackageRoots.push(dotnetRoot);
  }

  const coreInstalled = fs.existsSync(
    path.join(nodeModulesPath, "@tsonic", "core", "package.json")
  );
  if (!coreInstalled) {
    const coreRoot = resolveTsonicPackageRoot("core", "@tsonic/core");
    if (coreRoot) extraPackageRoots.push(coreRoot);
  }

  // Include any additional CLR packages discovered via imports (e.g., efcore, aspnetcore).
  // The CLR catalog loader scans node_modules/@tsonic by default; when developing in a
  // multi-repo workspace (or running E2E fixtures without local node_modules),
  // imports can resolve from sibling checkouts. Those package roots must be added
  // explicitly so bindings.json files are discovered and loaded into the Universe.
  const resolvePackageRootFromBindingsPath = (
    bindingsPath: string
  ): string | undefined => {
    let dir = path.dirname(bindingsPath);
    while (true) {
      if (fs.existsSync(path.join(dir, "package.json"))) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) return undefined;
      dir = parent;
    }
  };

  for (const bindingsPath of program.clrResolver.getDiscoveredBindingPaths()) {
    const pkgRoot = resolvePackageRootFromBindingsPath(bindingsPath);
    if (pkgRoot) extraPackageRoots.push(pkgRoot);
  }

  const assemblyCatalog = loadClrCatalog(nodeModulesPath, extraPackageRoots);
  const aliasTable = buildAliasTable(assemblyCatalog);

  // Build unified catalog merging source and assembly types
  const unifiedCatalog = buildUnifiedUniverse(
    typeRegistry,
    assemblyCatalog,
    program.options.rootNamespace
  );

  // Phase 6: Build NominalEnv from UnifiedTypeCatalog (TypeId-based)
  // No longer requires TypeRegistry, convertType, or binding
  const nominalEnv = buildNominalEnv(unifiedCatalog);

  // Build TypeSystem — the single source of truth for all type queries (Alice's spec)
  // TypeSystem encapsulates HandleRegistry, TypeRegistry, NominalEnv and type conversion
  const bindingInternal = program.binding as BindingInternal;
  const typeSystem = createTypeSystem({
    handleRegistry: bindingInternal._getHandleRegistry(),
    typeRegistry,
    nominalEnv,
    // Phase 5: Use convertCapturedTypeNode to encapsulate cast in internal module
    convertTypeNode: (node: unknown) =>
      convertCapturedTypeNode(node, program.binding),
    // Unified catalog for CLR assembly type lookups
    unifiedCatalog,
    aliasTable,
    resolveIdentifier: (node: unknown) =>
      ts.isIdentifier(node as ts.Node)
        ? program.binding.resolveIdentifier(node as ts.Identifier)
        : undefined,
    resolveCallSignature: (node: unknown) =>
      ts.isCallExpression(node as ts.Node)
        ? program.binding.resolveCallSignature(node as ts.CallExpression)
        : undefined,
    resolveConstructorSignature: (node: unknown) =>
      ts.isNewExpression(node as ts.Node)
        ? program.binding.resolveConstructorSignature(node as ts.NewExpression)
        : undefined,
  });

  return {
    checker: program.checker,
    binding: program.binding,
    typeSystem,
    metadata: program.metadata,
    bindings: program.bindings,
    clrResolver: program.clrResolver,
    diagnostics: [],
  };
};
