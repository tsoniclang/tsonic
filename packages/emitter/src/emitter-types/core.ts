/**
 * Core emitter types
 */

import type { MetadataFile } from "@tsonic/frontend/types/metadata.js";
import type { TypeBinding } from "@tsonic/frontend/types/bindings.js";

/**
 * Module identity for import resolution
 */
export type ModuleIdentity = {
  readonly namespace: string;
  readonly className: string;
  readonly filePath: string;
};

/**
 * Module map for resolving cross-file imports
 */
export type ModuleMap = ReadonlyMap<string, ModuleIdentity>;

/**
 * Export source: where an export actually comes from
 * Used to resolve re-exports to their original source
 */
export type ExportSource = {
  /** Canonical file path of the actual source */
  readonly sourceFile: string;
  /** Name of the export in the source file */
  readonly sourceName: string;
};

/**
 * Map from (moduleFilePath, exportName) to actual source
 * Key format: "moduleFilePath:exportName"
 */
export type ExportMap = ReadonlyMap<string, ExportSource>;

/**
 * Options for C# code generation
 */
export type EmitterOptions = {
  /** Root namespace for the application */
  readonly rootNamespace: string;
  /** Whether to include source map comments */
  readonly includeSourceMaps?: boolean;
  /** Indentation style (spaces) */
  readonly indent?: number;
  /** Maximum line length */
  readonly maxLineLength?: number;
  /** Include timestamp in generated files */
  readonly includeTimestamp?: boolean;
  /** Whether this module is an entry point (needs Main method) */
  readonly isEntryPoint?: boolean;
  /** Entry point file path (for batch emit) */
  readonly entryPointPath?: string;
  /** External library paths (contain .metadata and .bindings directories) */
  readonly libraries?: readonly string[];
  /** Runtime mode: "js" uses Tsonic.JSRuntime extensions, "dotnet" uses pure .NET */
  readonly runtime?: "js" | "dotnet";
  /** Module map for resolving cross-file imports (populated during batch emission) */
  readonly moduleMap?: ModuleMap;
  /** Export map for resolving re-exports to actual source (populated during batch emission) */
  readonly exportMap?: ExportMap;
};

/**
 * Import binding information for qualifying imported identifiers.
 * Local module imports are always emitted as fully-qualified references
 * to avoid C# name ambiguity.
 *
 * All CLR name resolution is done in the frontend - the emitter just uses
 * the pre-computed clrName directly (no string parsing or type lookup).
 */
export type ImportBinding = {
  /** Import kind: type (interface/class), value (function/variable), or namespace (import *) */
  readonly kind: "type" | "value" | "namespace";
  /**
   * Fully-qualified CLR name.
   * - For types: the type's FQN (e.g., "MultiFileTypes.models.User")
   * - For values/namespaces: the container class FQN (e.g., "MultiFileTypes.models.user")
   */
  readonly clrName: string;
  /** For value imports: the member name inside the container (e.g., "createUser") */
  readonly member?: string;
};

/**
 * Context passed through emission process
 */
export type EmitterContext = {
  /** Current indentation level */
  readonly indentLevel: number;
  /** Options for emission */
  readonly options: EmitterOptions;
  /** Set of using statements needed (BCL/runtime only, not local modules) */
  readonly usings: ReadonlySet<string>;
  /** Whether currently in static context */
  readonly isStatic: boolean;
  /** Whether currently in async context */
  readonly isAsync: boolean;
  /** Whether currently emitting an array index (omit .0 from integer literals) */
  readonly isArrayIndex?: boolean;
  /** Current class name (for constructor emission) */
  readonly className?: string;
  /** Whether the current class has a superclass (for virtual/override) */
  readonly hasSuperClass?: boolean;
  /** Whether the module has any inheritance (to decide virtual methods) */
  readonly hasInheritance?: boolean;
  /** Loaded .NET metadata files (for CLR type information) */
  readonly metadata?: ReadonlyArray<MetadataFile>;
  /** Registry mapping TypeScript emit names to type bindings */
  readonly bindingsRegistry?: ReadonlyMap<string, TypeBinding>;
  /** Map of local names to import binding info (for qualifying imported identifiers) */
  readonly importBindings?: ReadonlyMap<string, ImportBinding>;
};

/**
 * Result of emitting C# code
 */
export type EmitResult = {
  /** The generated C# code */
  readonly code: string;
  /** Updated context after emission */
  readonly context: EmitterContext;
};

/**
 * Helper type for C# code fragments
 */
export type CSharpFragment = {
  /** The code fragment */
  readonly text: string;
  /** Whether this needs parentheses when used in expressions */
  readonly needsParens?: boolean;
  /** Precedence level for operator expressions */
  readonly precedence?: number;
};
