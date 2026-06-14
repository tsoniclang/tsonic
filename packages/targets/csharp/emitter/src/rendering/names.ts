const reserved = new Set([
  "base",
  "bool",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "default",
  "do",
  "else",
  "enum",
  "event",
  "false",
  "finally",
  "for",
  "foreach",
  "if",
  "in",
  "interface",
  "internal",
  "is",
  "lock",
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
  "static",
  "string",
  "struct",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "using",
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
