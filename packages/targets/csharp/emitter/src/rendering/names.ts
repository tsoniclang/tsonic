const reserved = new Set([
  "base",
  "bool",
  "break",
  "byte",
  "case",
  "catch",
  "char",
  "class",
  "const",
  "continue",
  "default",
  "decimal",
  "do",
  "double",
  "else",
  "enum",
  "event",
  "false",
  "float",
  "finally",
  "for",
  "foreach",
  "if",
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
  "out",
  "private",
  "protected",
  "public",
  "readonly",
  "ref",
  "return",
  "sbyte",
  "short",
  "static",
  "string",
  "struct",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "uint",
  "ulong",
  "using",
  "ushort",
  "var",
  "void",
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
