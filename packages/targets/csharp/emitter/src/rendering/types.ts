import type { LoweringTypeMemberPlan, LoweringTypeRefPlan } from "@tsonic/frontend";
import type { RenderContext } from "../types.js";
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

const stableHash = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const typeMemberKey = (member: LoweringTypeMemberPlan): string => {
  switch (member.kind) {
    case "property":
      return `property:${member.optional ? "?" : ""}${member.name}:${typePlanKey(member.type)}`;
    case "method":
      return `method:${member.optional ? "?" : ""}${member.name}<${member.typeParameters.join(",")}>(${member.parameters
        .map((parameter) => `${parameter.rest ? "..." : ""}${parameter.name}:${typePlanKey(parameter.type)}`)
        .join(",")}):${typePlanKey(member.returnType)}`;
  }
};

export function typePlanKey(type: LoweringTypeRefPlan | undefined): string {
  if (!type) return "missing";
  switch (type.kind) {
    case "intrinsic":
      return `intrinsic:${type.name}`;
    case "source-primitive":
      return `source-primitive:${type.fact.kind}:${type.fact.sourceName}`;
    case "named":
      return `named:${type.name}<${type.typeArguments.map(typePlanKey).join(",")}>`;
    case "array":
      return `array:${type.readonly ? "readonly" : "mutable"}:${typePlanKey(type.elementType)}`;
    case "tuple":
      return `tuple:${type.readonly ? "readonly" : "mutable"}:${type.elements.map(typePlanKey).join(",")}`;
    case "union":
      return `union:${type.types.map(typePlanKey).join("|")}`;
    case "intersection":
      return `intersection:${type.types.map(typePlanKey).join("&")}`;
    case "function":
      return `function:<${type.typeParameters.join(",")}>(${type.parameters
        .map((parameter) => `${parameter.rest ? "..." : ""}${parameter.optional ? "?" : ""}${typePlanKey(parameter.type)}`)
        .join(",")}):${typePlanKey(type.returnType)}`;
    case "object":
      return `object:{${[...type.members.map(typeMemberKey)].sort().join(";")}}`;
    case "predicate":
      return `predicate:${typePlanKey(type.assertedType)}`;
    case "literal":
      return `literal:${type.literalKind}:${type.valueText}`;
    case "unsupported":
      return `unsupported:${type.sourceKindName}`;
  }
}

export const structuralTypeName = (type: LoweringTypeRefPlan): string =>
  `__TsonicShape_${stableHash(typePlanKey(type))}`;

const isNullishType = (type: LoweringTypeRefPlan): boolean =>
  (type.kind === "intrinsic" &&
    (type.name === "undefined" || type.name === "null")) ||
  (type.kind === "literal" &&
    (type.literalKind === "undefined" || type.literalKind === "null"));

const isOpaqueNullableType = (type: LoweringTypeRefPlan | undefined): boolean =>
  type === undefined ||
  (type.kind === "intrinsic" &&
    (type.name === "any" ||
      type.name === "object" ||
      type.name === "unknown" ||
      type.name === "undefined" ||
      type.name === "null" ||
      type.name === "symbol")) ||
  (type.kind === "literal" &&
    (type.literalKind === "undefined" || type.literalKind === "null")) ||
  type.kind === "unsupported";

const isVoidLikeType = (type: LoweringTypeRefPlan | undefined): boolean =>
  type?.kind === "intrinsic" &&
  (type.name === "void" || type.name === "never");

const isTaskType = (type: LoweringTypeRefPlan | undefined): boolean =>
  type?.kind === "named" && type.name === "Task";

const renderUnionType = (
  type: LoweringTypeRefPlan,
  context?: RenderContext
): string => {
  if (type.kind !== "union") return renderCSharpType(type, context);
  const nonNullish = type.types.filter((member) => !isNullishType(member));
  if (nonNullish.length === 1) {
    return renderNullableCSharpType(nonNullish[0], context);
  }
  return "object?";
};

const renderFunctionType = (
  type: LoweringTypeRefPlan,
  context?: RenderContext
): string => {
  if (type.kind !== "function") return renderCSharpType(type, context);
  const parameters = type.parameters.map((parameter) =>
    renderCSharpType(parameter.type, context)
  );
  const returnType = renderCSharpType(type.returnType, context);
  return returnType === "void"
    ? parameters.length === 0
      ? "global::System.Action"
      : `global::System.Action<${parameters.join(", ")}>`
    : `global::System.Func<${[...parameters, returnType].join(", ")}>`;
};

export const renderCSharpType = (
  type: LoweringTypeRefPlan | undefined,
  context?: RenderContext
): string => {
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
        : `${name}<${type.typeArguments.map((argument) => renderCSharpType(argument, context)).join(", ")}>`;
    }
    case "array":
      return type.readonly
        ? `global::System.Collections.Generic.IReadOnlyList<${renderCSharpType(type.elementType, context)}>`
        : `${renderCSharpType(type.elementType, context)}[]`;
    case "tuple":
      return `(${type.elements.map((element) => renderCSharpType(element, context)).join(", ")})`;
    case "union":
      return renderUnionType(type, context);
    case "intersection":
      return "object?";
    case "function":
      return renderFunctionType(type, context);
    case "object":
      return context?.getStructuralTypeName(type) ?? "object?";
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
  type: LoweringTypeRefPlan | undefined,
  context?: RenderContext
): string => {
  if (isOpaqueNullableType(type) || isVoidLikeType(type)) return "object?";
  if (type?.kind === "union") return renderUnionType(type, context);
  return `${renderCSharpType(type, context)}?`;
};

export const renderFunctionReturnType = (
  returnType: LoweringTypeRefPlan | undefined,
  isAsync: boolean,
  context?: RenderContext
): string => {
  const rendered = renderCSharpType(returnType, context);
  if (isTaskType(returnType)) return rendered;
  if (!isAsync) return rendered;
  return isVoidLikeType(returnType)
    ? "global::System.Threading.Tasks.Task"
    : `global::System.Threading.Tasks.Task<${rendered}>`;
};

export const renderTypeMember = (
  member: LoweringTypeMemberPlan,
  context: RenderContext
): string => {
  switch (member.kind) {
    case "property":
      return `${renderCSharpType(member.type, context)} ${sanitizeIdentifier(member.name)} { get; set; }`;
    case "method":
      return `${renderCSharpType(member.returnType, context)} ${sanitizeIdentifier(member.name)}(${member.parameters
        .map(
          (parameter) =>
            `${renderCSharpType(parameter.type, context)} ${sanitizeIdentifier(parameter.name)}`
        )
        .join(", ")});`;
  }
};
