const stripTypeSyntax = (typeText: string): string =>
  typeText
    .replace(/\breadonly\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

const splitTopLevel = (text: string, delimiter: string): readonly string[] => {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    switch (char) {
      case "<":
      case "(":
      case "[":
      case "{":
        depth += 1;
        break;
      case ">":
      case ")":
      case "]":
      case "}":
        depth = Math.max(0, depth - 1);
        break;
      default:
        break;
    }
    if (depth === 0 && text.startsWith(delimiter, index)) {
      parts.push(text.slice(start, index).trim());
      start = index + delimiter.length;
      index += delimiter.length - 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts.filter((part) => part.length > 0);
};

const genericArgument = (typeText: string, name: string): string | undefined => {
  const prefix = `${name}<`;
  if (!typeText.startsWith(prefix) || !typeText.endsWith(">")) return undefined;
  return typeText.slice(prefix.length, -1).trim();
};

const genericArguments = (
  typeText: string,
  name: string
): readonly string[] | undefined => {
  const argumentText = genericArgument(typeText, name);
  return argumentText === undefined ? undefined : splitTopLevel(argumentText, ",");
};

const renderFunctionType = (typeText: string): string | undefined => {
  const arrowIndex = typeText.indexOf("=>");
  if (arrowIndex < 0) return undefined;
  const parameterText = typeText.slice(0, arrowIndex).trim();
  const returnTypeText = typeText.slice(arrowIndex + 2).trim();
  if (!parameterText.startsWith("(") || !parameterText.endsWith(")")) {
    return undefined;
  }

  const parameters = splitTopLevel(parameterText.slice(1, -1), ",")
    .map((parameter) => {
      const colonIndex = parameter.indexOf(":");
      const rawType =
        colonIndex >= 0 ? parameter.slice(colonIndex + 1).trim() : parameter;
      return renderCSharpType(rawType.replace(/^\.\.\./, "").replace(/\?$/, ""));
    })
    .filter((parameter) => parameter.length > 0);
  const returnType = renderCSharpType(returnTypeText);
  return returnType === "void"
    ? parameters.length === 0
      ? "global::System.Action"
      : `global::System.Action<${parameters.join(", ")}>`
    : `global::System.Func<${[...parameters, returnType].join(", ")}>`;
};

export const renderCSharpType = (typeText: string | undefined): string => {
  if (!typeText) return "object?";

  const normalized = stripTypeSyntax(typeText);
  if (normalized.endsWith("?")) {
    return renderNullableCSharpType(normalized.slice(0, -1));
  }
  const typePredicate = /^\S+\s+is\s+.+$/.test(normalized);
  if (typePredicate) {
    return "bool";
  }

  const functionType = renderFunctionType(normalized);
  if (functionType) {
    return functionType;
  }

  const union = splitTopLevel(normalized, "|");
  if (union.length > 1) {
    const withoutUndefined = union.filter(
      (part) => part !== "undefined" && part !== "null"
    );
    if (withoutUndefined.length === 1) {
      const rendered = renderCSharpType(withoutUndefined[0]);
      if (rendered === "void") return "object?";
      return rendered.endsWith("?") ? rendered : `${rendered}?`;
    }
    return "object?";
  }

  const arrayElement = normalized.endsWith("[]")
    ? normalized.slice(0, -2)
    : undefined;
  if (arrayElement) {
    return `${renderCSharpType(arrayElement)}[]`;
  }

  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    return `(${splitTopLevel(normalized.slice(1, -1), ",")
      .map((item) => renderCSharpType(item))
      .join(", ")})`;
  }

  const parenthesizedTuple = normalized.match(/^\(\s*\[(.*)\]\s*\)$/);
  if (parenthesizedTuple) {
    return `(${splitTopLevel(parenthesizedTuple[1] ?? "", ",")
      .map((item) => renderCSharpType(item))
      .join(", ")})`;
  }

  const readonlyArray = genericArgument(normalized, "ReadonlyArray");
  if (readonlyArray) {
    return `global::System.Collections.Generic.IReadOnlyList<${renderCSharpType(readonlyArray)}>`;
  }

  const array = genericArgument(normalized, "Array");
  if (array) {
    return `${renderCSharpType(array)}[]`;
  }

  const iterable = genericArgument(normalized, "Iterable");
  if (iterable) {
    return `global::System.Collections.Generic.IEnumerable<${renderCSharpType(iterable)}>`;
  }

  const iterableIterator = genericArguments(normalized, "IterableIterator");
  if (iterableIterator) {
    return `global::System.Collections.Generic.IEnumerable<${renderCSharpType(iterableIterator[0])}>`;
  }

  const generator = genericArguments(normalized, "Generator");
  if (generator) {
    return `global::System.Collections.Generic.IEnumerable<${renderCSharpType(generator[0])}>`;
  }

  const list =
    genericArgument(normalized, "List") ?? genericArgument(normalized, "List_1");
  if (list) {
    return `global::System.Collections.Generic.List<${renderCSharpType(list)}>`;
  }

  const queue =
    genericArgument(normalized, "Queue") ?? genericArgument(normalized, "Queue_1");
  if (queue) {
    return `global::System.Collections.Generic.Queue<${renderCSharpType(queue)}>`;
  }

  const concurrentQueue = genericArgument(normalized, "ConcurrentQueue");
  if (concurrentQueue) {
    return `global::System.Collections.Concurrent.ConcurrentQueue<${renderCSharpType(concurrentQueue)}>`;
  }

  const promise = genericArgument(normalized, "Promise");
  if (promise) {
    const renderedPromise = renderCSharpType(promise);
    return renderedPromise === "void"
      ? "global::System.Threading.Tasks.Task"
      : `global::System.Threading.Tasks.Task<${renderedPromise}>`;
  }

  switch (normalized) {
    case "any":
    case "object":
    case "unknown":
    case "undefined":
    case "null":
      return "object?";
    case "this":
      return "this";
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
    case "CancellationTokenSource":
      return "global::System.Threading.CancellationTokenSource";
    case "ManualResetEventSlim":
      return "global::System.Threading.ManualResetEventSlim";
    case "Thread":
      return "global::System.Threading.Thread";
    case "Task":
      return "global::System.Threading.Tasks.Task";
    case "DateTimeOffset":
      return "global::System.DateTimeOffset";
    case "TimeSpan":
      return "global::System.TimeSpan";
    case "CultureInfo":
      return "global::System.Globalization.CultureInfo";
    case "DateTimeStyles":
      return "global::System.Globalization.DateTimeStyles";
    case "Match$instance":
    case "Match":
      return "global::System.Text.RegularExpressions.Match";
    case "Group":
      return "global::System.Text.RegularExpressions.Group";
    case "Regex":
      return "global::System.Text.RegularExpressions.Regex";
    case "RegexOptions":
      return "global::System.Text.RegularExpressions.RegexOptions";
    case "uint":
      return "uint";
    case "ulong":
      return "ulong";
    case "ushort":
      return "ushort";
    default:
      return normalized.includes("|") || normalized.includes("&")
        ? "object?"
        : normalized.replace(/\$/g, "_").replace(/\./g, "_");
  }
};

export const renderNullableCSharpType = (
  typeText: string | undefined
): string => {
  const rendered = renderCSharpType(typeText);
  if (
    rendered === "void" ||
    rendered.endsWith("?") ||
    rendered.endsWith("[]") ||
    rendered.startsWith("global::System.Func") ||
    rendered.startsWith("global::System.Action") ||
    rendered.startsWith("global::System.Collections.") ||
    /^[A-Z_]/.test(rendered)
  ) {
    return `${rendered}${rendered.endsWith("?") ? "" : "?"}`;
  }
  switch (rendered) {
    case "bool":
    case "byte":
    case "char":
    case "decimal":
    case "double":
    case "float":
    case "int":
    case "long":
    case "sbyte":
    case "short":
    case "uint":
    case "ulong":
    case "ushort":
      return `${rendered}?`;
    default:
      return rendered.endsWith("?") ? rendered : `${rendered}?`;
  }
};

export const renderFunctionReturnType = (
  returnTypeText: string | undefined,
  isAsync: boolean
): string => {
  const rendered = renderCSharpType(returnTypeText);
  if (rendered.startsWith("global::System.Threading.Tasks.Task")) {
    return rendered;
  }
  if (!isAsync) return rendered;
  return rendered === "void"
    ? "global::System.Threading.Tasks.Task"
    : `global::System.Threading.Tasks.Task<${rendered}>`;
};
