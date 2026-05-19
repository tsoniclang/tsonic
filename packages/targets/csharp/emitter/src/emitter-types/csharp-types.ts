/**
 * C# language-specific types
 */

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
