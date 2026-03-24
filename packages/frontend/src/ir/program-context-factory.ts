/**
 * ProgramContext factory — createProgramContext
 *
 * This is the ONLY place where internal registries are constructed and wired together.
 * All converters and builder helpers receive context explicitly — no global state.
 */

import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "path";
import * as ts from "typescript";
import type { BindingInternal } from "./binding/index.js";
import type { BindingRegistry } from "../program/bindings.js";
import { simpleBindingContributesTypeIdentity } from "../program/binding-registry.js";
import type { TsonicProgram } from "../program.js";
import type { IrBuildOptions } from "./builder/types.js";
import { buildNominalEnv } from "./type-system/internal/nominal-env.js";
import { convertCapturedTypeNode } from "./type-system/internal/type-converter.js";
import { createTypeSystem } from "./type-system/type-system.js";
import {
  buildAliasTable,
  buildSourceCatalog,
  buildUnifiedUniverse,
  loadClrCatalog,
} from "./type-system/internal/universe/index.js";
import type { AssemblyTypeCatalog } from "./type-system/internal/universe/types.js";
import type { ProgramContext } from "./program-context-types.js";
import {
  findPackageRootForFile,
  packageHasClrMetadata,
} from "./program-context-types.js";

const withSimpleTypeAliases = (
  assemblyCatalog: AssemblyTypeCatalog,
  bindings: BindingRegistry
): AssemblyTypeCatalog => {
  const tsNameToTypeId = new Map(assemblyCatalog.tsNameToTypeId);

  for (const [alias, descriptor] of bindings.getAllBindings()) {
    if (!simpleBindingContributesTypeIdentity(descriptor)) {
      continue;
    }
    if (tsNameToTypeId.has(alias)) continue;

    const typeId = assemblyCatalog.clrNameToTypeId.get(descriptor.type);
    if (!typeId) continue;
    tsNameToTypeId.set(alias, typeId);
  }

  return {
    entries: assemblyCatalog.entries,
    tsNameToTypeId,
    clrNameToTypeId: assemblyCatalog.clrNameToTypeId,
    namespaceToTypeIds: assemblyCatalog.namespaceToTypeIds,
  };
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
  const sourceFilesByPath = new Map<string, ts.SourceFile>(
    program.sourceFiles.map((sourceFile) => [
      sourceFile.fileName.replace(/\\/g, "/"),
      sourceFile,
    ])
  );

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
  const projectRootResolved = path.resolve(program.options.projectRoot);

  const declarationSourceFiles = program.declarationSourceFiles.filter((sf) => {
    const pkgRoot = findPackageRootForFile(
      sf.fileName,
      projectRootResolved,
      packageRootCache
    );
    if (!pkgRoot) return true;

    // tsbindgen-generated CLR declarations live in packages that include bindings.json
    // and are already represented in the CLR catalog. Including them in SourceCatalog
    // creates tsName collisions (e.g., `IEnumerable_1`) that break nominal resolution.
    return !packageHasClrMetadata(
      pkgRoot,
      packageInfoCache,
      packageHasMetadataCache
    );
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

  // Any declaration package participating in the TypeScript program must also
  // contribute its CLR metadata to the assembly catalog. This is the generic
  // rule that keeps ambient surface packages and normal declaration packages in
  // sync: if a package's .d.ts files are in the program, its bindings metadata
  // must be in the universe.
  for (const sourceFile of program.declarationSourceFiles) {
    const pkgRoot = findPackageRootForFile(
      sourceFile.fileName,
      projectRootResolved,
      packageRootCache
    );
    if (
      pkgRoot &&
      packageHasClrMetadata(pkgRoot, packageInfoCache, packageHasMetadataCache)
    ) {
      extraPackageRoots.push(pkgRoot);
    }
  }

  // Include any additional CLR packages discovered via imports (e.g., efcore, aspnetcore).
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

  const assemblyCatalog = withSimpleTypeAliases(
    loadClrCatalog(nodeModulesPath, extraPackageRoots),
    program.bindings
  );
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
    resolveShorthandAssignment: (node: unknown) =>
      ts.isShorthandPropertyAssignment(node as ts.Node)
        ? program.binding.resolveShorthandAssignment(
            node as ts.ShorthandPropertyAssignment
          )
        : undefined,
    resolveCallSignature: (node: unknown) =>
      ts.isCallExpression(node as ts.Node)
        ? program.binding.resolveCallSignature(node as ts.CallExpression)
        : undefined,
    resolveConstructorSignature: (node: unknown) =>
      ts.isNewExpression(node as ts.Node)
        ? program.binding.resolveConstructorSignature(node as ts.NewExpression)
        : undefined,
    checker: program.checker,
    tsCompilerOptions: program.program.getCompilerOptions(),
    sourceFilesByPath,
  });

  return {
    projectRoot: program.options.projectRoot,
    sourceRoot: options.sourceRoot,
    authoritativeTsonicPackageRoots:
      program.authoritativeTsonicPackageRoots ?? new Map<string, string>(),
    rootNamespace: options.rootNamespace,
    surface: program.options.surface ?? "clr",
    checker: program.checker,
    tsCompilerOptions: program.program.getCompilerOptions(),
    sourceFilesByPath,
    binding: program.binding,
    typeSystem,
    metadata: program.metadata,
    bindings: program.bindings,
    clrResolver: program.clrResolver,
    diagnostics: [],
  };
};
