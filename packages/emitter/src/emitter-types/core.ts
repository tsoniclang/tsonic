/**
 * Core emitter types
 */

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
};

/**
 * Context passed through emission process
 */
export type EmitterContext = {
  /** Current indentation level */
  readonly indentLevel: number;
  /** Options for emission */
  readonly options: EmitterOptions;
  /** Set of using statements needed */
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
