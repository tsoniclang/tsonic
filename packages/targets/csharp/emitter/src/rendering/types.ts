import type { LoweringTypeMemberPlan, LoweringTypeRefPlan } from "@tsonic/frontend";
import { sanitizeIdentifier, sanitizeTypeName } from "./names.js";

const primitiveRuntimeTypes: ReadonlyMap<string, string> = new Map([
  ["bool", "bool"],
  ["char", "char"],
  ["int8", "sbyte"],
  ["uint8", "byte"],
  ["int16", "short"],
  ["uint16", "ushort"],
  ["int32", "int"],
  ["uint32", "uint"],
  ["int64", "long"],
  ["uint64", "ulong"],
  ["native-int", "nint"],
  ["native-uint", "nuint"],
  ["float32", "float"],
  ["float64", "double"],
  ["decimal", "decimal"],
]);

const knownNamedTypes: ReadonlyMap<string, string> = new Map([
  ["CancellationTokenSource", "global::System.Threading.CancellationTokenSource"],
  ["ManualResetEventSlim", "global::System.Threading.ManualResetEventSlim"],
  ["Thread", "global::System.Threading.Thread"],
  ["Task", "global::System.Threading.Tasks.Task"],
  ["DateTimeOffset", "global::System.DateTimeOffset"],
  ["TimeSpan", "global::System.TimeSpan"],
  ["CultureInfo", "global::System.Globalization.CultureInfo"],
  ["DateTimeStyles", "global::System.Globalization.DateTimeStyles"],
  ["Match$instance", "global::System.Text.RegularExpressions.Match"],
  ["Match", "global::System.Text.RegularExpressions.Match"],
  ["Group", "global::System.Text.RegularExpressions.Group"],
  ["Regex", "global::System.Text.RegularExpressions.Regex"],
  ["RegexOptions", "global::System.Text.RegularExpressions.RegexOptions"],
]);

const renderNamedType = (name: string): string =>
  knownNamedTypes.get(name) ?? sanitizeTypeName(name.replace(/\$/g, "_").replace(/\./g, "_"));

const isNullishType = (type: LoweringTypeRefPlan): boolean =>
  (type.kind === "intrinsic" &&
    (type.name === "undefined" || type.name === "null")) ||
  (type.kind === "literal" &&
    (type.literalKind === "undefined" || type.literalKind === "null"));

const isReferenceLikeRenderedType = (rendered: string): boolean =>
  rendered.endsWith("?") ||
  rendered.endsWith("[]") ||
  rendered.startsWith("global::System.Func") ||
  rendered.startsWith("global::System.Action") ||
  rendered.startsWith("global::System.Collections.") ||
  rendered.startsWith("global::System.Threading.Tasks.Task") ||
  /^[A-Z_]/.test(rendered);

const renderNullableRenderedType = (rendered: string): string => {
  if (rendered === "void") return "object?";
  if (isReferenceLikeRenderedType(rendered)) {
    return rendered.endsWith("?") ? rendered : `${rendered}?`;
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
    case "nint":
    case "nuint":
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

const renderUnionType = (type: LoweringTypeRefPlan): string => {
  if (type.kind !== "union") return renderCSharpType(type);
  const nonNullish = type.types.filter((member) => !isNullishType(member));
  if (nonNullish.length === 1) {
    return renderNullableRenderedType(renderCSharpType(nonNullish[0]));
  }
  return "object?";
};

const renderFunctionType = (type: LoweringTypeRefPlan): string => {
  if (type.kind !== "function") return renderCSharpType(type);
  const parameters = type.parameters.map((parameter) =>
    renderCSharpType(parameter.type)
  );
  const returnType = renderCSharpType(type.returnType);
  return returnType === "void"
    ? parameters.length === 0
      ? "global::System.Action"
      : `global::System.Action<${parameters.join(", ")}>`
    : `global::System.Func<${[...parameters, returnType].join(", ")}>`;
};

export const renderCSharpType = (type: LoweringTypeRefPlan | undefined): string => {
  if (!type) return "object?";
  switch (type.kind) {
    case "intrinsic":
      switch (type.name) {
        case "any":
        case "object":
        case "unknown":
        case "undefined":
        case "null":
          return "object?";
        case "this":
          return "this";
        case "boolean":
          return "bool";
        case "number":
          return "double";
        case "bigint":
          return "global::System.Numerics.BigInteger";
        case "never":
        case "void":
          return "void";
        case "string":
          return "string";
        case "symbol":
          return "object?";
      }
    case "source-primitive":
      return primitiveRuntimeTypes.get(type.fact.kind) ?? "object?";
    case "named": {
      const name = renderNamedType(type.name);
      return type.typeArguments.length === 0
        ? name
        : `${name}<${type.typeArguments.map((argument) => renderCSharpType(argument)).join(", ")}>`;
    }
    case "array":
      return type.readonly
        ? `global::System.Collections.Generic.IReadOnlyList<${renderCSharpType(type.elementType)}>`
        : `${renderCSharpType(type.elementType)}[]`;
    case "tuple":
      return `(${type.elements.map((element) => renderCSharpType(element)).join(", ")})`;
    case "union":
      return renderUnionType(type);
    case "intersection":
      return "object?";
    case "function":
      return renderFunctionType(type);
    case "object":
      return "object?";
    case "predicate":
      return "bool";
    case "literal":
      switch (type.literalKind) {
        case "string":
          return "string";
        case "number":
          return "double";
        case "bigint":
          return "global::System.Numerics.BigInteger";
        case "boolean":
          return "bool";
        case "null":
        case "undefined":
          return "object?";
      }
    case "unsupported":
      return "object?";
  }
};

export const renderNullableCSharpType = (
  type: LoweringTypeRefPlan | undefined
): string => renderNullableRenderedType(renderCSharpType(type));

export const renderFunctionReturnType = (
  returnType: LoweringTypeRefPlan | undefined,
  isAsync: boolean
): string => {
  const rendered = renderCSharpType(returnType);
  if (rendered.startsWith("global::System.Threading.Tasks.Task")) {
    return rendered;
  }
  if (!isAsync) return rendered;
  return rendered === "void"
    ? "global::System.Threading.Tasks.Task"
    : `global::System.Threading.Tasks.Task<${rendered}>`;
};

export const renderTypeMember = (member: LoweringTypeMemberPlan): string => {
  switch (member.kind) {
    case "property":
      return `${renderCSharpType(member.type)} ${sanitizeIdentifier(member.name)} { get; set; }`;
    case "method":
      return `${renderCSharpType(member.returnType)} ${sanitizeIdentifier(member.name)}(${member.parameters
        .map(
          (parameter) =>
            `${renderCSharpType(parameter.type)} ${sanitizeIdentifier(parameter.name)}`
        )
        .join(", ")});`;
  }
};
