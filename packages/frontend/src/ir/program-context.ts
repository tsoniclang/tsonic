/**
 * ProgramContext — Per-compilation context for all semantic state
 *
 * This is the ONLY place where internal registries are constructed and wired together.
 * All converters and builder helpers receive context explicitly — no global state.
 *
 * Phase 5 Step 4: Airplane-grade parallel safety.
 */

import * as path from "path";
import type { Binding, BindingInternal } from "./binding/index.js";
import type { TypeSystem } from "./type-system/type-system.js";
import type { DotnetMetadataRegistry } from "../dotnet-metadata.js";
import type { BindingRegistry } from "../program/bindings.js";
import type { ClrBindingsResolver } from "../resolver/clr-bindings-resolver.js";
import type { TsonicProgram } from "../program.js";
import type { IrBuildOptions } from "./builder/types.js";
import { buildNominalEnv } from "./type-system/internal/nominal-env.js";
import {
  convertType,
  convertCapturedTypeNode,
} from "./type-system/internal/type-converter.js";
import { createTypeSystem } from "./type-system/type-system.js";
import { loadClrCatalog } from "./type-system/internal/universe/clr-catalog.js";
import { buildUnifiedUniverse } from "./type-system/internal/universe/unified-universe.js";
import { buildSourceCatalog } from "./type-system/internal/universe/source-catalog.js";

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
  readonly typeSystem: TypeSystem;

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
};

/**
 * Create a ProgramContext for a compilation.
 *
 * This factory is the ONLY place that wires together the internal registries.
 * It performs the full setup:
 * 1. Build SourceCatalog / TypeRegistry using two-pass builder
 * 2. Build NominalEnv for inheritance chain substitution
 * 3. Build CLR catalog from node_modules
 * 4. Build UnifiedUniverse merging source and CLR types
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
  const allSourceFiles = [
    ...program.sourceFiles,
    ...program.declarationSourceFiles,
  ];
  const { typeRegistry } = buildSourceCatalog({
    sourceFiles: allSourceFiles,
    checker: program.checker,
    sourceRoot: options.sourceRoot,
    rootNamespace: options.rootNamespace,
    binding: program.binding,
  });

  // Build NominalEnv from TypeRegistry
  // This enables inheritance chain substitution for member access
  const nominalEnv = buildNominalEnv(
    typeRegistry,
    convertType,
    program.binding
  );

  // Load assembly type catalog for CLR stdlib types
  // This enables member lookup on primitive types like string.length
  const nodeModulesPath = path.resolve(
    program.options.projectRoot,
    "node_modules"
  );
  const assemblyCatalog = loadClrCatalog(nodeModulesPath);

  // Build unified catalog merging source and assembly types
  const unifiedCatalog = buildUnifiedUniverse(
    typeRegistry,
    assemblyCatalog,
    program.options.rootNamespace
  );

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
  });

  return {
    binding: program.binding,
    typeSystem,
    metadata: program.metadata,
    bindings: program.bindings,
    clrResolver: program.clrResolver,
  };
};
