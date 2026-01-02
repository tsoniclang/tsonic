/**
 * IR Builder orchestration - Main module building logic
 */

import * as ts from "typescript";
import * as path from "path";
import { relative } from "path";
import { IrModule } from "../types.js";
import { TsonicProgram } from "../../program.js";
import { getNamespaceFromPath, getClassNameFromPath } from "../../resolver.js";
import { Result, ok, error } from "../../types/result.js";
import {
  Diagnostic,
  createDiagnostic,
  isFatal,
} from "../../types/diagnostic.js";
import {
  setMetadataRegistry,
  setBindingRegistry,
  setTypeRegistry,
  setNominalEnv,
  clearTypeRegistries,
  setTypeSystem,
} from "../statement-converter.js";
// Internal accessor for checking if TypeRegistry is initialized (TypeSystem construction only)
import { _internalGetTypeRegistry } from "../converters/statements/declarations/index.js";
import { buildTypeRegistry } from "../type-system/internal/type-registry.js";
import { buildNominalEnv } from "../type-system/internal/nominal-env.js";
import { convertType } from "../type-system/internal/type-converter.js";
import { createTypeSystem } from "../type-system/type-system.js";
import type { BindingInternal } from "../binding/index.js";
import {
  createConverterContext,
  type ConverterContext,
} from "../converters/context.js";
import { IrBuildOptions } from "./types.js";
import { extractImports } from "./imports.js";
import { extractExports } from "./exports.js";
import { extractStatements, isExecutableStatement } from "./statements.js";
import { validateClassImplements } from "./validation.js";
import { loadAssemblyTypeCatalog } from "../type-universe/assembly-catalog.js";
import { buildUnifiedTypeCatalog } from "../type-universe/unified-catalog.js";

/**
 * Build IR module from TypeScript source file
 *
 * @param sourceFile - The TypeScript source file to convert
 * @param program - The Tsonic program with type checker and bindings
 * @param options - Build options (sourceRoot, rootNamespace)
 * @param ctx - Optional ConverterContext for TypeSystem access. When provided,
 *              converters can access TypeSystem instead of singletons.
 *              Optional during migration; will become required when migration completes.
 */
export const buildIrModule = (
  sourceFile: ts.SourceFile,
  program: TsonicProgram,
  options: IrBuildOptions,
  ctx?: ConverterContext
): Result<IrModule, Diagnostic> => {
  try {
    // Set the metadata registry for this compilation
    setMetadataRegistry(program.metadata);

    // Set the binding registry for this compilation
    setBindingRegistry(program.bindings);

    // When called directly (without ctx), clear and initialize fresh registries.
    // This is needed for tests and standalone buildIrModule calls.
    // When called via buildIr with ctx, registries are already initialized.
    if (!ctx) {
      clearTypeRegistries();
    }

    // Initialize TypeRegistry/NominalEnv if not already set (e.g., when called directly by tests)
    // When called via buildIr, these are already initialized for all source files
    if (!_internalGetTypeRegistry()) {
      // Include both user source files AND declaration files from typeRoots
      // Declaration files contain globals (String, Array, etc.) needed for method resolution
      const allSourceFiles = [
        ...program.sourceFiles,
        ...program.declarationSourceFiles,
      ];
      const typeRegistry = buildTypeRegistry(
        allSourceFiles,
        program.checker,
        options.sourceRoot,
        options.rootNamespace
      );
      setTypeRegistry(typeRegistry);

      const nominalEnv = buildNominalEnv(
        typeRegistry,
        convertType,
        program.binding
      );
      setNominalEnv(nominalEnv);

      // Initialize TypeSystem if not already set (needed for validation)
      // Load assembly type catalog for CLR stdlib types
      const nodeModulesPath = path.resolve(
        program.options.projectRoot,
        "node_modules"
      );
      const assemblyCatalog = loadAssemblyTypeCatalog(nodeModulesPath);

      // Build unified catalog merging source and assembly types
      const unifiedCatalog = buildUnifiedTypeCatalog(
        typeRegistry,
        assemblyCatalog,
        program.options.rootNamespace
      );

      // Build TypeSystem — the single source of truth for all type queries
      const bindingInternal = program.binding as BindingInternal;
      const typeSystem = createTypeSystem({
        handleRegistry: bindingInternal._getHandleRegistry(),
        typeRegistry,
        nominalEnv,
        convertTypeNode: (node: unknown) =>
          convertType(node as import("typescript").TypeNode, program.binding),
        unifiedCatalog,
      });
      setTypeSystem(typeSystem);
    }

    const namespace = getNamespaceFromPath(
      sourceFile.fileName,
      options.sourceRoot,
      options.rootNamespace
    );
    const className = getClassNameFromPath(sourceFile.fileName);

    const imports = extractImports(
      sourceFile,
      program.binding,
      program.clrResolver
    );
    const exports = extractExports(sourceFile, program.binding);
    const statements = extractStatements(sourceFile, program.binding, ctx);

    // Check for file name / export name collision (Issue #4)
    // When file name matches an exported function/variable name, C# will have illegal code
    // Example: main.ts exporting function main() → class main { void main() } ❌
    // Note: Classes are allowed to match file name (Person.ts → class Person) - that's the normal pattern
    const collisionExport = exports.find((exp) => {
      if (exp.kind === "declaration") {
        const decl = exp.declaration;
        // Only check functions and variables, NOT classes (classes matching filename is normal)
        if (decl.kind === "functionDeclaration") {
          return decl.name === className;
        } else if (decl.kind === "variableDeclaration") {
          // Check if any of the variable declarators has a matching name
          return decl.declarations.some((declarator) => {
            if (declarator.name.kind === "identifierPattern") {
              return declarator.name.name === className;
            }
            return false;
          });
        }
      } else if (exp.kind === "named") {
        // For named exports, we need to check what's being exported
        // This is more complex because we'd need to look it up in statements
        // For now, skip named exports (they're usually re-exports)
        return false;
      }
      return false;
    });

    if (collisionExport) {
      return error(
        createDiagnostic(
          "TSN2003",
          "error",
          `File name '${className}' conflicts with exported member name. In C#, a type cannot contain a member with the same name as the enclosing type. Consider renaming the file or the exported member.`,
          {
            file: sourceFile.fileName,
            line: 1,
            column: 1,
            length: className.length,
          }
        )
      );
    }

    // Validate class implements patterns
    // TypeScript interfaces are nominalized to C# classes, so "implements" is invalid
    const implementsDiagnostics = validateClassImplements(
      sourceFile,
      program.binding
    );
    const firstImplementsDiagnostic = implementsDiagnostics[0];
    if (firstImplementsDiagnostic) {
      return error(firstImplementsDiagnostic);
    }

    // Determine if this should be a static container
    // Per spec: Files with a class matching the filename should NOT be static containers
    // Static containers are for top-level functions and constants
    const hasClassMatchingFilename = statements.some(
      (stmt) => stmt.kind === "classDeclaration" && stmt.name === className
    );

    const hasTopLevelCode = statements.some(isExecutableStatement);
    const isStaticContainer =
      !hasClassMatchingFilename && !hasTopLevelCode && exports.length > 0;

    // Compute relative file path from source root
    // Normalize to forward slashes for cross-platform consistency
    const relativePath = relative(
      options.sourceRoot,
      sourceFile.fileName
    ).replace(/\\/g, "/");

    const module: IrModule = {
      kind: "module",
      filePath: relativePath, // Now stores relative path instead of absolute
      namespace,
      className,
      isStaticContainer,
      imports,
      body: statements,
      exports,
    };

    return ok(module);
  } catch (err) {
    return error(
      createDiagnostic(
        "TSN6001",
        "error",
        `Failed to build IR: ${err instanceof Error ? err.message : String(err)}`,
        {
          file: sourceFile.fileName,
          line: 1,
          column: 1,
          length: 1,
        }
      )
    );
  }
};

/**
 * Build IR for all source files in the program
 */
export const buildIr = (
  program: TsonicProgram,
  options: IrBuildOptions
): Result<readonly IrModule[], readonly Diagnostic[]> => {
  // Clear any stale type registries from previous compilations
  clearTypeRegistries();

  // Build TypeRegistry from all source files INCLUDING declaration files from typeRoots
  // Declaration files contain globals (String, Array, etc.) needed for method resolution
  // This enables deterministic typing for inherited generic members
  const allSourceFiles = [
    ...program.sourceFiles,
    ...program.declarationSourceFiles,
  ];
  const typeRegistry = buildTypeRegistry(
    allSourceFiles,
    program.checker,
    options.sourceRoot,
    options.rootNamespace
  );
  setTypeRegistry(typeRegistry);

  // Build NominalEnv from TypeRegistry
  // This enables inheritance chain substitution for member access
  const nominalEnv = buildNominalEnv(
    typeRegistry,
    convertType,
    program.binding
  );
  setNominalEnv(nominalEnv);

  // Load assembly type catalog for CLR stdlib types
  // This enables member lookup on primitive types like string.length
  const nodeModulesPath = path.resolve(
    program.options.projectRoot,
    "node_modules"
  );
  const assemblyCatalog = loadAssemblyTypeCatalog(nodeModulesPath);

  // Build unified catalog merging source and assembly types
  const unifiedCatalog = buildUnifiedTypeCatalog(
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
    // Wrap convertType to capture binding context
    convertTypeNode: (node: unknown) =>
      convertType(node as import("typescript").TypeNode, program.binding),
    // Unified catalog for CLR assembly type lookups
    unifiedCatalog,
  });
  setTypeSystem(typeSystem);

  // Create converter context with all shared resources
  // This will be passed through the converter chain during migration
  const ctx: ConverterContext = createConverterContext({
    binding: program.binding,
    typeSystem,
    metadata: program.metadata,
    bindings: program.bindings,
    clrResolver: program.clrResolver,
  });

  const modules: IrModule[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const sourceFile of program.sourceFiles) {
    const result = buildIrModule(sourceFile, program, options, ctx);
    if (result.ok) {
      modules.push(result.value);
    } else {
      diagnostics.push(result.error);
      // Fatal diagnostics abort immediately - no point continuing
      if (isFatal(result.error)) {
        return error(diagnostics);
      }
    }
  }

  if (diagnostics.length > 0) {
    return error(diagnostics);
  }

  return ok(modules);
};
