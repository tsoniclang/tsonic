/**
 * Expression Emitter - IR expressions to C# code
 * Main dispatcher - delegates to specialized modules
 *
 * Primary entry point is emitExpressionAst which returns [CSharpExpressionAst, EmitterContext].
 */

import {
  IrExpression,
  IrType,
  IrNumericNarrowingExpression,
  IrTypeAssertionExpression,
  IrAsInterfaceExpression,
  IrTryCastExpression,
  IrStackAllocExpression,
  IrDefaultOfExpression,
  IrNameOfExpression,
  IrSizeOfExpression,
  stableIrTypeKey,
} from "@tsonic/frontend";
import { EmitterContext } from "./types.js";
import { emitTypeAst } from "./type-emitter.js";
import {
  substituteTypeArgs,
  resolveTypeAlias,
  stripNullish,
  getPropertyType,
  getAllPropertySignatures,
  resolveLocalTypeInfo,
  isTypeOnlyStructuralTarget,
  isDefinitelyValueType,
  splitRuntimeNullishUnionMembers,
} from "./core/semantic/type-resolution.js";
import {
  buildRuntimeUnionLayout,
  buildRuntimeUnionTypeAst,
  emitRuntimeCarrierTypeAst,
  findRuntimeUnionMemberIndex,
} from "./core/semantic/runtime-unions.js";
import { isSemanticUnion } from "./core/semantic/union-semantics.js";
import { matchesExpectedEmissionType } from "./core/semantic/expected-type-matching.js";
import { resolveEffectiveExpressionType } from "./core/semantic/narrowed-expression-types.js";
import {
  buildRuntimeUnionFactoryCallAst,
  buildInvalidRuntimeUnionCastExpression,
  tryBuildRuntimeUnionProjectionToLayoutAst,
} from "./core/semantic/runtime-union-projection.js";
import type {
  CSharpExpressionAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "./core/format/backend-ast/types.js";
import {
  getIdentifierTypeName,
  getIdentifierTypeLeafName,
  sameTypeAstSurface,
  stableTypeKeyFromAst,
  stripNullableTypeAst,
} from "./core/format/backend-ast/utils.js";
import {
  identifierExpression,
  identifierType,
  nullLiteral,
  stringLiteral,
} from "./core/format/backend-ast/builders.js";
import { allocateLocalName } from "./core/format/local-names.js";
import { getAcceptedSurfaceType } from "./core/semantic/defaults.js";
import { unwrapTransparentExpression } from "./core/semantic/transparent-expressions.js";
import { resolveRuntimeMaterializationTargetType } from "./core/semantic/runtime-materialization-targets.js";
import { emitCSharpName } from "./naming-policy.js";

// Import expression emitters from specialized modules
import { emitLiteral } from "./expressions/literals.js";
import { emitIdentifier } from "./expressions/identifiers.js";
import { emitArray, emitObject } from "./expressions/collections.js";
import { emitMemberAccess } from "./expressions/access.js";
import { emitCall } from "./expressions/calls/call-emitter.js";
import { emitNew } from "./expressions/calls/new-emitter.js";
import {
  emitBinary,
  emitLogical,
  emitUnary,
  emitUpdate,
  emitAssignment,
  emitConditional,
} from "./expressions/operators.js";
import {
  emitFunctionExpression,
  emitArrowFunction,
} from "./expressions/functions.js";
import {
  emitTemplateLiteral,
  emitSpread,
  emitAwait,
} from "./expressions/other.js";
import type { LocalTypeInfo } from "./emitter-types/core.js";
import { getMemberAccessNarrowKey } from "./core/semantic/narrowing-keys.js";

type StructuralPropertyInfo = {
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

const hasNullishBranch = (type: IrType | undefined): boolean => {
  if (!type || type.kind !== "unionType") return false;
  return type.types.some(
    (member) =>
      member.kind === "primitiveType" &&
      (member.name === "null" || member.name === "undefined")
  );
};

const POLYMORPHIC_THIS_MARKER = "__tsonic_polymorphic_this";

const isPolymorphicThisType = (type: IrType | undefined): boolean =>
  !!type &&
  ((type.kind === "typeParameterType" &&
    type.name === POLYMORPHIC_THIS_MARKER) ||
    (type.kind === "referenceType" && type.name === POLYMORPHIC_THIS_MARKER));

const isSuperMemberCallExpression = (expr: IrExpression): boolean =>
  expr.kind === "call" &&
  expr.callee.kind === "memberAccess" &&
  expr.callee.object.kind === "identifier" &&
  expr.callee.object.name === "super";

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

const collectStructuralProperties = (
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

const resolveAnonymousStructuralReferenceType = (
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
          (
            member
          ): member is Extract<
            typeof member,
            { kind: "propertyDeclaration"; name: string }
          > =>
            member.kind === "propertyDeclaration" && member.type !== undefined
        )
        .map((member) => ({
          name: member.name,
          isOptional: false,
          typeKey: stableIrTypeKey(member.type!),
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

const canPreferAnonymousStructuralTarget = (type: IrType): boolean => {
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

const isSameNominalType = (
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

const getArrayElementType = (
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

const isObjectLikeTypeAst = (type: CSharpTypeAst | undefined): boolean => {
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

const tryAdaptStructuralExpressionAst = (
  emittedAst: CSharpExpressionAst,
  sourceType: IrType | undefined,
  context: EmitterContext,
  expectedType: IrType | undefined
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
              acceptedTargetType
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
      targetElementType
    );
    const upcastElementAdaptation =
      structuralElementAdaptation ??
      maybeUpcastExpressionToExpectedTypeAst(
        itemIdentifier,
        sourceElementType,
        currentContext,
        targetElementType,
        new Set<string>()
      );
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
      targetValueType
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

const getBareTypeParameterName = (
  type: IrType,
  context: EmitterContext
): string | undefined => {
  if (type.kind === "typeParameterType") return type.name;
  if (
    type.kind === "referenceType" &&
    (context.typeParameters?.has(type.name) ?? false) &&
    (!type.typeArguments || type.typeArguments.length === 0)
  ) {
    return type.name;
  }
  return undefined;
};

const getUnconstrainedNullishTypeParamName = (
  type: IrType,
  context: EmitterContext
): string | undefined => {
  if (type.kind !== "unionType") return undefined;

  const nonNullTypes = type.types.filter(
    (t) =>
      !(
        t.kind === "primitiveType" &&
        (t.name === "null" || t.name === "undefined")
      )
  );
  if (nonNullTypes.length !== 1) return undefined;

  const nonNull = nonNullTypes[0];
  if (!nonNull) return undefined;

  const typeParamName = getBareTypeParameterName(nonNull, context);
  if (!typeParamName) return undefined;

  const constraintKind =
    context.typeParamConstraints?.get(typeParamName) ?? "unconstrained";
  return constraintKind === "unconstrained" ? typeParamName : undefined;
};

const maybeCastNullishTypeParamAst = (
  expr: IrExpression,
  ast: CSharpExpressionAst,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] => {
  if (!expectedType) return [ast, context];
  const actualType = resolveEffectiveExpressionType(expr, context);
  const narrowKey =
    expr.kind === "identifier"
      ? expr.name
      : expr.kind === "memberAccess"
        ? getMemberAccessNarrowKey(expr)
        : undefined;
  const narrowedSourceType =
    narrowKey && context.narrowedBindings
      ? context.narrowedBindings.get(narrowKey)?.sourceType
      : undefined;
  const sourceStorageType =
    narrowedSourceType ?? expr.inferredType ?? actualType;
  if (!actualType && !sourceStorageType) return [ast, context];

  const expectedTypeParam = getBareTypeParameterName(expectedType, context);
  if (!expectedTypeParam) return [ast, context];

  const unionTypeParam =
    (actualType
      ? getUnconstrainedNullishTypeParamName(actualType, context)
      : undefined) ??
    (sourceStorageType
      ? getUnconstrainedNullishTypeParamName(sourceStorageType, context)
      : undefined);
  if (!unionTypeParam) return [ast, context];
  if (unionTypeParam !== expectedTypeParam) return [ast, context];

  const [typeAst, newContext] = emitTypeAst(expectedType, context);
  return [
    {
      kind: "castExpression",
      type: typeAst,
      expression: ast,
    },
    newContext,
  ];
};

const getNullableUnionBaseType = (type: IrType): IrType | undefined => {
  if (type.kind !== "unionType") return undefined;

  const nonNullTypes = type.types.filter(
    (t) =>
      !(
        t.kind === "primitiveType" &&
        (t.name === "null" || t.name === "undefined")
      )
  );
  if (nonNullTypes.length !== 1) return undefined;
  return nonNullTypes[0];
};

const isNonNullableValueType = (type: IrType): boolean => {
  if (type.kind === "primitiveType") {
    return (
      type.name === "number" ||
      type.name === "int" ||
      type.name === "boolean" ||
      type.name === "char"
    );
  }

  if (type.kind === "referenceType") {
    return (
      type.name === "sbyte" ||
      type.name === "short" ||
      type.name === "int" ||
      type.name === "long" ||
      type.name === "nint" ||
      type.name === "int128" ||
      type.name === "byte" ||
      type.name === "ushort" ||
      type.name === "uint" ||
      type.name === "ulong" ||
      type.name === "nuint" ||
      type.name === "uint128" ||
      type.name === "half" ||
      type.name === "float" ||
      type.name === "double" ||
      type.name === "decimal" ||
      type.name === "bool" ||
      type.name === "char"
    );
  }

  return false;
};

const isSameTypeForNullableUnwrap = (
  base: IrType,
  expected: IrType
): boolean => {
  if (base.kind !== expected.kind) return false;

  if (base.kind === "primitiveType" && expected.kind === "primitiveType") {
    return base.name === expected.name;
  }

  if (base.kind === "referenceType" && expected.kind === "referenceType") {
    return (
      base.name === expected.name &&
      (base.typeArguments?.length ?? 0) === 0 &&
      (expected.typeArguments?.length ?? 0) === 0
    );
  }

  return false;
};

const maybeUnwrapNullableValueTypeAst = (
  expr: IrExpression,
  ast: CSharpExpressionAst,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] => {
  if (!expectedType) return [ast, context];
  const actualType = resolveEffectiveExpressionType(expr, context);
  if (!actualType) return [ast, context];

  // Only unwrap direct nullable values.
  if (expr.kind !== "identifier" && expr.kind !== "memberAccess") {
    return [ast, context];
  }

  if (
    context.narrowedBindings &&
    ((expr.kind === "identifier" && context.narrowedBindings.has(expr.name)) ||
      (expr.kind === "memberAccess" &&
        (() => {
          const key = getMemberAccessNarrowKey(expr);
          return key ? context.narrowedBindings.has(key) : false;
        })()))
  ) {
    return [ast, context];
  }

  const nullableBase = getNullableUnionBaseType(actualType);
  if (!nullableBase) return [ast, context];

  if (!isNonNullableValueType(expectedType)) return [ast, context];
  if (!isSameTypeForNullableUnwrap(nullableBase, expectedType)) {
    return [ast, context];
  }

  // Append .Value
  return [
    {
      kind: "memberAccessExpression",
      expression: ast,
      memberName: "Value",
    },
    context,
  ];
};

const normalizeComparableType = (
  type: IrType,
  context: EmitterContext
): IrType => {
  const stripped = stripNullish(type);
  if (
    stripped.kind === "referenceType" &&
    (stripped.name === "out" ||
      stripped.name === "ref" ||
      stripped.name === "In" ||
      stripped.name === "inref") &&
    stripped.typeArguments &&
    stripped.typeArguments.length === 1
  ) {
    const innerType = stripped.typeArguments[0];
    if (innerType) {
      return resolveTypeAlias(stripNullish(innerType), context);
    }
  }

  return resolveTypeAlias(stripped, context);
};

const unwrapEmissionComparableType = (type: IrType): IrType => {
  const stripped = stripNullish(type);
  if (
    stripped.kind === "referenceType" &&
    (stripped.name === "out" ||
      stripped.name === "ref" ||
      stripped.name === "In" ||
      stripped.name === "inref") &&
    stripped.typeArguments &&
    stripped.typeArguments.length === 1
  ) {
    const innerType = stripped.typeArguments[0];
    if (innerType) {
      return unwrapEmissionComparableType(innerType);
    }
  }

  return stripped;
};

const isSafelyEmittableTypeForExactComparison = (
  type: IrType,
  context: EmitterContext,
  visited: WeakSet<object> = new WeakSet()
): boolean => {
  if (typeof type === "object" && type !== null) {
    if (visited.has(type)) {
      return true;
    }
    visited.add(type);
  }

  const stripped = stripNullish(type);

  switch (stripped.kind) {
    case "primitiveType":
    case "literalType":
    case "typeParameterType":
    case "voidType":
    case "anyType":
    case "unknownType":
    case "neverType":
      return true;
    case "objectType":
      return false;
    case "referenceType":
      return (stripped.typeArguments ?? []).every(
        (typeArgument) =>
          typeArgument !== undefined &&
          isSafelyEmittableTypeForExactComparison(
            typeArgument,
            context,
            visited
          )
      );
    case "arrayType":
      return isSafelyEmittableTypeForExactComparison(
        stripped.elementType,
        context,
        visited
      );
    case "dictionaryType":
      return (
        isSafelyEmittableTypeForExactComparison(
          stripped.keyType,
          context,
          visited
        ) &&
        isSafelyEmittableTypeForExactComparison(
          stripped.valueType,
          context,
          visited
        )
      );
    case "tupleType":
      return stripped.elementTypes.every(
        (elementType) =>
          elementType !== undefined &&
          isSafelyEmittableTypeForExactComparison(elementType, context, visited)
      );
    case "functionType":
      return (
        stripped.parameters.every(
          (parameter) =>
            !parameter.type ||
            isSafelyEmittableTypeForExactComparison(
              parameter.type,
              context,
              visited
            )
        ) &&
        isSafelyEmittableTypeForExactComparison(
          stripped.returnType,
          context,
          visited
        )
      );
    case "unionType":
    case "intersectionType":
      return stripped.types.every(
        (memberType) =>
          memberType !== undefined &&
          isSafelyEmittableTypeForExactComparison(memberType, context, visited)
      );
  }
};

const getSafeExactComparisonTargetType = (
  type: IrType,
  context: EmitterContext
): IrType | undefined => {
  if (isSafelyEmittableTypeForExactComparison(type, context)) {
    return type;
  }

  const stripped = stripNullish(type);
  if (isSafelyEmittableTypeForExactComparison(stripped, context)) {
    return stripped;
  }

  const anonymousStructuralTarget = canPreferAnonymousStructuralTarget(type)
    ? resolveAnonymousStructuralReferenceType(type, context)
    : undefined;
  if (
    anonymousStructuralTarget &&
    isSafelyEmittableTypeForExactComparison(anonymousStructuralTarget, context)
  ) {
    return anonymousStructuralTarget;
  }

  const normalized = normalizeComparableType(type, context);
  if (isSafelyEmittableTypeForExactComparison(normalized, context)) {
    return normalized;
  }

  return undefined;
};

const tryEmitExactComparisonTargetAst = (
  type: IrType,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] | undefined => {
  const candidates: IrType[] = [];
  const seen = new Set<string>();

  const pushCandidate = (candidate: IrType | undefined): void => {
    if (!candidate) {
      return;
    }
    const key = stableIrTypeKey(candidate);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    candidates.push(candidate);
  };

  pushCandidate(getSafeExactComparisonTargetType(type, context));
  pushCandidate(normalizeComparableType(type, context));

  for (const candidate of candidates) {
    try {
      return emitTypeAst(candidate, context);
    } catch {
      continue;
    }
  }

  return undefined;
};

const canUseImplicitOptionalSurfaceConversion = (
  actualType: IrType,
  expectedType: IrType,
  context: EmitterContext
): boolean => {
  if (!hasNullishBranch(expectedType)) {
    return false;
  }

  const normalizedActualBase = normalizeComparableType(
    stripNullish(actualType),
    context
  );
  const normalizedExpectedBase = normalizeComparableType(
    stripNullish(expectedType),
    context
  );

  return areIrTypesEquivalent(
    normalizedActualBase,
    normalizedExpectedBase,
    context
  );
};

const areIrTypesEquivalent = (
  left: IrType,
  right: IrType,
  context: EmitterContext,
  visited: WeakMap<object, WeakSet<object>> = new WeakMap()
): boolean => {
  const seenRight = visited.get(left);
  if (seenRight?.has(right)) {
    return true;
  }
  if (seenRight) {
    seenRight.add(right);
  } else {
    visited.set(left, new WeakSet([right]));
  }

  const a = normalizeComparableType(left, context);
  const b = normalizeComparableType(right, context);

  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case "primitiveType":
      return a.name === (b as typeof a).name;
    case "literalType":
      return a.value === (b as typeof a).value;
    case "referenceType": {
      const rb = b as typeof a;
      if (a.name !== rb.name) return false;
      const aArgs = a.typeArguments ?? [];
      const bArgs = rb.typeArguments ?? [];
      if (aArgs.length !== bArgs.length) return false;
      for (let i = 0; i < aArgs.length; i++) {
        const aa = aArgs[i];
        const bb = bArgs[i];
        if (!aa || !bb || !areIrTypesEquivalent(aa, bb, context)) return false;
      }
      return true;
    }
    case "arrayType":
      return areIrTypesEquivalent(
        a.elementType,
        (b as typeof a).elementType,
        context,
        visited
      );
    case "dictionaryType":
      return (
        areIrTypesEquivalent(
          a.keyType,
          (b as typeof a).keyType,
          context,
          visited
        ) &&
        areIrTypesEquivalent(
          a.valueType,
          (b as typeof a).valueType,
          context,
          visited
        )
      );
    case "tupleType": {
      const rb = b as typeof a;
      if (a.elementTypes.length !== rb.elementTypes.length) return false;
      for (let i = 0; i < a.elementTypes.length; i++) {
        const ae = a.elementTypes[i];
        const be = rb.elementTypes[i];
        if (!ae || !be || !areIrTypesEquivalent(ae, be, context, visited))
          return false;
      }
      return true;
    }
    case "functionType": {
      const rb = b as typeof a;
      if (a.parameters.length !== rb.parameters.length) return false;
      for (let i = 0; i < a.parameters.length; i++) {
        const ap = a.parameters[i];
        const bp = rb.parameters[i];
        if (!ap || !bp) return false;
        if (!ap.type && !bp.type) continue;
        if (!ap.type || !bp.type) return false;
        if (!areIrTypesEquivalent(ap.type, bp.type, context, visited))
          return false;
      }
      return areIrTypesEquivalent(
        a.returnType,
        rb.returnType,
        context,
        visited
      );
    }
    case "unionType":
    case "intersectionType": {
      const rb = b as typeof a;
      if (a.types.length !== rb.types.length) return false;
      const used = new Set<number>();
      for (const at of a.types) {
        if (!at) return false;
        let matched = false;
        for (let i = 0; i < rb.types.length; i++) {
          if (used.has(i)) continue;
          const bt = rb.types[i];
          if (!bt) continue;
          if (areIrTypesEquivalent(at, bt, context, visited)) {
            used.add(i);
            matched = true;
            break;
          }
        }
        if (!matched) return false;
      }
      return true;
    }
    case "typeParameterType":
      return a.name === (b as typeof a).name;
    case "voidType":
    case "anyType":
    case "unknownType":
    case "neverType":
      return true;
    case "objectType": {
      const rb = b as typeof a;
      if (a.members.length !== rb.members.length) return false;
      for (let i = 0; i < a.members.length; i++) {
        const am = a.members[i];
        const bm = rb.members[i];
        if (!am || !bm || am.kind !== bm.kind) return false;
        if (
          am.kind === "propertySignature" &&
          bm.kind === "propertySignature"
        ) {
          if (am.name !== bm.name) return false;
          if (!areIrTypesEquivalent(am.type, bm.type, context, visited))
            return false;
          continue;
        }
        if (am.kind === "methodSignature" && bm.kind === "methodSignature") {
          if (am.name !== bm.name) return false;
          if (am.parameters.length !== bm.parameters.length) return false;
          for (let j = 0; j < am.parameters.length; j++) {
            const ap = am.parameters[j];
            const bp = bm.parameters[j];
            if (!ap || !bp) return false;
            if (!ap.type || !bp.type) return false;
            if (!areIrTypesEquivalent(ap.type, bp.type, context, visited))
              return false;
          }
          if (!am.returnType || !bm.returnType) return false;
          if (
            !areIrTypesEquivalent(
              am.returnType,
              bm.returnType,
              context,
              visited
            )
          )
            return false;
          continue;
        }
        return false;
      }
      return true;
    }
  }
};

const maybeUpcastDictionaryUnionValueAst = (
  expr: IrExpression,
  ast: CSharpExpressionAst,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] => {
  const actualType = resolveEffectiveExpressionType(expr, context);
  if (!expectedType || !actualType) return [ast, context];

  const expected = normalizeComparableType(expectedType, context);
  const actual = normalizeComparableType(actualType, context);
  if (expected.kind !== "dictionaryType" || actual.kind !== "dictionaryType") {
    return [ast, context];
  }

  if (!areIrTypesEquivalent(expected.keyType, actual.keyType, context)) {
    return [ast, context];
  }

  const expectedValue = normalizeComparableType(expected.valueType, context);
  if (expectedValue.kind !== "unionType") return [ast, context];

  const actualValue = normalizeComparableType(actual.valueType, context);
  if (areIrTypesEquivalent(expectedValue, actualValue, context)) {
    return [ast, context];
  }

  const [runtimeLayout, layoutCtx] = buildRuntimeUnionLayout(
    expectedValue,
    context,
    emitTypeAst
  );
  if (!runtimeLayout) return [ast, context];

  const runtimeMemberIndex = findRuntimeUnionMemberIndex(
    runtimeLayout.members,
    actualValue,
    layoutCtx
  );
  if (runtimeMemberIndex === undefined) return [ast, context];

  const [unionValueTypeAst, ctx1] = emitTypeAst(expected.valueType, layoutCtx);
  const kvpId = "kvp";
  const keySelector: CSharpExpressionAst = {
    kind: "lambdaExpression",
    isAsync: false,
    parameters: [{ name: kvpId }],
    body: {
      kind: "memberAccessExpression",
      expression: { kind: "identifierExpression", identifier: kvpId },
      memberName: "Key",
    },
  };
  const valueSelector: CSharpExpressionAst = {
    kind: "lambdaExpression",
    isAsync: false,
    parameters: [{ name: kvpId }],
    body: {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: {
          kind: "typeReferenceExpression",
          type: unionValueTypeAst,
        },
        memberName: `From${runtimeMemberIndex + 1}`,
      },
      arguments: [
        {
          kind: "memberAccessExpression",
          expression: { kind: "identifierExpression", identifier: kvpId },
          memberName: "Value",
        },
      ],
    },
  };

  const converted: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: {
        ...identifierExpression("global::System.Linq.Enumerable"),
      },
      memberName: "ToDictionary",
    },
    arguments: [ast, keySelector, valueSelector],
  };

  return [converted, ctx1];
};

const maybeWidenRuntimeUnionExpressionAst = (
  ast: CSharpExpressionAst,
  actualType: IrType,
  context: EmitterContext,
  expectedType: IrType,
  visited: ReadonlySet<string>
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const [actualLayout, actualLayoutContext] = buildRuntimeUnionLayout(
    actualType,
    context,
    emitTypeAst
  );
  if (!actualLayout) {
    return undefined;
  }
  const [expectedLayout, expectedLayoutContext] = buildRuntimeUnionLayout(
    expectedType,
    actualLayoutContext,
    emitTypeAst
  );
  if (!expectedLayout) {
    return undefined;
  }

  return tryBuildRuntimeUnionProjectionToLayoutAst({
    valueAst: ast,
    sourceLayout: actualLayout,
    targetLayout: expectedLayout,
    context: expectedLayoutContext,
    buildMappedMemberValue: ({
      actualMember,
      parameterExpr,
      targetMember,
      context: nextContext,
    }) =>
      maybeUpcastExpressionToExpectedTypeAst(
        parameterExpr,
        actualMember,
        nextContext,
        targetMember,
        visited
      ) ?? [parameterExpr, nextContext],
  });
};

const maybeNarrowRuntimeUnionExpressionAst = (
  ast: CSharpExpressionAst,
  actualType: IrType,
  context: EmitterContext,
  expectedType: IrType,
  visited: ReadonlySet<string>
): [CSharpExpressionAst, EmitterContext] | undefined => {
  // Semantic gate: only project via Match() when both the actual and
  // expected types are semantic unions (explicit unionType in IR).
  // Alias references like MiddlewareLike must not be treated as unions
  // here — they are single semantic types, even if they alias a union.
  if (
    !isSemanticUnion(actualType, context) ||
    !isSemanticUnion(expectedType, context)
  ) {
    return undefined;
  }

  const [actualLayout, actualLayoutContext] = buildRuntimeUnionLayout(
    actualType,
    context,
    emitTypeAst
  );
  if (!actualLayout) {
    return undefined;
  }

  const [expectedLayout, expectedLayoutContext] = buildRuntimeUnionLayout(
    expectedType,
    actualLayoutContext,
    emitTypeAst
  );
  if (!expectedLayout) {
    return undefined;
  }

  return tryBuildRuntimeUnionProjectionToLayoutAst({
    valueAst: ast,
    sourceLayout: actualLayout,
    targetLayout: expectedLayout,
    context: expectedLayoutContext,
    buildMappedMemberValue: ({
      actualMember,
      parameterExpr,
      targetMember,
      context: nextContext,
    }) =>
      maybeUpcastExpressionToExpectedTypeAst(
        parameterExpr,
        actualMember,
        nextContext,
        targetMember,
        visited
      ) ?? [parameterExpr, nextContext],
    buildUnmappedMemberBody: ({ actualMember }) =>
      buildInvalidRuntimeUnionCastExpression(actualMember, expectedType),
  });
};

const maybeProjectRuntimeUnionMemberExpressionAst = (
  ast: CSharpExpressionAst,
  actualType: IrType,
  context: EmitterContext,
  expectedType: IrType,
  visited: ReadonlySet<string>
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const normalizedExpected = normalizeComparableType(expectedType, context);
  if (normalizedExpected.kind === "unionType") {
    return undefined;
  }

  const [actualLayout, actualLayoutContext] = buildRuntimeUnionLayout(
    actualType,
    context,
    emitTypeAst
  );
  if (!actualLayout) {
    return undefined;
  }

  const actualTypeContext = actualLayoutContext;

  const lambdaArgs: CSharpExpressionAst[] = [];
  let currentContext = actualTypeContext;
  let sawMatch = false;

  for (let index = 0; index < actualLayout.members.length; index += 1) {
    const actualMember = actualLayout.members[index];
    if (!actualMember) continue;

    const parameterName = `__tsonic_union_member_${index + 1}`;
    const parameterExpr: CSharpExpressionAst = {
      kind: "identifierExpression",
      identifier: parameterName,
    };

    let body: CSharpExpressionAst = buildInvalidRuntimeUnionCastExpression(
      actualMember,
      expectedType
    );

    if (areIrTypesEquivalent(actualMember, expectedType, currentContext)) {
      body = parameterExpr;
      sawMatch = true;
    } else {
      const nested = maybeUpcastExpressionToExpectedTypeAst(
        parameterExpr,
        actualMember,
        currentContext,
        expectedType,
        visited
      );
      if (nested) {
        body = nested[0];
        currentContext = nested[1];
        sawMatch = true;
      }
    }

    lambdaArgs.push({
      kind: "lambdaExpression",
      isAsync: false,
      parameters: [{ name: parameterName }],
      body,
    });
  }

  if (!sawMatch) {
    return undefined;
  }

  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: ast,
        memberName: "Match",
      },
      arguments: lambdaArgs,
    },
    currentContext,
  ];
};

const maybeUpcastExpressionToExpectedTypeAst = (
  ast: CSharpExpressionAst,
  actualType: IrType | undefined,
  context: EmitterContext,
  expectedType: IrType | undefined,
  visited: ReadonlySet<string> = new Set<string>()
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (!actualType || !expectedType) return undefined;

  const exactComparisonTargetAst = tryEmitExactComparisonTargetAst(
    expectedType,
    context
  );
  if (
    exactComparisonTargetAst &&
    (isExactExpressionToType(
      ast,
      stripNullableTypeAst(exactComparisonTargetAst[0])
    ) ||
      isExactArrayCreationToType(ast, exactComparisonTargetAst[0]) ||
      isExactNullableValueAccessToType(ast, actualType, expectedType, context))
  ) {
    return [ast, exactComparisonTargetAst[1]];
  }

  const directValueSurfaceType = tryResolveDirectValueSurfaceType(ast, context);
  const preferredActualType = (() => {
    if (!directValueSurfaceType) {
      return actualType;
    }

    const [directLayout, directLayoutContext] = buildRuntimeUnionLayout(
      directValueSurfaceType,
      context,
      emitTypeAst
    );
    const [actualLayout] = buildRuntimeUnionLayout(
      actualType,
      directLayoutContext,
      emitTypeAst
    );

    const layoutsDiffer = (() => {
      if (!directLayout && !actualLayout) {
        return false;
      }
      if (!directLayout || !actualLayout) {
        return true;
      }
      if (
        directLayout.memberTypeAsts.length !==
        actualLayout.memberTypeAsts.length
      ) {
        return true;
      }
      return directLayout.memberTypeAsts.some((memberTypeAst, index) => {
        const other = actualLayout.memberTypeAsts[index];
        return !other || !sameTypeAstSurface(memberTypeAst, other);
      });
    })();

    if (layoutsDiffer) {
      return directValueSurfaceType;
    }

    return !areIrTypesEquivalent(directValueSurfaceType, actualType, context)
      ? directValueSurfaceType
      : actualType;
  })();

  const emissionActualType = unwrapEmissionComparableType(preferredActualType);
  const emissionExpectedType = unwrapEmissionComparableType(expectedType);
  const normalizedActualType = normalizeComparableType(
    preferredActualType,
    context
  );
  const normalizedExpectedType = normalizeComparableType(expectedType, context);

  const runtimeUnionLayoutsDiffer = (() => {
    const [actualLayout, actualLayoutContext] = buildRuntimeUnionLayout(
      emissionActualType,
      context,
      emitTypeAst
    );
    const [expectedLayout, expectedLayoutContext] = buildRuntimeUnionLayout(
      emissionExpectedType,
      actualLayoutContext,
      emitTypeAst
    );

    if (!actualLayout && !expectedLayout) {
      return false;
    }

    if (!actualLayout || !expectedLayout) {
      return true;
    }

    if (
      actualLayout.memberTypeAsts.length !==
      expectedLayout.memberTypeAsts.length
    ) {
      return true;
    }

    for (
      let index = 0;
      index < actualLayout.memberTypeAsts.length;
      index += 1
    ) {
      const actualMemberAst = actualLayout.memberTypeAsts[index];
      const expectedMemberAst = expectedLayout.memberTypeAsts[index];
      if (!actualMemberAst || !expectedMemberAst) {
        return true;
      }
      if (
        !sameTypeAstSurface(actualMemberAst, expectedMemberAst)
      ) {
        return true;
      }
      const actualMember = actualLayout.members[index];
      const expectedMember = expectedLayout.members[index];
      if (!actualMember || !expectedMember) {
        return true;
      }
      if (
        !areIrTypesEquivalent(
          normalizeComparableType(actualMember, expectedLayoutContext),
          normalizeComparableType(expectedMember, expectedLayoutContext),
          expectedLayoutContext
        )
      ) {
        return true;
      }
    }

    return false;
  })();

  const adapted = tryAdaptStructuralExpressionAst(
    ast,
    emissionActualType,
    context,
    emissionExpectedType
  );
  if (adapted) {
    return adapted;
  }

  if (
    areIrTypesEquivalent(
      normalizedActualType,
      normalizedExpectedType,
      context
    ) &&
    !runtimeUnionLayoutsDiffer
  ) {
    return [ast, context];
  }

  if (
    !runtimeUnionLayoutsDiffer &&
    canUseImplicitOptionalSurfaceConversion(
      emissionActualType,
      expectedType,
      context
    )
  ) {
    return [ast, context];
  }

  if (exactComparisonTargetAst) {
    const concreteExpectedTypeAst = stripNullableTypeAst(
      exactComparisonTargetAst[0]
    );
    if (isExactExpressionToType(ast, concreteExpectedTypeAst)) {
      return [ast, exactComparisonTargetAst[1]];
    }
  }

  const normalizedExpected = normalizedExpectedType;
  const visitKey = `${stableIrTypeKey(normalizedActualType)}=>${stableIrTypeKey(normalizedExpected)}`;
  if (visited.has(visitKey)) {
    return undefined;
  }
  const nextVisited = new Set(visited);
  nextVisited.add(visitKey);

  const projectedUnion = maybeProjectRuntimeUnionMemberExpressionAst(
    ast,
    emissionActualType,
    context,
    emissionExpectedType,
    nextVisited
  );
  if (projectedUnion) {
    return projectedUnion;
  }

  if (normalizedExpected.kind !== "unionType") {
    return undefined;
  }

  const widenedUnion = maybeWidenRuntimeUnionExpressionAst(
    ast,
    emissionActualType,
    context,
    emissionExpectedType,
    nextVisited
  );
  if (widenedUnion) {
    return widenedUnion;
  }

  const [actualRuntimeLayout] = buildRuntimeUnionLayout(
    emissionActualType,
    context,
    emitTypeAst
  );
  if (actualRuntimeLayout) {
    return undefined;
  }

  const [runtimeLayout, layoutContext] = buildRuntimeUnionLayout(
    emissionExpectedType,
    context,
    emitTypeAst
  );
  if (!runtimeLayout) {
    return undefined;
  }

  const [actualTypeAst, actualTypeContext] = emitTypeAst(
    emissionActualType,
    layoutContext
  );
  const actualTypeKey = stableTypeKeyFromAst(actualTypeAst);
  const normalizedActual = normalizeComparableType(
    emissionActualType,
    actualTypeContext
  );
  const actualSemanticKey = stableIrTypeKey(normalizedActual);

  const preferredIndices = new Set<number>();
  for (let index = 0; index < runtimeLayout.memberTypeAsts.length; index += 1) {
    const memberTypeAst = runtimeLayout.memberTypeAsts[index];
    if (!memberTypeAst) continue;
    if (stableTypeKeyFromAst(memberTypeAst) === actualTypeKey) {
      preferredIndices.add(index);
    }
    const member = runtimeLayout.members[index];
    if (
      member &&
      stableIrTypeKey(normalizeComparableType(member, actualTypeContext)) ===
        actualSemanticKey
    ) {
      preferredIndices.add(index);
    }
  }

  const candidateIndices = [
    ...preferredIndices,
    ...runtimeLayout.members
      .map((_, index) => index)
      .filter((index) => !preferredIndices.has(index))
      .sort((left, right) => {
        const leftScore = isObjectLikeTypeAst(
          runtimeLayout.memberTypeAsts[left]
        )
          ? 1
          : 0;
        const rightScore = isObjectLikeTypeAst(
          runtimeLayout.memberTypeAsts[right]
        )
          ? 1
          : 0;
        return leftScore - rightScore;
      }),
  ];

  for (const index of candidateIndices) {
    const member = runtimeLayout.members[index];
    if (!member) continue;

    const nested = maybeUpcastExpressionToExpectedTypeAst(
      ast,
      emissionActualType,
      layoutContext,
      member,
      nextVisited
    );
    if (!nested) continue;

    const unionTypeContext = nested[1];
    const concreteUnionTypeAst = buildRuntimeUnionTypeAst(runtimeLayout);

    return [
      buildRuntimeUnionFactoryCallAst(
        concreteUnionTypeAst,
        index + 1,
        nested[0]
      ),
      unionTypeContext,
    ];
  }

  return undefined;
};

const isCharIrType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) return false;
  const resolved = resolveTypeAlias(stripNullish(type), context);
  return (
    (resolved.kind === "primitiveType" && resolved.name === "char") ||
    (resolved.kind === "referenceType" && resolved.name === "char")
  );
};

const expectsStringIrType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) return false;
  const resolved = resolveTypeAlias(stripNullish(type), context);
  return (
    (resolved.kind === "primitiveType" && resolved.name === "string") ||
    (resolved.kind === "referenceType" &&
      (resolved.name === "string" || resolved.name === "String"))
  );
};

const isParameterlessToStringInvocation = (ast: CSharpExpressionAst): boolean =>
  ast.kind === "invocationExpression" &&
  ast.arguments.length === 0 &&
  ast.expression.kind === "memberAccessExpression" &&
  ast.expression.memberName === "ToString";

const maybeConvertCharToStringAst = (
  expr: IrExpression,
  ast: CSharpExpressionAst,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] => {
  if (!expectsStringIrType(expectedType, context)) return [ast, context];
  if (!isCharIrType(resolveEffectiveExpressionType(expr, context), context)) {
    return [ast, context];
  }
  if (isParameterlessToStringInvocation(ast)) return [ast, context];

  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: ast,
        memberName: "ToString",
      },
      arguments: [],
    },
    context,
  ];
};

const resolveDirectStorageExpressionType = (
  expr: IrExpression,
  ast: CSharpExpressionAst,
  context: EmitterContext
): IrType | undefined => {
  if (expr.kind !== "identifier" || ast.kind !== "identifierExpression") {
    return undefined;
  }

  const remappedLocal = context.localNameMap?.get(expr.name) ?? expr.name;
  if (ast.identifier !== remappedLocal) {
    return undefined;
  }

  const narrowed = context.narrowedBindings?.get(expr.name);
  if (
    narrowed?.kind === "expr" &&
    narrowed.storageExprAst?.kind === "identifierExpression" &&
    narrowed.storageExprAst.identifier === remappedLocal &&
    narrowed.sourceType
  ) {
    return narrowed.sourceType;
  }

  if (narrowed?.kind === "runtimeSubset" && narrowed.sourceType) {
    return narrowed.sourceType;
  }

  return context.localValueTypes?.get(expr.name);
};

const isExactCastToType = (
  ast: CSharpExpressionAst,
  targetType: CSharpTypeAst
): boolean =>
  ast.kind === "castExpression" &&
  sameTypeAstSurface(ast.type, targetType);

const isExactArrayCreationToType = (
  ast: CSharpExpressionAst,
  targetType: CSharpTypeAst
): boolean => {
  if (ast.kind !== "arrayCreationExpression") {
    return false;
  }

  const concreteTargetType = stripNullableTypeAst(targetType);
  return (
    concreteTargetType.kind === "arrayType" &&
    concreteTargetType.rank === 1 &&
    sameTypeAstSurface(ast.elementType, concreteTargetType.elementType)
  );
};

const isExactRuntimeUnionFactoryCallToType = (
  ast: CSharpExpressionAst,
  targetType: CSharpTypeAst
): boolean => {
  if (ast.kind !== "invocationExpression") {
    return false;
  }

  if (ast.expression.kind !== "memberAccessExpression") {
    return false;
  }

  if (!/^From[1-8]$/.test(ast.expression.memberName)) {
    return false;
  }

  if (ast.expression.expression.kind !== "typeReferenceExpression") {
    return false;
  }

  return (
    sameTypeAstSurface(ast.expression.expression.type, targetType)
  );
};

const isExactDefaultExpressionToType = (
  ast: CSharpExpressionAst,
  targetType: CSharpTypeAst
): boolean =>
  ast.kind === "defaultExpression" &&
  ast.type !== undefined &&
  sameTypeAstSurface(ast.type, targetType);

const isThrowExpressionToType = (ast: CSharpExpressionAst): boolean =>
  ast.kind === "throwExpression";

const isExactRuntimeUnionMatchToType = (
  ast: CSharpExpressionAst,
  targetType: CSharpTypeAst
): boolean => {
  if (ast.kind !== "invocationExpression") {
    return false;
  }

  if (
    ast.expression.kind !== "memberAccessExpression" ||
    ast.expression.memberName !== "Match"
  ) {
    return false;
  }

  if (ast.arguments.length === 0) {
    return false;
  }

  return ast.arguments.every((argument) => {
    if (argument.kind !== "lambdaExpression") {
      return false;
    }
    return (
      argument.body.kind !== "blockStatement" &&
      isExactExpressionToType(argument.body, targetType)
    );
  });
};

const isExactConditionalExpressionToType = (
  ast: CSharpExpressionAst,
  targetType: CSharpTypeAst
): boolean =>
  ast.kind === "conditionalExpression" &&
  isExactExpressionToType(ast.whenTrue, targetType) &&
  isExactExpressionToType(ast.whenFalse, targetType);

const isExactNullableValueAccessToType = (
  ast: CSharpExpressionAst,
  actualType: IrType,
  expectedType: IrType,
  context: EmitterContext
): boolean => {
  if (ast.kind !== "memberAccessExpression" || ast.memberName !== "Value") {
    return false;
  }

  const splitActual = splitRuntimeNullishUnionMembers(actualType);
  if (
    !splitActual?.hasRuntimeNullish ||
    splitActual.nonNullishMembers.length !== 1
  ) {
    return false;
  }

  const [baseMember] = splitActual.nonNullishMembers;
  if (!baseMember) {
    return false;
  }

  const resolvedBase = resolveTypeAlias(stripNullish(baseMember), context);
  const resolvedExpected = resolveTypeAlias(
    stripNullish(expectedType),
    context
  );
  return (
    isDefinitelyValueType(resolvedExpected) &&
    stableIrTypeKey(resolvedBase) === stableIrTypeKey(resolvedExpected)
  );
};

const isExactExpressionToType = (
  ast: CSharpExpressionAst,
  targetType: CSharpTypeAst
): boolean =>
  isThrowExpressionToType(ast) ||
  isExactObjectCreationToType(ast, targetType) ||
  isExactCastToType(ast, targetType) ||
  isExactRuntimeUnionFactoryCallToType(ast, targetType) ||
  isExactDefaultExpressionToType(ast, targetType) ||
  isExactRuntimeUnionMatchToType(ast, targetType) ||
  isExactConditionalExpressionToType(ast, targetType);

const isExactObjectCreationToType = (
  ast: CSharpExpressionAst,
  targetType: CSharpTypeAst
): boolean =>
  ast.kind === "objectCreationExpression" &&
  sameTypeAstSurface(ast.type, targetType);

const getNarrowedBindingForExpression = (
  expr: IrExpression,
  context: EmitterContext
) => {
  if (!context.narrowedBindings) {
    return undefined;
  }

  const narrowKey =
    expr.kind === "identifier"
      ? expr.name
      : expr.kind === "memberAccess"
        ? getMemberAccessNarrowKey(expr)
        : undefined;

  return narrowKey ? context.narrowedBindings.get(narrowKey) : undefined;
};

const tryResolveDirectValueSurfaceType = (
  ast: CSharpExpressionAst,
  context: EmitterContext
): IrType | undefined => {
  if (ast.kind !== "identifierExpression") {
    return undefined;
  }

  const direct = context.localValueTypes?.get(ast.identifier);
  if (direct) {
    return direct;
  }

  const originalName = Array.from(context.localNameMap ?? []).find(
    ([, emitted]) => emitted === ast.identifier
  )?.[0];
  return originalName ? context.localValueTypes?.get(originalName) : undefined;
};

const withoutNarrowedBinding = (
  expr: IrExpression,
  context: EmitterContext
): EmitterContext => {
  if (!context.narrowedBindings) {
    return context;
  }

  const narrowKey =
    expr.kind === "identifier"
      ? expr.name
      : expr.kind === "memberAccess"
        ? getMemberAccessNarrowKey(expr)
        : undefined;
  if (!narrowKey || !context.narrowedBindings.has(narrowKey)) {
    return context;
  }

  const narrowedBindings = new Map(context.narrowedBindings);
  narrowedBindings.delete(narrowKey);
  return {
    ...context,
    narrowedBindings,
  };
};

/**
 * Emit a numeric narrowing expression as CSharpExpressionAst.
 */
const emitNumericNarrowing = (
  expr: IrNumericNarrowingExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  if (expr.proof !== undefined) {
    if (expr.proof.source.type === "literal") {
      const [innerAst, newContext] = emitExpressionAst(
        expr.expression,
        context,
        expr.inferredType
      );
      return [innerAst, newContext];
    }

    const [innerAst, ctx1] = emitExpressionAst(expr.expression, context);
    const [typeAst, ctx2] = emitTypeAst(expr.inferredType, ctx1);
    return [
      {
        kind: "castExpression",
        type: typeAst,
        expression: innerAst,
      },
      ctx2,
    ];
  }

  throw new Error(
    `Internal error: numericNarrowing without proof reached emitter. ` +
      `Target: ${expr.targetKind}, Expression kind: ${expr.expression.kind}. ` +
      `This indicates a bug in the numeric proof pass - it should have ` +
      `emitted a diagnostic and aborted compilation.`
  );
};

/**
 * Emit a type assertion expression as CSharpExpressionAst.
 *
 * TypeScript `x as T` becomes C# `(T)x` (throwing cast).
 */
const emitTypeAssertion = (
  expr: IrTypeAssertionExpression,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  const isTransparentFlowAssertion = (() => {
    const inner = expr.expression;
    if (inner.kind !== "identifier" && inner.kind !== "memberAccess") {
      return false;
    }
    if (!expr.sourceSpan || !inner.sourceSpan) {
      return false;
    }
    return (
      expr.sourceSpan.file === inner.sourceSpan.file &&
      expr.sourceSpan.line === inner.sourceSpan.line &&
      expr.sourceSpan.column === inner.sourceSpan.column &&
      expr.sourceSpan.length === inner.sourceSpan.length
    );
  })();

  const resolveLocalTypeAliases = (target: IrType): IrType => {
    if (target.kind === "referenceType" && context.localTypes) {
      const typeInfo = context.localTypes.get(target.name);
      if (typeInfo?.kind === "typeAlias") {
        const substituted =
          target.typeArguments && target.typeArguments.length > 0
            ? substituteTypeArgs(
                typeInfo.type,
                typeInfo.typeParameters,
                target.typeArguments
              )
            : typeInfo.type;
        return resolveLocalTypeAliases(substituted);
      }
    }
    return target;
  };

  const shouldEraseTypeAssertion = (target: IrType): boolean => {
    const resolved = resolveLocalTypeAliases(target);

    if (isTypeOnlyStructuralTarget(resolved, context)) {
      return true;
    }

    if (resolved.kind === "unknownType") {
      return true;
    }

    if (resolved.kind === "referenceType" && resolved.typeArguments?.length) {
      const importBinding = context.importBindings?.get(resolved.name);
      const clrName =
        importBinding?.kind === "type"
          ? (getIdentifierTypeName(importBinding.typeAst) ?? "")
          : "";
      if (clrName.endsWith(".ExtensionMethods")) {
        return true;
      }
    }

    if (resolved.kind === "intersectionType") {
      return resolved.types.some(
        (t) => t.kind === "referenceType" && t.name.startsWith("__Ext_")
      );
    }

    return false;
  };

  if (shouldEraseTypeAssertion(expr.targetType)) {
    return emitExpressionAst(expr.expression, context, expectedType);
  }

  if (isTransparentFlowAssertion) {
    return emitExpressionAst(expr.expression, context, expectedType);
  }

  const runtimeEmissionTarget = resolveRuntimeMaterializationTargetType(
    expr.targetType,
    context
  );
  const rawSourceContext =
    expr.expression.kind === "identifier" ||
    expr.expression.kind === "memberAccess"
      ? withoutNarrowedBinding(expr.expression, context)
      : context;
  const innerExpectedType =
    expr.expression.kind === "identifier" ||
    expr.expression.kind === "memberAccess"
      ? undefined
      : runtimeEmissionTarget;
  const [innerAst, ctx1] = emitExpressionAst(
    expr.expression,
    rawSourceContext,
    innerExpectedType
  );
  const runtimeTarget = resolveRuntimeMaterializationTargetType(
    expr.targetType,
    ctx1
  );
  const transparentSourceExpression = unwrapTransparentExpression(
    expr.expression
  );
  const sourceExpressionType =
    transparentSourceExpression.kind === "identifier"
      ? (ctx1.localSemanticTypes?.get(transparentSourceExpression.name) ??
        transparentSourceExpression.inferredType)
      : transparentSourceExpression.inferredType;
  const isSourceUnion = sourceExpressionType
    ? isSemanticUnion(sourceExpressionType, ctx1)
    : false;
  const [sourceRuntimeUnionLayout, sourceLayoutContext] = isSourceUnion
    ? buildRuntimeUnionLayout(sourceExpressionType!, ctx1, emitTypeAst)
    : [undefined, ctx1];
  const narrowedBinding = getNarrowedBindingForExpression(
    expr.expression,
    sourceLayoutContext
  );
  const actualExpressionType =
    sourceRuntimeUnionLayout && narrowedBinding?.kind === "runtimeSubset"
      ? sourceExpressionType
      : resolveEffectiveExpressionType(expr.expression, sourceLayoutContext);
  const [
    runtimeTargetTypeAst,
    runtimeTargetUnionLayout,
    runtimeTargetTypeContext,
  ] = emitRuntimeCarrierTypeAst(
    runtimeTarget,
    sourceLayoutContext,
    emitTypeAst
  );
  const mustPreserveNominalCast =
    isSuperMemberCallExpression(expr.expression) ||
    isPolymorphicThisType(runtimeTarget);
  const mustPreserveFlowStorageCast =
    !!sourceExpressionType &&
    !sourceRuntimeUnionLayout &&
    !runtimeTargetUnionLayout &&
    !areIrTypesEquivalent(sourceExpressionType, runtimeTarget, ctx1);

  if (
    isExactExpressionToType(
      innerAst,
      stripNullableTypeAst(runtimeTargetTypeAst)
    )
  ) {
    return [innerAst, runtimeTargetTypeContext];
  }

  if (mustPreserveNominalCast || mustPreserveFlowStorageCast) {
    return [
      {
        kind: "castExpression",
        type: runtimeTargetTypeAst,
        expression: innerAst,
      },
      runtimeTargetTypeContext,
    ];
  }

  const adaptedUnionAst =
    maybeUpcastExpressionToExpectedTypeAst(
      innerAst,
      actualExpressionType,
      sourceLayoutContext,
      runtimeTarget
    ) ??
    tryAdaptStructuralExpressionAst(
      innerAst,
      actualExpressionType,
      sourceLayoutContext,
      runtimeTarget
    );
  if (adaptedUnionAst) {
    return adaptedUnionAst;
  }

  if (actualExpressionType) {
    const narrowedUnionAst = maybeNarrowRuntimeUnionExpressionAst(
      innerAst,
      actualExpressionType,
      sourceLayoutContext,
      runtimeTarget,
      new Set<string>()
    );
    if (narrowedUnionAst) {
      return narrowedUnionAst;
    }
  }

  return [
    {
      kind: "castExpression",
      type: runtimeTargetTypeAst,
      expression: innerAst,
    },
    runtimeTargetTypeContext,
  ];
};

/**
 * Emit an asinterface expression as CSharpExpressionAst.
 */
const emitAsInterface = (
  expr: IrAsInterfaceExpression,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  const expected = expectedType ?? expr.targetType;
  return emitExpressionAst(expr.expression, context, expected);
};

/**
 * Emit a trycast expression as CSharpExpressionAst.
 *
 * TypeScript `trycast<T>(x)` becomes C# `x as T` (safe cast).
 */
const emitTryCast = (
  expr: IrTryCastExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [innerAst, ctx1] = emitExpressionAst(expr.expression, context);
  const [typeAst, ctx2] = emitTypeAst(expr.targetType, ctx1);
  return [
    {
      kind: "asExpression",
      expression: innerAst,
      type: typeAst,
    },
    ctx2,
  ];
};

/**
 * Emit a stackalloc expression as CSharpExpressionAst.
 */
const emitStackAlloc = (
  expr: IrStackAllocExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [elementTypeAst, ctx1] = emitTypeAst(expr.elementType, context);
  const [sizeAst, ctx2] = emitExpressionAst(expr.size, ctx1, {
    kind: "primitiveType",
    name: "int",
  });
  return [
    {
      kind: "stackAllocArrayCreationExpression",
      elementType: elementTypeAst,
      sizeExpression: sizeAst,
    },
    ctx2,
  ];
};

/**
 * Emit a defaultof expression as CSharpExpressionAst.
 */
const emitDefaultOf = (
  expr: IrDefaultOfExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [typeAst, ctx1] = emitTypeAst(expr.targetType, context);
  return [
    {
      kind: "defaultExpression",
      type: typeAst,
    },
    ctx1,
  ];
};

/**
 * Emit a nameof expression as a compile-time string literal using the authored TS name.
 */
const emitNameOf = (
  expr: IrNameOfExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => [stringLiteral(expr.name), context];

/**
 * Emit a sizeof expression as C# sizeof(T).
 */
const emitSizeOf = (
  expr: IrSizeOfExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [typeAst, ctx1] = emitTypeAst(expr.targetType, context);
  return [
    {
      kind: "sizeOfExpression",
      type: typeAst,
    },
    ctx1,
  ];
};

/**
 * Emit a C# expression AST from an IR expression.
 * Primary entry point for expression emission.
 *
 * @param expr The IR expression to emit
 * @param context The emitter context
 * @param expectedType Optional expected type for contextual typing
 */
export const emitExpressionAst = (
  expr: IrExpression,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  const [ast, newContext] = (() => {
    switch (expr.kind) {
      case "literal":
        return emitLiteral(expr, context, expectedType);

      case "identifier":
        return emitIdentifier(expr, context, expectedType);

      case "array":
        return emitArray(expr, context, expectedType);

      case "object":
        return emitObject(expr, context, expectedType);

      case "memberAccess":
        return emitMemberAccess(expr, context, "value", expectedType);

      case "call":
        return emitCall(expr, context, expectedType);

      case "new":
        return emitNew(expr, context);

      case "binary":
        return emitBinary(expr, context, expectedType);

      case "logical":
        return emitLogical(expr, context);

      case "unary":
        return emitUnary(expr, context, expectedType);

      case "update":
        return emitUpdate(expr, context);

      case "assignment":
        return emitAssignment(expr, context);

      case "conditional":
        return emitConditional(expr, context, expectedType);

      case "functionExpression":
        return emitFunctionExpression(expr, context, expectedType);

      case "arrowFunction":
        return emitArrowFunction(expr, context, expectedType);

      case "templateLiteral":
        return emitTemplateLiteral(expr, context);

      case "spread":
        return emitSpread(expr, context);

      case "await":
        return emitAwait(expr, context);

      case "this":
        return [
          {
            kind: "identifierExpression" as const,
            identifier: context.objectLiteralThisIdentifier ?? "this",
          },
          context,
        ];

      case "numericNarrowing":
        return emitNumericNarrowing(expr, context);

      case "asinterface":
        return emitAsInterface(expr, context, expectedType);

      case "typeAssertion":
        return emitTypeAssertion(expr, context, expectedType);

      case "trycast":
        return emitTryCast(expr, context);

      case "stackalloc":
        return emitStackAlloc(expr, context);

      case "defaultof":
        return emitDefaultOf(expr, context);

      case "nameof":
        return emitNameOf(expr, context);

      case "sizeof":
        return emitSizeOf(expr, context);

      default:
        throw new Error(
          `Unhandled IR expression kind: ${String((expr as { kind?: unknown }).kind)}`
        );
    }
  })();

  const [castedAst, castedContext] = maybeCastNullishTypeParamAst(
    expr,
    ast,
    newContext,
    expectedType
  );
  const actualExprType =
    resolveDirectStorageExpressionType(expr, castedAst, castedContext) ??
    resolveEffectiveExpressionType(expr, castedContext);
  const [dictUpcastAst, dictUpcastContext] = maybeUpcastDictionaryUnionValueAst(
    expr,
    castedAst,
    castedContext,
    expectedType
  );
  const [unionAdjustedAst, unionAdjustedContext] =
    maybeUpcastExpressionToExpectedTypeAst(
      dictUpcastAst,
      actualExprType,
      dictUpcastContext,
      expectedType
    ) ?? [dictUpcastAst, dictUpcastContext];
  const adjustedExprType =
    unionAdjustedAst !== dictUpcastAst && expectedType
      ? expectedType
      : actualExprType;
  const [materializedAst, materializedContext] =
    tryAdaptStructuralExpressionAst(
      unionAdjustedAst,
      adjustedExprType,
      unionAdjustedContext,
      expectedType
    ) ?? [unionAdjustedAst, unionAdjustedContext];
  const [stringAdjustedAst, stringAdjustedContext] =
    maybeConvertCharToStringAst(
      expr,
      materializedAst,
      materializedContext,
      expectedType
    );
  return maybeUnwrapNullableValueTypeAst(
    expr,
    stringAdjustedAst,
    stringAdjustedContext,
    expectedType
  );
};

// Re-export commonly used functions from barrel
export { generateSpecializedName } from "./expressions/identifiers.js";
