/**
 * Structural adaptation and materialization.
 * Converts expressions between structural types by emitting object initializers,
 * array-element adaptation, and dictionary-value adaptation.
 */

import {
  IrType,
  IrPropertyDeclaration,
  stableIrTypeKey,
} from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "../type-emitter.js";
import {
  resolveTypeAlias,
  stripNullish,
  getPropertyType,
  getAllPropertySignatures,
  resolveLocalTypeInfo,
} from "../core/semantic/type-resolution.js";
import { matchesExpectedEmissionType } from "../core/semantic/expected-type-matching.js";
import { emitRuntimeCarrierTypeAst } from "../core/semantic/runtime-unions.js";
import type {
  CSharpExpressionAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";
import {
  getIdentifierTypeName,
  getIdentifierTypeLeafName,
  sameTypeAstSurface,
  stripNullableTypeAst,
} from "../core/format/backend-ast/utils.js";
import {
  identifierExpression,
  identifierType,
  nullLiteral,
  stringLiteral,
} from "../core/format/backend-ast/builders.js";
import { allocateLocalName } from "../core/format/local-names.js";
import { getAcceptedSurfaceType } from "../core/semantic/defaults.js";
import { emitCSharpName } from "../naming-policy.js";
import type { LocalTypeInfo } from "../emitter-types/core.js";
import { hasNullishBranch } from "./exact-comparison.js";

export { hasNullishBranch } from "./exact-comparison.js";

export type UpcastFn = (
  ast: CSharpExpressionAst,
  actualType: IrType | undefined,
  context: EmitterContext,
  expectedType: IrType | undefined,
  visited?: ReadonlySet<string>
) => [CSharpExpressionAst, EmitterContext] | undefined;

export type StructuralPropertyInfo = {
  readonly name: string;
  readonly type: IrType;
  readonly isOptional: boolean;
};

const stripUndefinedFromSurfaceType = (type: IrType): IrType => {
  if (type.kind !== "unionType") {
    return type;
  }

  const remaining = type.types.filter(
    (member) =>
      !(member.kind === "primitiveType" && member.name === "undefined")
  );

  if (remaining.length === 1 && remaining[0]) {
    return remaining[0];
  }

  return remaining.length === type.types.length
    ? type
    : {
        kind: "unionType",
        types: remaining,
      };
};

const buildDelegateType = (
  parameterTypes: readonly CSharpTypeAst[],
  returnType: CSharpTypeAst
): CSharpTypeAst =>
  identifierType("global::System.Func", [...parameterTypes, returnType]);

const collectLocalStructuralProperties = (
  info: LocalTypeInfo
): readonly StructuralPropertyInfo[] | undefined => {
  switch (info.kind) {
    case "interface": {
      if (info.members.some((member) => member.kind === "methodSignature")) {
        return undefined;
      }
      const props: StructuralPropertyInfo[] = [];
      for (const member of info.members) {
        if (member.kind !== "propertySignature") continue;
        props.push({
          name: member.name,
          type: member.type,
          isOptional: member.isOptional,
        });
      }
      return props;
    }

    case "class": {
      if (info.members.some((member) => member.kind === "methodDeclaration")) {
        return undefined;
      }
      const props: StructuralPropertyInfo[] = [];
      for (const member of info.members) {
        if (member.kind !== "propertyDeclaration") continue;
        if (!member.type) return undefined;
        const isOptional = hasNullishBranch(member.type);
        props.push({
          name: member.name,
          type: isOptional
            ? stripUndefinedFromSurfaceType(member.type)
            : member.type,
          isOptional,
        });
      }
      return props;
    }

    case "typeAlias": {
      const aliasType = info.type;
      if (aliasType.kind !== "objectType") return undefined;
      if (
        aliasType.members.some((member) => member.kind === "methodSignature")
      ) {
        return undefined;
      }
      return aliasType.members
        .filter(
          (
            member
          ): member is Extract<typeof member, { kind: "propertySignature" }> =>
            member.kind === "propertySignature"
        )
        .map((member) => ({
          name: member.name,
          type: member.type,
          isOptional: member.isOptional,
        }));
    }

    default:
      return undefined;
  }
};

const parseEmitterClrTypeString = (clrType: string): IrType => {
  if (clrType === "System.Void" || clrType === "void") {
    return { kind: "voidType" };
  }

  const primitiveMap: Record<string, IrType> = {
    "System.String": { kind: "primitiveType", name: "string" },
    string: { kind: "primitiveType", name: "string" },
    "System.Int32": { kind: "primitiveType", name: "int" },
    int: { kind: "primitiveType", name: "int" },
    "System.Double": { kind: "primitiveType", name: "number" },
    double: { kind: "primitiveType", name: "number" },
    "System.Boolean": { kind: "primitiveType", name: "boolean" },
    bool: { kind: "primitiveType", name: "boolean" },
    "System.Char": { kind: "primitiveType", name: "char" },
    char: { kind: "primitiveType", name: "char" },
    "System.Int64": { kind: "referenceType", name: "long" },
    long: { kind: "referenceType", name: "long" },
    "System.Object": { kind: "referenceType", name: "object" },
    object: { kind: "referenceType", name: "object" },
  };

  const primitive = primitiveMap[clrType];
  if (primitive) return primitive;

  if (clrType.endsWith("[]")) {
    return {
      kind: "arrayType",
      elementType: parseEmitterClrTypeString(clrType.slice(0, -2)),
    };
  }

  if (clrType.endsWith("*")) {
    return parseEmitterClrTypeString(clrType.slice(0, -1));
  }

  if (clrType.startsWith("System.Nullable`1")) {
    const innerMatch = clrType.match(/System\.Nullable`1\[\[([^\]]+)\]\]/);
    if (innerMatch?.[1]) {
      return {
        kind: "unionType",
        types: [
          parseEmitterClrTypeString(innerMatch[1]),
          { kind: "primitiveType", name: "undefined" },
        ],
      };
    }
  }

  if (/^T\d*$/.test(clrType) || /^T[A-Z][a-zA-Z]*$/.test(clrType)) {
    return { kind: "typeParameterType", name: clrType };
  }

  const underscoreInstantiationMatch = clrType.match(
    /^(.+?)_(\d+)\[\[(.+)\]\]$/
  );
  if (
    underscoreInstantiationMatch?.[1] &&
    underscoreInstantiationMatch[2] &&
    underscoreInstantiationMatch[3]
  ) {
    const baseName = underscoreInstantiationMatch[1];
    const arity = Number.parseInt(underscoreInstantiationMatch[2], 10);
    const args = splitEmitterTypeArguments(underscoreInstantiationMatch[3]);
    return {
      kind: "referenceType",
      name: `${baseName}_${arity}`,
      typeArguments:
        args.length === arity
          ? args.map((arg) => parseEmitterClrTypeString(arg.trim()))
          : undefined,
      resolvedClrType: clrType,
    };
  }

  const genericMatch = clrType.match(/^(.+)`(\d+)(?:\[\[(.+)\]\])?$/);
  if (genericMatch?.[1] && genericMatch[2]) {
    const baseName = genericMatch[1];
    const arity = Number.parseInt(genericMatch[2], 10);
    const typeArguments = genericMatch[3]
      ? splitEmitterTypeArguments(genericMatch[3]).map((arg) =>
          parseEmitterClrTypeString(arg.trim())
        )
      : Array.from({ length: arity }, (_, index) => ({
          kind: "typeParameterType" as const,
          name: index === 0 ? "T" : `T${index + 1}`,
        }));

    return {
      kind: "referenceType",
      name: baseName,
      typeArguments,
      resolvedClrType: clrType,
    };
  }

  return {
    kind: "referenceType",
    name: clrType,
    resolvedClrType: clrType,
  };
};

const splitEmitterTypeArguments = (text: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let current = "";

  for (const char of text) {
    if (char === "[") {
      depth++;
      current += char;
      continue;
    }
    if (char === "]") {
      depth--;
      current += char;
      continue;
    }
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
};

const addUndefinedToBindingType = (type: IrType): IrType => {
  if (
    type.kind === "unionType" &&
    type.types.some(
      (candidate) =>
        candidate.kind === "primitiveType" && candidate.name === "undefined"
    )
  ) {
    return type;
  }

  return {
    kind: "unionType",
    types: [type, { kind: "primitiveType", name: "undefined" }],
  };
};

const parseBindingPropertyType = (
  normalizedSignature: string | undefined
): IrType => {
  if (!normalizedSignature) {
    return { kind: "unknownType" };
  }

  const indexerMatch = normalizedSignature.match(/\|\[[^\]]*\]:([^|]+)\|/);
  if (indexerMatch?.[1]) {
    return parseEmitterClrTypeString(indexerMatch[1]);
  }

  const propertyMatch = normalizedSignature.match(/\|:([^|]+)\|/);
  if (propertyMatch?.[1]) {
    return parseEmitterClrTypeString(propertyMatch[1]);
  }

  const fieldParts = normalizedSignature.split("|");
  if (fieldParts.length >= 2 && fieldParts[1]) {
    return parseEmitterClrTypeString(fieldParts[1]);
  }

  return { kind: "unknownType" };
};

const collectBindingStructuralProperties = (
  type: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): readonly StructuralPropertyInfo[] | undefined => {
  const registry = context.bindingsRegistry;
  if (!registry || registry.size === 0) {
    return undefined;
  }

  const candidates = new Set<string>();
  const add = (value: string | undefined): void => {
    if (value && value.length > 0) {
      candidates.add(value);
      if (value.includes(".")) {
        candidates.add(value.split(".").pop() ?? value);
      }
    }
  };

  add(type.name);
  add(type.resolvedClrType);
  add(type.typeId?.tsName);
  add(type.typeId?.clrName);

  for (const candidate of candidates) {
    const binding = registry.get(candidate);
    if (!binding) continue;
    if (binding.members.some((member) => member.kind === "method")) {
      return undefined;
    }

    const props = binding.members
      .filter(
        (
          member
        ): member is (typeof binding.members)[number] & {
          kind: "property";
        } => member.kind === "property"
      )
      .map((member) => ({
        name: member.alias,
        type:
          member.semanticType !== undefined
            ? member.semanticOptional === true
              ? addUndefinedToBindingType(member.semanticType)
              : member.semanticType
            : parseBindingPropertyType(member.signature),
        isOptional: member.semanticOptional === true,
      }));

    if (props.length > 0) {
      return props;
    }
  }

  return undefined;
};

export const collectStructuralProperties = (
  type: IrType | undefined,
  context: EmitterContext
): readonly StructuralPropertyInfo[] | undefined => {
  if (!type) return undefined;

  const resolved = resolveTypeAlias(stripNullish(type), context);

  if (resolved.kind === "objectType") {
    if (resolved.members.some((member) => member.kind === "methodSignature")) {
      return undefined;
    }
    return resolved.members
      .filter(
        (
          member
        ): member is Extract<typeof member, { kind: "propertySignature" }> =>
          member.kind === "propertySignature"
      )
      .map((member) => ({
        name: member.name,
        type: member.type,
        isOptional: member.isOptional,
      }));
  }

  if (resolved.kind !== "referenceType") {
    return undefined;
  }

  const inheritedInterfaceProps = getAllPropertySignatures(resolved, context);
  if (inheritedInterfaceProps && inheritedInterfaceProps.length > 0) {
    return inheritedInterfaceProps.map((member) => ({
      name: member.name,
      type: member.type,
      isOptional: member.isOptional,
    }));
  }

  const localInfo = resolveLocalTypeInfo(resolved, context)?.info;
  if (localInfo) {
    return collectLocalStructuralProperties(localInfo);
  }

  if (resolved.structuralMembers && resolved.structuralMembers.length > 0) {
    if (
      resolved.structuralMembers.some(
        (member) => member.kind === "methodSignature"
      )
    ) {
      return undefined;
    }
    return resolved.structuralMembers
      .filter(
        (
          member
        ): member is Extract<typeof member, { kind: "propertySignature" }> =>
          member.kind === "propertySignature"
      )
      .map((member) => ({
        name: member.name,
        type: member.type,
        isOptional: member.isOptional,
      }));
  }

  return collectBindingStructuralProperties(resolved, context);
};

export const resolveAnonymousStructuralReferenceType = (
  type: IrType,
  context: EmitterContext
): IrType | undefined => {
  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind !== "objectType") return undefined;

  const currentNamespace =
    context.moduleNamespace ?? context.options.rootNamespace;
  const targetProps = resolved.members
    .filter(
      (
        member
      ): member is Extract<
        typeof member,
        { kind: "propertySignature"; name: string }
      > => member.kind === "propertySignature"
    )
    .map((member) => ({
      name: member.name,
      isOptional: member.isOptional,
      typeKey: stableIrTypeKey(member.type),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  if (targetProps.length === 0) return undefined;

  const candidateMaps: ReadonlyMap<string, LocalTypeInfo>[] = [];
  if (context.localTypes) {
    candidateMaps.push(context.localTypes);
  }
  if (context.options.moduleMap) {
    for (const module of context.options.moduleMap.values()) {
      if (module.localTypes) {
        candidateMaps.push(module.localTypes);
      }
    }
  }

  const matches: {
    readonly key: string;
    readonly name: string;
    readonly resolvedClrType: string;
    readonly isExternal: boolean;
  }[] = [];
  const collectMatches = (
    localTypes: ReadonlyMap<string, LocalTypeInfo>,
    namespace: string
  ): void => {
    for (const [typeName, info] of localTypes.entries()) {
      if (info.kind !== "class" || !typeName.startsWith("__Anon_")) continue;
      const candidateProps = info.members
        .filter(
          (member): member is IrPropertyDeclaration & { type: IrType } =>
            member.kind === "propertyDeclaration" && member.type !== undefined
        )
        .map((member) => ({
          name: member.name,
          isOptional: false,
          typeKey: stableIrTypeKey(member.type),
        }))
        .sort((left, right) => left.name.localeCompare(right.name));
      if (
        candidateProps.length === targetProps.length &&
        candidateProps.every(
          (prop, index) =>
            prop.name === targetProps[index]?.name &&
            prop.isOptional === targetProps[index]?.isOptional &&
            prop.typeKey === targetProps[index]?.typeKey
        )
      ) {
        const resolvedClrType = `${namespace}.${typeName}`;
        matches.push({
          key: resolvedClrType,
          name: typeName,
          resolvedClrType,
          isExternal: namespace !== currentNamespace,
        });
      }
    }
  };

  if (context.localTypes) {
    collectMatches(context.localTypes, currentNamespace);
  }
  if (context.options.moduleMap) {
    for (const module of context.options.moduleMap.values()) {
      if (module.localTypes) {
        collectMatches(module.localTypes, module.namespace);
      }
    }
  }

  const registry = context.bindingsRegistry;
  if (registry && registry.size > 0) {
    for (const binding of registry.values()) {
      const simpleAlias = binding.alias.split(".").pop() ?? binding.alias;
      const simpleName = binding.name.split(".").pop() ?? binding.name;
      if (
        !simpleAlias.startsWith("__Anon_") &&
        !simpleName.startsWith("__Anon_")
      ) {
        continue;
      }
      if (binding.members.some((member) => member.kind === "method")) continue;

      const candidateProps = binding.members
        .filter(
          (
            member
          ): member is (typeof binding.members)[number] & {
            kind: "property";
          } => member.kind === "property"
        )
        .map((member) => ({
          name: member.alias,
          isOptional: member.semanticOptional === true,
          typeKey: stableIrTypeKey(
            member.semanticType ?? parseBindingPropertyType(member.signature)
          ),
        }))
        .sort((left, right) => left.name.localeCompare(right.name));

      if (
        candidateProps.length !== targetProps.length ||
        !candidateProps.every(
          (prop, index) =>
            prop.name === targetProps[index]?.name &&
            prop.isOptional === targetProps[index]?.isOptional &&
            prop.typeKey === targetProps[index]?.typeKey
        )
      ) {
        continue;
      }

      const resolvedClrType = binding.name;
      matches.push({
        key: resolvedClrType,
        name: simpleAlias.startsWith("__Anon_") ? simpleAlias : simpleName,
        resolvedClrType,
        isExternal: !resolvedClrType.startsWith(`${currentNamespace}.`),
      });
    }
  }

  if (matches.length === 0) return undefined;

  const uniqueMatches = new Map(matches.map((match) => [match.key, match]));
  const deduped = [...uniqueMatches.values()];
  if (deduped.length === 1) {
    const onlyMatch = deduped[0];
    if (!onlyMatch) return undefined;
    return {
      kind: "referenceType",
      name: onlyMatch.name,
      resolvedClrType: onlyMatch.resolvedClrType,
    } satisfies IrType;
  }

  const externalMatches = deduped.filter((match) => match.isExternal);
  if (externalMatches.length === 1) {
    const onlyExternal = externalMatches[0];
    if (!onlyExternal) return undefined;
    return {
      kind: "referenceType",
      name: onlyExternal.name,
      resolvedClrType: onlyExternal.resolvedClrType,
    } satisfies IrType;
  }

  return undefined;
};

export const canPreferAnonymousStructuralTarget = (type: IrType): boolean => {
  const stripped = stripNullish(type);
  if (stripped.kind !== "referenceType") {
    return true;
  }

  const simpleName = stripped.name.split(".").pop() ?? stripped.name;
  const clrSimpleName = stripped.resolvedClrType?.split(".").pop();
  const isCompilerGeneratedCarrier = (name: string | undefined): boolean =>
    !!name && (name.startsWith("__Anon_") || name.startsWith("__Rest_"));

  return (
    isCompilerGeneratedCarrier(simpleName) ||
    isCompilerGeneratedCarrier(clrSimpleName)
  );
};

const getNominalReferenceIdentity = (
  type: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): string => {
  const explicitIdentity =
    type.resolvedClrType ??
    type.typeId?.clrName ??
    (type.name.includes(".") ? type.name : undefined) ??
    (type.typeId?.tsName?.includes(".") ? type.typeId.tsName : undefined);
  if (explicitIdentity) {
    return explicitIdentity;
  }

  const resolvedLocal = resolveLocalTypeInfo(type, context);
  if (resolvedLocal) {
    const localName = type.name.split(".").pop() ?? type.name;
    const canonicalTarget = context.options.canonicalLocalTypeTargets?.get(
      `${resolvedLocal.namespace}::${localName}`
    );
    return canonicalTarget ?? `${resolvedLocal.namespace}.${localName}`;
  }

  return type.name;
};

export const isSameNominalType = (
  sourceType: IrType | undefined,
  targetType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!sourceType || !targetType) return false;

  const sourceBase = stripNullish(sourceType);
  const targetBase = stripNullish(targetType);

  if (
    sourceBase.kind === "referenceType" &&
    targetBase.kind === "referenceType"
  ) {
    if (
      getNominalReferenceIdentity(sourceBase, context) ===
      getNominalReferenceIdentity(targetBase, context)
    ) {
      return true;
    }
  }

  const sourceResolved = resolveTypeAlias(sourceBase, context);
  const targetResolved = resolveTypeAlias(targetBase, context);
  if (
    sourceResolved.kind !== "referenceType" ||
    targetResolved.kind !== "referenceType"
  ) {
    return false;
  }

  return (
    sourceResolved.name === targetResolved.name ||
    (sourceResolved.resolvedClrType !== undefined &&
      sourceResolved.resolvedClrType === targetResolved.resolvedClrType)
  );
};

const buildStructuralSourceAccess = (
  sourceExpression: CSharpExpressionAst,
  sourceType: IrType,
  propertyName: string,
  context: EmitterContext
): CSharpExpressionAst => {
  const resolvedSource = resolveTypeAlias(stripNullish(sourceType), context);
  if (resolvedSource.kind === "dictionaryType") {
    return {
      kind: "elementAccessExpression",
      expression: sourceExpression,
      arguments: [stringLiteral(propertyName)],
    };
  }

  return {
    kind: "memberAccessExpression",
    expression: sourceExpression,
    memberName: emitCSharpName(propertyName, "properties", context),
  };
};

const isDirectlyReusableExpression = (
  expression: CSharpExpressionAst
): boolean =>
  expression.kind === "identifierExpression" ||
  expression.kind === "memberAccessExpression" ||
  expression.kind === "elementAccessExpression";

export const getArrayElementType = (
  type: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!type) return undefined;
  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind === "arrayType") return resolved.elementType;
  if (resolved.kind === "tupleType") {
    if (resolved.elementTypes.length === 1) return resolved.elementTypes[0];
    return undefined;
  }
  if (
    resolved.kind === "referenceType" &&
    (resolved.name === "Array" ||
      resolved.name === "ReadonlyArray" ||
      resolved.name === "JSArray") &&
    resolved.typeArguments?.length === 1
  ) {
    return resolved.typeArguments[0];
  }
  return undefined;
};

export const isObjectLikeTypeAst = (
  type: CSharpTypeAst | undefined
): boolean => {
  if (!type) return false;
  const concrete = stripNullableTypeAst(type);
  if (concrete.kind === "predefinedType") {
    return concrete.keyword === "object";
  }
  const name = getIdentifierTypeName(concrete);
  return (
    name === "object" ||
    name === "System.Object" ||
    name === "global::System.Object"
  );
};

const getDictionaryValueType = (
  type: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!type) return undefined;
  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind !== "dictionaryType") return undefined;
  return resolved.valueType;
};

export const tryAdaptStructuralExpressionAst = (
  emittedAst: CSharpExpressionAst,
  sourceType: IrType | undefined,
  context: EmitterContext,
  expectedType: IrType | undefined,
  upcastFn?: UpcastFn
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (!expectedType || !sourceType) return undefined;
  if (isSameNominalType(sourceType, expectedType, context)) {
    return undefined;
  }

  const strippedExpectedType = stripNullish(expectedType);
  const resolvedExpectedType = resolveTypeAlias(strippedExpectedType, context);
  if (
    resolvedExpectedType.kind === "referenceType" &&
    resolvedExpectedType.name === "object"
  ) {
    return [emittedAst, context];
  }

  const anonymousStructuralTarget = canPreferAnonymousStructuralTarget(
    expectedType
  )
    ? resolveAnonymousStructuralReferenceType(expectedType, context)
    : undefined;
  const targetStructuralType =
    anonymousStructuralTarget ?? resolvedExpectedType;
  const targetEmissionType =
    anonymousStructuralTarget ??
    (strippedExpectedType.kind === "referenceType"
      ? strippedExpectedType
      : undefined);
  const targetProps = collectStructuralProperties(
    targetStructuralType,
    context
  );
  if (targetProps && targetProps.length > 0) {
    if (!targetEmissionType && targetStructuralType.kind === "objectType") {
      return undefined;
    }

    const sourceProps = collectStructuralProperties(sourceType, context);
    if (!sourceProps || sourceProps.length === 0) return undefined;

    const sourcePropNames = new Set(sourceProps.map((prop) => prop.name));
    const materializedProps = targetProps.filter(
      (prop) => prop.isOptional || sourcePropNames.has(prop.name)
    );
    if (materializedProps.length === 0) return undefined;

    for (const prop of targetProps) {
      if (!prop.isOptional && !sourcePropNames.has(prop.name)) {
        return undefined;
      }
      if (!sourcePropNames.has(prop.name)) continue;
      if (!getPropertyType(sourceType, prop.name, context)) {
        return undefined;
      }
    }

    let currentContext = context;
    const [targetTypeAst, withType] = emitTypeAst(
      targetEmissionType ?? targetStructuralType,
      currentContext
    );
    currentContext = withType;
    const safeTargetTypeAst =
      targetTypeAst.kind === "nullableType"
        ? targetTypeAst.underlyingType
        : targetTypeAst;

    if (
      emittedAst.kind === "objectCreationExpression" &&
      (sameTypeAstSurface(emittedAst.type, safeTargetTypeAst) ||
        getIdentifierTypeLeafName(emittedAst.type) ===
          getIdentifierTypeLeafName(safeTargetTypeAst))
    ) {
      return [emittedAst, currentContext];
    }

    const sourcePropMap = new Map(sourceProps.map((prop) => [prop.name, prop]));

    const buildInitializer = (
      sourceExpression: CSharpExpressionAst,
      initContext: EmitterContext
    ): [CSharpExpressionAst, EmitterContext] => {
      let currentInitContext = initContext;
      const assignments = materializedProps
        .filter((prop) => sourcePropNames.has(prop.name))
        .map((prop) => {
          const sourceProp = sourcePropMap.get(prop.name);
          const sourceAccess = buildStructuralSourceAccess(
            sourceExpression,
            sourceType,
            prop.name,
            currentInitContext
          );
          const acceptedTargetType = getAcceptedSurfaceType(
            prop.type,
            prop.isOptional
          );
          const [adaptedValueAst, adaptedValueContext] =
            tryAdaptStructuralExpressionAst(
              sourceAccess,
              sourceProp?.type,
              currentInitContext,
              acceptedTargetType,
              upcastFn
            ) ?? [sourceAccess, currentInitContext];
          currentInitContext = adaptedValueContext;

          return {
            kind: "assignmentExpression" as const,
            operatorToken: "=" as const,
            left: {
              kind: "identifierExpression" as const,
              identifier: emitCSharpName(
                prop.name,
                "properties",
                currentInitContext
              ),
            },
            right: adaptedValueAst,
          };
        });

      return [
        {
          kind: "objectCreationExpression",
          type: safeTargetTypeAst,
          arguments: [],
          initializer: assignments,
        },
        currentInitContext,
      ];
    };

    const sourceMayBeNullish = hasNullishBranch(sourceType);
    if (emittedAst.kind === "identifierExpression") {
      const [initializer, initializerContext] = buildInitializer(
        emittedAst,
        currentContext
      );
      if (!sourceMayBeNullish) {
        return [initializer, initializerContext];
      }
      return [
        {
          kind: "conditionalExpression",
          condition: {
            kind: "binaryExpression",
            operatorToken: "==",
            left: emittedAst,
            right: nullLiteral(),
          },
          whenTrue: {
            kind: "defaultExpression",
            type: safeTargetTypeAst,
          },
          whenFalse: initializer,
        },
        initializerContext,
      ];
    }

    const temp = allocateLocalName("__struct", currentContext);
    currentContext = temp.context;
    const tempIdentifier: CSharpExpressionAst = {
      kind: "identifierExpression",
      identifier: temp.emittedName,
    };

    const statements: CSharpStatementAst[] = [
      {
        kind: "localDeclarationStatement",
        modifiers: [],
        type: { kind: "varType" },
        declarators: [{ name: temp.emittedName, initializer: emittedAst }],
      },
    ];

    if (sourceMayBeNullish) {
      statements.push({
        kind: "ifStatement",
        condition: {
          kind: "binaryExpression",
          operatorToken: "==",
          left: tempIdentifier,
          right: nullLiteral(),
        },
        thenStatement: {
          kind: "blockStatement",
          statements: [
            {
              kind: "returnStatement",
              expression: {
                kind: "defaultExpression",
                type: safeTargetTypeAst,
              },
            },
          ],
        },
      });
    }

    const [initializer, initializerContext] = buildInitializer(
      tempIdentifier,
      currentContext
    );
    currentContext = initializerContext;

    statements.push({
      kind: "returnStatement",
      expression: initializer,
    });

    const lambdaAst: CSharpExpressionAst = {
      kind: "lambdaExpression",
      isAsync: false,
      parameters: [],
      body: {
        kind: "blockStatement",
        statements,
      },
    };

    return [
      {
        kind: "invocationExpression",
        expression: {
          kind: "parenthesizedExpression",
          expression: {
            kind: "castExpression",
            type: buildDelegateType([], safeTargetTypeAst),
            expression: {
              kind: "parenthesizedExpression",
              expression: lambdaAst,
            },
          },
        },
        arguments: [],
      },
      currentContext,
    ];
  }

  const targetElementType = getArrayElementType(expectedType, context);
  const sourceElementType = getArrayElementType(sourceType, context);
  if (targetElementType && sourceElementType) {
    if (
      matchesExpectedEmissionType(sourceElementType, targetElementType, context)
    ) {
      return [emittedAst, context];
    }

    const item = allocateLocalName("__item", context);
    let currentContext = item.context;
    const itemIdentifier: CSharpExpressionAst = {
      kind: "identifierExpression",
      identifier: item.emittedName,
    };
    const structuralElementAdaptation = tryAdaptStructuralExpressionAst(
      itemIdentifier,
      sourceElementType,
      currentContext,
      targetElementType,
      upcastFn
    );
    const upcastElementAdaptation =
      structuralElementAdaptation ??
      (upcastFn
        ? upcastFn(
            itemIdentifier,
            sourceElementType,
            currentContext,
            targetElementType,
            new Set<string>()
          )
        : undefined);
    const adaptedElementAst =
      structuralElementAdaptation?.[0] ?? upcastElementAdaptation?.[0];
    currentContext =
      structuralElementAdaptation?.[1] ??
      upcastElementAdaptation?.[1] ??
      currentContext;
    const needsElementAdaptation =
      adaptedElementAst !== undefined && adaptedElementAst !== itemIdentifier;
    if (needsElementAdaptation) {
      const [sourceElementTypeAst, , sourceElementTypeContext] =
        emitRuntimeCarrierTypeAst(
          sourceElementType,
          currentContext,
          emitTypeAst
        );
      currentContext = sourceElementTypeContext;
      const [targetElementTypeAst, , targetElementTypeContext] =
        emitRuntimeCarrierTypeAst(
          targetElementType,
          currentContext,
          emitTypeAst
        );
      currentContext = targetElementTypeContext;
      const selectAst: CSharpExpressionAst = {
        kind: "invocationExpression",
        expression: {
          ...identifierExpression("global::System.Linq.Enumerable.Select"),
        },
        typeArguments: [sourceElementTypeAst, targetElementTypeAst],
        arguments: [
          emittedAst,
          {
            kind: "lambdaExpression",
            isAsync: false,
            parameters: [{ name: item.emittedName }],
            body: adaptedElementAst,
          },
        ],
      };
      const toArrayAst: CSharpExpressionAst = {
        kind: "invocationExpression",
        expression: {
          ...identifierExpression("global::System.Linq.Enumerable.ToArray"),
        },
        typeArguments: [targetElementTypeAst],
        arguments: [selectAst],
      };
      const [targetArrayTypeAst, targetArrayTypeContext] = emitTypeAst(
        expectedType,
        currentContext
      );
      currentContext = targetArrayTypeContext;
      const materializedArrayAst: CSharpExpressionAst = {
        kind: "castExpression",
        type: targetArrayTypeAst,
        expression: toArrayAst,
      };

      if (!hasNullishBranch(sourceType)) {
        return [materializedArrayAst, currentContext];
      }

      if (isDirectlyReusableExpression(emittedAst)) {
        return [
          {
            kind: "conditionalExpression",
            condition: {
              kind: "binaryExpression",
              operatorToken: "==",
              left: emittedAst,
              right: nullLiteral(),
            },
            whenTrue: { kind: "defaultExpression" },
            whenFalse: materializedArrayAst,
          },
          currentContext,
        ];
      }
    }
  }

  const targetValueType = getDictionaryValueType(expectedType, context);
  const sourceValueType = getDictionaryValueType(sourceType, context);
  if (targetValueType && sourceValueType) {
    let currentContext = context;
    const [targetValueTypeAst, valueTypeContext] = emitTypeAst(
      targetValueType,
      currentContext
    );
    currentContext = valueTypeContext;
    const dictTypeAst: CSharpTypeAst = identifierType(
      "global::System.Collections.Generic.Dictionary",
      [{ kind: "predefinedType", keyword: "string" }, targetValueTypeAst]
    );
    const sourceTemp = allocateLocalName("__dict", currentContext);
    currentContext = sourceTemp.context;
    const entryTemp = allocateLocalName("__entry", currentContext);
    currentContext = entryTemp.context;
    const resultTemp = allocateLocalName("__result", currentContext);
    currentContext = resultTemp.context;

    const entryValueAst: CSharpExpressionAst = {
      kind: "memberAccessExpression",
      expression: {
        kind: "identifierExpression",
        identifier: entryTemp.emittedName,
      },
      memberName: "Value",
    };
    const [adaptedValueAst, adaptedContext] = tryAdaptStructuralExpressionAst(
      entryValueAst,
      sourceValueType,
      currentContext,
      targetValueType,
      upcastFn
    ) ?? [undefined, currentContext];
    currentContext = adaptedContext;
    if (adaptedValueAst !== undefined) {
      const statements: CSharpStatementAst[] = [
        {
          kind: "localDeclarationStatement",
          modifiers: [],
          type: { kind: "varType" },
          declarators: [
            {
              name: sourceTemp.emittedName,
              initializer: emittedAst,
            },
          ],
        },
        {
          kind: "ifStatement",
          condition: {
            kind: "binaryExpression",
            operatorToken: "==",
            left: {
              kind: "identifierExpression",
              identifier: sourceTemp.emittedName,
            },
            right: nullLiteral(),
          },
          thenStatement: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                expression: { kind: "defaultExpression", type: dictTypeAst },
              },
            ],
          },
        },
        {
          kind: "localDeclarationStatement",
          modifiers: [],
          type: { kind: "varType" },
          declarators: [
            {
              name: resultTemp.emittedName,
              initializer: {
                kind: "objectCreationExpression",
                type: dictTypeAst,
                arguments: [],
              },
            },
          ],
        },
        {
          kind: "foreachStatement",
          isAwait: false,
          type: { kind: "varType" },
          identifier: entryTemp.emittedName,
          expression: {
            kind: "identifierExpression",
            identifier: sourceTemp.emittedName,
          },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "expressionStatement",
                expression: {
                  kind: "assignmentExpression",
                  operatorToken: "=",
                  left: {
                    kind: "elementAccessExpression",
                    expression: {
                      kind: "identifierExpression",
                      identifier: resultTemp.emittedName,
                    },
                    arguments: [
                      {
                        kind: "memberAccessExpression",
                        expression: {
                          kind: "identifierExpression",
                          identifier: entryTemp.emittedName,
                        },
                        memberName: "Key",
                      },
                    ],
                  },
                  right: adaptedValueAst,
                },
              },
            ],
          },
        },
        {
          kind: "returnStatement",
          expression: {
            kind: "identifierExpression",
            identifier: resultTemp.emittedName,
          },
        },
      ];

      return [
        {
          kind: "invocationExpression",
          expression: {
            kind: "parenthesizedExpression",
            expression: {
              kind: "castExpression",
              type: buildDelegateType([], dictTypeAst),
              expression: {
                kind: "parenthesizedExpression",
                expression: {
                  kind: "lambdaExpression",
                  isAsync: false,
                  parameters: [],
                  body: {
                    kind: "blockStatement",
                    statements,
                  },
                },
              },
            },
          },
          arguments: [],
        },
        currentContext,
      ];
    }
  }

  return undefined;
};
