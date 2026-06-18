import type { RenderContext } from "../types.js";

const reserved = new Set([
  "abstract",
  "as",
  "base",
  "bool",
  "break",
  "byte",
  "case",
  "catch",
  "checked",
  "char",
  "class",
  "const",
  "continue",
  "default",
  "delegate",
  "decimal",
  "do",
  "double",
  "dynamic",
  "else",
  "enum",
  "event",
  "explicit",
  "extern",
  "false",
  "fixed",
  "float",
  "finally",
  "for",
  "foreach",
  "goto",
  "if",
  "implicit",
  "in",
  "interface",
  "internal",
  "int",
  "is",
  "lock",
  "long",
  "namespace",
  "new",
  "null",
  "object",
  "operator",
  "out",
  "override",
  "params",
  "private",
  "protected",
  "public",
  "readonly",
  "ref",
  "return",
  "sbyte",
  "sealed",
  "short",
  "sizeof",
  "stackalloc",
  "static",
  "string",
  "struct",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "unchecked",
  "typeof",
  "uint",
  "ulong",
  "unsafe",
  "using",
  "ushort",
  "var",
  "virtual",
  "void",
  "volatile",
  "while",
]);

export const sanitizeIdentifier = (name: string | undefined): string => {
  const raw = name && name.length > 0 ? name : "_";
  const normalized = raw.replace(/[^A-Za-z0-9_]/g, "_");
  const leadingSafe = /^[A-Za-z_]/.test(normalized)
    ? normalized
    : `_${normalized}`;
  return reserved.has(leadingSafe) ? `@${leadingSafe}` : leadingSafe;
};

export const sanitizeTypeName = (name: string | undefined): string => {
  const identifier = sanitizeIdentifier(name);
  return identifier.startsWith("@") ? identifier.slice(1) : identifier;
};

export const requiredIdentifier = (
  name: string | undefined,
  context: RenderContext,
  feature: string,
  sourceKindName: string,
  sourceText: string
): string => {
  if (!name || name.length === 0) {
    context.reportUnsupported(feature, sourceKindName, sourceText);
  }
  return sanitizeIdentifier(name);
};
