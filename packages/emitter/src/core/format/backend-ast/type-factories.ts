import type { CSharpTypeAst } from "./types.js";

const predefinedTypeKeywords = new Set<string>([
  "bool",
  "byte",
  "sbyte",
  "short",
  "ushort",
  "int",
  "uint",
  "long",
  "ulong",
  "nint",
  "nuint",
  "char",
  "float",
  "double",
  "decimal",
  "string",
  "object",
  "void",
  "dynamic",
]);

const simpleIdentifierPattern = /^@?[A-Za-z_][A-Za-z0-9_]*$/;
const qualifiedIdentifierPattern =
  /^@?[A-Za-z_][A-Za-z0-9_]*(?:(?:\.|::)@?[A-Za-z_][A-Za-z0-9_]*)*$/;

const splitTopLevelCommaSeparated = (
  input: string
): readonly string[] | undefined => {
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < input.length; index++) {
    const ch = input[index];
    if (ch === "<" || ch === "(" || ch === "[" || ch === "{") {
      depth++;
      continue;
    }
    if (ch === ">" || ch === ")" || ch === "]" || ch === "}") {
      depth--;
      if (depth < 0) return undefined;
      continue;
    }
    if (ch === "," && depth === 0) {
      const part = input.slice(start, index).trim();
      if (!part) return undefined;
      items.push(part);
      start = index + 1;
    }
  }
  if (depth !== 0) return undefined;
  const tail = input.slice(start).trim();
  if (!tail) return undefined;
  items.push(tail);
  return items;
};

const parseArrayType = (text: string): CSharpTypeAst | undefined => {
  const match = text.match(/^(.*)\[(,*?)\]$/);
  if (!match) return undefined;
  const base = match[1]?.trim();
  const commas = match[2] ?? "";
  if (!base) return undefined;
  return {
    kind: "arrayType",
    elementType: typeAstFromText(base),
    rank: commas.length + 1,
  };
};

const parseGenericIdentifierType = (
  text: string
): CSharpTypeAst | undefined => {
  const lt = text.indexOf("<");
  if (lt <= 0 || !text.endsWith(">")) return undefined;
  const base = text.slice(0, lt).trim();
  const argsText = text.slice(lt + 1, -1).trim();
  if (!qualifiedIdentifierPattern.test(base) || !argsText) return undefined;
  const args = splitTopLevelCommaSeparated(argsText);
  if (!args || args.length === 0) return undefined;
  return {
    kind: "identifierType",
    name: base,
    typeArguments: args.map((arg) => typeAstFromText(arg)),
  };
};

export const typeAstFromText = (text: string): CSharpTypeAst => {
  const trimmed = text.trim();
  if (trimmed.endsWith("?")) {
    const underlying = trimmed.slice(0, -1).trim();
    if (underlying) {
      return {
        kind: "nullableType",
        underlyingType: typeAstFromText(underlying),
      };
    }
  }

  const arrayType = parseArrayType(trimmed);
  if (arrayType) return arrayType;

  if (predefinedTypeKeywords.has(trimmed)) {
    return {
      kind: "predefinedType",
      keyword: trimmed as Extract<
        CSharpTypeAst,
        { kind: "predefinedType" }
      >["keyword"],
    };
  }

  const genericType = parseGenericIdentifierType(trimmed);
  if (genericType) return genericType;

  if (
    simpleIdentifierPattern.test(trimmed) ||
    qualifiedIdentifierPattern.test(trimmed)
  ) {
    return { kind: "identifierType", name: trimmed };
  }

  return { kind: "rawType", text: trimmed };
};
