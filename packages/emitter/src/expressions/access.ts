/**
 * Member access expression emitters
 */

import { IrExpression, stableIrTypeKey, type IrType } from "@tsonic/frontend";
import type { NarrowedBinding } from "../types.js";
import { EmitterContext } from "../types.js";
import { emitExpressionAst } from "../expression-emitter.js";
import {
  isExplicitViewProperty,
  extractInterfaceNameFromView,
} from "@tsonic/frontend/types/explicit-views.js";
import { emitTypeAst } from "../type-emitter.js";
import {
  getPropertyType,
  resolveTypeAlias,
  stripNullish,
  getAllPropertySignatures,
  hasDeterministicPropertyMembership,
  normalizeStructuralEmissionType,
  resolveLocalTypeInfo,
  resolveStructuralReferenceType,
  getArrayLikeElementType,
} from "../core/semantic/type-resolution.js";
import { emitCSharpName } from "../naming-policy.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import {
  identifierExpression,
  identifierType,
  nullLiteral,
  stringLiteral,
} from "../core/format/backend-ast/builders.js";
import {
  extractCalleeNameFromAst,
  getIdentifierTypeLeafName,
  getIdentifierTypeName,
  stableTypeKeyFromAst,
} from "../core/format/backend-ast/utils.js";
import { getMemberAccessNarrowKey } from "../core/semantic/narrowing-keys.js";
import {
  buildRuntimeUnionFrame,
  getRuntimeUnionReferenceMembers,
  isRuntimeUnionTypeName,
} from "../core/semantic/runtime-unions.js";
import { isSemanticUnion } from "../core/semantic/union-semantics.js";
import { tryBuildRuntimeReificationPlan } from "../core/semantic/runtime-reification.js";
import { resolveEffectiveExpressionType } from "../core/semantic/narrowed-expression-types.js";
import { matchesExpectedEmissionType } from "../core/semantic/expected-type-matching.js";
import { normalizeRuntimeStorageType } from "../core/semantic/storage-types.js";
import { isAssignable } from "../core/semantic/index.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";

// ============================================================================
// CONTRACT: Emitter ONLY consumes proof markers.
// ============================================================================

/**
 * Check if an expression has proven Int32 type from the numeric proof pass.
 */
const hasInt32Proof = (expr: IrExpression): boolean => {
  if (
    expr.inferredType?.kind === "primitiveType" &&
    expr.inferredType.name === "int"
  ) {
    return true;
  }

  if (
    expr.inferredType?.kind === "referenceType" &&
    expr.inferredType.name === "int"
  ) {
    return true;
  }

  return false;
};

type MemberAccessUsage = "value" | "call";

type MemberAccessBucket = "methods" | "properties" | "fields" | "enumMembers";

const bucketFromMemberKind = (kind: string): MemberAccessBucket => {
  switch (kind) {
    case "method":
      return "methods";
    case "field":
      return "fields";
    case "enumMember":
      return "enumMembers";
    default:
      return "properties";
  }
};

const stripGlobalPrefix = (name: string): string =>
  name.startsWith("global::") ? name.slice("global::".length) : name;

const stripClrGenericArity = (typeName: string): string =>
  typeName.replace(/`\d+$/, "");

const createStringLiteralExpression = (value: string): CSharpExpressionAst =>
  stringLiteral(value);

const unwrapNullableTypeAst = (typeAst: CSharpTypeAst): CSharpTypeAst =>
  typeAst.kind === "nullableType" ? typeAst.underlyingType : typeAst;

const isObjectTypeAst = (typeAst: CSharpTypeAst): boolean => {
  const concrete = unwrapNullableTypeAst(typeAst);
  if (concrete.kind === "predefinedType") {
    return concrete.keyword === "object";
  }
  if (concrete.kind === "identifierType") {
    const normalized = concrete.name.replace(/^global::/, "");
    return normalized === "object" || normalized === "System.Object";
  }
  if (concrete.kind === "qualifiedIdentifierType") {
    const qualifier = concrete.name.aliasQualifier
      ? `${concrete.name.aliasQualifier}::`
      : "";
    const printed = `${qualifier}${concrete.name.segments.join(".")}`.replace(
      /^global::/,
      ""
    );
    return printed === "System.Object";
  }
  return false;
};

const isPlainObjectIrType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) return false;
  const resolved = resolveTypeAlias(stripNullish(type), context);
  return resolved.kind === "referenceType" && resolved.name === "object";
};

const looksLikeTypeParameterName = (name: string): boolean =>
  /^T($|[A-Z0-9_])/.test(name);

const eraseOutOfScopeArrayWrapperTypeParameters = (
  typeAst: CSharpTypeAst,
  context: EmitterContext
): CSharpTypeAst => {
  switch (typeAst.kind) {
    case "identifierType": {
      if (
        !typeAst.name.includes(".") &&
        !typeAst.name.includes("::") &&
        (context.typeParameters?.has(typeAst.name) ?? false) === false &&
        looksLikeTypeParameterName(typeAst.name)
      ) {
        return identifierType("object");
      }

      if (!typeAst.typeArguments || typeAst.typeArguments.length === 0) {
        return typeAst;
      }

      return {
        ...typeAst,
        typeArguments: typeAst.typeArguments.map((arg) =>
          eraseOutOfScopeArrayWrapperTypeParameters(arg, context)
        ),
      };
    }

    case "arrayType":
      return {
        ...typeAst,
        elementType: eraseOutOfScopeArrayWrapperTypeParameters(
          typeAst.elementType,
          context
        ),
      };

    case "nullableType":
      return {
        ...typeAst,
        underlyingType: eraseOutOfScopeArrayWrapperTypeParameters(
          typeAst.underlyingType,
          context
        ),
      };

    default:
      return typeAst;
  }
};

const emitArrayWrapperElementTypeAst = (
  receiverType: IrType | undefined,
  fallbackElementType: IrType,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  const storageReceiverType = normalizeRuntimeStorageType(
    receiverType,
    context
  );
  const resolvedReceiverType = storageReceiverType
    ? resolveTypeAlias(stripNullish(storageReceiverType), context)
    : undefined;

  if (resolvedReceiverType?.kind === "arrayType") {
    const [elementTypeAst, nextContext] = emitTypeAst(
      resolvedReceiverType.elementType,
      context
    );
    return [
      eraseOutOfScopeArrayWrapperTypeParameters(elementTypeAst, nextContext),
      nextContext,
    ];
  }

  if (
    resolvedReceiverType?.kind === "referenceType" &&
    (resolvedReceiverType.name === "Array" ||
      resolvedReceiverType.name === "ReadonlyArray") &&
    resolvedReceiverType.typeArguments?.length === 1
  ) {
    const elementType = resolvedReceiverType.typeArguments[0];
    if (elementType) {
      const [elementTypeAst, nextContext] = emitTypeAst(elementType, context);
      return [
        eraseOutOfScopeArrayWrapperTypeParameters(elementTypeAst, nextContext),
        nextContext,
      ];
    }
  }

  const [elementTypeAst, nextContext] = emitTypeAst(
    fallbackElementType,
    context
  );
  return [
    eraseOutOfScopeArrayWrapperTypeParameters(elementTypeAst, nextContext),
    nextContext,
  ];
};

const emitStorageCompatibleArrayWrapperElementTypeAst = (
  receiverExpr: IrExpression,
  receiverType: IrType | undefined,
  fallbackElementType: IrType,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  const [storageReceiverTypeAst, storageContext] =
    resolveEmittedReceiverTypeAst(receiverExpr, context);
  const concreteStorageReceiverTypeAst = storageReceiverTypeAst
    ? unwrapNullableTypeAst(storageReceiverTypeAst)
    : undefined;

  if (concreteStorageReceiverTypeAst?.kind === "arrayType") {
    return [
      eraseOutOfScopeArrayWrapperTypeParameters(
        concreteStorageReceiverTypeAst.elementType,
        storageContext
      ),
      storageContext,
    ];
  }

  if (
    concreteStorageReceiverTypeAst?.kind === "identifierType" &&
    (concreteStorageReceiverTypeAst.name === "global::System.Array" ||
      concreteStorageReceiverTypeAst.name === "System.Array") &&
    concreteStorageReceiverTypeAst.typeArguments?.length === 1
  ) {
    const [elementTypeAst] = concreteStorageReceiverTypeAst.typeArguments;
    if (elementTypeAst) {
      return [
        eraseOutOfScopeArrayWrapperTypeParameters(
          elementTypeAst,
          storageContext
        ),
        storageContext,
      ];
    }
  }

  return emitArrayWrapperElementTypeAst(
    receiverType,
    fallbackElementType,
    storageContext
  );
};

const maybeReifyErasedArrayElement = (
  accessAst: CSharpExpressionAst,
  receiverExpr: IrExpression,
  desiredType: IrType | undefined,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const normalizedDesiredType =
    desiredType && desiredType.kind === "objectType"
      ? (resolveStructuralReferenceType(desiredType, context) ?? desiredType)
      : desiredType;

  if (
    !normalizedDesiredType ||
    isPlainObjectIrType(normalizedDesiredType, context)
  ) {
    return [accessAst, context];
  }

  const [receiverTypeAst, receiverTypeContext] = resolveEmittedReceiverTypeAst(
    receiverExpr,
    context
  );
  if (!receiverTypeAst) {
    return [accessAst, receiverTypeContext];
  }
  const concreteReceiverTypeAst = unwrapNullableTypeAst(receiverTypeAst);
  if (concreteReceiverTypeAst.kind !== "arrayType") {
    return [accessAst, receiverTypeContext];
  }
  const concreteElementTypeAst = unwrapNullableTypeAst(
    concreteReceiverTypeAst.elementType
  );
  if (!isObjectTypeAst(concreteElementTypeAst)) {
    return [accessAst, receiverTypeContext];
  }

  const plan = tryBuildRuntimeReificationPlan(
    accessAst,
    normalizedDesiredType,
    receiverTypeContext,
    emitTypeAst
  );
  if (!plan) {
    return [accessAst, receiverTypeContext];
  }

  return [plan.value, plan.context];
};

const maybeReifyStorageErasedMemberRead = (
  accessAst: CSharpExpressionAst,
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] => {
  if (!expectedType || expr.isComputed || typeof expr.property !== "string") {
    return [accessAst, context];
  }

  const semanticType = resolveEffectiveExpressionType(expr, context);
  const semanticMatchesExpected =
    !!semanticType &&
    (isAssignable(semanticType, expectedType) ||
      stableIrTypeKey(resolveTypeAlias(stripNullish(semanticType), context)) ===
        stableIrTypeKey(resolveTypeAlias(stripNullish(expectedType), context)));
  if (!semanticMatchesExpected) {
    return [accessAst, context];
  }

  const storageType =
    normalizeRuntimeStorageType(
      getPropertyType(
        resolveEffectiveExpressionType(expr.object, context),
        expr.property,
        context
      ) ?? expr.inferredType,
      context
    ) ?? expr.inferredType;

  if (
    !storageType ||
    matchesExpectedEmissionType(storageType, expectedType, context)
  ) {
    return [accessAst, context];
  }

  const plan = tryBuildRuntimeReificationPlan(
    accessAst,
    expectedType,
    context,
    emitTypeAst
  );
  if (plan) {
    return [plan.value, plan.context];
  }

  const [expectedTypeAst, expectedTypeContext] = emitTypeAst(
    expectedType,
    context
  );
  if (
    accessAst.kind === "castExpression" &&
    stableTypeKeyFromAst(accessAst.type) ===
      stableTypeKeyFromAst(expectedTypeAst)
  ) {
    return [accessAst, expectedTypeContext];
  }
  return [
    {
      kind: "castExpression",
      type: expectedTypeAst,
      expression: accessAst,
    },
    expectedTypeContext,
  ];
};

const tryEmitStorageCompatibleNarrowedMemberRead = (
  narrowed: Extract<NarrowedBinding, { kind: "expr" }>,
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (
    !expectedType ||
    !narrowed.storageExprAst ||
    typeof expr.property !== "string"
  ) {
    return undefined;
  }

  const storageType =
    normalizeRuntimeStorageType(
      getPropertyType(
        resolveEffectiveExpressionType(expr.object, context),
        expr.property,
        context
      ) ?? expr.inferredType,
      context
    ) ?? expr.inferredType;

  if (
    !storageType ||
    !matchesExpectedEmissionType(storageType, expectedType, context)
  ) {
    return undefined;
  }

  return maybeReifyStorageErasedMemberRead(
    narrowed.storageExprAst,
    expr,
    context,
    expectedType
  );
};

const isStringReceiverType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) return false;
  const resolved = resolveTypeAlias(stripNullish(type), context);
  return (
    (resolved.kind === "primitiveType" && resolved.name === "string") ||
    (resolved.kind === "referenceType" &&
      (resolved.name === "string" ||
        resolved.name === "String" ||
        resolved.resolvedClrType === "System.String" ||
        resolved.resolvedClrType === "global::System.String"))
  );
};

const isLengthPropertyName = (propertyName: string): boolean =>
  propertyName === "length" ||
  propertyName === "Length" ||
  propertyName === "Count";

const tryEmitErasedLengthAccess = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  objectAst: CSharpExpressionAst,
  objectType: IrType | undefined,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (
    expr.isComputed ||
    expr.isOptional ||
    typeof expr.property !== "string" ||
    !isLengthPropertyName(expr.property)
  ) {
    return undefined;
  }

  const propertyType =
    getPropertyType(objectType, expr.property, context) ?? expr.inferredType;
  if (!propertyType) {
    return undefined;
  }

  const [receiverTypeAst, receiverTypeContext] = resolveEmittedReceiverTypeAst(
    expr.object,
    context
  );
  const storageReceiverType =
    expr.object.kind === "identifier"
      ? context.localValueTypes?.get(expr.object.name)
      : undefined;
  const concreteReceiverTypeAst = receiverTypeAst
    ? unwrapNullableTypeAst(receiverTypeAst)
    : undefined;
  const storageIsObject =
    storageReceiverType !== undefined &&
    isPlainObjectIrType(storageReceiverType, context);
  if (
    !storageIsObject &&
    (!concreteReceiverTypeAst || !isObjectTypeAst(concreteReceiverTypeAst))
  ) {
    return undefined;
  }

  const [propertyTypeAst, propertyTypeContext] = emitTypeAst(
    propertyType,
    receiverTypeContext
  );

  const castLengthValue = (
    value: CSharpExpressionAst
  ): CSharpExpressionAst => ({
    kind: "castExpression",
    type: propertyTypeAst,
    expression: value,
  });

  return [
    {
      kind: "switchExpression",
      governingExpression: objectAst,
      arms: [
        {
          pattern: {
            kind: "declarationPattern",
            type: identifierType("global::System.String"),
            designation: "__tsonic_string",
          },
          expression: castLengthValue({
            kind: "invocationExpression",
            expression: identifierExpression(
              "global::Tsonic.JSRuntime.String.length"
            ),
            arguments: [identifierExpression("__tsonic_string")],
          }),
        },
        {
          pattern: {
            kind: "declarationPattern",
            type: identifierType("global::System.Array"),
            designation: "__tsonic_array",
          },
          expression: castLengthValue({
            kind: "memberAccessExpression",
            expression: identifierExpression("__tsonic_array"),
            memberName: "Length",
          }),
        },
        {
          pattern: {
            kind: "declarationPattern",
            type: identifierType("global::System.Collections.ICollection"),
            designation: "__tsonic_collection",
          },
          expression: castLengthValue({
            kind: "memberAccessExpression",
            expression: identifierExpression("__tsonic_collection"),
            memberName: "Count",
          }),
        },
        {
          pattern: { kind: "discardPattern" },
          expression: {
            kind: "defaultExpression",
            type: propertyTypeAst,
          },
        },
      ],
    },
    propertyTypeContext,
  ];
};

const tryEmitConcreteReceiverLengthAccess = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  objectAst: CSharpExpressionAst,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (
    expr.isComputed ||
    typeof expr.property !== "string" ||
    !isLengthPropertyName(expr.property)
  ) {
    return undefined;
  }

  const [receiverTypeAst, receiverTypeContext] = resolveEmittedReceiverTypeAst(
    expr.object,
    context
  );
  const concreteReceiverTypeAst = receiverTypeAst
    ? unwrapNullableTypeAst(receiverTypeAst)
    : undefined;

  if (!concreteReceiverTypeAst) {
    return undefined;
  }

  if (concreteReceiverTypeAst.kind === "arrayType") {
    return [
      {
        kind: expr.isOptional
          ? "conditionalMemberAccessExpression"
          : "memberAccessExpression",
        expression: objectAst,
        memberName: "Length",
      },
      receiverTypeContext,
    ];
  }

  const receiverTypeName = getIdentifierTypeName(concreteReceiverTypeAst);
  const receiverLeafName = getIdentifierTypeLeafName(concreteReceiverTypeAst);
  if (
    receiverTypeName === "global::System.Array" ||
    receiverTypeName === "System.Array" ||
    receiverLeafName === "Array"
  ) {
    return [
      {
        kind: expr.isOptional
          ? "conditionalMemberAccessExpression"
          : "memberAccessExpression",
        expression: objectAst,
        memberName: "Length",
      },
      receiverTypeContext,
    ];
  }

  if (
    receiverLeafName === "ICollection" ||
    receiverLeafName === "IReadOnlyCollection"
  ) {
    return [
      {
        kind: expr.isOptional
          ? "conditionalMemberAccessExpression"
          : "memberAccessExpression",
        expression: objectAst,
        memberName: "Count",
      },
      receiverTypeContext,
    ];
  }

  return undefined;
};

const tryEmitJsSurfaceArrayLikeLengthAccess = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  objectAst: CSharpExpressionAst,
  objectType: IrType | undefined,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (
    context.options.surface !== "@tsonic/js" ||
    expr.isComputed ||
    typeof expr.property !== "string" ||
    !isLengthPropertyName(expr.property)
  ) {
    return undefined;
  }

  const [receiverTypeAst, receiverTypeContext] = resolveEmittedReceiverTypeAst(
    expr.object,
    context
  );
  const concreteReceiverTypeAst = receiverTypeAst
    ? unwrapNullableTypeAst(receiverTypeAst)
    : undefined;

  if (concreteReceiverTypeAst?.kind === "arrayType") {
    const elementTypeAst = eraseOutOfScopeArrayWrapperTypeParameters(
      concreteReceiverTypeAst.elementType,
      receiverTypeContext
    );
    return [
      {
        kind: expr.isOptional
          ? "conditionalMemberAccessExpression"
          : "memberAccessExpression",
        expression: {
          kind: "objectCreationExpression",
          type: identifierType("global::Tsonic.JSRuntime.JSArray", [
            elementTypeAst,
          ]),
          arguments: [objectAst],
        },
        memberName: "length",
      },
      receiverTypeContext,
    ];
  }

  const arrayLikeReceiver = resolveArrayLikeReceiver(objectType, context);
  if (!arrayLikeReceiver) {
    return undefined;
  }
  const [elementTypeAst, typeContext] =
    emitStorageCompatibleArrayWrapperElementTypeAst(
      expr.object,
      objectType,
      arrayLikeReceiver.elementType,
      context
    );

  return [
    {
      kind: expr.isOptional
        ? "conditionalMemberAccessExpression"
        : "memberAccessExpression",
      expression: {
        kind: "objectCreationExpression",
        type: identifierType("global::Tsonic.JSRuntime.JSArray", [
          elementTypeAst,
        ]),
        arguments: [objectAst],
      },
      memberName: "length",
    },
    typeContext,
  ];
};

const lookupMemberKindFromLocalTypes = (
  receiverTypeName: string,
  memberName: string,
  context: EmitterContext
): string | undefined => {
  const local = context.localTypes?.get(receiverTypeName);
  if (!local) return undefined;

  if (local.kind === "enum") {
    return local.members.includes(memberName) ? "enumMember" : undefined;
  }

  if (local.kind === "typeAlias") {
    if (local.type.kind !== "objectType") return undefined;
    const found = local.type.members.find((m) => m.name === memberName);
    if (!found) return undefined;
    return found.kind === "methodSignature" ? "method" : "property";
  }

  const members = local.members;
  for (const m of members) {
    if (!("name" in m) || m.name !== memberName) continue;
    if (m.kind === "methodDeclaration" || m.kind === "methodSignature") {
      return "method";
    }
    if (m.kind === "propertySignature") return "property";
    if (m.kind === "propertyDeclaration") {
      const hasAccessors = !!(m.getterBody || m.setterBody);
      return hasAccessors ? "property" : "field";
    }
  }

  return undefined;
};

const lookupMemberKindFromIndex = (
  receiverTypeFqn: string,
  memberName: string,
  context: EmitterContext
): string | undefined => {
  const perType = context.options.typeMemberIndex?.get(receiverTypeFqn);
  return perType?.get(memberName);
};

const hasPropertyFromBindingsRegistry = (
  type: Extract<IrType, { kind: "referenceType" }>,
  propertyName: string,
  context: EmitterContext
): boolean | undefined => {
  const registry = context.bindingsRegistry;
  if (!registry || registry.size === 0) return undefined;

  const candidates = new Set<string>();
  const addCandidate = (value: string | undefined): void => {
    if (!value) return;
    candidates.add(value);
    if (value.includes(".")) {
      const leaf = value.split(".").pop();
      if (leaf) candidates.add(leaf);
    }
  };

  addCandidate(type.name);
  addCandidate(type.typeId?.tsName);
  addCandidate(type.resolvedClrType);
  addCandidate(type.typeId?.clrName);

  for (const value of Array.from(candidates)) {
    if (value.endsWith("$instance")) {
      candidates.add(value.slice(0, -"$instance".length));
    }
    if (value.startsWith("__") && value.endsWith("$views")) {
      candidates.add(value.slice("__".length, -"$views".length));
    }
  }

  for (const key of candidates) {
    const binding = registry.get(key);
    if (!binding) continue;
    return binding.members.some(
      (member) =>
        member.kind === "property" &&
        (member.alias === propertyName ||
          member.name === propertyName ||
          member.binding.member === propertyName)
    );
  }

  return undefined;
};

const resolveReceiverTypeFqn = (
  receiverExpr: IrExpression,
  receiverType: IrType | undefined,
  context: EmitterContext
): string | undefined => {
  if (receiverType?.kind === "referenceType" && receiverType.resolvedClrType) {
    return receiverType.resolvedClrType;
  }

  if (receiverExpr.kind === "identifier") {
    const binding = context.importBindings?.get(receiverExpr.name);
    if (binding?.kind === "type") {
      const typeName = getIdentifierTypeName(binding.typeAst);
      return typeName ? stripGlobalPrefix(typeName) : undefined;
    }
  }

  return undefined;
};

const resolveArrayLikeReceiver = (
  receiverType: IrType | undefined,
  context: EmitterContext
): Extract<IrType, { kind: "arrayType" }> | undefined => {
  if (!receiverType) return undefined;

  const resolved = resolveTypeAlias(stripNullish(receiverType), context);
  if (resolved.kind === "arrayType") {
    return resolved;
  }

  const elementType = getArrayLikeElementType(receiverType, context);
  if (elementType) {
    return {
      kind: "arrayType",
      elementType,
      origin: "explicit",
    };
  }

  return undefined;
};

const tryExtractRuntimeUnionMemberN = (
  exprAst: CSharpExpressionAst
): number | undefined => {
  const target =
    exprAst.kind === "parenthesizedExpression" ? exprAst.expression : exprAst;
  if (target.kind !== "invocationExpression" || target.arguments.length !== 0) {
    return undefined;
  }
  if (target.expression.kind !== "memberAccessExpression") {
    return undefined;
  }

  const match = target.expression.memberName.match(/^As(\d+)$/);
  if (!match?.[1]) {
    return undefined;
  }

  return Number.parseInt(match[1], 10);
};

const tryResolveEmittedRuntimeUnionMemberTypeAst = (
  baseType: IrType | undefined,
  exprAst: CSharpExpressionAst,
  context: EmitterContext
): [CSharpTypeAst | undefined, EmitterContext] => {
  if (!baseType) return [undefined, context];

  const memberN = tryExtractRuntimeUnionMemberN(exprAst);
  if (!memberN) return [undefined, context];

  const runtimeFrame = buildRuntimeUnionFrame(baseType, context);
  if (!runtimeFrame) {
    return [undefined, context];
  }

  const memberIndex = memberN - 1;
  if (memberIndex < 0 || memberIndex >= runtimeFrame.members.length) {
    return [undefined, context];
  }

  const memberType = runtimeFrame.members[memberIndex];
  if (!memberType) {
    return [undefined, context];
  }

  const storageMemberType =
    normalizeRuntimeStorageType(memberType, context) ?? memberType;
  return emitTypeAst(
    normalizeStructuralEmissionType(storageMemberType, context),
    context
  );
};

const resolveEffectiveReceiverType = (
  receiverExpr: IrExpression,
  context: EmitterContext
): IrType | undefined => resolveEffectiveExpressionType(receiverExpr, context);

const hasSourceDeclaredMember = (
  receiverType: IrType | undefined,
  memberName: string,
  usage: MemberAccessUsage,
  context: EmitterContext
): boolean => {
  if (!receiverType) {
    return false;
  }

  const resolved = resolveTypeAlias(stripNullish(receiverType), context);
  if (usage === "value") {
    if (resolved.kind === "objectType") {
      return resolved.members.some(
        (member) =>
          member.kind === "propertySignature" && member.name === memberName
      );
    }

    if (
      resolved.kind === "referenceType" &&
      hasDeterministicPropertyMembership(resolved, memberName, context) === true
    ) {
      return true;
    }
  }

  if (resolved.kind !== "referenceType") {
    return false;
  }

  if (
    resolved.structuralMembers?.some((member) => member.name === memberName)
  ) {
    return true;
  }

  const localInfo = resolveLocalTypeInfo(resolved, context)?.info;
  if (!localInfo) {
    return false;
  }

  switch (localInfo.kind) {
    case "class":
      return localInfo.members.some((member) =>
        usage === "call"
          ? member.kind === "methodDeclaration" && member.name === memberName
          : member.kind === "propertyDeclaration" && member.name === memberName
      );
    case "interface":
      return localInfo.members.some(
        (member) =>
          (usage === "call"
            ? member.kind === "methodSignature"
            : member.kind === "propertySignature") && member.name === memberName
      );
    default:
      return false;
  }
};

const resolveEmittedReceiverTypeAst = (
  receiverExpr: IrExpression,
  context: EmitterContext
): [CSharpTypeAst | undefined, EmitterContext] => {
  const baseType = receiverExpr.inferredType;
  if (context.narrowedBindings) {
    const narrowKey =
      receiverExpr.kind === "identifier"
        ? receiverExpr.name
        : receiverExpr.kind === "memberAccess"
          ? getMemberAccessNarrowKey(receiverExpr)
          : undefined;

    if (narrowKey) {
      const narrowed = context.narrowedBindings.get(narrowKey);
      if (narrowed?.kind === "expr") {
        if (narrowed.type) {
          const storageNarrowedType =
            normalizeRuntimeStorageType(narrowed.type, context) ??
            narrowed.type;
          return emitTypeAst(
            normalizeStructuralEmissionType(storageNarrowedType, context),
            context
          );
        }

        const sourceType = narrowed.sourceType ?? baseType;
        const [memberTypeAst, memberContext] =
          tryResolveEmittedRuntimeUnionMemberTypeAst(
            sourceType,
            narrowed.exprAst,
            context
          );
        if (memberTypeAst) {
          return [memberTypeAst, memberContext];
        }
      }
    }
  }

  const receiverType = resolveEffectiveReceiverType(receiverExpr, context);
  if (!receiverType) {
    return [undefined, context];
  }

  const normalizedReceiverType =
    normalizeRuntimeStorageType(receiverType, context) ?? receiverType;
  const arrayLikeElementType = getArrayLikeElementType(
    normalizedReceiverType,
    context
  );
  if (arrayLikeElementType) {
    const [elementTypeAst, elementContext] = emitTypeAst(
      normalizeStructuralEmissionType(arrayLikeElementType, context),
      context
    );
    const storageCompatibleElementTypeAst =
      eraseOutOfScopeArrayWrapperTypeParameters(elementTypeAst, elementContext);
    return [
      {
        kind: "arrayType",
        elementType: storageCompatibleElementTypeAst,
        rank: 1,
      },
      elementContext,
    ];
  }

  return emitTypeAst(
    normalizeStructuralEmissionType(normalizedReceiverType, context),
    context
  );
};

const emitMemberName = (
  receiverExpr: IrExpression,
  receiverType: IrType | undefined,
  memberName: string,
  context: EmitterContext,
  usage: MemberAccessUsage
): string => {
  if (usage === "call") {
    return emitCSharpName(memberName, "methods", context);
  }

  if (receiverExpr.kind === "identifier") {
    const binding = context.importBindings?.get(receiverExpr.name);
    if (binding?.kind === "namespace") {
      return emitCSharpName(memberName, "fields", context);
    }
  }

  const receiverTypeName =
    receiverType?.kind === "referenceType" ? receiverType.name : undefined;
  if (receiverTypeName) {
    const localKind = lookupMemberKindFromLocalTypes(
      receiverTypeName,
      memberName,
      context
    );
    if (localKind) {
      return emitCSharpName(
        memberName,
        bucketFromMemberKind(localKind),
        context
      );
    }
  }

  if (receiverExpr.kind === "identifier") {
    const localKind = lookupMemberKindFromLocalTypes(
      receiverExpr.name,
      memberName,
      context
    );
    if (localKind) {
      return emitCSharpName(
        memberName,
        bucketFromMemberKind(localKind),
        context
      );
    }
  }

  const receiverFqn = resolveReceiverTypeFqn(
    receiverExpr,
    receiverType,
    context
  );
  if (receiverFqn) {
    const indexedKind = lookupMemberKindFromIndex(
      receiverFqn,
      memberName,
      context
    );
    if (indexedKind) {
      return emitCSharpName(
        memberName,
        bucketFromMemberKind(indexedKind),
        context
      );
    }
  }

  return emitCSharpName(memberName, "properties", context);
};

/**
 * Check if an expression represents a static type reference (not an instance)
 */
const isStaticTypeReference = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  context: EmitterContext
): boolean => {
  if (expr.object.kind === "identifier") {
    const importBinding = context.importBindings?.get(expr.object.name);
    if (importBinding) return true;

    if (!expr.object.inferredType) return false;
  }

  const objectType = expr.object.inferredType;

  if (
    objectType?.kind === "referenceType" ||
    objectType?.kind === "arrayType" ||
    objectType?.kind === "intersectionType" ||
    objectType?.kind === "unionType" ||
    objectType?.kind === "primitiveType" ||
    objectType?.kind === "literalType" ||
    objectType?.kind === "typeParameterType" ||
    objectType?.kind === "unknownType"
  ) {
    return false;
  }

  return true;
};

/**
 * Emit a member access expression as CSharpExpressionAst
 */
export const emitMemberAccess = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  context: EmitterContext,
  usage: MemberAccessUsage = "value",
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  // Nullable guard narrowing for member-access expressions.
  const narrowKey = context.narrowedBindings
    ? getMemberAccessNarrowKey(expr)
    : undefined;
  if (narrowKey && context.narrowedBindings) {
    const narrowed = context.narrowedBindings.get(narrowKey);
    if (narrowed) {
      if (narrowed.kind === "rename") {
        return [
          identifierExpression(escapeCSharpIdentifier(narrowed.name)),
          context,
        ];
      }
      if (narrowed.kind === "expr") {
        const storageCompatible = tryEmitStorageCompatibleNarrowedMemberRead(
          narrowed,
          expr,
          context,
          expectedType
        );
        if (storageCompatible) {
          return storageCompatible;
        }
        return maybeReifyStorageErasedMemberRead(
          narrowed.exprAst,
          expr,
          context,
          expectedType
        );
      }
    }
  }

  const objectType = resolveEffectiveReceiverType(expr.object, context);

  if (
    !expr.isComputed &&
    usage === "value" &&
    context.options.surface === "@tsonic/js" &&
    isStringReceiverType(objectType, context) &&
    ((expr.property as string) === "length" ||
      (expr.property as string) === "Length")
  ) {
    const [stringObjectAst, stringContext] = emitExpressionAst(
      expr.object,
      context
    );
    return [
      {
        kind: "invocationExpression",
        expression: identifierExpression(
          "global::Tsonic.JSRuntime.String.length"
        ),
        arguments: [stringObjectAst],
      },
      stringContext,
    ];
  }

  // Property access that targets a CLR runtime union
  if (!expr.isComputed && !expr.isOptional) {
    const prop = expr.property as string;
    if (objectType && isSemanticUnion(objectType, context)) {
      const resolvedBase = resolveTypeAlias(stripNullish(objectType), context);
      const resolved =
        resolvedBase.kind === "intersectionType"
          ? (resolvedBase.types.find(
              (t): t is Extract<IrType, { kind: "referenceType" }> =>
                t.kind === "referenceType" && isRuntimeUnionTypeName(t.name)
            ) ?? resolvedBase)
          : resolvedBase;
      const runtimeReferenceMembers =
        resolved.kind === "referenceType"
          ? getRuntimeUnionReferenceMembers(resolved)
          : undefined;
      const members: readonly IrType[] =
        resolved.kind === "unionType"
          ? resolved.types
          : runtimeReferenceMembers
            ? runtimeReferenceMembers
            : [];

      const runtimeLayout = (() => {
        if (members.length < 2 || members.length > 8) {
          return undefined;
        }

        return buildRuntimeUnionFrame(objectType, context);
      })();
      const runtimeMembers = runtimeLayout?.members ?? members;
      const arity = runtimeMembers.length;
      if (arity >= 2 && arity <= 8) {
        const memberHasProperty = runtimeMembers.map((m) => {
          if (m.kind !== "referenceType") return false;
          const props = getAllPropertySignatures(m, context);
          if (props) return props.some((p) => p.name === prop);
          const fromBindings = hasPropertyFromBindingsRegistry(
            m,
            prop,
            context
          );
          return fromBindings ?? false;
        });
        const count = memberHasProperty.filter(Boolean).length;

        if (count === arity || count === 1) {
          const [objectAst, newContext] = emitExpressionAst(
            expr.object,
            context
          );
          const escapedProp = emitMemberName(
            expr.object,
            objectType,
            prop,
            context,
            usage
          );

          if (count === arity) {
            // All members have the property: use Match lambda
            const lambdaArgs = runtimeMembers.map(
              (_, i): CSharpExpressionAst => ({
                kind: "lambdaExpression",
                isAsync: false,
                parameters: [{ name: `__m${i + 1}` }],
                body: {
                  kind: "memberAccessExpression",
                  expression: {
                    kind: "identifierExpression",
                    identifier: `__m${i + 1}`,
                  },
                  memberName: escapedProp,
                },
              })
            );
            return [
              {
                kind: "invocationExpression",
                expression: {
                  kind: "memberAccessExpression",
                  expression: objectAst,
                  memberName: "Match",
                },
                arguments: lambdaArgs,
              },
              newContext,
            ];
          }

          const armIndex = memberHasProperty.findIndex(Boolean);
          if (armIndex >= 0) {
            const asMethod = emitCSharpName(
              `As${armIndex + 1}`,
              "methods",
              context
            );
            // receiver.AsN().prop
            return [
              {
                kind: "memberAccessExpression",
                expression: {
                  kind: "invocationExpression",
                  expression: {
                    kind: "memberAccessExpression",
                    expression: objectAst,
                    memberName: asMethod,
                  },
                  arguments: [],
                },
                memberName: escapedProp,
              },
              newContext,
            ];
          }
        }
      }
    }
  }

  if (expr.memberBinding) {
    const { type, member } = expr.memberBinding;
    const escapedMember = escapeCSharpIdentifier(member);
    const bindingTypeLeaf = stripClrGenericArity(type).split(".").pop();

    const receiverType = resolveEffectiveReceiverType(expr.object, context);
    const arrayLikeReceiver = resolveArrayLikeReceiver(receiverType, context);
    const hasArrayLikeBindingHint =
      bindingTypeLeaf === "JSArray" ||
      bindingTypeLeaf === "Array" ||
      bindingTypeLeaf === "ReadonlyArray" ||
      type.includes("JSArray") ||
      type.includes("System.Array");
    if (
      usage === "value" &&
      typeof expr.property === "string" &&
      isLengthPropertyName(expr.property) &&
      context.options.surface === "@tsonic/js" &&
      !expr.memberBinding.isExtensionMethod &&
      (arrayLikeReceiver || hasArrayLikeBindingHint)
    ) {
      const [objectAst, withObject] = emitExpressionAst(expr.object, context);
      const jsSurfaceArrayLengthAccess = tryEmitJsSurfaceArrayLikeLengthAccess(
        expr,
        objectAst,
        receiverType,
        withObject
      );
      if (jsSurfaceArrayLengthAccess) {
        return jsSurfaceArrayLengthAccess;
      }

      let elementTypeAst: CSharpTypeAst = {
        kind: "predefinedType",
        keyword: "object",
      };
      let elementContext = withObject;

      if (arrayLikeReceiver) {
        [elementTypeAst, elementContext] =
          emitStorageCompatibleArrayWrapperElementTypeAst(
            expr.object,
            receiverType,
            arrayLikeReceiver.elementType,
            withObject
          );
      } else {
        const [receiverTypeAst, receiverTypeContext] =
          resolveEmittedReceiverTypeAst(expr.object, withObject);
        elementContext = receiverTypeContext;
        const concreteReceiverTypeAst = receiverTypeAst
          ? unwrapNullableTypeAst(receiverTypeAst)
          : undefined;
        if (concreteReceiverTypeAst?.kind === "arrayType") {
          elementTypeAst = eraseOutOfScopeArrayWrapperTypeParameters(
            concreteReceiverTypeAst.elementType,
            receiverTypeContext
          );
        }
      }

      return [
        {
          kind: expr.isOptional
            ? "conditionalMemberAccessExpression"
            : "memberAccessExpression",
          expression: {
            kind: "objectCreationExpression",
            type: identifierType("global::Tsonic.JSRuntime.JSArray", [
              elementTypeAst,
            ]),
            arguments: [objectAst],
          },
          memberName: "length",
        },
        elementContext,
      ];
    }
    if (
      usage === "value" &&
      arrayLikeReceiver &&
      !expr.memberBinding.isExtensionMethod &&
      !(
        type === "System.Array" ||
        type === "global::System.Array" ||
        type.startsWith("System.Array`") ||
        type.startsWith("global::System.Array`")
      )
    ) {
      const arityText = type.match(/`(\d+)$/)?.[1];
      const genericArity = arityText ? Number.parseInt(arityText, 10) : 0;
      if (genericArity <= 1) {
        const [objectAst, withObject] = emitExpressionAst(expr.object, context);
        let currentContext = withObject;

        let wrapperTypeArguments: readonly CSharpTypeAst[] | undefined;
        if (genericArity === 1) {
          const [elementTypeAst, withElementType] =
            emitStorageCompatibleArrayWrapperElementTypeAst(
              expr.object,
              receiverType,
              arrayLikeReceiver.elementType,
              currentContext
            );
          currentContext = withElementType;
          wrapperTypeArguments = [elementTypeAst];
        }

        const wrapperAst: CSharpExpressionAst = {
          kind: "objectCreationExpression",
          type: identifierType(
            `global::${stripClrGenericArity(type)}`,
            wrapperTypeArguments
          ),
          arguments: [objectAst],
        };

        if (expr.isOptional) {
          return [
            {
              kind: "conditionalMemberAccessExpression",
              expression: wrapperAst,
              memberName: escapedMember,
            },
            currentContext,
          ];
        }

        return [
          {
            kind: "memberAccessExpression",
            expression: wrapperAst,
            memberName: escapedMember,
          },
          currentContext,
        ];
      }
    }

    if (usage === "value" && expr.memberBinding.isExtensionMethod) {
      const [objectAst, newContext] = emitExpressionAst(expr.object, context);
      const extensionCallAst: CSharpExpressionAst = {
        kind: "invocationExpression",
        expression: identifierExpression(`global::${type}.${escapedMember}`),
        arguments: [objectAst],
      };

      if (!expr.isOptional) {
        return [extensionCallAst, newContext];
      }

      return [
        {
          kind: "conditionalExpression",
          condition: {
            kind: "binaryExpression",
            operatorToken: "==",
            left: objectAst,
            right: nullLiteral(),
          },
          whenTrue: { kind: "defaultExpression" },
          whenFalse: extensionCallAst,
        },
        newContext,
      ];
    }

    const isGlobalSimpleBindingAccess = (() => {
      if (expr.object.kind !== "identifier") return false;
      const isLocal = context.localNameMap?.has(expr.object.name) ?? false;
      if (isLocal) return false;
      if (
        expr.object.resolvedClrType !== undefined ||
        (expr.object.csharpName !== undefined &&
          expr.object.resolvedAssembly !== undefined)
      ) {
        return true;
      }
      if (!bindingTypeLeaf) return false;
      return bindingTypeLeaf === expr.object.name;
    })();

    if (isStaticTypeReference(expr, context) || isGlobalSimpleBindingAccess) {
      // Static access: emit full CLR type and member with global:: prefix
      return [
        identifierExpression(`global::${type}.${escapedMember}`),
        context,
      ];
    } else {
      // Instance access: emit object.ClrMemberName
      const [objectAst, newContext] = emitExpressionAst(expr.object, context);
      const sourcePropertyName =
        typeof expr.property === "string" ? expr.property : member;
      const emittedSourceMemberName = emitMemberName(
        expr.object,
        receiverType,
        sourcePropertyName,
        context,
        usage
      );
      const emittedMemberName = hasSourceDeclaredMember(
        receiverType,
        sourcePropertyName,
        usage,
        context
      )
        ? emittedSourceMemberName
        : escapedMember;
      if (expr.isOptional) {
        return [
          {
            kind: "conditionalMemberAccessExpression",
            expression: objectAst,
            memberName: emittedMemberName,
          },
          newContext,
        ];
      }
      return [
        {
          kind: "memberAccessExpression",
          expression: objectAst,
          memberName: emittedMemberName,
        },
        newContext,
      ];
    }
  }

  const [objectAst, newContext] = emitExpressionAst(expr.object, context);

  if (usage === "value") {
    const jsSurfaceArrayLengthAccess = tryEmitJsSurfaceArrayLikeLengthAccess(
      expr,
      objectAst,
      objectType,
      newContext
    );
    if (jsSurfaceArrayLengthAccess) {
      return jsSurfaceArrayLengthAccess;
    }
  }

  if (expr.isComputed) {
    const accessKind = expr.accessKind;
    if (accessKind === undefined || accessKind === "unknown") {
      throw new Error(
        `Internal Compiler Error: Computed accessKind was not classified during IR build ` +
          `(accessKind=${accessKind ?? "undefined"}).`
      );
    }

    const indexContext = { ...newContext, isArrayIndex: true };
    const [propAst, contextWithIndex] = emitExpressionAst(
      expr.property as IrExpression,
      indexContext
    );
    const finalContext = { ...contextWithIndex, isArrayIndex: false };

    if (accessKind === "dictionary") {
      if (expr.isOptional) {
        return [
          {
            kind: "conditionalElementAccessExpression",
            expression: objectAst,
            arguments: [propAst],
          },
          finalContext,
        ];
      }
      return [
        {
          kind: "elementAccessExpression",
          expression: objectAst,
          arguments: [propAst],
        },
        finalContext,
      ];
    }

    // HARD GATE: clrIndexer + stringChar require Int32 proof
    const indexExpr = expr.property as IrExpression;
    if (!hasInt32Proof(indexExpr)) {
      const propText = extractCalleeNameFromAst(propAst);
      throw new Error(
        `Internal Compiler Error: CLR indexer requires Int32 index (accessKind=${accessKind}). ` +
          `Expression '${propText}' has no Int32 proof. ` +
          `This should have been caught by the numeric proof pass (TSN5107).`
      );
    }

    if (accessKind === "stringChar") {
      const elementAccess: CSharpExpressionAst = expr.isOptional
        ? {
            kind: "conditionalElementAccessExpression",
            expression: objectAst,
            arguments: [propAst],
          }
        : {
            kind: "elementAccessExpression",
            expression: objectAst,
            arguments: [propAst],
          };

      const narrowedExpectedType = expectedType
        ? stripNullish(expectedType)
        : undefined;
      const resolvedExpectedType = narrowedExpectedType
        ? resolveTypeAlias(narrowedExpectedType, context)
        : undefined;
      const expectsChar =
        (resolvedExpectedType?.kind === "primitiveType" &&
          resolvedExpectedType.name === "char") ||
        (resolvedExpectedType?.kind === "referenceType" &&
          resolvedExpectedType.name === "char");

      if (expectsChar) {
        return [elementAccess, finalContext];
      }

      // str[i] returns char in C#, but JS/TS surface semantics expect a string
      // in non-char contexts. Convert char → string at the emission boundary.
      return [
        {
          kind: "invocationExpression",
          expression: {
            kind: "memberAccessExpression",
            expression: elementAccess,
            memberName: "ToString",
          },
          arguments: [],
        },
        finalContext,
      ];
    }

    if (expr.isOptional) {
      return [
        {
          kind: "conditionalElementAccessExpression",
          expression: objectAst,
          arguments: [propAst],
        },
        finalContext,
      ];
    }
    const accessAst: CSharpExpressionAst = {
      kind: "elementAccessExpression",
      expression: objectAst,
      arguments: [propAst],
    };
    return maybeReifyErasedArrayElement(
      accessAst,
      expr.object,
      expectedType ?? expr.inferredType,
      finalContext
    );
  }

  // Property access
  const prop = expr.property as string;
  const resolvedObjectType = objectType
    ? resolveTypeAlias(stripNullish(objectType), context)
    : undefined;

  if (
    usage === "value" &&
    (prop === "length" || prop === "Length" || prop === "Count")
  ) {
    const [storageReceiverTypeAst, storageContext] =
      resolveEmittedReceiverTypeAst(expr.object, newContext);
    const concreteStorageReceiverTypeAst = storageReceiverTypeAst
      ? unwrapNullableTypeAst(storageReceiverTypeAst)
      : undefined;
    if (concreteStorageReceiverTypeAst?.kind === "arrayType") {
      return [
        {
          kind: expr.isOptional
            ? "conditionalMemberAccessExpression"
            : "memberAccessExpression",
          expression: objectAst,
          memberName: "Length",
        },
        storageContext,
      ];
    }
  }

  // Handle explicit interface view properties (As_IInterface)
  if (isExplicitViewProperty(prop)) {
    const interfaceName = extractInterfaceNameFromView(prop);
    if (interfaceName) {
      // Emit as C# interface cast: ((IInterface)obj)
      const interfaceType: IrType = {
        kind: "referenceType",
        name: interfaceName,
      };
      const [interfaceTypeAst, ctxAfterType] = emitTypeAst(
        interfaceType,
        newContext
      );
      return [
        {
          kind: "castExpression",
          type: interfaceTypeAst,
          expression: objectAst,
        },
        ctxAfterType,
      ];
    }
  }

  // Dictionary pseudo-members:
  // - dict.Keys   -> new List<TKey>(dict.Keys).ToArray()
  // - dict.Values -> new List<TValue>(dict.Values).ToArray()
  //
  // We expose these as array-typed on the frontend, so emit array materialization
  // here to keep C# behavior aligned with inferred IR types.
  if (resolvedObjectType?.kind === "dictionaryType") {
    if (prop === "Keys" || prop === "Values") {
      const collectionMemberName = emitCSharpName(prop, "properties", context);
      const sourceCollectionAst: CSharpExpressionAst = {
        kind: "memberAccessExpression",
        expression: objectAst,
        memberName: collectionMemberName,
      };

      const elementType =
        prop === "Keys"
          ? resolvedObjectType.keyType
          : resolvedObjectType.valueType;
      const [elementTypeAst, ctxAfterType] = emitTypeAst(
        elementType,
        newContext
      );

      const listTypeAst = identifierType(
        "global::System.Collections.Generic.List",
        [elementTypeAst]
      );

      const listExprAst: CSharpExpressionAst = {
        kind: "objectCreationExpression",
        type: listTypeAst,
        arguments: [sourceCollectionAst],
      };

      return [
        {
          kind: "invocationExpression",
          expression: {
            kind: "memberAccessExpression",
            expression: listExprAst,
            memberName: "ToArray",
          },
          arguments: [],
        },
        ctxAfterType,
      ];
    }

    if (prop === "Count" || prop === "Length") {
      return [
        {
          kind: expr.isOptional
            ? "conditionalMemberAccessExpression"
            : "memberAccessExpression",
          expression: objectAst,
          memberName: "Count",
        },
        newContext,
      ];
    }

    const keyAst = createStringLiteralExpression(prop);
    if (expr.isOptional) {
      return [
        {
          kind: "conditionalElementAccessExpression",
          expression: objectAst,
          arguments: [keyAst],
        },
        newContext,
      ];
    }

    return [
      {
        kind: "elementAccessExpression",
        expression: objectAst,
        arguments: [keyAst],
      },
      newContext,
    ];
  }

  // Regular property access
  const memberName = emitMemberName(
    expr.object,
    objectType,
    prop,
    context,
    usage
  );

  if (
    context.options.surface === "@tsonic/js" &&
    !expr.memberBinding &&
    usage === "call"
  ) {
    const arrayLikeReceiver = resolveArrayLikeReceiver(objectType, context);
    if (arrayLikeReceiver) {
      const [elementTypeAst, typeCtx] = emitArrayWrapperElementTypeAst(
        objectType,
        arrayLikeReceiver.elementType,
        newContext
      );
      return [
        {
          kind: "memberAccessExpression",
          expression: {
            kind: "objectCreationExpression",
            type: identifierType("global::Tsonic.JSRuntime.JSArray", [
              elementTypeAst,
            ]),
            arguments: [objectAst],
          },
          memberName: emitCSharpName(prop, "methods", typeCtx),
        },
        typeCtx,
      ];
    }
  }

  if (usage === "value") {
    if (
      resolvedObjectType?.kind === "arrayType" ||
      resolvedObjectType?.kind === "tupleType"
    ) {
      if (prop === "length" || prop === "Length" || prop === "Count") {
        return [
          {
            kind: expr.isOptional
              ? "conditionalMemberAccessExpression"
              : "memberAccessExpression",
            expression: objectAst,
            memberName: "Length",
          },
          newContext,
        ];
      }
    }
  }

  const concreteReceiverLengthAccess = tryEmitConcreteReceiverLengthAccess(
    expr,
    objectAst,
    newContext
  );
  if (concreteReceiverLengthAccess) {
    return concreteReceiverLengthAccess;
  }

  const erasedLengthAccess = tryEmitErasedLengthAccess(
    expr,
    objectAst,
    objectType,
    newContext
  );
  if (erasedLengthAccess) {
    return erasedLengthAccess;
  }

  if (expr.isOptional) {
    return [
      {
        kind: "conditionalMemberAccessExpression",
        expression: objectAst,
        memberName,
      },
      newContext,
    ];
  }

  return maybeReifyStorageErasedMemberRead(
    {
      kind: "memberAccessExpression",
      expression: objectAst,
      memberName,
    },
    expr,
    newContext,
    expectedType
  );
};
