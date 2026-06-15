import type {
  LoweringExternalBindingReferencePlan,
  LoweringSourceQualifiedNamePlan,
  LoweringTypeMemberPlan,
  LoweringTypeRefPlan,
} from "@tsonic/frontend";
import type { RenderContext } from "../types.js";
import { requiredIdentifier, sanitizeIdentifier, sanitizeTypeName } from "./names.js";

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

const objectTypePlan: LoweringTypeRefPlan = { kind: "intrinsic", name: "object" };
const voidTypePlan: LoweringTypeRefPlan = { kind: "intrinsic", name: "void" };

const privateJsRuntimeTypes: ReadonlyMap<string, string> = new Map([
  ["js._.Match$instance", "global::System.Text.RegularExpressions.Match"],
  ["js._.Match", "global::System.Text.RegularExpressions.Match"],
  ["js._.Group", "global::System.Text.RegularExpressions.Group"],
  ["js._.Regex", "global::System.Text.RegularExpressions.Regex"],
  ["js._.RegexOptions", "global::System.Text.RegularExpressions.RegexOptions"],
  ["js._.Error", "global::js.Error"],
  ["js._.RegExp", "global::js.RegExp"],
  ["js._.Map", "global::js.Map"],
  ["js._.ReadonlyMap", "global::js.Map"],
  ["js._.Uint8Array", "global::js.Uint8Array"],
  ["js._.Uint8ClampedArray", "global::js.Uint8ClampedArray"],
  ["js._.Int8Array", "global::js.Int8Array"],
  ["js._.Uint16Array", "global::js.Uint16Array"],
  ["js._.Int16Array", "global::js.Int16Array"],
  ["js._.Uint32Array", "global::js.Uint32Array"],
  ["js._.Int32Array", "global::js.Int32Array"],
  ["js._.Float32Array", "global::js.Float32Array"],
  ["js._.Float64Array", "global::js.Float64Array"],
  ["js._.DataView", "global::js.DataView"],
]);

export const sourceQualifiedNameKey = (
  sourceQualifiedName: LoweringSourceQualifiedNamePlan | undefined
): string | undefined =>
  sourceQualifiedName
    ? [sourceQualifiedName.namespace, sourceQualifiedName.container, sourceQualifiedName.name]
        .filter((part): part is string => part !== undefined && part.length > 0)
        .join(".")
    : undefined;

const sourceQualifiedNameNamespaceSegments = (
  sourceQualifiedName: LoweringSourceQualifiedNamePlan | undefined
): readonly string[] =>
  sourceQualifiedName?.namespace?.split(".").filter(Boolean) ?? [];

export const isPrivateJsRuntimeName = (
  sourceQualifiedName: LoweringSourceQualifiedNamePlan | undefined
): boolean => {
  const [root, next] = sourceQualifiedNameNamespaceSegments(sourceQualifiedName);
  return root === "js" && next === "_";
};

const renderRuntimeNameSegments = (
  sourceQualifiedName: LoweringSourceQualifiedNamePlan,
  finalSegment: (name: string | undefined) => string
): string =>
  [
    ...sourceQualifiedNameNamespaceSegments(sourceQualifiedName).map(sanitizeIdentifier),
    ...(sourceQualifiedName.container
      ? [sanitizeTypeName(sourceQualifiedName.container)]
      : []),
    finalSegment(sourceQualifiedName.name),
  ].join(".");

export const renderCSharpRuntimeTypeName = (
  sourceQualifiedName: LoweringSourceQualifiedNamePlan | undefined
): string | undefined =>
  sourceQualifiedName
    ? `global::${renderRuntimeNameSegments(sourceQualifiedName, (name) =>
        sanitizeTypeName(name?.replace(/\$/g, "_").replace(/\./g, "_"))
      )}`
    : undefined;

export const renderCSharpRuntimeExpressionName = (
  sourceQualifiedName: LoweringSourceQualifiedNamePlan | undefined
): string | undefined =>
  sourceQualifiedName
    ? `global::${renderRuntimeNameSegments(sourceQualifiedName, sanitizeIdentifier)}`
    : undefined;

export const externalBindingKey = (
  externalBinding: LoweringExternalBindingReferencePlan | undefined
): string | undefined =>
  externalBinding
    ? `${externalBinding.bindingFile}#${externalBinding.sourceName}`
    : undefined;

const renderExternalTargetTypeName = (
  externalBinding: LoweringExternalBindingReferencePlan | undefined,
  context: RenderContext
): string | undefined => {
  if (!externalBinding) return undefined;
  const targetName = context.externalBindingTargetName(externalBinding);
  return targetName
    ? `global::${targetName
        .replace(/^global::/u, "")
        .replace(/\+/gu, ".")
        .replace(/\$/gu, "_")
        .replace(/`\d+$/u, "")
        .split(".")
        .filter(Boolean)
        .map(sanitizeTypeName)
        .join(".")}`
    : undefined;
};

export const renderExternalTargetExpressionName = (
  externalBinding: LoweringExternalBindingReferencePlan | undefined,
  context: RenderContext
): string | undefined => {
  if (!externalBinding) return undefined;
  const targetName = context.externalBindingTargetName(externalBinding);
  return targetName
    ? `global::${targetName
        .replace(/^global::/u, "")
        .replace(/\+/gu, ".")
        .replace(/\$/gu, "_")
        .replace(/`\d+$/u, "")
        .split(".")
        .filter(Boolean)
        .map(sanitizeIdentifier)
        .join(".")}`
    : undefined;
};

const renderNamedType = (
  type: Extract<LoweringTypeRefPlan, { readonly kind: "named" }>
): string =>
  privateJsRuntimeTypes.get(sourceQualifiedNameKey(type.sourceQualifiedName) ?? "") ??
  renderCSharpRuntimeTypeName(type.sourceQualifiedName) ??
  sanitizeTypeName(type.name.replace(/\$/g, "_").replace(/\./g, "_"));

const renderNamedRuntimeType = (
  type: Extract<LoweringTypeRefPlan, { readonly kind: "named" }>,
  context: RenderContext
): string | undefined => {
  const special = renderSpecialNamedType(type, context);
  if (special) return special;
  if (type.runtimeVisibility === "opaque") {
    return undefined;
  }
  if (type.externalBinding) {
    const externalName = renderExternalTargetTypeName(type.externalBinding, context);
    if (!externalName) {
      context.reportUnsupported(
        "external binding target type",
        "TypeReference",
        type.sourceText ?? type.name
      );
      return "object?";
    }
    return type.typeArguments.length === 0
      ? externalName
      : `${externalName}<${type.typeArguments.map((argument) => renderCSharpType(argument, context)).join(", ")}>`;
  }
  if (!type.sourceQualifiedName) return undefined;
  const name = renderNamedType(type);
  return type.typeArguments.length === 0
    ? name
    : `${name}<${type.typeArguments.map((argument) => renderCSharpType(argument, context)).join(", ")}>`;
};

const renderIntersectionRuntimeType = (
  type: Extract<LoweringTypeRefPlan, { readonly kind: "intersection" }>,
  context: RenderContext
): string | undefined => {
  const renderedTypes = new Set<string>();
  for (const member of type.types) {
    if (member.kind === "named") {
      const rendered = renderNamedRuntimeType(member, context);
      if (rendered) renderedTypes.add(rendered);
      continue;
    }
    if (member.kind === "intersection") {
      const rendered = renderIntersectionRuntimeType(member, context);
      if (rendered) renderedTypes.add(rendered);
    }
  }
  return renderedTypes.size === 1 ? [...renderedTypes][0] : undefined;
};

const requiredTypeArgument = (
  type: Extract<LoweringTypeRefPlan, { readonly kind: "named" }>,
  index: number,
  context: RenderContext,
  feature: string
): LoweringTypeRefPlan => {
  const argument = type.typeArguments[index];
  if (argument) return argument;
  context.reportUnsupported(feature, "TypeReference", type.sourceText ?? type.name);
  return objectTypePlan;
};

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
      return `named:${type.runtimeVisibility ?? "public"}:${sourceQualifiedNameKey(type.sourceQualifiedName) ?? externalBindingKey(type.externalBinding) ?? type.name}<${type.typeArguments.map((argument) => typePlanKeyWithSeen(argument, nextSeen)).join(",")}>`;
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

const collectTypeParameterNames = (
  type: LoweringTypeRefPlan | undefined,
  names: Set<string>,
  seen: ReadonlySet<LoweringTypeRefPlan> = new Set()
): void => {
  if (!type || seen.has(type)) return;
  const nextSeen = new Set(seen);
  nextSeen.add(type);
  switch (type.kind) {
    case "named":
      if (type.declarationKind === "type-parameter") {
        names.add(type.name);
      }
      for (const argument of type.typeArguments) {
        collectTypeParameterNames(argument, names, nextSeen);
      }
      if (type.sourceQualifiedName === undefined) {
        collectTypeParameterNames(type.aliasTarget, names, nextSeen);
      }
      break;
    case "record":
      collectTypeParameterNames(type.keyType, names, nextSeen);
      collectTypeParameterNames(type.valueType, names, nextSeen);
      break;
    case "array":
      collectTypeParameterNames(type.elementType, names, nextSeen);
      break;
    case "tuple":
      for (const element of type.elements) {
        collectTypeParameterNames(element, names, nextSeen);
      }
      break;
    case "union":
    case "intersection":
      for (const member of type.types) {
        collectTypeParameterNames(member, names, nextSeen);
      }
      break;
    case "function":
      for (const parameter of type.parameters) {
        collectTypeParameterNames(parameter.type, names, nextSeen);
      }
      collectTypeParameterNames(type.returnType, names, nextSeen);
      break;
    case "object":
      for (const member of type.members) {
        switch (member.kind) {
          case "property":
            collectTypeParameterNames(member.type, names, nextSeen);
            break;
          case "method":
            for (const parameter of member.parameters) {
              collectTypeParameterNames(parameter.type, names, nextSeen);
            }
            collectTypeParameterNames(member.returnType, names, nextSeen);
            break;
          case "index-signature":
            collectTypeParameterNames(member.keyType, names, nextSeen);
            collectTypeParameterNames(member.valueType, names, nextSeen);
            break;
        }
      }
      break;
    case "predicate":
      collectTypeParameterNames(type.assertedType, names, nextSeen);
      break;
    case "intrinsic":
    case "source-primitive":
    case "literal":
    case "unsupported":
      break;
  }
};

export const structuralTypeParameterNames = (
  type: LoweringTypeRefPlan
): readonly string[] => {
  const names = new Set<string>();
  collectTypeParameterNames(type, names);
  return [...names];
};

export const renderTypeParameters = (
  typeParameters: readonly string[] | undefined
): string =>
  typeParameters && typeParameters.length > 0
    ? `<${typeParameters.map((name) => sanitizeTypeName(name)).join(", ")}>`
    : "";

export const renderStructuralTypeReference = (
  type: LoweringTypeRefPlan,
  context: RenderContext
): string =>
  `${context.getStructuralTypeName(type)}${renderTypeParameters(
    structuralTypeParameterNames(type)
  )}`;

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
  type.sourceQualifiedName === undefined &&
  type.externalBinding === undefined &&
  type.aliasTarget?.kind !== "union";

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
  const addArm = (arm: LoweringTypeRefPlan): void => {
    if (isNullishType(arm)) return;
    if (arm.kind === "union") {
      for (const nested of arm.types) {
        addArm(nested);
      }
      return;
    }
    if (isOpaqueRuntimeTypePlan(arm) || isVoidLikeTypePlan(arm)) return;
    const key = runtimeTypeIdentityKey(arm);
    if (runtimeTypes.has(key)) return;
    runtimeTypes.add(key);
    arms.push(arm);
  };
  for (const arm of target.types) {
    addArm(arm);
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
      return true;
    case "tuple":
      return true;
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
  (type.kind === "named" && type.runtimeVisibility === "opaque") ||
  (type.kind === "union" && isOpaqueUnionTypePlan(type));

const isScalarRuntimeTypePlan = (
  type: LoweringTypeRefPlan | undefined,
  seen: ReadonlySet<LoweringTypeRefPlan> = new Set()
): boolean => {
  if (!type) return false;
  if (seen.has(type)) return false;
  const nextSeen = new Set(seen);
  nextSeen.add(type);
  if (type.kind === "named" && type.aliasTarget) {
    return isScalarRuntimeTypePlan(type.aliasTarget, nextSeen);
  }
  if (type.kind === "union") {
    return (
      type.types.length > 0 &&
      type.types.every(
        (member) =>
          isScalarRuntimeTypePlan(member, nextSeen) ||
          isOpaqueRuntimeTypePlan(member)
      )
    );
  }
  if (type.kind === "source-primitive") return true;
  if (type.kind === "intrinsic") {
    return (
      type.name === "string" ||
      type.name === "number" ||
      type.name === "boolean" ||
      type.name === "bigint" ||
      type.name === "symbol"
    );
  }
  if (type.kind === "literal") {
    return (
      type.literalKind === "string" ||
      type.literalKind === "number" ||
      type.literalKind === "boolean" ||
      type.literalKind === "bigint" ||
      type.literalKind === "null" ||
      type.literalKind === "undefined"
    );
  }
  return false;
};

const isOpaqueUnionTypePlan = (type: LoweringTypeRefPlan): boolean =>
  type.kind === "union" &&
  type.types.length > 0 &&
  type.types.every(
    (member) => isScalarRuntimeTypePlan(member) || isOpaqueRuntimeTypePlan(member)
  );

const isOpaqueNullableType = isOpaqueRuntimeTypePlan;

export const isVoidLikeTypePlan = (
  type: LoweringTypeRefPlan | undefined
): boolean =>
  type?.kind === "intrinsic" &&
  (type.name === "void" || type.name === "never");

const containsUnemittableStructuralMemberType = (
  type: LoweringTypeRefPlan | undefined,
  seen: ReadonlySet<LoweringTypeRefPlan> = new Set()
): boolean => {
  if (!type) return false;
  if (seen.has(type)) return false;
  const nextSeen = new Set(seen);
  nextSeen.add(type);
  if (isVoidLikeTypePlan(type)) {
    return true;
  }
  switch (type.kind) {
    case "named":
      return (
        type.typeArguments.some((argument) =>
          containsUnemittableStructuralMemberType(argument, nextSeen)
        ) ||
        (type.sourceQualifiedName === undefined &&
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

const isExternalTargetType = (
  type: LoweringTypeRefPlan | undefined,
  context: RenderContext | undefined,
  targetName: string
): boolean =>
  type?.kind === "named" &&
  type.externalBinding !== undefined &&
  context?.externalBindingTargetName(type.externalBinding) === targetName;

const isTaskType = (
  type: LoweringTypeRefPlan | undefined,
  context?: RenderContext
): boolean => isExternalTargetType(type, context, "System.Threading.Tasks.Task");

const isPrivateJsPromiseConstructorAliasTarget = (
  type: LoweringTypeRefPlan | undefined
): boolean =>
  type?.kind === "named" &&
  (type.name === "PromiseConstructor" || type.name === "PromiseLike") &&
  isPrivateJsRuntimeName(type.sourceQualifiedName);

const isPromiseType = (type: LoweringTypeRefPlan | undefined): boolean =>
  type?.kind === "named" &&
  (type.name === "Promise" || type.name === "PromiseLike") &&
  (isPrivateJsRuntimeName(type.sourceQualifiedName) ||
    isPrivateJsPromiseConstructorAliasTarget(type.aliasTarget));

export const isTaskLikeTypePlan = (
  type: LoweringTypeRefPlan | undefined,
  context?: RenderContext
): boolean =>
  isTaskType(type, context) || isPromiseType(type);

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
  type: LoweringTypeRefPlan | undefined,
  context?: RenderContext
): Extract<LoweringTypeRefPlan, { readonly kind: "array" }> | undefined => {
  if (type?.kind === "named" && type.aliasTarget?.kind === "union") {
    return undefined;
  }
  const unwrapped = unwrapAliasTarget(type);
  if (!unwrapped) return undefined;
  if (unwrapped.kind === "array") return unwrapped;
  if (
    unwrapped.kind === "named" &&
    isPrivateJsRuntimeName(unwrapped.sourceQualifiedName) &&
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
  const externalCollectionTarget =
    unwrapped.kind === "named" && unwrapped.externalBinding
      ? context?.externalBindingTargetName(unwrapped.externalBinding)
      : undefined;
  const externalCollectionReadonly =
    externalCollectionTarget === "System.Collections.Generic.IEnumerable`1" ||
    externalCollectionTarget === "System.Collections.Generic.IReadOnlyList`1";
  const externalCollectionMutable =
    externalCollectionTarget === "System.Collections.Generic.IList`1" ||
    externalCollectionTarget === "System.Collections.Generic.List`1";
  if (
    unwrapped.kind === "named" &&
    (externalCollectionReadonly || externalCollectionMutable)
  ) {
    const elementType = unwrapped.typeArguments[0];
    return elementType
      ? {
          kind: "array",
          elementType,
          readonly: externalCollectionReadonly,
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
  carrier: LoweringTypeRefPlan | undefined,
  context?: RenderContext
): boolean => {
  const arrayType = arrayTypeFromTypePlan(arm, context);
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
  type: LoweringTypeRefPlan | undefined,
  context: RenderContext,
  feature: string
): LoweringTypeRefPlan | undefined => {
  if (!isTaskLikeTypePlan(type, context) || type?.kind !== "named")
    return undefined;
  const awaitedType = type.typeArguments[0];
  if (awaitedType) return awaitedType;
  if (isTaskType(type, context)) return voidTypePlan;
  context.reportUnsupported(
    `${feature} awaited type`,
    "TypeReference",
    type.sourceText ?? type.name
  );
  return objectTypePlan;
};

const asyncReturnAwaitedType = (
  type: LoweringTypeRefPlan | undefined,
  context: RenderContext
): LoweringTypeRefPlan | undefined => {
  const direct = promiseOrTaskAwaitedType(type, context, "async return");
  if (direct) return direct;
  if (type?.kind !== "union") return undefined;
  const nonNullish = type.types.filter((member) => !isNullishType(member));
  const asyncMembers = nonNullish.filter((member) =>
    isTaskLikeTypePlan(member, context)
  );
  if (asyncMembers.length !== 1) return undefined;
  const awaited = promiseOrTaskAwaitedType(
    asyncMembers[0],
    context,
    "async union return"
  );
  if (!awaited) return undefined;
  const synchronousMembers = nonNullish.filter(
    (member) =>
      !isTaskLikeTypePlan(member, context) && !isVoidLikeTypePlan(member)
  );
  if (synchronousMembers.length === 0) return awaited;
  if (synchronousMembers.every(isBroadIntrinsicTypePlan)) {
    context.reportUnsupported(
      "async union return type",
      "UnionType",
      type.sourceText ?? "union"
    );
    return objectTypePlan;
  }
  if (
    synchronousMembers.length === 1 &&
    typePlanKey(synchronousMembers[0]) === typePlanKey(awaited)
  ) {
    return awaited;
  }
  context.reportUnsupported(
    "async union return type",
    "UnionType",
    type.sourceText ?? "union"
  );
  return objectTypePlan;
};

const renderTaskReturnType = (
  awaitedType: LoweringTypeRefPlan | undefined,
  context: RenderContext
): string => {
  if (!awaitedType || isVoidLikeTypePlan(awaitedType)) {
    return "global::System.Threading.Tasks.Task";
  }
  return `global::System.Threading.Tasks.Task<${renderCSharpType(awaitedType, context)}>`;
};

const flattenNonNullishUnionMembers = (
  type: LoweringTypeRefPlan
): readonly LoweringTypeRefPlan[] => {
  const result: LoweringTypeRefPlan[] = [];
  const seen = new Set<string>();
  const visit = (member: LoweringTypeRefPlan): void => {
    if (isNullishType(member)) return;
    if (member.kind === "union") {
      for (const nested of member.types) visit(nested);
      return;
    }
    const key = runtimeTypeIdentityKey(member);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(member);
  };
  visit(type);
  return result;
};

const renderUnionType = (
  type: LoweringTypeRefPlan,
  context: RenderContext
): string => {
  if (type.kind !== "union") return renderCSharpType(type, context);
  const nonNullish = flattenNonNullishUnionMembers(type);
  const voidLike = nonNullish.filter(isVoidLikeTypePlan);
  const taskLike = nonNullish.filter((member) =>
    isTaskLikeTypePlan(member, context)
  );
  if (voidLike.length > 0 && taskLike.length === 1) {
    const taskType = taskLike[0];
    if (taskType) return renderCSharpType(taskType, context);
    context.reportUnsupported("union task type", "UnionType", type.sourceText ?? "union");
    return "object?";
  }
  if (taskLike.length === 1) {
    const taskType = taskLike[0];
    const awaited = promiseOrTaskAwaitedType(
      taskType,
      context,
      "union task type"
    );
    const synchronousMembers = nonNullish.filter(
      (member) =>
        !isTaskLikeTypePlan(member, context) && !isVoidLikeTypePlan(member)
    );
    if (synchronousMembers.every(isBroadIntrinsicTypePlan)) {
      context.reportUnsupported(
        "union task type",
        "UnionType",
        type.sourceText ?? "union"
      );
      return renderTaskReturnType(objectTypePlan, context);
    }
    if (
      awaited &&
      synchronousMembers.every(
        (member) => typePlanKey(member) === typePlanKey(awaited)
      )
    ) {
      return renderTaskReturnType(awaited, context);
    }
  }
  if (nonNullish.length === 1) {
    const member = nonNullish[0];
    if (member) return renderNullableCSharpType(member, context);
    context.reportUnsupported("union member type", "UnionType", type.sourceText ?? "union");
    return "object?";
  }
  if (shouldEmitAnonymousRuntimeUnionCarrier(type, context)) {
    return renderStructuralTypeReference(type, context);
  }
  if (isOpaqueRuntimeTypePlan(type)) {
    return "object?";
  }
  context.reportUnsupported("union type", "UnionType", type.sourceText ?? "union");
  return "object?";
};

const renderFunctionType = (
  type: LoweringTypeRefPlan,
  context: RenderContext
): string => {
  if (type.kind !== "function") return renderCSharpType(type, context);
  const parameters = type.parameters.map((parameter) =>
    parameter.optional
      ? renderRequiredNullableCSharpType(
          parameter.type,
          context,
          "function type parameter",
          parameter.sourceKindName,
          parameter.sourceText
        )
      : renderRequiredCSharpType(
          parameter.type,
          context,
          "function type parameter",
          parameter.sourceKindName,
          parameter.sourceText
        )
  );
  const returnType = renderFunctionReturnType(
    type.returnType,
    false,
    context,
    "FunctionType",
    type.sourceText ?? "function"
  );
  return isVoidLikeTypePlan(type.returnType)
    ? parameters.length === 0
      ? "global::System.Action"
      : `global::System.Action<${parameters.join(", ")}>`
    : `global::System.Func<${[...parameters, returnType].join(", ")}>`;
};

const renderSpecialNamedType = (
  type: Extract<LoweringTypeRefPlan, { readonly kind: "named" }>,
  context: RenderContext
): string | undefined => {
  if (isPromiseType(type)) {
    const awaited = requiredTypeArgument(
      type,
      0,
      context,
      "Promise awaited type"
    );
    return isVoidLikeTypePlan(awaited)
      ? "global::System.Threading.Tasks.Task"
      : `global::System.Threading.Tasks.Task<${renderCSharpType(awaited, context)}>`;
  }
  const privateJsRuntimeName = isPrivateJsRuntimeName(type.sourceQualifiedName)
    ? type.name
    : undefined;
  switch (privateJsRuntimeName) {
    case "Array":
      return `global::System.Collections.Generic.List<${renderCSharpType(requiredTypeArgument(type, 0, context, "Array type argument"), context)}>`;
    case "ReadonlyArray":
      return `global::System.Collections.Generic.IReadOnlyList<${renderCSharpType(requiredTypeArgument(type, 0, context, "ReadonlyArray type argument"), context)}>`;
    case "Iterable":
    case "IterableIterator":
    case "Iterator":
    case "Generator":
      return `global::System.Collections.Generic.IEnumerable<${renderCSharpType(requiredTypeArgument(type, 0, context, `${type.name} type argument`), context)}>`;
    default:
      return undefined;
  }
};

export const renderCSharpType = (
  type: LoweringTypeRefPlan,
  context: RenderContext
): string => {
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
      {
        const primitiveType = primitiveRuntimeTypes.get(type.fact.kind);
        if (primitiveType) return primitiveType;
        context.reportUnsupported(
          "source primitive runtime type",
          "TypeReference",
          type.sourceText ?? type.fact.sourceName
        );
        return "object?";
      }
    case "named": {
      const special = renderSpecialNamedType(type, context);
      if (special) return special;
      if (type.declarationKind === "type-alias" && !type.aliasTarget) {
        context.reportUnsupported(
          "type alias target",
          "TypeReference",
          type.sourceText ?? type.name
        );
        return "object?";
      }
      if (
        type.runtimeVisibility === "opaque"
      ) {
        return "object?";
      }
      if (
        type.declarationKind === "type-alias" &&
        type.aliasTarget?.kind === "named" &&
        type.aliasTarget.aliasTarget?.kind !== "union"
      ) {
        return renderCSharpType(type.aliasTarget, context);
      }
      if (
        isPrivateJsRuntimeName(type.sourceQualifiedName) &&
        type.aliasTarget &&
        type.aliasTarget.kind !== "object" &&
        type.aliasTarget.kind !== "function"
      ) {
        return renderCSharpType(type.aliasTarget, context);
      }
      if (type.sourceQualifiedName || type.externalBinding) {
        return renderNamedRuntimeType(type, context) ?? renderNamedType(type);
      }
      if (
        type.aliasTarget &&
        type.aliasTarget.kind !== "object" &&
        type.aliasTarget.kind !== "function"
      ) {
        if (type.aliasTarget.kind === "union") {
          const name = renderNamedType(type);
          return type.typeArguments.length === 0
            ? name
            : `${name}<${type.typeArguments.map((argument) => renderCSharpType(argument, context)).join(", ")}>`;
        }
        if (type.aliasTarget.kind === "intersection") {
          const runtimeType = renderIntersectionRuntimeType(
            type.aliasTarget,
            context
          );
          if (runtimeType) return runtimeType;
          context.reportUnsupported(
            "intersection type alias target",
            "IntersectionType",
            type.aliasTarget.sourceText ?? type.sourceText ?? type.name
          );
          return "object?";
        }
        return renderCSharpType(type.aliasTarget, context);
      }
      const name = renderNamedType(type);
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
      {
        const runtimeType = renderIntersectionRuntimeType(type, context);
        if (runtimeType) return runtimeType;
        context.reportUnsupported(
          "intersection type",
          "IntersectionType",
          type.sourceText ?? "intersection"
        );
        return "object?";
      }
    case "function":
      return renderFunctionType(type, context);
    case "object":
      return shouldEmitStructuralObjectType(type)
        ? renderStructuralTypeReference(type, context)
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
      context.reportUnsupported(
        "type",
        type.sourceKindName,
        type.sourceText
      );
      return "object?";
  }
};

export const renderRequiredCSharpType = (
  type: LoweringTypeRefPlan | undefined,
  context: RenderContext,
  feature: string,
  sourceKindName: string,
  sourceText: string
): string => {
  if (type) return renderCSharpType(type, context);
  context.reportUnsupported(feature, sourceKindName, sourceText);
  return renderCSharpType(objectTypePlan, context);
};

export const renderNullableCSharpType = (
  type: LoweringTypeRefPlan,
  context: RenderContext
): string => {
  if (isOpaqueNullableType(type) || isVoidLikeTypePlan(type)) return "object?";
  if (type?.kind === "union") return renderUnionType(type, context);
  const rendered = renderCSharpType(type, context);
  return `${rendered}?`;
};

export const renderRequiredNullableCSharpType = (
  type: LoweringTypeRefPlan | undefined,
  context: RenderContext,
  feature: string,
  sourceKindName: string,
  sourceText: string
): string => {
  if (type) return renderNullableCSharpType(type, context);
  context.reportUnsupported(feature, sourceKindName, sourceText);
  return renderNullableCSharpType(objectTypePlan, context);
};

export const renderFunctionReturnType = (
  returnType: LoweringTypeRefPlan | undefined,
  isAsync: boolean,
  context: RenderContext,
  sourceKindName = "FunctionLike",
  sourceText = "function"
): string => {
  const asyncAwaitedType = asyncReturnAwaitedType(returnType, context);
  if (asyncAwaitedType) {
    return renderTaskReturnType(asyncAwaitedType, context);
  }
  if (!returnType) {
    context.reportUnsupported("function return type", sourceKindName, sourceText);
  }
  const effectiveReturnType = returnType ?? objectTypePlan;
  const rendered = renderCSharpType(effectiveReturnType, context);
  if (isTaskLikeTypePlan(returnType, context)) {
    return rendered;
  }
  if (!isAsync) return rendered;
  return isVoidLikeTypePlan(effectiveReturnType)
    ? "global::System.Threading.Tasks.Task"
    : `global::System.Threading.Tasks.Task<${rendered}>`;
};

export const renderTypeMember = (
  member: LoweringTypeMemberPlan,
  context: RenderContext
): string => {
  switch (member.kind) {
    case "property":
      return `${renderRequiredCSharpType(member.type, context, "type member property type", "TypeMember", member.name)} ${sanitizeIdentifier(member.name)} { get; set; }`;
    case "method":
      return `${renderRequiredCSharpType(member.returnType, context, "type member return type", "TypeMember", member.name)} ${sanitizeIdentifier(member.name)}${member.typeParameters.length > 0 ? `<${member.typeParameters.map((name) => sanitizeTypeName(name)).join(", ")}>` : ""}(${member.parameters
        .map(
          (parameter) =>
            `${renderRequiredCSharpType(parameter.type, context, "type member parameter type", parameter.sourceKindName, parameter.sourceText)} ${requiredIdentifier(
              parameter.name,
              context,
              "type member parameter name",
              parameter.sourceKindName,
              parameter.nameSourceText ?? parameter.sourceText
            )}`
        )
        .join(", ")});`;
    case "index-signature":
      return `${renderRequiredCSharpType(member.valueType, context, "type member index value type", "TypeMember", "index-signature")} this[${renderRequiredCSharpType(member.keyType, context, "type member index key type", "TypeMember", "index-signature")} key] { get; set; }`;
  }
};
