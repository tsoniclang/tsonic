const stripTypeSyntax = (typeText: string): string =>
  typeText
    .replace(/\breadonly\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

const genericArgument = (typeText: string, name: string): string | undefined => {
  const prefix = `${name}<`;
  if (!typeText.startsWith(prefix) || !typeText.endsWith(">")) return undefined;
  return typeText.slice(prefix.length, -1).trim();
};

export const renderCSharpType = (typeText: string | undefined): string => {
  if (!typeText) return "object?";

  const normalized = stripTypeSyntax(typeText);
  const arrayElement = normalized.endsWith("[]")
    ? normalized.slice(0, -2)
    : undefined;
  if (arrayElement) {
    return `${renderCSharpType(arrayElement)}[]`;
  }

  const readonlyArray = genericArgument(normalized, "ReadonlyArray");
  if (readonlyArray) {
    return `global::System.Collections.Generic.IReadOnlyList<${renderCSharpType(readonlyArray)}>`;
  }

  const array = genericArgument(normalized, "Array");
  if (array) {
    return `${renderCSharpType(array)}[]`;
  }

  const promise = genericArgument(normalized, "Promise");
  if (promise) {
    return `global::System.Threading.Tasks.Task<${renderCSharpType(promise)}>`;
  }

  switch (normalized) {
    case "any":
    case "object":
    case "unknown":
      return "object?";
    case "boolean":
    case "bool":
      return "bool";
    case "byte":
      return "byte";
    case "char":
      return "char";
    case "decimal":
      return "decimal";
    case "double":
    case "number":
      return "double";
    case "float":
      return "float";
    case "int":
      return "int";
    case "long":
      return "long";
    case "never":
    case "void":
      return "void";
    case "sbyte":
      return "sbyte";
    case "short":
      return "short";
    case "string":
      return "string";
    case "uint":
      return "uint";
    case "ulong":
      return "ulong";
    case "ushort":
      return "ushort";
    default:
      return normalized.includes("|") || normalized.includes("&")
        ? "object?"
        : normalized.replace(/\./g, "_");
  }
};

export const renderFunctionReturnType = (
  returnTypeText: string | undefined,
  isAsync: boolean
): string => {
  const rendered = renderCSharpType(returnTypeText);
  if (!isAsync) return rendered;
  return rendered === "void"
    ? "global::System.Threading.Tasks.Task"
    : `global::System.Threading.Tasks.Task<${rendered}>`;
};
