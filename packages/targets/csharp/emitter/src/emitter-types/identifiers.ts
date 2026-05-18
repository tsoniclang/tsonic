/**
 * C# identifier escaping utilities
 *
 * C# reserved keywords must be prefixed with @ when used as identifiers.
 * This module provides utilities to safely emit identifiers that may
 * conflict with C# keywords.
 */

/**
 * Complete list of C# keywords (as of C# 12)
 * https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/
 */
const CSHARP_KEYWORDS: ReadonlySet<string> = new Set([
  // Value keywords
  "bool",
  "byte",
  "char",
  "decimal",
  "double",
  "float",
  "int",
  "long",
  "object",
  "sbyte",
  "short",
  "string",
  "uint",
  "ulong",
  "ushort",
  "void",

  // Reference keywords
  "class",
  "delegate",
  "enum",
  "interface",
  "struct",
  "record",

  // Modifier keywords
  "abstract",
  "async",
  "const",
  "event",
  "extern",
  "in",
  "internal",
  "new",
  "out",
  "override",
  "partial",
  "private",
  "protected",
  "public",
  "readonly",
  "ref",
  "sealed",
  "static",
  "unsafe",
  "virtual",
  "volatile",

  // Statement keywords
  "break",
  "case",
  "catch",
  "checked",
  "continue",
  "default",
  "do",
  "else",
  "finally",
  "fixed",
  "for",
  "foreach",
  "goto",
  "if",
  "lock",
  "return",
  "switch",
  "throw",
  "try",
  "unchecked",
  "while",
  "yield",

  // Expression keywords
  "as",
  "await",
  "base",
  "false",
  "is",
  "nameof",
  "null",
  "sizeof",
  "stackalloc",
  "this",
  "true",
  "typeof",
  "with",

  // Namespace/type keywords
  "namespace",
  "using",

  // Operator keywords
  "operator",
  "implicit",
  "explicit",

  // Parameter keywords
  "params",

  // NOTE: Contextual keywords are NOT included here.
  // Contextual keywords (get, set, init, add, remove, value, var, dynamic, etc.)
  // are only special in specific syntactic contexts and can be used as regular
  // identifiers without escaping in most code.
]);

/**
 * Escape a C# identifier if it's a reserved keyword.
 *
 * In C#, the @ prefix allows using keywords as identifiers:
 * - `@class` is a valid identifier meaning "class"
 * - `@int` is a valid identifier meaning "int"
 *
 * @param name The identifier name to potentially escape
 * @returns The escaped identifier (prefixed with @ if keyword) or original name
 */
export const escapeCSharpIdentifier = (name: string): string =>
  CSHARP_KEYWORDS.has(name) ? `@${name}` : name;

/**
 * Check if a name is a C# keyword
 */
export const isCSharpKeyword = (name: string): boolean =>
  CSHARP_KEYWORDS.has(name);
