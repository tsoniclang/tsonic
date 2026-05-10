/**
 * Dependency graph builder - Multi-file compilation
 * Traverses local imports using ts.resolveModuleName()
 */

import * as ts from "typescript";
import { dirname, isAbsolute, relative, resolve } from "path";
import { Result, ok, error } from "../types/result.js";
import { Diagnostic, createDiagnostic } from "../types/diagnostic.js";
import { IrModule, IrStatement } from "../ir/types.js";
import { buildIr } from "../ir/builder/orchestrator.js";
import { createProgramContext } from "../ir/program-context.js";
import { createProgram, createCompilerOptions } from "./creation.js";
import type { CompilerOptions } from "./types.js";
import type { BindingRegistry, TypeBinding } from "./bindings.js";
import { discoverAndLoadClrBindings } from "./clr-bindings-discovery.js";
import { validateIrSoundness } from "../ir/validation/soundness-gate.js";
import { runNumericProofPass } from "../ir/validation/numeric-proof-pass.js";
import { runCallResolutionRefreshPass } from "../ir/validation/call-resolution-refresh-pass.js";
import { runArrowReturnFinalizationPass } from "../ir/validation/arrow-return-finalization-pass.js";
import { runNumericCoercionPass } from "../ir/validation/numeric-coercion-pass.js";
import { runCharValidationPass } from "../ir/validation/char-validation-pass.js";
import { runYieldLoweringPass } from "../ir/validation/yield-lowering-pass.js";
import { runOverloadCollectionPass } from "../ir/validation/overload-collection-pass.js";
import { runOverloadFamilyConsistencyPass } from "../ir/validation/overload-family-consistency-pass.js";
import { runAttributeCollectionPass } from "../ir/validation/attribute-collection-pass.js";
import { runAnonymousTypeLoweringPass } from "../ir/validation/anonymous-type-lowering-pass.js";
import { runRestTypeSynthesisPass } from "../ir/validation/rest-type-synthesis-pass.js";
import { runVirtualMarkingPass } from "../ir/validation/virtual-marking-pass.js";
import { validateProgram } from "../validation/orchestrator.js";
import {
  getLocalResolutionBoundary,
  parsePackageSpecifier,
  resolveInstalledPackageImport,
  resolveSourcePackageAliasTarget,
  resolveSourcePackageImport,
  resolveSourcePackageImportFromPackageRoot,
} from "../resolver/source-package-resolution.js";
import { resolveImport } from "../resolver.js";
import {
  resolveSurfaceCapabilities,
  type SurfaceCapabilities,
} from "../surface/profiles.js";
import { scanForDeclarationFiles } from "./core-declarations.js";
import {
  discoverDeclarationGlobalImports,
  discoverDeclarationModuleAliases,
  type DeclarationModuleAlias,
} from "./declaration-module-aliases.js";
import { readSourcePackageMetadata } from "./source-package-metadata.js";

export type ModuleDependencyGraphResult = {
  readonly modules: readonly IrModule[];
  readonly entryModule: IrModule;
  readonly surfaceCapabilities: SurfaceCapabilities;
  /** Type bindings loaded from CLR packages (for emitter bindingsRegistry) */
  readonly bindings: ReadonlyMap<string, TypeBinding>;
  /** Full binding registry for exact global/module/source binding lookups during emission. */
  readonly bindingRegistry: BindingRegistry;
};

const tryConvertProgramBuildExceptionToDiagnostics = (
  err: unknown
): readonly Diagnostic[] | undefined => {
  if (!(err instanceof Error)) {
    return undefined;
  }

  const invalidNativeMetadataPrefix =
    "Invalid native source package metadata at ";
  if (err.message.startsWith(invalidNativeMetadataPrefix)) {
    const manifestPath = err.message
      .slice(invalidNativeMetadataPrefix.length)
      .replace(/\.$/, "");
    return [
      createDiagnostic(
        "TSN1004",
        "error",
        `Invalid source package manifest: ${manifestPath}`,
        undefined,
        "Native source packages must declare valid source metadata in tsonic.package.json, including source.namespace and source.exports."
      ),
    ];
  }

  const missingPackageMetadataPrefix = "Installed source package at ";
  if (
    err.message.startsWith(missingPackageMetadataPrefix) &&
    err.message.endsWith(" is missing valid package metadata.")
  ) {
    const packageRoot = err.message.slice(
      missingPackageMetadataPrefix.length,
      -" is missing valid package metadata.".length
    );
    return [
      createDiagnostic(
        "TSN1004",
        "error",
        `Installed source package at ${packageRoot} is missing valid package metadata.`,
        undefined,
        "Native source packages must include package.json name plus valid source.namespace and source.exports in tsonic.package.json."
      ),
    ];
  }

  if (
    err.message.startsWith(missingPackageMetadataPrefix) &&
    err.message.endsWith(" is missing package.json name.")
  ) {
    const packageRoot = err.message.slice(
      missingPackageMetadataPrefix.length,
      -" is missing package.json name.".length
    );
    return [
      createDiagnostic(
        "TSN1004",
        "error",
        `Installed source package at ${packageRoot} is missing package.json name.`,
        undefined,
        "Native source packages must include a package.json with a valid name."
      ),
    ];
  }

  return undefined;
};

/**
 * Collect compiler-synthesized type names that may be referenced across IR modules.
 *
 * These types are not present in user-authored TypeScript, so they cannot be
 * imported via normal ESM syntax. However, they are emitted as top-level C# types
 * within the same assembly, so cross-module references are valid.
 *
 * Example: two files in a project may both lower to (or re-use) a synthesized
 * `__Anon_*` shape type. The second file will reference the type name in IR, but
 * (correctly) has no TS import for it.
 */
const collectSynthesizedTypeNames = (
  modules: readonly IrModule[]
): ReadonlySet<string> => {
  const names = new Set<string>();

  const isTypeDecl = (
    stmt: IrStatement
  ): stmt is Extract<
    IrStatement,
    {
      kind:
        | "classDeclaration"
        | "interfaceDeclaration"
        | "typeAliasDeclaration"
        | "enumDeclaration";
    }
  > =>
    stmt.kind === "classDeclaration" ||
    stmt.kind === "interfaceDeclaration" ||
    stmt.kind === "typeAliasDeclaration" ||
    stmt.kind === "enumDeclaration";

  for (const module of modules) {
    for (const stmt of module.body) {
      if (!isTypeDecl(stmt)) continue;
      if (stmt.name.startsWith("__Anon_") || stmt.name.startsWith("__Rest_")) {
        names.add(stmt.name);
      }
    }
  }

  return names;
};

/**
 * Extract module specifier from import or re-export declaration
 * Returns the module specifier string literal, or null if not applicable
 */
const getModuleSpecifier = (stmt: ts.Statement): ts.StringLiteral | null => {
  // Handle: import { x } from "./module"
  if (
    ts.isImportDeclaration(stmt) &&
    ts.isStringLiteral(stmt.moduleSpecifier)
  ) {
    return stmt.moduleSpecifier;
  }

  // Handle: export { x } from "./module" (re-exports)
  if (
    ts.isExportDeclaration(stmt) &&
    stmt.moduleSpecifier &&
    ts.isStringLiteral(stmt.moduleSpecifier)
  ) {
    return stmt.moduleSpecifier;
  }

  return null;
};

const collectSourcePackageModuleAliases = (
  packageRoots: readonly string[]
): ReadonlyMap<string, DeclarationModuleAlias> => {
  const aliases = new Map<string, DeclarationModuleAlias>();

  for (const packageRoot of packageRoots) {
    const metadata = readSourcePackageMetadata(packageRoot);
    if (!metadata) {
      continue;
    }

    for (const [specifier, targetSpecifier] of Object.entries(
      metadata.moduleAliases
    )) {
      if (aliases.has(specifier)) {
        continue;
      }

      aliases.set(specifier, {
        targetSpecifier,
        declarationFile: resolve(metadata.packageRoot, "tsonic.package.json"),
      });
    }
  }

  return aliases;
};

const collectAuthoritativeSourcePackageRoots = (
  packageRoots: readonly string[]
): ReadonlyMap<string, string> => {
  const roots = new Map<string, string>();

  for (const packageRoot of packageRoots) {
    const metadata = readSourcePackageMetadata(packageRoot);
    if (!metadata || roots.has(metadata.packageName)) {
      continue;
    }
    roots.set(metadata.packageName, metadata.packageRoot);
  }

  return roots;
};

const findAuthoritativePackageRootForImport = (
  importSpecifier: string,
  authoritativeSourcePackageRoots: ReadonlyMap<string, string>
): string | undefined => {
  const parsed = parsePackageSpecifier(importSpecifier);
  if (!parsed) {
    return undefined;
  }
  return authoritativeSourcePackageRoots.get(parsed.packageName);
};

const resolveSourcePackageImportWithAuthoritativeRoots = (
  importSpecifier: string,
  containingFile: string,
  activeSurface: CompilerOptions["surface"],
  projectRoot: string,
  authoritativeSourcePackageRoots: ReadonlyMap<string, string>
): ReturnType<typeof resolveSourcePackageImport> => {
  const authoritativeRoot = findAuthoritativePackageRootForImport(
    importSpecifier,
    authoritativeSourcePackageRoots
  );
  return authoritativeRoot
    ? resolveSourcePackageImportFromPackageRoot(
        importSpecifier,
        authoritativeRoot,
        activeSurface,
        projectRoot
      )
    : resolveSourcePackageImport(
        importSpecifier,
        containingFile,
        activeSurface,
        projectRoot
      );
};

const queueResolvedLocalDependency = (
  importSpecifier: string,
  currentFile: string,
  sourceFile: ts.SourceFile,
  anchor: ts.Node,
  sourceRootAbs: string,
  compilerOptions: ts.CompilerOptions,
  moduleResolutionCache: ts.ModuleResolutionCache,
  queue: string[],
  diagnostics: Diagnostic[]
): void => {
  const resolved = ts.resolveModuleName(
    importSpecifier,
    currentFile,
    compilerOptions,
    ts.sys,
    moduleResolutionCache
  );

  if (resolved.resolvedModule?.resolvedFileName) {
    const resolvedPath = resolved.resolvedModule.resolvedFileName;
    const localBoundary = getLocalResolutionBoundary(
      currentFile,
      sourceRootAbs
    );
    const canonicalResolvedPath =
      ts.sys.realpath?.(resolvedPath) ?? resolvedPath;
    const canonicalLocalBoundary =
      ts.sys.realpath?.(localBoundary) ?? localBoundary;

    if (
      canonicalResolvedPath.startsWith(canonicalLocalBoundary) &&
      canonicalResolvedPath.endsWith(".ts") &&
      !canonicalResolvedPath.endsWith(".d.ts")
    ) {
      queue.push(canonicalResolvedPath);
    } else if (!canonicalResolvedPath.startsWith(canonicalLocalBoundary)) {
      diagnostics.push(
        createDiagnostic(
          "TSN1004",
          "error",
          `Import outside allowed module root: '${importSpecifier}'`,
          {
            file: currentFile,
            line: anchor.getStart(sourceFile),
            column: 1,
            length: importSpecifier.length,
          },
          `Allowed root: ${canonicalLocalBoundary}`
        )
      );
    }
    return;
  }

  const relativeCurrent = relative(sourceRootAbs, currentFile);
  diagnostics.push(
    createDiagnostic(
      "TSN1002",
      "error",
      `Cannot resolve import '${importSpecifier}' from '${relativeCurrent}'`,
      {
        file: currentFile,
        line: anchor.getStart(sourceFile),
        column: 1,
        length: importSpecifier.length,
      }
    )
  );
};

const isQueueableTsSourceDependency = (resolvedPath: string): boolean =>
  (resolvedPath.endsWith(".ts") ||
    resolvedPath.endsWith(".mts") ||
    resolvedPath.endsWith(".cts")) &&
  !resolvedPath.endsWith(".d.ts") &&
  !resolvedPath.endsWith(".d.mts") &&
  !resolvedPath.endsWith(".d.cts");

const canonicalizeExistingPath = (filePath: string): string => {
  const normalizedPath = resolve(filePath);
  return ts.sys.realpath?.(normalizedPath) ?? normalizedPath;
};

const dedupeDiscoveryTypeRoots = (
  typeRoots: readonly string[]
): readonly string[] => {
  const seenPaths = new Set<string>();
  const seenSourcePackageNames = new Set<string>();
  const deduped: string[] = [];

  for (const typeRoot of typeRoots) {
    const metadata = readSourcePackageMetadata(typeRoot);
    if (metadata) {
      if (seenSourcePackageNames.has(metadata.packageName)) {
        continue;
      }
      seenSourcePackageNames.add(metadata.packageName);
      deduped.push(canonicalizeExistingPath(metadata.packageRoot));
      continue;
    }

    const canonicalPath = canonicalizeExistingPath(typeRoot);
    if (seenPaths.has(canonicalPath)) {
      continue;
    }
    seenPaths.add(canonicalPath);
    deduped.push(canonicalPath);
  }

  return deduped;
};

/**
 * Build complete module dependency graph from entry point
 * Traverses all local imports and builds IR for all discovered modules
 * Uses TypeScript's ts.resolveModuleName() for correct module resolution
 */
export const buildModuleDependencyGraph = (
  entryFile: string,
  options: CompilerOptions
): Result<ModuleDependencyGraphResult, readonly Diagnostic[]> => {
  const diagnostics: Diagnostic[] = [];

  // Normalize entry file and source root to absolute paths
  const entryAbs = resolve(entryFile);
  const sourceRootAbs = resolve(options.sourceRoot);

  // Get TypeScript compiler options for module resolution
  const compilerOptions = createCompilerOptions(options);
  const moduleResolutionCache = ts.createModuleResolutionCache(
    options.projectRoot,
    (fileName) =>
      ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase(),
    compilerOptions
  );
  const surfaceCapabilities = resolveSurfaceCapabilities(options.surface, {
    projectRoot: options.projectRoot,
  });
  const discoveryTypeRoots = dedupeDiscoveryTypeRoots(
    Array.from(
      new Set<string>([
        ...(options.typeRoots ?? []),
        ...surfaceCapabilities.requiredTypeRoots,
      ])
    ).map((typeRoot) =>
      ts.sys.resolvePath(
        isAbsolute(typeRoot) ? typeRoot : resolve(options.projectRoot, typeRoot)
      )
    )
  );
  const sourcePackageAmbientFiles = discoveryTypeRoots.flatMap(
    (typeRoot) => readSourcePackageMetadata(typeRoot)?.ambientPaths ?? []
  );
  const declarationFiles = discoveryTypeRoots
    .filter((typeRoot) => !readSourcePackageMetadata(typeRoot))
    .flatMap((typeRoot) => scanForDeclarationFiles(typeRoot));
  const ambientSupportFiles = Array.from(
    new Set([...sourcePackageAmbientFiles, ...declarationFiles])
  );
  const declarationModuleAliases = new Map(
    collectSourcePackageModuleAliases(discoveryTypeRoots)
  );
  const authoritativeSourcePackageRoots =
    collectAuthoritativeSourcePackageRoots(discoveryTypeRoots);
  for (const [specifier, alias] of discoverDeclarationModuleAliases(
    ambientSupportFiles
  )) {
    if (!declarationModuleAliases.has(specifier)) {
      declarationModuleAliases.set(specifier, alias);
    }
  }
  const declarationGlobalImports =
    discoverDeclarationGlobalImports(ambientSupportFiles);
  const ambientGlobalSourceFiles: string[] = [];
  for (const declarationGlobalImport of declarationGlobalImports) {
    const resolvedGlobalImport = resolveImport(
      declarationGlobalImport.targetSpecifier,
      declarationGlobalImport.declarationFile,
      sourceRootAbs,
      {
        bindings: undefined,
        projectRoot: options.projectRoot,
        surface: options.surface,
        authoritativeTsonicPackageRoots: authoritativeSourcePackageRoots,
        declarationModuleAliases,
      }
    );
    if (!resolvedGlobalImport.ok) {
      diagnostics.push(resolvedGlobalImport.error);
      continue;
    }
    if (resolvedGlobalImport.value) {
      ambientGlobalSourceFiles.push(resolvedGlobalImport.value.resolvedPath);
    }
  }
  // Track all discovered files for later type checking
  const allDiscoveredFiles: string[] = [...ambientSupportFiles];

  // BFS to discover all local imports
  const visited = new Set<string>();
  const queue: string[] = [entryAbs, ...ambientGlobalSourceFiles];

  // First pass: discover all files
  while (queue.length > 0) {
    const currentFile = queue.shift();
    if (currentFile === undefined) continue;

    // Dedup by realpath (handles symlinks, relative paths)
    const realPath = ts.sys.realpath?.(currentFile) ?? currentFile;
    if (visited.has(realPath)) {
      continue;
    }
    visited.add(realPath);
    allDiscoveredFiles.push(realPath);

    // Read source file directly from filesystem
    const sourceText = ts.sys.readFile(currentFile);
    if (!sourceText) {
      // Missing file - add diagnostic but continue traversal
      const relativeCurrent = relative(sourceRootAbs, currentFile);
      diagnostics.push(
        createDiagnostic(
          "TSN1002",
          "error",
          `Cannot find module '${relativeCurrent}'`,
          {
            file: currentFile,
            line: 1,
            column: 1,
            length: 1,
          }
        )
      );
      continue;
    }

    // Parse source file to extract imports
    const sourceFile = ts.createSourceFile(
      currentFile,
      sourceText,
      ts.ScriptTarget.Latest,
      true
    );

    // Extract local imports and re-exports using TypeScript's resolution
    for (const stmt of sourceFile.statements) {
      // Handle import declarations: import { x } from "./module"
      // Handle re-export declarations: export { x } from "./module"
      const moduleSpecifier = getModuleSpecifier(stmt);
      if (!moduleSpecifier) {
        continue;
      }

      const importSpecifier = moduleSpecifier.text;

      if (importSpecifier.startsWith(".") || importSpecifier.startsWith("/")) {
        queueResolvedLocalDependency(
          importSpecifier,
          currentFile,
          sourceFile,
          stmt,
          sourceRootAbs,
          compilerOptions,
          moduleResolutionCache,
          queue,
          diagnostics
        );
        continue;
      }

      const declarationAlias = declarationModuleAliases.get(importSpecifier);
      if (declarationAlias) {
        const authoritativeAliasRoot = findAuthoritativePackageRootForImport(
          declarationAlias.targetSpecifier,
          authoritativeSourcePackageRoots
        );
        const redirectedSourcePackage =
          authoritativeAliasRoot !== undefined
            ? resolveSourcePackageAliasTarget(
                declarationAlias.targetSpecifier,
                authoritativeAliasRoot,
                options.surface,
                options.projectRoot
              )
            : declarationAlias.targetSpecifier === "." ||
                declarationAlias.targetSpecifier.startsWith("./")
            ? resolveSourcePackageAliasTarget(
                declarationAlias.targetSpecifier,
                dirname(declarationAlias.declarationFile),
                options.surface,
                options.projectRoot
              )
            : resolveSourcePackageImportWithAuthoritativeRoots(
                declarationAlias.targetSpecifier,
                currentFile,
                options.surface,
                options.projectRoot,
                authoritativeSourcePackageRoots
              );
        if (!redirectedSourcePackage.ok) {
          diagnostics.push({
            ...redirectedSourcePackage.error,
            location: {
              file: currentFile,
              line: stmt.getStart(sourceFile),
              column: 1,
              length: importSpecifier.length,
            },
          });
          continue;
        }
        if (redirectedSourcePackage.value) {
          queue.push(redirectedSourcePackage.value.resolvedPath);
          continue;
        }
      }

      const sourcePackage = resolveSourcePackageImportWithAuthoritativeRoots(
        importSpecifier,
        currentFile,
        options.surface,
        options.projectRoot,
        authoritativeSourcePackageRoots
      );
      if (!sourcePackage.ok) {
        diagnostics.push({
          ...sourcePackage.error,
          location: {
            file: currentFile,
            line: stmt.getStart(sourceFile),
            column: 1,
            length: importSpecifier.length,
          },
        });
        continue;
      }
      if (sourcePackage.value) {
        queue.push(sourcePackage.value.resolvedPath);
        continue;
      }

      const installedPackage = resolveInstalledPackageImport(
        importSpecifier,
        currentFile
      );
      if (!installedPackage.ok) {
        diagnostics.push({
          ...installedPackage.error,
          location: {
            file: currentFile,
            line: stmt.getStart(sourceFile),
            column: 1,
            length: importSpecifier.length,
          },
        });
        continue;
      }
      if (installedPackage.value) {
        if (
          isQueueableTsSourceDependency(installedPackage.value.resolvedPath)
        ) {
          queue.push(installedPackage.value.resolvedPath);
        }
        continue;
      }
    }

  }
  // If any diagnostics from discovery, fail the build
  if (diagnostics.length > 0) {
    return error(diagnostics);
  }

  // Ensure we discovered at least the entry file
  if (allDiscoveredFiles.length === 0) {
    return error([
      createDiagnostic(
        "TSN1002",
        "error",
        `No modules found starting from entry point '${entryFile}'`,
        {
          file: entryFile,
          line: 1,
          column: 1,
          length: 1,
        }
      ),
    ]);
  }

  // Second pass: Create TypeScript program with all discovered files for type checking
  // Use absolute sourceRoot for consistency
  const programResult = createProgram(allDiscoveredFiles, {
    ...options,
    sourceRoot: sourceRootAbs,
  });
  if (!programResult.ok) {
    return error(programResult.error.diagnostics);
  }

  const tsonicProgram = programResult.value;

  // Load CLR bindings before IR building
  // This scans all imports and loads their bindings upfront
  discoverAndLoadClrBindings(tsonicProgram, options.verbose);
  // Run source-level validation (imports, exports, unsupported features, generics)
  const validationCollector = validateProgram(tsonicProgram);
  if (validationCollector.diagnostics.length > 0) {
    return error(validationCollector.diagnostics);
  }

  // Third pass: Build IR for all discovered modules
  // buildIr() creates a single ProgramContext for the entire program.
  // This ensures no global singleton state and enables parallel compilation safety
  let irResult: ReturnType<typeof buildIr>;
  try {
    irResult = buildIr(tsonicProgram, {
      sourceRoot: sourceRootAbs,
      rootNamespace: options.rootNamespace,
    });
  } catch (err) {
    const converted = tryConvertProgramBuildExceptionToDiagnostics(err);
    if (converted) {
      return error([...converted]);
    }
    throw err;
  }

  if (!irResult.ok) {
    return error(irResult.error);
  }

  const modules: IrModule[] = [...irResult.value];
  // Run rest type synthesis pass - attaches rest shape info for object rest destructuring
  // and generates synthetic types for rest objects.
  //
  // IMPORTANT: This must run BEFORE anonymous type lowering. Anonymous lowering
  // replaces objectType shapes with synthesized named types, which would otherwise
  // erase the member information needed to compute rest shapes.
  const restResult = runRestTypeSynthesisPass(modules);

  // Run anonymous type lowering pass - transforms objectType to generated named types
  // This must run before soundness validation so the emitter never sees objectType
  const anonTypeResult = runAnonymousTypeLoweringPass(restResult.modules);
  // Note: This pass always succeeds (no diagnostics), but we use the lowered modules
  const loweredModules = anonTypeResult.modules;

  // Run overload collection pass - extracts O<T>().method(...).family(...)
  // and O(fn).family(...) marker calls
  // and attaches overload-family metadata to declarations.
  //
  // IMPORTANT: This must run BEFORE the IR soundness gate. Overload markers are
  // compiler-only and must be removed before the normal validation/emission pipeline.
  const overloadResult = runOverloadCollectionPass(loweredModules);
  if (!overloadResult.ok) {
    return error(overloadResult.diagnostics);
  }

  const overloadConsistencyResult = runOverloadFamilyConsistencyPass(
    overloadResult.modules
  );
  if (!overloadConsistencyResult.ok) {
    return error(overloadConsistencyResult.diagnostics);
  }

  // Run attribute collection pass - extracts A<T>().add(...) / A(fn).add(...) marker calls
  // and attaches them as attributes to declarations.
  //
  // IMPORTANT: This must run BEFORE the IR soundness gate. Attribute markers are
  // compiler-only and may introduce types that are not representable in the runtime
  // subset (e.g., AttributeDescriptor<>). The pass removes all recognized marker
  // statements so the emitter/soundness gate never see them.
  const attributeResult = runAttributeCollectionPass(
    overloadConsistencyResult.modules
  );
  if (!attributeResult.ok) {
    return error(attributeResult.diagnostics);
  }

  // Run an initial IR soundness gate on the pre-proof lowered IR.
  // A second soundness gate runs after later normalization passes.
  const soundnessResult = validateIrSoundness(attributeResult.modules, {
    knownReferenceTypes: new Set([
      ...tsonicProgram.bindings.getEmitterTypeMap().keys(),
      ...collectSynthesizedTypeNames(attributeResult.modules),
    ]),
  });
  if (!soundnessResult.ok) {
    return error(soundnessResult.diagnostics);
  }

  // Run numeric proof pass - validates all numeric narrowings are provable
  // and attaches proofs to expressions for the emitter
  const numericResult = runNumericProofPass(attributeResult.modules);
  if (!numericResult.ok) {
    return error(numericResult.diagnostics);
  }

  const refreshContext = createProgramContext(tsonicProgram, {
    sourceRoot: sourceRootAbs,
    rootNamespace: options.rootNamespace,
  });
  const refreshedCallResolutionResult = runCallResolutionRefreshPass(
    numericResult.modules,
    refreshContext
  );
  const reloweredAfterRefreshResult = runAnonymousTypeLoweringPass(
    refreshedCallResolutionResult.modules
  );

  // Run arrow return finalization pass - infers return types for expression-bodied
  // arrows from their body's inferredType (after numeric proof has run)
  const arrowResult = runArrowReturnFinalizationPass(
    reloweredAfterRefreshResult.modules
  );

  // Run numeric coercion pass - validates no implicit int→double conversions
  // This enforces the strict contract: integer literals require explicit widening
  const coercionResult = runNumericCoercionPass(arrowResult.modules);
  if (!coercionResult.ok) {
    return error(coercionResult.diagnostics);
  }

  // Run char validation pass - validates char literals and char-typed positions.
  // This prevents emitter ICEs for invalid char literals (length != 1).
  const charResult = runCharValidationPass(coercionResult.modules);
  if (!charResult.ok) {
    return error(charResult.diagnostics);
  }

  // Run yield lowering pass - transforms yield expressions in generators
  // into IrYieldStatement nodes for the emitter
  const yieldResult = runYieldLoweringPass(charResult.modules);
  if (!yieldResult.ok) {
    return error(yieldResult.diagnostics);
  }

  // Run virtual marking pass - marks base class methods as virtual when overridden
  const virtualResult = runVirtualMarkingPass(yieldResult.modules);
  // Note: This pass always succeeds

  // Run a final IR soundness gate on the fully processed modules.
  // This catches any unsupported type metadata reintroduced by later passes
  // (for example call-resolution refresh) before the emitter sees the IR.
  const finalSoundnessResult = validateIrSoundness(virtualResult.modules, {
    knownReferenceTypes: new Set([
      ...tsonicProgram.bindings.getEmitterTypeMap().keys(),
      ...collectSynthesizedTypeNames(virtualResult.modules),
    ]),
  });
  if (!finalSoundnessResult.ok) {
    return error(finalSoundnessResult.diagnostics);
  }

  // Use the processed modules with proofs, lowered yields, attributes, and virtual marks
  const processedModules = [...virtualResult.modules];

  // Sort modules by relative path for deterministic output
  processedModules.sort((a, b) => a.filePath.localeCompare(b.filePath));

  // Entry module is the first one (after sorting, it should be the entry file)
  // But let's find it by matching the entry file path
  const entryRelative = relative(sourceRootAbs, entryAbs).replace(/\\/g, "/");
  const foundEntryModule = processedModules.find(
    (m) => m.filePath === entryRelative
  );
  const entryModule = foundEntryModule ?? processedModules[0];
  if (entryModule === undefined) {
    return error([
      createDiagnostic("TSN1001", "error", "No modules found in the project", {
        file: entryAbs,
        line: 1,
        column: 1,
        length: 1,
      }),
    ]);
  }

  return ok({
    modules: processedModules,
    entryModule,
    surfaceCapabilities: tsonicProgram.surfaceCapabilities ?? surfaceCapabilities,
    bindings: tsonicProgram.bindings.getEmitterTypeMap(),
    bindingRegistry: tsonicProgram.bindings,
  });
};
