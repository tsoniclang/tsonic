import type {
  LoweringSourceRuntimeNamePlan,
  LoweringTypeMemberPlan,
  LoweringTypeRefPlan,
} from "@tsonic/frontend";
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
  ["Error", "global::js.Error"],
  ["RegExp", "global::js.RegExp"],
  ["Map", "global::js.Map"],
  ["ReadonlyMap", "global::js.Map"],
  ["Uint8Array", "global::js.Uint8Array"],
  ["Uint8ClampedArray", "global::js.Uint8ClampedArray"],
  ["Int8Array", "global::js.Int8Array"],
  ["Uint16Array", "global::js.Uint16Array"],
  ["Int16Array", "global::js.Int16Array"],
  ["Uint32Array", "global::js.Uint32Array"],
  ["Int32Array", "global::js.Int32Array"],
  ["Float32Array", "global::js.Float32Array"],
  ["Float64Array", "global::js.Float64Array"],
  ["DataView", "global::js.DataView"],
  ["JsValue", "object?"],
]);

export const sourceRuntimeNameKey = (
  sourceRuntimeName: LoweringSourceRuntimeNamePlan | undefined
): string | undefined =>
  sourceRuntimeName
    ? [sourceRuntimeName.namespace, sourceRuntimeName.container, sourceRuntimeName.name]
        .filter((part): part is string => part !== undefined && part.length > 0)
        .join(".")
    : undefined;

const sourceRuntimeNameNamespaceSegments = (
  sourceRuntimeName: LoweringSourceRuntimeNamePlan | undefined
): readonly string[] =>
  sourceRuntimeName?.namespace?.split(".").filter(Boolean) ?? [];

export const isPrivateJsRuntimeName = (
  sourceRuntimeName: LoweringSourceRuntimeNamePlan | undefined
): boolean => {
  const [root, next] = sourceRuntimeNameNamespaceSegments(sourceRuntimeName);
  return root === "js" && next === "_";
};

const renderRuntimeNameSegments = (
  sourceRuntimeName: LoweringSourceRuntimeNamePlan,
  finalSegment: (name: string | undefined) => string
): string =>
  [
    ...sourceRuntimeNameNamespaceSegments(sourceRuntimeName).map(sanitizeIdentifier),
    ...(sourceRuntimeName.container
      ? [sanitizeTypeName(sourceRuntimeName.container)]
      : []),
    finalSegment(sourceRuntimeName.name),
  ].join(".");

export const renderCSharpRuntimeTypeName = (
  sourceRuntimeName: LoweringSourceRuntimeNamePlan | undefined
): string | undefined =>
  sourceRuntimeName
    ? `global::${renderRuntimeNameSegments(sourceRuntimeName, (name) =>
        sanitizeTypeName(name?.replace(/\$/g, "_").replace(/\./g, "_"))
      )}`
    : undefined;

export const renderCSharpRuntimeExpressionName = (
  sourceRuntimeName: LoweringSourceRuntimeNamePlan | undefined
): string | undefined =>
  sourceRuntimeName
    ? `global::${renderRuntimeNameSegments(sourceRuntimeName, sanitizeIdentifier)}`
    : undefined;

const renderNamedType = (
  name: string,
  sourceRuntimeName?: LoweringSourceRuntimeNamePlan
): string =>
  (isPrivateJsRuntimeName(sourceRuntimeName) ? knownNamedTypes.get(name) : undefined) ??
  renderCSharpRuntimeTypeName(sourceRuntimeName) ??
  knownNamedTypes.get(name) ??
  sanitizeTypeName(name.replace(/\$/g, "_").replace(/\./g, "_"));

const nonStructuralNamedTypes = new Set([
  "Array",
  "Date",
  "Error",
  "Generator",
  "Iterable",
  "IterableIterator",
  "Iterator",
  "Map",
  "ReadonlyArray",
  "ReadonlyMap",
  "RegExp",
  "Set",
  "Uint8Array",
  "Uint8ClampedArray",
  "Int8Array",
  "Uint16Array",
  "Int16Array",
  "Uint32Array",
  "Int32Array",
  "Float32Array",
  "Float64Array",
  "DataView",
  "WeakMap",
  "WeakSet",
]);

const stableHash = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const typeMemberKey = (
  member: LoweringTypeMemberPlan,
  seen: ReadonlySet<LoweringTypeRefPlan>
): string => {
  switch (member.kind) {
    case "property":
      return `property:${member.optional ? "?" : ""}${member.name}:${typePlanKeyWithSeen(member.type, seen)}`;
    case "method":
      return `method:${member.optional ? "?" : ""}${member.name}<${member.typeParameters.join(",")}>(${member.parameters
        .map((parameter) => `${parameter.rest ? "..." : ""}${parameter.name}:${typePlanKeyWithSeen(parameter.type, seen)}`)
        .join(",")}):${typePlanKeyWithSeen(member.returnType, seen)}`;
    case "index-signature":
      return `index:${typePlanKeyWithSeen(member.keyType, seen)}:${typePlanKeyWithSeen(member.valueType, seen)}`;
  }
};

const typePlanKeyWithSeen = (
  type: LoweringTypeRefPlan | undefined,
  seen: ReadonlySet<LoweringTypeRefPlan>
): string => {
  if (!type) return "missing";
  if (seen.has(type)) return "recursive";
  const nextSeen = new Set(seen);
  nextSeen.add(type);
  switch (type.kind) {
    case "intrinsic":
      return `intrinsic:${type.name}`;
    case "source-primitive":
      return `source-primitive:${type.fact.kind}:${type.fact.sourceName}`;
    case "named":
      return `named:${type.runtimeVisibility ?? "public"}:${sourceRuntimeNameKey(type.sourceRuntimeName) ?? type.name}<${type.typeArguments.map((argument) => typePlanKeyWithSeen(argument, nextSeen)).join(",")}>`;
    case "record":
      return `record:${typePlanKeyWithSeen(type.keyType, nextSeen)}:${typePlanKeyWithSeen(type.valueType, nextSeen)}`;
    case "array":
      return `array:${type.storage ?? (type.readonly ? "readonly" : "mutable")}:${typePlanKeyWithSeen(type.elementType, nextSeen)}`;
    case "tuple":
      return `tuple:${type.readonly ? "readonly" : "mutable"}:${type.elements.map((element) => typePlanKeyWithSeen(element, nextSeen)).join(",")}`;
    case "union":
      return `union:${type.types.map((member) => typePlanKeyWithSeen(member, nextSeen)).join("|")}`;
    case "intersection":
      return `intersection:${type.types.map((member) => typePlanKeyWithSeen(member, nextSeen)).join("&")}`;
    case "function":
      return `function:<${type.typeParameters.join(",")}>(${type.parameters
        .map((parameter) => `${parameter.rest ? "..." : ""}${parameter.optional ? "?" : ""}${typePlanKeyWithSeen(parameter.type, nextSeen)}`)
        .join(",")}):${typePlanKeyWithSeen(type.returnType, nextSeen)}`;
    case "object":
      return `object:{${[...type.members.map((member) => typeMemberKey(member, nextSeen))].sort().join(";")}}`;
    case "predicate":
      return `predicate:${typePlanKeyWithSeen(type.assertedType, nextSeen)}`;
    case "literal":
      return `literal:${type.literalKind}:${type.valueText}`;
    case "unsupported":
      return `unsupported:${type.sourceKindName}`;
  }
};

export function typePlanKey(type: LoweringTypeRefPlan | undefined): string {
  return typePlanKeyWithSeen(type, new Set<LoweringTypeRefPlan>());
}

export const structuralTypeName = (type: LoweringTypeRefPlan): string =>
  `__TsonicShape_${stableHash(typePlanKey(type))}`;

export const sameRuntimeTypePlan = (
  left: LoweringTypeRefPlan | undefined,
  right: LoweringTypeRefPlan | undefined
): boolean => {
  if (!left || !right) return left === right;
  const leftNamedIdentity =
    left.kind === "named" ? typePlanKey({ ...left, aliasTarget: undefined }) : undefined;
  const rightNamedIdentity =
    right.kind === "named" ? typePlanKey({ ...right, aliasTarget: undefined }) : undefined;
  if (leftNamedIdentity && rightNamedIdentity) {
    return leftNamedIdentity === rightNamedIdentity;
  }
  return typePlanKey(left) === typePlanKey(right);
};

export const shouldExpandNamedAliasTarget = (
  type: LoweringTypeRefPlan
): boolean =>
  type.kind === "named" &&
  type.sourceRuntimeName === undefined &&
  type.aliasTarget?.kind !== "union" &&
  !nonStructuralNamedTypes.has(type.name);

export const isNullishType = (type: LoweringTypeRefPlan): boolean =>
  (type.kind === "intrinsic" &&
    (type.name === "undefined" || type.name === "null")) ||
  (type.kind === "literal" &&
    (type.literalKind === "undefined" || type.literalKind === "null"));

export const nonNullishUnionTypes = (
  type: LoweringTypeRefPlan
): readonly LoweringTypeRefPlan[] =>
  type.kind === "union" ? type.types.filter((member) => !isNullishType(member)) : [type];

export const namedUnionAliasTarget = (
  type: LoweringTypeRefPlan | undefined
): Extract<LoweringTypeRefPlan, { readonly kind: "union" }> | undefined =>
  type?.kind === "named" && type.aliasTarget?.kind === "union"
    ? type.aliasTarget
    : undefined;

export const runtimeUnionTarget = (
  type: LoweringTypeRefPlan | undefined
): Extract<LoweringTypeRefPlan, { readonly kind: "union" }> | undefined =>
  type?.kind === "union" ? type : namedUnionAliasTarget(type);

export const runtimeUnionCarrierArms = (
  type: LoweringTypeRefPlan | undefined,
  _context?: RenderContext
): readonly LoweringTypeRefPlan[] => {
  const target = runtimeUnionTarget(type);
  if (!target) return [];
  const arms: LoweringTypeRefPlan[] = [];
  const runtimeTypes = new Set<string>();
  for (const arm of target.types) {
    if (isNullishType(arm)) continue;
    if (isOpaqueRuntimeTypePlan(arm) || isVoidLikeTypePlan(arm)) continue;
    const key = runtimeTypeIdentityKey(arm);
    if (runtimeTypes.has(key)) continue;
    runtimeTypes.add(key);
    arms.push(arm);
  }
  return arms;
};

const armNeedsRuntimeIdentity = (arm: LoweringTypeRefPlan): boolean => {
  switch (arm.kind) {
    case "function":
    case "object":
    case "record":
      return true;
    case "named":
      return (
        arm.aliasTarget?.kind === "function" ||
        arm.aliasTarget?.kind === "object" ||
        arm.aliasTarget?.kind === "union" ||
        arm.declarationKind === "class" ||
        arm.declarationKind === "interface" ||
        arm.declarationKind === "type-alias"
      );
    case "array":
      return armNeedsRuntimeIdentity(arm.elementType);
    case "tuple":
      return arm.elements.some(armNeedsRuntimeIdentity);
    case "union":
    case "intersection":
      return arm.types.some(armNeedsRuntimeIdentity);
    case "intrinsic":
    case "source-primitive":
    case "literal":
    case "predicate":
    case "unsupported":
      return false;
  }
};

export const shouldEmitAnonymousRuntimeUnionCarrier = (
  type: LoweringTypeRefPlan | undefined,
  context?: RenderContext
): boolean =>
  type?.kind === "union" &&
  runtimeUnionCarrierArms(type, context).length > 1 &&
  runtimeUnionCarrierArms(type, context).some(armNeedsRuntimeIdentity);

export const isOpaqueRuntimeTypePlan = (
  type: LoweringTypeRefPlan | undefined
): boolean =>
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
  type.kind === "unsupported" ||
  type.kind === "intersection" ||
  (type.kind === "object" && !shouldEmitStructuralObjectType(type)) ||
  (type.kind === "named" &&
    (type.name === "JsValue" || type.runtimeVisibility === "opaque"));

const isOpaqueNullableType = isOpaqueRuntimeTypePlan;

export const isVoidLikeTypePlan = (
  type: LoweringTypeRefPlan | undefined
): boolean =>
  type?.kind === "intrinsic" &&
  (type.name === "void" || type.name === "never");

const isOutOfScopeTypeParameterType = (
  type: LoweringTypeRefPlan | undefined
): boolean =>
  type?.kind === "named" && type.declarationKind === "type-parameter";

const containsUnemittableStructuralMemberType = (
  type: LoweringTypeRefPlan | undefined,
  seen: ReadonlySet<LoweringTypeRefPlan> = new Set()
): boolean => {
  if (!type) return false;
  if (seen.has(type)) return false;
  const nextSeen = new Set(seen);
  nextSeen.add(type);
  if (isVoidLikeTypePlan(type) || isOutOfScopeTypeParameterType(type)) {
    return true;
  }
  switch (type.kind) {
    case "named":
      return (
        type.typeArguments.some((argument) =>
          containsUnemittableStructuralMemberType(argument, nextSeen)
        ) ||
        (type.sourceRuntimeName === undefined &&
          containsUnemittableStructuralMemberType(type.aliasTarget, nextSeen))
      );
    case "record":
      return (
        containsUnemittableStructuralMemberType(type.keyType, nextSeen) ||
        containsUnemittableStructuralMemberType(type.valueType, nextSeen)
      );
    case "array":
      return containsUnemittableStructuralMemberType(type.elementType, nextSeen);
    case "tuple":
      return type.elements.some((element) =>
        containsUnemittableStructuralMemberType(element, nextSeen)
      );
    case "union":
    case "intersection":
      return type.types.some((member) =>
        containsUnemittableStructuralMemberType(member, nextSeen)
      );
    case "function":
      return (
        type.parameters.some((parameter) =>
          containsUnemittableStructuralMemberType(parameter.type, nextSeen)
        ) || containsUnemittableStructuralMemberType(type.returnType, nextSeen)
      );
    case "object":
      return !shouldEmitStructuralObjectType(type);
    case "predicate":
      return containsUnemittableStructuralMemberType(
        type.assertedType,
        nextSeen
      );
    case "intrinsic":
    case "source-primitive":
    case "literal":
    case "unsupported":
      return false;
  }
};

export const shouldEmitStructuralObjectType = (
  type: LoweringTypeRefPlan
): boolean => {
  if (type.kind !== "object") return false;
  if (type.members.length === 0) return false;
  return type.members.every((member) => {
    switch (member.kind) {
      case "property":
        return !containsUnemittableStructuralMemberType(member.type);
      case "method":
        return (
          !containsUnemittableStructuralMemberType(member.returnType) &&
          member.parameters.every(
            (parameter) =>
              !containsUnemittableStructuralMemberType(parameter.type)
          )
        );
      case "index-signature":
        return (
          !containsUnemittableStructuralMemberType(member.keyType) &&
          !containsUnemittableStructuralMemberType(member.valueType)
        );
    }
  });
};

const isTaskType = (type: LoweringTypeRefPlan | undefined): boolean =>
  type?.kind === "named" &&
  (type.name === "Task" ||
    sourceRuntimeNameKey(type.sourceRuntimeName) === "System.Threading.Tasks.Task");

const isPromiseType = (type: LoweringTypeRefPlan | undefined): boolean =>
  type?.kind === "named" && type.name === "Promise";

export const isTaskLikeTypePlan = (
  type: LoweringTypeRefPlan | undefined
): boolean =>
  isTaskType(type) || isPromiseType(type);

export const isBroadIntrinsicTypePlan = (
  type: LoweringTypeRefPlan | undefined
): boolean =>
  type?.kind === "intrinsic" &&
  (type.name === "any" || type.name === "unknown" || type.name === "object");

export const isStringLikeTypePlan = (
  type: LoweringTypeRefPlan | undefined
): boolean =>
  type?.kind === "intrinsic"
    ? type.name === "string"
    : type?.kind === "literal"
      ? type.literalKind === "string"
      : false;

export const isBooleanLikeTypePlan = (
  type: LoweringTypeRefPlan | undefined
): boolean =>
  type?.kind === "intrinsic"
    ? type.name === "boolean"
    : type?.kind === "source-primitive"
      ? type.fact.kind === "bool"
      : type?.kind === "literal"
        ? type.literalKind === "boolean"
        : false;

export const isDoubleRuntimeTypePlan = (
  type: LoweringTypeRefPlan | undefined
): boolean =>
  type?.kind === "intrinsic"
    ? type.name === "number"
    : type?.kind === "source-primitive"
      ? type.fact.kind === "float64"
      : type?.kind === "literal"
        ? type.literalKind === "number"
        : false;

export const unwrapAliasTarget = (
  type: LoweringTypeRefPlan | undefined
): LoweringTypeRefPlan | undefined =>
  type?.kind === "named" && type.aliasTarget
    ? unwrapAliasTarget(type.aliasTarget)
    : type;

export const arrayTypeFromTypePlan = (
  type: LoweringTypeRefPlan | undefined
): Extract<LoweringTypeRefPlan, { readonly kind: "array" }> | undefined => {
  if (type?.kind === "named" && type.aliasTarget?.kind === "union") {
    return undefined;
  }
  const unwrapped = unwrapAliasTarget(type);
  if (!unwrapped) return undefined;
  if (unwrapped.kind === "array") return unwrapped;
  if (
    unwrapped.kind === "named" &&
    (unwrapped.name === "Array" || unwrapped.name === "ReadonlyArray")
  ) {
    const elementType = unwrapped.typeArguments[0];
    return elementType
      ? {
          kind: "array",
          elementType,
          readonly: unwrapped.name === "ReadonlyArray",
        }
      : undefined;
  }
  if (unwrapped.kind === "union") {
    const arrays = nonNullishUnionTypes(unwrapped)
      .map((member) => unwrapAliasTarget(member))
      .filter(
        (
          member
        ): member is Extract<LoweringTypeRefPlan, { readonly kind: "array" }> =>
          member?.kind === "array"
      );
    return arrays.length === 1 ? arrays[0] : undefined;
  }
  return undefined;
};

export const isRecursiveRuntimeArrayArm = (
  arm: LoweringTypeRefPlan | undefined,
  carrier: LoweringTypeRefPlan | undefined
): boolean => {
  const arrayType = arrayTypeFromTypePlan(arm);
  return (
    arrayType !== undefined && sameRuntimeTypePlan(arrayType.elementType, carrier)
  );
};

const runtimeTypeIdentityKey = (type: LoweringTypeRefPlan): string => {
  if (isOpaqueRuntimeTypePlan(type)) return "opaque";
  if (isVoidLikeTypePlan(type)) return "void";
  if (isStringLikeTypePlan(type)) return "primitive:string";
  if (isBooleanLikeTypePlan(type)) return "primitive:bool";
  if (isDoubleRuntimeTypePlan(type)) return "primitive:float64";
  if (type.kind === "named") {
    return typePlanKey({ ...type, aliasTarget: undefined });
  }
  if (type.kind === "array") {
    return `array:${type.storage ?? (type.readonly ? "readonly" : "mutable")}:${runtimeTypeIdentityKey(type.elementType)}`;
  }
  if (type.kind === "tuple") {
    return `tuple:${type.elements.map(runtimeTypeIdentityKey).join(",")}`;
  }
  return typePlanKey(type);
};

const promiseOrTaskAwaitedType = (
  type: LoweringTypeRefPlan | undefined
): LoweringTypeRefPlan | undefined =>
  isTaskLikeTypePlan(type) && type?.kind === "named"
    ? (type.typeArguments[0] ?? { kind: "intrinsic", name: "void" })
    : undefined;

const asyncReturnAwaitedType = (
  type: LoweringTypeRefPlan | undefined
): LoweringTypeRefPlan | undefined => {
  const direct = promiseOrTaskAwaitedType(type);
  if (direct) return direct;
  if (type?.kind !== "union") return undefined;
  const nonNullish = type.types.filter((member) => !isNullishType(member));
  const asyncMembers = nonNullish.filter(isTaskLikeTypePlan);
  if (asyncMembers.length !== 1) return undefined;
  const awaited =
    promiseOrTaskAwaitedType(asyncMembers[0]) ??
    ({ kind: "intrinsic", name: "object" } as const);
  const synchronousMembers = nonNullish.filter(
    (member) => !isTaskLikeTypePlan(member) && !isVoidLikeTypePlan(member)
  );
  if (synchronousMembers.length === 0) return awaited;
  if (synchronousMembers.every(isBroadIntrinsicTypePlan)) {
    return { kind: "intrinsic", name: "object" };
  }
  if (
    synchronousMembers.length === 1 &&
    typePlanKey(synchronousMembers[0]) === typePlanKey(awaited)
  ) {
    return awaited;
  }
  return { kind: "intrinsic", name: "object" };
};

const renderTaskReturnType = (
  awaitedType: LoweringTypeRefPlan | undefined,
  context?: RenderContext
): string =>
  isVoidLikeTypePlan(awaitedType)
    ? "global::System.Threading.Tasks.Task"
    : `global::System.Threading.Tasks.Task<${renderCSharpType(awaitedType, context)}>`;

const renderUnionType = (
  type: LoweringTypeRefPlan,
  context?: RenderContext
): string => {
  if (type.kind !== "union") return renderCSharpType(type, context);
  const nonNullish = type.types.filter((member) => !isNullishType(member));
  const voidLike = nonNullish.filter(isVoidLikeTypePlan);
  const taskLike = nonNullish.filter(isTaskLikeTypePlan);
  if (voidLike.length > 0 && taskLike.length === 1) {
    return renderCSharpType(taskLike[0], context);
  }
  if (nonNullish.length === 1) {
    return renderNullableCSharpType(nonNullish[0], context);
  }
  if (context && shouldEmitAnonymousRuntimeUnionCarrier(type, context)) {
    return context.getStructuralTypeName(type);
  }
  return "object?";
};

const renderFunctionType = (
  type: LoweringTypeRefPlan,
  context?: RenderContext
): string => {
  if (type.kind !== "function") return renderCSharpType(type, context);
  const parameters = type.parameters.map((parameter) =>
    parameter.optional
      ? renderNullableCSharpType(parameter.type, context)
      : renderCSharpType(parameter.type, context)
  );
  const returnType = renderFunctionReturnType(type.returnType, false, context);
  return isVoidLikeTypePlan(type.returnType)
    ? parameters.length === 0
      ? "global::System.Action"
      : `global::System.Action<${parameters.join(", ")}>`
    : `global::System.Func<${[...parameters, returnType].join(", ")}>`;
};

const renderSpecialNamedType = (
  type: Extract<LoweringTypeRefPlan, { readonly kind: "named" }>,
  context?: RenderContext
): string | undefined => {
  switch (type.name) {
    case "Array":
      return `global::System.Collections.Generic.List<${renderCSharpType(type.typeArguments[0], context)}>`;
    case "ReadonlyArray":
      return `global::System.Collections.Generic.IReadOnlyList<${renderCSharpType(type.typeArguments[0], context)}>`;
    case "Iterable":
    case "IterableIterator":
    case "Iterator":
    case "Generator":
      return `global::System.Collections.Generic.IEnumerable<${renderCSharpType(type.typeArguments[0], context)}>`;
    case "Promise": {
      const awaited = type.typeArguments[0];
      return isVoidLikeTypePlan(awaited)
        ? "global::System.Threading.Tasks.Task"
        : `global::System.Threading.Tasks.Task<${renderCSharpType(awaited, context)}>`;
    }
    default:
      return undefined;
  }
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
      const special = renderSpecialNamedType(type, context);
      if (special) return special;
      if (knownNamedTypes.has(type.name)) {
        const name = renderNamedType(type.name, type.sourceRuntimeName);
        return type.typeArguments.length === 0
          ? name
          : `${name}<${type.typeArguments.map((argument) => renderCSharpType(argument, context)).join(", ")}>`;
      }
      if (type.declarationKind === "type-alias" && !type.aliasTarget) {
        return "object?";
      }
      if (
        type.runtimeVisibility === "opaque"
      ) {
        return "object?";
      }
      if (type.sourceRuntimeName) {
        const name = renderNamedType(type.name, type.sourceRuntimeName);
        return type.typeArguments.length === 0
          ? name
          : `${name}<${type.typeArguments.map((argument) => renderCSharpType(argument, context)).join(", ")}>`;
      }
      if (
        type.aliasTarget &&
        type.aliasTarget.kind !== "object" &&
        type.aliasTarget.kind !== "function"
      ) {
        if (type.aliasTarget.kind === "union") {
          const name = renderNamedType(type.name, type.sourceRuntimeName);
          return type.typeArguments.length === 0
            ? name
            : `${name}<${type.typeArguments.map((argument) => renderCSharpType(argument, context)).join(", ")}>`;
        }
        return type.aliasTarget.kind === "intersection"
          ? "object?"
          : renderCSharpType(type.aliasTarget, context);
      }
      const name = renderNamedType(type.name, type.sourceRuntimeName);
      return type.typeArguments.length === 0
        ? name
        : `${name}<${type.typeArguments.map((argument) => renderCSharpType(argument, context)).join(", ")}>`;
    }
    case "record":
      return `global::System.Collections.Generic.Dictionary<${renderCSharpType(type.keyType, context)}, ${renderCSharpType(type.valueType, context)}>`;
    case "array":
      if (type.storage === "native-array") {
        return `${renderCSharpType(type.elementType, context)}[]`;
      }
      return type.readonly
        ? `global::System.Collections.Generic.IReadOnlyList<${renderCSharpType(type.elementType, context)}>`
        : `global::System.Collections.Generic.List<${renderCSharpType(type.elementType, context)}>`;
    case "tuple":
      return `(${type.elements.map((element) => renderCSharpType(element, context)).join(", ")})`;
    case "union":
      return renderUnionType(type, context);
    case "intersection":
      return "object?";
    case "function":
      return renderFunctionType(type, context);
    case "object":
      return shouldEmitStructuralObjectType(type)
        ? (context?.getStructuralTypeName(type) ?? "object?")
        : "object?";
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
  if (isOpaqueNullableType(type) || isVoidLikeTypePlan(type)) return "object?";
  if (type?.kind === "union") return renderUnionType(type, context);
  const rendered = renderCSharpType(type, context);
  return `${rendered}?`;
};

export const renderFunctionReturnType = (
  returnType: LoweringTypeRefPlan | undefined,
  isAsync: boolean,
  context?: RenderContext
): string => {
  const asyncAwaitedType = asyncReturnAwaitedType(returnType);
  if (asyncAwaitedType) {
    return renderTaskReturnType(asyncAwaitedType, context);
  }
  const rendered = renderCSharpType(returnType, context);
  if (isTaskLikeTypePlan(returnType)) {
    return rendered;
  }
  if (!isAsync) return rendered;
  return isVoidLikeTypePlan(returnType)
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
      return `${renderCSharpType(member.returnType, context)} ${sanitizeIdentifier(member.name)}${member.typeParameters.length > 0 ? `<${member.typeParameters.map((name) => sanitizeTypeName(name)).join(", ")}>` : ""}(${member.parameters
        .map(
          (parameter) =>
            `${renderCSharpType(parameter.type, context)} ${sanitizeIdentifier(parameter.name)}`
        )
        .join(", ")});`;
    case "index-signature":
      return `${renderCSharpType(member.valueType, context)} this[${renderCSharpType(member.keyType, context)} key] { get; set; }`;
  }
};
