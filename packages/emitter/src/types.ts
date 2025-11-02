/**
 * C# Emitter Types
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

/**
 * C# access modifiers
 */
export type CSharpAccessModifier =
  | "public"
  | "private"
  | "protected"
  | "internal"
  | "protected internal";

/**
 * C# class modifiers
 */
export type CSharpClassModifier = "static" | "abstract" | "sealed" | "partial";

/**
 * C# method modifiers
 */
export type CSharpMethodModifier =
  | "static"
  | "virtual"
  | "override"
  | "abstract"
  | "async"
  | "new"
  | "sealed";

/**
 * Represents a C# using statement
 */
export type CSharpUsing = {
  /** The namespace to import */
  readonly namespace: string;
  /** Whether this is a static import */
  readonly isStatic?: boolean;
  /** Alias for the import */
  readonly alias?: string;
};

/**
 * Helper functions for working with emitter context
 */
export const createContext = (options: EmitterOptions): EmitterContext => ({
  indentLevel: 0,
  options,
  usings: new Set(["Tsonic.Runtime"]),
  isStatic: false,
  isAsync: false,
});

export const indent = (context: EmitterContext): EmitterContext => ({
  ...context,
  indentLevel: context.indentLevel + 1,
});

export const dedent = (context: EmitterContext): EmitterContext => ({
  ...context,
  indentLevel: Math.max(0, context.indentLevel - 1),
});

export const addUsing = (
  context: EmitterContext,
  namespace: string
): EmitterContext => ({
  ...context,
  usings: new Set([...context.usings, namespace]),
});

export const withStatic = (
  context: EmitterContext,
  isStatic: boolean
): EmitterContext => ({
  ...context,
  isStatic,
});

export const withAsync = (
  context: EmitterContext,
  isAsync: boolean
): EmitterContext => ({
  ...context,
  isAsync,
});

export const withClassName = (
  context: EmitterContext,
  className: string
): EmitterContext => ({
  ...context,
  className,
});

/**
 * Get indentation string for current level
 */
export const getIndent = (context: EmitterContext): string => {
  const spaces = context.options.indent ?? 4;
  return " ".repeat(spaces * context.indentLevel);
};

/**
 * Format a list of using statements
 */
export const formatUsings = (usings: ReadonlySet<string>): string => {
  const sorted = Array.from(usings).sort((a, b) => {
    // Tsonic.Runtime ALWAYS FIRST (per spec/06-code-generation.md)
    const aIsTsonicRuntime =
      a === "Tsonic.Runtime" || a.startsWith("static Tsonic.Runtime");
    const bIsTsonicRuntime =
      b === "Tsonic.Runtime" || b.startsWith("static Tsonic.Runtime");
    if (aIsTsonicRuntime && !bIsTsonicRuntime) return -1;
    if (!aIsTsonicRuntime && bIsTsonicRuntime) return 1;

    // System namespaces second
    const aIsSystem = a.startsWith("System");
    const bIsSystem = b.startsWith("System");
    if (aIsSystem && !bIsSystem) return -1;
    if (!aIsSystem && bIsSystem) return 1;

    // Microsoft namespaces third
    const aIsMicrosoft = a.startsWith("Microsoft");
    const bIsMicrosoft = b.startsWith("Microsoft");
    if (aIsMicrosoft && !bIsMicrosoft) return -1;
    if (!aIsMicrosoft && bIsMicrosoft) return 1;

    // Alphabetical within groups
    return a.localeCompare(b);
  });

  return sorted.map((u) => `using ${u};`).join("\n");
};
