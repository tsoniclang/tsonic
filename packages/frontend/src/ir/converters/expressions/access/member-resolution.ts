/**
 * Member access property type resolution and name extraction helpers
 *
 * All member type queries go through TypeSystem.typeOfMember().
 */

import {
  getTstsDeclaredTypeNode,
  getTstsIdentifierText,
  getTstsNodeText,
  TstsSyntax,
  type TstsNode,
} from "@tsonic/tsts";
import {
  IrType,
  ComputedAccessKind,
  ComputedAccessProtocol,
} from "../../../types.js";
import type { ProgramContext } from "../../../program-context.js";
import { getNumericKindFromIrType } from "../../../type-system/inference-utilities.js";
import { surfaceIncludesJs } from "../../../../surface/profiles.js";
import { getSourceSemanticIrType } from "../../../expression-converter-helpers.js";
import { addUndefinedToType } from "../../../type-system/type-system-state-helpers.js";

const memberHasExplicitUnknownAnnotation = (
  node: TstsNode,
  ctx: ProgramContext
): boolean => {
  const memberId = ctx.binding.resolvePropertyAccess(node);
  if (!memberId) {
    return false;
  }

  const typeNode = ctx.binding.getTypeNodeOfMember(memberId);
  return (
    !!typeNode &&
    typeof typeNode === "object" &&
    "Kind" in typeNode &&
    typeNode.Kind === TstsSyntax.KindUnknownKeyword
  );
};

const isCompilerGeneratedStructuralCarrier = (
  type: IrType | undefined
): boolean =>
  type?.kind === "referenceType" &&
  (type.name.startsWith("__Anon_") || type.name.startsWith("__Rest_"));

const hasExplicitStructuralReference = (type: IrType | undefined): boolean => {
  if (!type) return false;

  if (type.kind === "referenceType") {
    if (
      !isCompilerGeneratedStructuralCarrier(type) &&
      (type.structuralMembers?.length ?? 0) > 0
    ) {
      return true;
    }

    return false;
  }

  if (type.kind === "functionType") {
    return (
      type.parameters.some((parameter) =>
        hasExplicitStructuralReference(parameter.type)
      ) || hasExplicitStructuralReference(type.returnType)
    );
  }

  if (type.kind === "intersectionType" || type.kind === "unionType") {
    return type.types.some((member) => hasExplicitStructuralReference(member));
  }

  return false;
};

const hasInlineOrGeneratedStructuralCarrier = (
  type: IrType | undefined
): boolean => {
  if (!type) return false;

  if (type.kind === "objectType") {
    return type.members.length > 0;
  }

  if (isCompilerGeneratedStructuralCarrier(type)) {
    return true;
  }

  if (type.kind === "functionType") {
    return (
      type.parameters.some((parameter) =>
        hasInlineOrGeneratedStructuralCarrier(parameter.type)
      ) || hasInlineOrGeneratedStructuralCarrier(type.returnType)
    );
  }

  if (type.kind === "intersectionType" || type.kind === "unionType") {
    return type.types.some((member) =>
      hasInlineOrGeneratedStructuralCarrier(member)
    );
  }

  return false;
};

const getDirectStructuralMemberType = (
  receiverIrType: IrType | undefined,
  propertyName: string
): IrType | undefined => {
  const members =
    receiverIrType?.kind === "referenceType"
      ? receiverIrType.structuralMembers
      : receiverIrType?.kind === "objectType"
        ? receiverIrType.members
        : undefined;
  if (!members || members.length === 0) {
    return undefined;
  }

  const matchingMembers = members.filter(
    (member) => member.name === propertyName
  );
  if (matchingMembers.length === 0) {
    return undefined;
  }

  const methodMembers = matchingMembers.filter(
    (
      member
    ): member is Extract<
      (typeof matchingMembers)[number],
      { kind: "methodSignature" }
    > => member.kind === "methodSignature"
  );
  if (methodMembers.length > 0) {
    const callableTypes = methodMembers.map((member) => ({
      kind: "functionType" as const,
      typeParameters: member.typeParameters,
      parameters: member.parameters,
      returnType: member.returnType ?? { kind: "unknownType" as const },
    }));

    return callableTypes.length === 1
      ? callableTypes[0]
      : {
          kind: "intersectionType",
          types: callableTypes,
        };
  }

  const propertyMember = matchingMembers.find(
    (
      member
    ): member is Extract<
      (typeof matchingMembers)[number],
      { kind: "propertySignature" }
    > => member.kind === "propertySignature"
  );
  if (!propertyMember) {
    return undefined;
  }

  return propertyMember.isOptional
    ? addUndefinedToType(propertyMember.type)
    : propertyMember.type;
};

const hasStrongerNumericIntent = (
  candidate: IrType | undefined,
  current: IrType | undefined
): boolean => {
  if (!candidate || !current) {
    return false;
  }

  const candidateNumeric = getNumericKindFromIrType(candidate);
  const currentNumeric = getNumericKindFromIrType(current);
  if (candidateNumeric && currentNumeric) {
    return currentNumeric === "float64" && candidateNumeric !== "float64";
  }

  if (candidate.kind === "functionType" && current.kind === "functionType") {
    if (candidate.parameters.length !== current.parameters.length) {
      return false;
    }

    const candidateReturnNumeric = getNumericKindFromIrType(
      candidate.returnType
    );
    const currentReturnNumeric = getNumericKindFromIrType(current.returnType);
    if (
      candidateReturnNumeric &&
      currentReturnNumeric &&
      currentReturnNumeric === "float64" &&
      candidateReturnNumeric !== "float64"
    ) {
      return true;
    }

    return candidate.parameters.some((parameter, index) => {
      const currentParameter = current.parameters[index];
      return (
        currentParameter !== undefined &&
        hasStrongerNumericIntent(parameter.type, currentParameter.type)
      );
    });
  }

  return false;
};

const shouldPreferConcreteStructuralMemberType = (
  structuralMemberType: IrType | undefined,
  candidateMemberType: IrType | undefined,
  ctx: ProgramContext
): boolean => {
  if (!structuralMemberType || !candidateMemberType) {
    return false;
  }

  return (
    !ctx.typeSystem.containsTypeParameter(structuralMemberType) &&
    ctx.typeSystem.containsTypeParameter(candidateMemberType)
  );
};

const isUsableNamespaceSourceMemberType = (
  type: IrType | undefined
): type is IrType => {
  if (!type) return false;
  return type.kind !== "anyType" && type.kind !== "unknownType";
};

const getImportedSourceNamespaceMemberType = (
  node: TstsNode,
  ctx: ProgramContext
): IrType | undefined => {
  const target = ctx.binding.resolveImportedSourceNamespaceMember(node);
  if (!target) {
    return undefined;
  }

  const declarationTypeNode = getTstsDeclaredTypeNode(target.declaration);
  if (declarationTypeNode) {
    const declaredType = ctx.typeSystem.typeFromSyntax(
      ctx.binding.captureTypeSyntax(declarationTypeNode)
    );
    if (isUsableNamespaceSourceMemberType(declaredType)) {
      return declaredType;
    }
  }

  const semanticNode = TstsSyntax.Node_Name(target.declaration) ?? target.declaration;
  const semanticType = getSourceSemanticIrType(
    ctx.sourceSemantics.getExpressionType(semanticNode),
    semanticNode,
    ctx
  );
  return isUsableNamespaceSourceMemberType(semanticType)
    ? semanticType
    : undefined;
};

export const hasDeclaredMemberByName = (
  receiverIrType: IrType | undefined,
  propertyName: string,
  _ctx: ProgramContext
): boolean => {
  if (!receiverIrType || receiverIrType.kind === "unknownType") return false;

  if (receiverIrType.kind === "objectType") {
    return receiverIrType.members.some(
      (member) => member.name === propertyName
    );
  }

  if (
    receiverIrType.kind === "referenceType" &&
    receiverIrType.structuralMembers &&
    receiverIrType.structuralMembers.length > 0
  ) {
    return receiverIrType.structuralMembers.some(
      (member) => member.name === propertyName
    );
  }

  return false;
};

/**
 * Get the declared property type from a property access expression.
 *
 * Uses explicit TypeSystem queries only.
 * Prefer exact member-handle typing when Binding resolved the property access to a
 * concrete declaration; otherwise use receiver+member TypeSystem lookup.
 *
 * @param node - Property access expression node
 * @param receiverIrType - Already-computed IR type of the receiver (object) expression
 * @param ctx - ProgramContext for type system and binding access
 * @returns The deterministically computed property type
 */
export const getDeclaredPropertyType = (
  node: TstsNode,
  receiverIrType: IrType | undefined,
  ctx: ProgramContext
): IrType | undefined => {
  const propertyName = getTstsIdentifierText(TstsSyntax.Node_Name(node)) ?? "";

  const typeSystem = ctx.typeSystem;
  const directStructuralMemberType = getDirectStructuralMemberType(
    receiverIrType,
    propertyName
  );
  const receiverMemberType =
    receiverIrType && receiverIrType.kind !== "unknownType"
      ? typeSystem.typeOfMember(receiverIrType, {
          kind: "byName",
          name: propertyName,
        })
      : undefined;
  const memberId = ctx.binding.resolvePropertyAccess(node);
  if (memberId) {
    const exactMemberType = typeSystem.typeOfMemberId(memberId, receiverIrType);
    if (
      exactMemberType.kind !== "unknownType" &&
      directStructuralMemberType &&
      hasExplicitStructuralReference(directStructuralMemberType) &&
      hasInlineOrGeneratedStructuralCarrier(exactMemberType) &&
      typeSystem.isAssignableTo(exactMemberType, directStructuralMemberType) &&
      typeSystem.isAssignableTo(directStructuralMemberType, exactMemberType)
    ) {
      return directStructuralMemberType;
    }
    if (
      exactMemberType.kind !== "unknownType" &&
      shouldPreferConcreteStructuralMemberType(
        directStructuralMemberType,
        exactMemberType,
        ctx
      )
    ) {
      return directStructuralMemberType;
    }
    if (exactMemberType.kind !== "unknownType") {
      if (hasStrongerNumericIntent(receiverMemberType, exactMemberType)) {
        return receiverMemberType;
      }
      return exactMemberType;
    }
    if (memberHasExplicitUnknownAnnotation(node, ctx)) {
      return exactMemberType;
    }
  }

  const importedSourceNamespaceMemberType =
    getImportedSourceNamespaceMemberType(node, ctx);
  if (importedSourceNamespaceMemberType) {
    return importedSourceNamespaceMemberType;
  }

  if (directStructuralMemberType) {
    return directStructuralMemberType;
  }

  if (receiverIrType && receiverIrType.kind !== "unknownType") {
    const memberType = receiverMemberType;
    // If TypeSystem returned a valid type (not unknownType), use it
    if (memberType && memberType.kind !== "unknownType") {
      if (
        shouldPreferConcreteStructuralMemberType(
          directStructuralMemberType,
          memberType,
          ctx
        )
      ) {
        return directStructuralMemberType;
      }
      return memberType;
    }
    if (hasDeclaredMemberByName(receiverIrType, propertyName, ctx)) {
      return memberType;
    }
  }
  return undefined;
};

/**
 * Normalize a receiver type for computed access classification.
 *
 * This supports common TS shapes that appear at runtime:
 * - Nullish unions (`T | undefined` / `T | null | undefined`)
 * - tsbindgen-style intersection views (`T$instance & __T$views`, and primitives like
 *   `string & String$instance & __String$views`)
 *
 * The goal is to preserve deterministic proof behavior.
 */
export const normalizeForComputedAccess = (
  type: IrType | undefined
): IrType | undefined => {
  if (!type) return undefined;

  if (type.kind === "unionType") {
    const nonNullish = type.types.filter(
      (t) =>
        !(
          t.kind === "primitiveType" &&
          (t.name === "null" || t.name === "undefined")
        )
    );
    if (nonNullish.length === 1) {
      const only = nonNullish[0];
      return only ? normalizeForComputedAccess(only) : undefined;
    }
  }

  if (type.kind === "intersectionType") {
    const pick =
      type.types.find((t) => t.kind === "arrayType") ??
      type.types.find((t) => t.kind === "dictionaryType") ??
      type.types.find(
        (t) => t.kind === "primitiveType" && t.name === "string"
      ) ??
      type.types.find((t) => t.kind === "referenceType");

    return pick ? normalizeForComputedAccess(pick) : type;
  }

  return type;
};

const isNullishType = (type: IrType): boolean =>
  type.kind === "primitiveType" &&
  (type.name === "null" || type.name === "undefined");

const getNonNullishUnionTypes = (type: IrType): readonly IrType[] =>
  type.kind === "unionType"
    ? type.types.filter((member) => !isNullishType(member))
    : [type];

const computedAccessRecursionKey = (type: IrType, depth = 0): string => {
  if (depth > 4) {
    return `${type.kind}:*`;
  }

  switch (type.kind) {
    case "primitiveType":
      return `primitive:${type.name}`;
    case "literalType":
      return `literal:${JSON.stringify(type.value)}`;
    case "typeParameterType":
      return `typeParameter:${type.name}`;
    case "anyType":
    case "unknownType":
    case "voidType":
    case "neverType":
      return type.kind;
    case "arrayType":
      return `array:${computedAccessRecursionKey(type.elementType, depth + 1)}`;
    case "tupleType":
      return `tuple:${type.elementTypes.length}`;
    case "dictionaryType":
      return `dictionary:${computedAccessRecursionKey(type.keyType, depth + 1)}:${computedAccessRecursionKey(type.valueType, depth + 1)}`;
    case "referenceType": {
      const typeId = type.typeId?.stableId ?? type.typeId?.symbolId;
      const symbolId = type.symbolId;
      const qualifiedName = type.providerQualifiedName ?? type.name;
      return `reference:${typeId ?? symbolId ?? qualifiedName}:${type.typeArguments?.length ?? 0}`;
    }
    case "unionType":
    case "intersectionType":
      return `${type.kind}:${type.types
        .map((member) => computedAccessRecursionKey(member, depth + 1))
        .sort()
        .join("|")}`;
    case "functionType":
      return `function:${type.parameters.length}`;
    case "objectType":
      return `object:${type.members
        .map((member) => member.name)
        .sort()
        .join("|")}`;
  }
};

const collectComputedAccessCarrierCandidates = (
  type: IrType,
  ctx: ProgramContext
): readonly IrType[] => {
  if (type.kind !== "referenceType") {
    return [type];
  }

  const expanded = ctx.typeSystem.collectNarrowingCandidates(type);
  return expanded.length > 0 ? expanded : [type];
};

const isNumericIndexerKeyType = (keyType: IrType): boolean =>
  getNumericKindFromIrType(keyType) !== undefined;

const INT_IR_TYPE: IrType = { kind: "primitiveType", name: "int" };

const getCallableSignatures = (
  type: IrType | undefined
): readonly Extract<IrType, { kind: "functionType" }>[] => {
  if (!type) {
    return [];
  }

  if (type.kind === "functionType") {
    return [type];
  }

  if (type.kind === "intersectionType") {
    return type.types.filter(
      (member): member is Extract<IrType, { kind: "functionType" }> =>
        member.kind === "functionType"
    );
  }

  return [];
};

const stripUndefinedFromType = (type: IrType): IrType => {
  if (type.kind !== "unionType") {
    return type;
  }

  const nonUndefined = type.types.filter(
    (member) =>
      !(member.kind === "primitiveType" && member.name === "undefined")
  );

  if (nonUndefined.length === 1 && nonUndefined[0]) {
    return nonUndefined[0];
  }

  return {
    kind: "unionType",
    types: nonUndefined,
  };
};

const hasGetterProtocol = (
  objectType: IrType,
  indexerValueType: IrType,
  ctx: ProgramContext
): boolean => {
  const memberType = ctx.typeSystem.tryTypeOfMember(objectType, {
    kind: "byName",
    name: "at",
  });

  return getCallableSignatures(memberType).some((signature) => {
    const [indexParam] = signature.parameters;
    if (!indexParam?.type) {
      return false;
    }

    if (!ctx.typeSystem.isAssignableTo(INT_IR_TYPE, indexParam.type)) {
      return false;
    }

    const returnType = stripUndefinedFromType(signature.returnType);
    const getterReturnNumericKind = getNumericKindFromIrType(returnType);
    const indexerValueNumericKind = getNumericKindFromIrType(indexerValueType);
    return (
      ctx.typeSystem.isAssignableTo(indexerValueType, returnType) ||
      ctx.typeSystem.typesEqual(indexerValueType, returnType) ||
      (getterReturnNumericKind !== undefined &&
        indexerValueNumericKind !== undefined)
    );
  });
};

const hasSetterProtocol = (
  objectType: IrType,
  indexerValueType: IrType,
  ctx: ProgramContext
): boolean => {
  const memberType = ctx.typeSystem.tryTypeOfMember(objectType, {
    kind: "byName",
    name: "set",
  });

  return getCallableSignatures(memberType).some((signature) => {
    const [indexParam, valueParam] = signature.parameters;
    if (!indexParam?.type || !valueParam?.type) {
      return false;
    }

    if (!ctx.typeSystem.isAssignableTo(INT_IR_TYPE, indexParam.type)) {
      return false;
    }

    const setterValueNumericKind = getNumericKindFromIrType(valueParam.type);
    const indexerValueNumericKind = getNumericKindFromIrType(indexerValueType);

    return (
      ctx.typeSystem.isAssignableTo(indexerValueType, valueParam.type) ||
      ctx.typeSystem.isAssignableTo(valueParam.type, indexerValueType) ||
      ctx.typeSystem.typesEqual(indexerValueType, valueParam.type) ||
      (setterValueNumericKind !== undefined &&
        indexerValueNumericKind !== undefined)
    );
  });
};

export const resolveComputedAccessProtocol = (
  objectType: IrType | undefined,
  ctx: ProgramContext
): ComputedAccessProtocol | undefined => {
  const normalized = normalizeForComputedAccess(objectType);
  if (!normalized || normalized.kind !== "referenceType") {
    return undefined;
  }

  const indexer = ctx.typeSystem.getIndexerInfo(normalized);
  if (!indexer || !isNumericIndexerKeyType(indexer.keyType)) {
    return undefined;
  }

  if (!hasGetterProtocol(normalized, indexer.valueType, ctx)) {
    return undefined;
  }

  return hasSetterProtocol(normalized, indexer.valueType, ctx)
    ? { getterMember: "at", setterMember: "set" }
    : { getterMember: "at" };
};

/**
 * Classify computed member access for proof pass.
 * This determines whether source-int proof is required for the index.
 *
 * Classification is based on IR type kinds, NOT string matching.
 * Positional indexers (arrays, lists, spans, buffers, etc.) require int proof.
 *
 * IMPORTANT: If classification cannot be determined reliably for a external-bound
 * reference type, we conservatively assume `numericIndexer` (requires source-int proof).
 * This is safer than allowing arbitrary dictionary access without proof.
 *
 * @param objectType - The inferred type of the object being accessed
 * @returns The access kind classification
 */
export const classifyComputedAccess = (
  objectType: IrType | undefined,
  ctx: ProgramContext
): ComputedAccessKind =>
  classifyComputedAccessWorker(objectType, ctx, new Set<string>());

const classifyComputedAccessWorker = (
  objectType: IrType | undefined,
  ctx: ProgramContext,
  seen: ReadonlySet<string>
): ComputedAccessKind => {
  const normalized = normalizeForComputedAccess(objectType);
  if (!normalized) return "unknown";
  objectType = normalized;
  const visitKey = computedAccessRecursionKey(objectType);
  if (seen.has(visitKey)) {
    return "unknown";
  }
  const nextSeen = new Set(seen);
  nextSeen.add(visitKey);

  if (objectType.kind === "unionType") {
    const memberKinds = getNonNullishUnionTypes(objectType).map((member) =>
      classifyComputedAccessWorker(member, ctx, nextSeen)
    );
    if (memberKinds.length === 0 || memberKinds.includes("unknown")) {
      return "unknown";
    }

    const firstKind = memberKinds[0];
    if (firstKind && memberKinds.every((kind) => kind === firstKind)) {
      return firstKind;
    }

    return "unknown";
  }

  // TypeScript array type (number[], T[], etc.)
  // Requires source-int proof
  if (objectType.kind === "arrayType") {
    return "numericIndexer";
  }

  if (objectType.kind === "tupleType") {
    return "numericIndexer";
  }

  // IR dictionary type - this is the PRIMARY way to detect dictionaries
  // tsbindgen should emit dictionaryType for Record<K,V> and {[key: K]: V}
  if (objectType.kind === "dictionaryType") {
    return "dictionary";
  }

  // String character access: string[int]
  if (objectType.kind === "primitiveType" && objectType.name === "string") {
    return "stringChar";
  }

  if (objectType.kind === "referenceType") {
    const expandedCarriers = collectComputedAccessCarrierCandidates(
      objectType,
      ctx
    );
    if (
      expandedCarriers.length !== 1 ||
      !ctx.typeSystem.typesEqual(expandedCarriers[0]!, objectType)
    ) {
      const carrierKinds = expandedCarriers.map((candidate) =>
        classifyComputedAccessWorker(candidate, ctx, nextSeen)
      );
      const firstKind = carrierKinds[0];
      if (
        firstKind &&
        carrierKinds.every((candidateKind) => candidateKind === firstKind)
      ) {
        return firstKind;
      }
    }

    const indexer = ctx.typeSystem.getIndexerInfo(objectType);
    if (!indexer) return "numericIndexer";
    return isNumericIndexerKeyType(indexer.keyType)
      ? "numericIndexer"
      : "dictionary";
  }

  return "unknown";
};

/**
 * Extract the type name from an inferred type for binding lookup.
 * Handles tsbindgen's naming convention where instance types are suffixed with $instance
 * (e.g., List_1$instance → List_1 for binding lookup)
 *
 * Also handles intersection types like `TypeName$instance & __TypeName$views`
 * which are common in tsbindgen-generated types. In this case, we look for
 * the $instance member and extract the type name from it.
 */
export const extractTypeName = (
  inferredType: IrType | undefined
): string | undefined => {
  if (!inferredType) return undefined;

  // Handle common nullish unions like `Uri | undefined` by stripping null/undefined.
  // This enables native target member binding after explicit null checks in source code.
  if (inferredType.kind === "unionType") {
    const nonNullish = inferredType.types.filter(
      (t) =>
        !(
          t.kind === "primitiveType" &&
          (t.name === "null" || t.name === "undefined")
        )
    );
    if (nonNullish.length === 1) {
      const only = nonNullish[0];
      return only ? extractTypeName(only) : undefined;
    }

    if (nonNullish.length > 1) {
      const extractedNames = nonNullish
        .map((part) => extractTypeName(part))
        .filter((name): name is string => typeof name === "string");

      if (extractedNames.length !== nonNullish.length) {
        return undefined;
      }

      const uniqueNames = [...new Set(extractedNames)];
      if (uniqueNames.length === 1) {
        return uniqueNames[0];
      }
    }
  }

  if (inferredType.kind === "primitiveType") {
    return undefined;
  }

  if (inferredType.kind === "literalType") {
    return undefined;
  }

  if (inferredType.kind === "referenceType") {
    const name = inferredType.name;

    // Strip $instance suffix from tsbindgen-generated type names
    // e.g., "List_1$instance" → "List_1" for binding lookup
    if (name.endsWith("$instance")) {
      return name.slice(0, -"$instance".length);
    }

    return name;
  }

  // Treat TS arrays as Array for binding lookup so surface packages can
  // bind Array<T> members declaratively (no compiler hardcoding).
  if (inferredType.kind === "arrayType") {
    return "Array";
  }

  // Handle intersection types: TypeName$instance & __TypeName$views
  // This happens when TypeScript expands a type alias to its underlying intersection
  // during property access (e.g., listener.prefixes returns HttpListenerPrefixCollection
  // which is HttpListenerPrefixCollection$instance & __HttpListenerPrefixCollection$views)
  if (inferredType.kind === "intersectionType") {
    // Look for a member that ends with $instance - that's the main type
    for (const member of inferredType.types) {
      if (
        member.kind === "referenceType" &&
        member.name.endsWith("$instance")
      ) {
        // Found the $instance member, strip the suffix to get the type name
        return member.name.slice(0, -"$instance".length);
      }
    }

    // Fallback: look for any referenceType that's not a $views type
    for (const member of inferredType.types) {
      if (
        member.kind === "referenceType" &&
        !member.name.startsWith("__") &&
        !member.name.endsWith("$views")
      ) {
        return member.name;
      }
    }
  }

  return undefined;
};

/**
 * Derive element type from object type for element access.
 * - Array type → element type
 * - Dictionary type → value type
 * - String → string (single character)
 * - Other → undefined
 */
export const deriveElementType = (
  objectType: IrType | undefined,
  ctx: ProgramContext,
  accessExpression?: TstsNode
): IrType | undefined =>
  deriveElementTypeWorker(
    objectType,
    ctx,
    accessExpression,
    new Set<string>()
  );

const deriveElementTypeWorker = (
  objectType: IrType | undefined,
  ctx: ProgramContext,
  accessExpression: TstsNode | undefined,
  seen: ReadonlySet<string>
): IrType | undefined => {
  objectType = normalizeForComputedAccess(objectType);
  if (!objectType) return undefined;
  const visitKey = computedAccessRecursionKey(objectType);
  if (seen.has(visitKey)) {
    return undefined;
  }
  const nextSeen = new Set(seen);
  nextSeen.add(visitKey);

  if (objectType.kind === "unionType") {
    const elementTypes: IrType[] = [];
    for (const member of getNonNullishUnionTypes(objectType)) {
      const elementType = deriveElementTypeWorker(
        member,
        ctx,
        accessExpression,
        nextSeen
      );
      if (!elementType) {
        return undefined;
      }
      if (
        !elementTypes.some(
          (existing) =>
            ctx.typeSystem.typesEqual(existing, elementType) ||
            (ctx.typeSystem.isAssignableTo(existing, elementType) &&
              ctx.typeSystem.isAssignableTo(elementType, existing))
        )
      ) {
        elementTypes.push(elementType);
      }
    }

    if (elementTypes.length === 0) {
      return undefined;
    }

    if (elementTypes.length === 1) {
      return elementTypes[0];
    }

    return { kind: "unionType", types: elementTypes };
  }

  if (objectType.kind === "arrayType") {
    return objectType.elementType;
  }

  if (objectType.kind === "dictionaryType") {
    return objectType.valueType;
  }

  if (objectType.kind === "tupleType") {
    if (
      accessExpression &&
      accessExpression.Kind === TstsSyntax.KindNumericLiteral &&
      Number.isInteger(Number(getTstsNodeText(accessExpression)))
    ) {
      const elementType =
        objectType.elementTypes[Number(getTstsNodeText(accessExpression))];
      if (elementType) {
        return elementType;
      }
    }

    if (objectType.elementTypes.length === 0) {
      return undefined;
    }

    if (objectType.elementTypes.length === 1) {
      return objectType.elementTypes[0];
    }

    return {
      kind: "unionType",
      types: objectType.elementTypes,
    };
  }

  if (objectType.kind === "primitiveType" && objectType.name === "string") {
    return {
      kind: "primitiveType",
      name: surfaceIncludesJs(ctx.surfaceCapabilities) ? "string" : "char",
    };
  }

  if (
    objectType.kind === "referenceType" &&
    objectType.name === "Span" &&
    objectType.typeArguments &&
    objectType.typeArguments.length === 1
  ) {
    return objectType.typeArguments[0];
  }

  if (objectType.kind === "referenceType") {
    const expandedCarriers = collectComputedAccessCarrierCandidates(
      objectType,
      ctx
    );
    if (
      expandedCarriers.length !== 1 ||
      !ctx.typeSystem.typesEqual(expandedCarriers[0]!, objectType)
    ) {
      const elementTypes: IrType[] = [];
      for (const candidate of expandedCarriers) {
        const elementType = deriveElementTypeWorker(
          candidate,
          ctx,
          accessExpression,
          nextSeen
        );
        if (!elementType) {
          return undefined;
        }
        if (
          !elementTypes.some(
            (existing) =>
              ctx.typeSystem.typesEqual(existing, elementType) ||
              (ctx.typeSystem.isAssignableTo(existing, elementType) &&
                ctx.typeSystem.isAssignableTo(elementType, existing))
          )
        ) {
          elementTypes.push(elementType);
        }
      }

      if (elementTypes.length === 1) {
        return elementTypes[0];
      }

      if (elementTypes.length > 1) {
        return { kind: "unionType", types: elementTypes };
      }
    }

    return ctx.typeSystem.getIndexerInfo(objectType)?.valueType;
  }

  return undefined;
};
