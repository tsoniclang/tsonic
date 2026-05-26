import { type IrExpression, type IrType } from "@tsonic/frontend";
import { identifierExpression } from "../core/format/backend-ast/builders.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";
import type { EmitterContext } from "../types.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import {
  resolveEffectiveExpressionType,
  tryResolveRuntimeUnionMemberType,
} from "../core/semantic/narrowed-expression-types.js";
import { getMemberAccessNarrowKey } from "../core/semantic/narrowing-keys.js";
import {
  extractCalleeNameFromAst,
  sameTypeAstSurface,
} from "../core/format/backend-ast/utils.js";
import { matchesExpectedEmissionType } from "../core/semantic/expected-type-matching.js";
import { runtimeUnionAliasReferencesMatch } from "../core/semantic/runtime-union-alias-identity.js";
import {
  splitRuntimeNullishUnionMembers,
  stripNullish,
} from "../core/semantic/type-resolution.js";
import {
  buildRuntimeUnionLayout,
  buildRuntimeUnionTypeAst,
} from "../core/semantic/runtime-unions.js";
import { willCarryAsRuntimeUnion } from "../core/semantic/union-semantics.js";
import { applyConditionBranchNarrowing } from "../core/semantic/condition-branch-narrowing.js";
import { emitTypeAst } from "../type-emitter.js";
import {
  resolveDirectStorageIrType,
  resolveIdentifierCarrierStorageType,
  resolveIdentifierRuntimeCarrierType,
  resolveRuntimeCarrierIrType,
} from "../core/semantic/direct-storage-ir-types.js";
import { resolveRuntimeStorageType } from "../core/semantic/storage-types.js";

const emitConditionNarrowingStub = (_expr: IrExpression, ctx: EmitterContext) =>
  [identifierExpression("__tsonic_narrow"), ctx] as [
    ReturnType<typeof identifierExpression>,
    EmitterContext,
  ];

const matchesStoredExpressionAst = (
  left: CSharpExpressionAst | undefined,
  right: CSharpExpressionAst | undefined
): boolean => {
  if (!left || !right) {
    return false;
  }

  if (left === right) {
    return true;
  }

  if (left.kind !== right.kind) {
    return false;
  }

  switch (left.kind) {
    case "identifierExpression":
      return (
        right.kind === "identifierExpression" &&
        left.identifier === right.identifier
      );
    case "parenthesizedExpression":
      return (
        right.kind === "parenthesizedExpression" &&
        matchesStoredExpressionAst(left.expression, right.expression)
      );
    case "castExpression":
    case "asExpression":
      return (
        right.kind === left.kind &&
        sameTypeAstSurface(left.type, right.type) &&
        matchesStoredExpressionAst(left.expression, right.expression)
      );
    case "memberAccessExpression":
      return (
        right.kind === "memberAccessExpression" &&
        left.memberName === right.memberName &&
        matchesStoredExpressionAst(left.expression, right.expression)
      );
    case "conditionalMemberAccessExpression":
      return (
        right.kind === "conditionalMemberAccessExpression" &&
        left.memberName === right.memberName &&
        matchesStoredExpressionAst(left.expression, right.expression)
      );
    case "invocationExpression":
      return (
        right.kind === "invocationExpression" &&
        matchesStoredExpressionAst(left.expression, right.expression) &&
        left.arguments.length === right.arguments.length &&
        left.arguments.every((argument, index) =>
          matchesStoredExpressionAst(argument, right.arguments[index])
        )
      );
    default:
      return false;
  }
};

const isBroadObjectTypeAst = (typeAst: CSharpTypeAst | undefined): boolean => {
  if (!typeAst) {
    return false;
  }

  const concrete =
    typeAst.kind === "nullableType" ? typeAst.underlyingType : typeAst;
  return (
    (concrete.kind === "predefinedType" && concrete.keyword === "object") ||
    (concrete.kind === "identifierType" && concrete.name === "object") ||
    (concrete.kind === "qualifiedIdentifierType" &&
      concrete.name.segments.length === 2 &&
      concrete.name.segments[0] === "System" &&
      concrete.name.segments[1] === "Object")
  );
};

const tryResolveProjectedExpressionType = (
  ast: CSharpExpressionAst
): IrType | undefined => {
  let target = ast;
  while (
    target.kind === "parenthesizedExpression" ||
    target.kind === "castExpression" ||
    target.kind === "asExpression"
  ) {
    target = target.expression;
  }

  if (target.kind !== "invocationExpression") {
    return undefined;
  }
  if (target.expression.kind !== "memberAccessExpression") {
    return undefined;
  }
  if (target.expression.memberName !== "Match") {
    return undefined;
  }

  const [typeArgument] = target.typeArguments ?? [];
  if (!isBroadObjectTypeAst(typeArgument)) {
    return undefined;
  }

  return { kind: "referenceType", name: "object" };
};

const tryConvertExactSurfaceTypeAstToIrType = (
  typeAst: CSharpTypeAst
): IrType | undefined => {
  const tryBuildDictionaryType = (
    name: string,
    typeArguments: readonly IrType[] | undefined
  ): IrType | undefined =>
    (name === "Dictionary" ||
      name === "System.Collections.Generic.Dictionary" ||
      name === "global::System.Collections.Generic.Dictionary") &&
    typeArguments?.length === 2 &&
    typeArguments[0] &&
    typeArguments[1]
      ? {
          kind: "dictionaryType",
          keyType: typeArguments[0],
          valueType: typeArguments[1],
        }
      : undefined;

  switch (typeAst.kind) {
    case "predefinedType":
      switch (typeAst.keyword) {
        case "bool":
          return { kind: "primitiveType", name: "boolean" };
        case "string":
          return { kind: "primitiveType", name: "string" };
        case "void":
          return { kind: "voidType" };
        case "object":
          return { kind: "referenceType", name: "object" };
        case "byte":
          return {
            kind: "referenceType",
            name: "byte",
            providerQualifiedName: "global::System.Byte",
          };
        case "sbyte":
          return {
            kind: "referenceType",
            name: "sbyte",
            providerQualifiedName: "global::System.SByte",
          };
        case "short":
          return {
            kind: "referenceType",
            name: "short",
            providerQualifiedName: "global::System.Int16",
          };
        case "ushort":
          return {
            kind: "referenceType",
            name: "ushort",
            providerQualifiedName: "global::System.UInt16",
          };
        case "int":
          return { kind: "primitiveType", name: "int" };
        case "uint":
          return {
            kind: "referenceType",
            name: "uint",
            providerQualifiedName: "global::System.UInt32",
          };
        case "long":
          return {
            kind: "referenceType",
            name: "long",
            providerQualifiedName: "global::System.Int64",
          };
        case "ulong":
          return {
            kind: "referenceType",
            name: "ulong",
            providerQualifiedName: "global::System.UInt64",
          };
        case "nint":
          return {
            kind: "referenceType",
            name: "nint",
            providerQualifiedName: "global::System.IntPtr",
          };
        case "nuint":
          return {
            kind: "referenceType",
            name: "nuint",
            providerQualifiedName: "global::System.UIntPtr",
          };
        case "float":
          return {
            kind: "referenceType",
            name: "float",
            providerQualifiedName: "global::System.Single",
          };
        case "double":
          return { kind: "primitiveType", name: "number" };
        case "decimal":
          return {
            kind: "referenceType",
            name: "decimal",
            providerQualifiedName: "global::System.Decimal",
          };
        case "char":
          return { kind: "primitiveType", name: "char" };
        default:
          return { kind: "referenceType", name: typeAst.keyword };
      }
    case "identifierType": {
      const typeArguments = typeAst.typeArguments
        ?.map((typeArgument) =>
          tryConvertExactSurfaceTypeAstToIrType(typeArgument)
        )
        .filter(
          (typeArgument): typeArgument is IrType => typeArgument !== undefined
        );
      const dictionaryType = tryBuildDictionaryType(
        typeAst.name,
        typeArguments
      );
      if (dictionaryType) {
        return dictionaryType;
      }

      return {
        kind: "referenceType",
        name: typeAst.name,
        ...(typeArguments && typeArguments.length > 0 ? { typeArguments } : {}),
      };
    }
    case "qualifiedIdentifierType": {
      const typeArguments = typeAst.typeArguments
        ?.map((typeArgument) =>
          tryConvertExactSurfaceTypeAstToIrType(typeArgument)
        )
        .filter(
          (typeArgument): typeArgument is IrType => typeArgument !== undefined
        );
      const providerQualifiedName = `${
        typeAst.name.aliasQualifier ? `${typeAst.name.aliasQualifier}::` : ""
      }${typeAst.name.segments.join(".")}`;
      const name =
        typeAst.name.segments[typeAst.name.segments.length - 1] ??
        providerQualifiedName;
      const dictionaryType = tryBuildDictionaryType(
        providerQualifiedName,
        typeArguments
      );
      if (dictionaryType) {
        return dictionaryType;
      }

      return {
        kind: "referenceType",
        name,
        providerQualifiedName,
        ...(typeArguments && typeArguments.length > 0 ? { typeArguments } : {}),
      };
    }
    case "nullableType": {
      const underlyingType = tryConvertExactSurfaceTypeAstToIrType(
        typeAst.underlyingType
      );
      return underlyingType
        ? {
            kind: "unionType",
            types: [
              underlyingType,
              { kind: "primitiveType", name: "undefined" },
            ],
          }
        : undefined;
    }
    case "arrayType": {
      if (typeAst.rank !== 1) {
        return undefined;
      }
      const elementType = tryConvertExactSurfaceTypeAstToIrType(
        typeAst.elementType
      );
      return elementType
        ? {
            kind: "arrayType",
            elementType,
          }
        : undefined;
    }
    default:
      return undefined;
  }
};

const isPlainDirectStorageSurfaceAst = (ast: CSharpExpressionAst): boolean => {
  let target = ast;
  while (
    target.kind === "parenthesizedExpression" ||
    target.kind === "castExpression" ||
    target.kind === "asExpression"
  ) {
    target = target.expression;
  }

  return (
    target.kind === "identifierExpression" ||
    target.kind === "memberAccessExpression" ||
    target.kind === "conditionalMemberAccessExpression" ||
    target.kind === "elementAccessExpression" ||
    target.kind === "conditionalElementAccessExpression"
  );
};

const getSingleNullishBranchStorageType = (
  type: IrType | undefined
): IrType | undefined => {
  if (!type) {
    return undefined;
  }

  const split = splitRuntimeNullishUnionMembers(type);
  if (!split?.hasRuntimeNullish || split.nonNullishMembers.length !== 1) {
    return undefined;
  }

  return split.nonNullishMembers[0];
};

const storageTypesShareEmittedSurface = (
  left: IrType,
  right: IrType,
  context: EmitterContext
): boolean => {
  try {
    const [leftAst, leftContext] = emitTypeAst(left, context);
    const [rightAst] = emitTypeAst(right, leftContext);
    return sameTypeAstSurface(leftAst, rightAst);
  } catch {
    return false;
  }
};

const storageTypesAreMutuallyCompatible = (
  left: IrType,
  right: IrType,
  context: EmitterContext
): boolean =>
  (matchesExpectedEmissionType(left, right, context) &&
    matchesExpectedEmissionType(right, left, context)) ||
  storageTypesShareEmittedSurface(left, right, context);

const resolveConditionalBranchStorageType = (
  expr: IrExpression,
  ast: CSharpExpressionAst,
  context: EmitterContext,
  counterpartType: IrType | undefined
): IrType | undefined => {
  if (
    counterpartType &&
    expr.kind === "literal" &&
    (expr.value === undefined || expr.value === null)
  ) {
    return counterpartType;
  }

  const directType = resolveDirectStorageExpressionType(expr, ast, context);
  if (directType) {
    return directType;
  }

  if (!counterpartType) {
    return undefined;
  }

  const effectiveType = resolveEffectiveExpressionType(expr, context);
  const effectiveStorageType = effectiveType
    ? (resolveRuntimeStorageType(effectiveType, context) ?? effectiveType)
    : undefined;
  if (
    effectiveStorageType &&
    storageTypesAreMutuallyCompatible(
      effectiveStorageType,
      counterpartType,
      context
    )
  ) {
    return counterpartType;
  }

  const inferredStorageType = expr.inferredType
    ? (resolveRuntimeStorageType(expr.inferredType, context) ??
      expr.inferredType)
    : undefined;
  if (
    inferredStorageType &&
    storageTypesAreMutuallyCompatible(
      inferredStorageType,
      counterpartType,
      context
    )
  ) {
    return counterpartType;
  }

  const sourceBackedReturnType =
    "sourceBackedReturnType" in expr ? expr.sourceBackedReturnType : undefined;
  const nullishBranchStorageType =
    getSingleNullishBranchStorageType(sourceBackedReturnType) ??
    getSingleNullishBranchStorageType(expr.inferredType);
  if (!nullishBranchStorageType) {
    return undefined;
  }

  return storageTypesAreMutuallyCompatible(
    nullishBranchStorageType,
    counterpartType,
    context
  )
    ? nullishBranchStorageType
    : undefined;
};

export const resolveExactStorageSurfaceExpressionType = (
  ast: CSharpExpressionAst
): IrType | undefined => {
  let target = ast;
  while (target.kind === "parenthesizedExpression") {
    target = target.expression;
  }

  switch (target.kind) {
    case "castExpression":
    case "asExpression":
      return tryConvertExactSurfaceTypeAstToIrType(target.type);
    case "objectCreationExpression":
      return tryConvertExactSurfaceTypeAstToIrType(target.type);
    case "arrayCreationExpression":
      return (() => {
        const elementType = tryConvertExactSurfaceTypeAstToIrType(
          target.elementType
        );
        return elementType
          ? {
              kind: "arrayType",
              elementType,
            }
          : undefined;
      })();
    case "invocationExpression": {
      if (
        extractCalleeNameFromAst(target.expression) !==
          "global::System.Array.Empty" ||
        target.typeArguments?.length !== 1
      ) {
        return undefined;
      }
      const [elementTypeArgument] = target.typeArguments;
      const elementType =
        elementTypeArgument &&
        tryConvertExactSurfaceTypeAstToIrType(elementTypeArgument);
      return elementType
        ? {
            kind: "arrayType",
            elementType,
          }
        : undefined;
    }
    default:
      return undefined;
  }
};

export const resolveDirectStorageExpressionType = (
  expr: IrExpression,
  ast: CSharpExpressionAst,
  context: EmitterContext
): IrType | undefined => {
  const directAst = (() => {
    let target = ast;
    while (target.kind === "parenthesizedExpression") {
      target = target.expression;
    }
    return target;
  })();

  const projectedType = tryResolveProjectedExpressionType(ast);
  if (projectedType) {
    return projectedType;
  }

  const identifierProjectionBaseTypes =
    expr.kind === "identifier"
      ? (() => {
          const originalContext =
            context.narrowedBindings?.has(expr.name) === true
              ? {
                  ...context,
                  narrowedBindings: new Map(
                    [...context.narrowedBindings].filter(
                      ([bindingName]) => bindingName !== expr.name
                    )
                  ),
                }
              : context;
          const conditionAlias = context.conditionAliases?.get(expr.name);
          return [
            resolveIdentifierRuntimeCarrierType(expr, originalContext),
            resolveDirectStorageIrType(expr, originalContext),
            resolveIdentifierRuntimeCarrierType(expr, context),
            conditionAlias?.inferredType,
            conditionAlias
              ? resolveDirectStorageIrType(conditionAlias, context)
              : undefined,
            context.localSemanticTypes?.get(expr.name),
            context.localValueTypes?.get(expr.name),
          ];
        })()
      : [];
  const runtimeProjectedType = [
    ...identifierProjectionBaseTypes,
    expr.inferredType,
  ]
    .flatMap((candidateType) => [
      tryResolveRuntimeUnionMemberType(candidateType, ast, context),
      tryResolveRuntimeUnionMemberType(candidateType, directAst, context),
      tryResolveRuntimeUnionMemberType(candidateType, ast, context, {
        verifyReceiver: false,
      }),
      tryResolveRuntimeUnionMemberType(candidateType, directAst, context, {
        verifyReceiver: false,
      }),
    ])
    .find((candidateType): candidateType is IrType => !!candidateType);
  if (runtimeProjectedType) {
    return runtimeProjectedType;
  }

  const exactSurfaceType = resolveExactStorageSurfaceExpressionType(ast);
  if (exactSurfaceType) {
    return exactSurfaceType;
  }

  if (expr.kind === "numericNarrowing") {
    return expr.inferredType;
  }

  const directReturnedExpressionType = (() => {
    const isRuntimeProjectionMatchAst =
      directAst.kind === "invocationExpression" &&
      (extractCalleeNameFromAst(directAst.expression)?.endsWith(".Match") ??
        false);
    if (isRuntimeProjectionMatchAst) {
      return undefined;
    }

    if (
      (expr.kind === "call" && directAst.kind === "invocationExpression") ||
      (expr.kind === "new" && directAst.kind === "objectCreationExpression") ||
      (expr.kind === "await" && directAst.kind === "awaitExpression")
    ) {
      return resolveDirectStorageIrType(expr, context);
    }

    return undefined;
  })();
  if (directReturnedExpressionType) {
    return directReturnedExpressionType;
  }

  if (
    expr.kind === "conditional" &&
    directAst.kind === "conditionalExpression"
  ) {
    const truthyContext = applyConditionBranchNarrowing(
      expr.condition,
      "truthy",
      context,
      emitConditionNarrowingStub
    );
    const falsyContext = applyConditionBranchNarrowing(
      expr.condition,
      "falsy",
      context,
      emitConditionNarrowingStub
    );
    const directWhenTrueType = resolveDirectStorageExpressionType(
      expr.whenTrue,
      directAst.whenTrue,
      truthyContext
    );
    const directWhenFalseType = resolveDirectStorageExpressionType(
      expr.whenFalse,
      directAst.whenFalse,
      falsyContext
    );
    const whenTrueType =
      directWhenTrueType ??
      resolveConditionalBranchStorageType(
        expr.whenTrue,
        directAst.whenTrue,
        truthyContext,
        directWhenFalseType
      );
    const whenFalseType =
      directWhenFalseType ??
      resolveConditionalBranchStorageType(
        expr.whenFalse,
        directAst.whenFalse,
        falsyContext,
        directWhenTrueType
      );
    if (
      whenTrueType &&
      whenFalseType &&
      storageTypesAreMutuallyCompatible(whenTrueType, whenFalseType, context)
    ) {
      return whenTrueType;
    }
  }

  const narrowKey =
    expr.kind === "identifier"
      ? expr.name
      : expr.kind === "memberAccess"
        ? getMemberAccessNarrowKey(expr)
        : undefined;
  const narrowed = narrowKey
    ? context.narrowedBindings?.get(narrowKey)
    : undefined;
  if (narrowed?.kind === "expr") {
    if (matchesStoredExpressionAst(ast, narrowed.carrierExprAst)) {
      return (
        narrowed.carrierType ??
        narrowed.sourceType ??
        resolveRuntimeCarrierIrType(expr, context) ??
        narrowed.type ??
        narrowed.storageType
      );
    }

    if (matchesStoredExpressionAst(ast, narrowed.storageExprAst)) {
      return (
        narrowed.storageType ??
        narrowed.type ??
        narrowed.sourceType ??
        resolveDirectStorageIrType(expr, context)
      );
    }

    if (matchesStoredExpressionAst(ast, narrowed.exprAst)) {
      const directStorageSurfaceType = isPlainDirectStorageSurfaceAst(ast)
        ? resolveDirectStorageIrType(expr, context)
        : undefined;
      return (
        tryResolveRuntimeUnionMemberType(expr.inferredType, ast, context, {
          verifyReceiver: false,
        }) ??
        tryResolveRuntimeUnionMemberType(
          narrowed.sourceType ??
            narrowed.carrierType ??
            narrowed.storageType ??
            narrowed.type,
          ast,
          context
        ) ??
        directStorageSurfaceType ??
        narrowed.storageType ??
        narrowed.type ??
        narrowed.sourceType
      );
    }
  }

  if (
    narrowed?.kind === "runtimeSubset" &&
    matchesStoredExpressionAst(ast, narrowed.storageExprAst)
  ) {
    const originalStorageContext =
      narrowKey && context.narrowedBindings?.has(narrowKey)
        ? (() => {
            const narrowedBindings = new Map(context.narrowedBindings);
            narrowedBindings.delete(narrowKey);
            return { ...context, narrowedBindings };
          })()
        : context;
    const originalStorageType = resolveDirectStorageIrType(
      expr,
      originalStorageContext
    );
    return (
      narrowed.type ??
      narrowed.sourceType ??
      originalStorageType ??
      resolveDirectStorageIrType(expr, context)
    );
  }

  const directStorageType = resolveDirectStorageIrType(expr, context);
  if (expr.kind === "identifier") {
    const storageType = directStorageType;
    const remappedLocal = context.localNameMap?.get(expr.name) ?? expr.name;
    if (
      ast.kind !== "identifierExpression" ||
      ast.identifier !== remappedLocal
    ) {
      const conditionAlias = context.conditionAliases?.get(expr.name);
      const originalContext =
        context.narrowedBindings?.has(expr.name) === true
          ? {
              ...context,
              narrowedBindings: new Map(
                [...context.narrowedBindings].filter(
                  ([bindingName]) => bindingName !== expr.name
                )
              ),
            }
          : context;
      const projectedTypeCandidates = [
        resolveIdentifierRuntimeCarrierType(expr, originalContext),
        resolveDirectStorageIrType(expr, originalContext),
        resolveIdentifierRuntimeCarrierType(expr, context),
        conditionAlias?.inferredType,
        conditionAlias
          ? resolveDirectStorageIrType(conditionAlias, context)
          : undefined,
        context.localSemanticTypes?.get(expr.name),
        context.localValueTypes?.get(expr.name),
        storageType,
        expr.inferredType,
      ];
      for (const candidateType of projectedTypeCandidates) {
        const projectedType = tryResolveRuntimeUnionMemberType(
          candidateType,
          ast,
          context
        );
        if (projectedType) {
          return projectedType;
        }
      }

      return undefined;
    }

    return storageType;
  }

  if (expr.kind !== "memberAccess") {
    return undefined;
  }

  const storageType = directStorageType;
  if (
    ast.kind !== "memberAccessExpression" &&
    ast.kind !== "conditionalMemberAccessExpression"
  ) {
    return tryResolveRuntimeUnionMemberType(storageType, ast, context);
  }

  return storageType;
};

export const resolveDirectStorageExpressionAst = (
  expr: IrExpression,
  context: EmitterContext
): CSharpExpressionAst | undefined => {
  if (expr.kind !== "identifier" && expr.kind !== "memberAccess") {
    return undefined;
  }

  const narrowKey =
    expr.kind === "identifier" ? expr.name : getMemberAccessNarrowKey(expr);
  const narrowed = narrowKey
    ? context.narrowedBindings?.get(narrowKey)
    : undefined;
  if (
    (narrowed?.kind === "expr" || narrowed?.kind === "runtimeSubset") &&
    narrowed.storageExprAst
  ) {
    return narrowed.storageExprAst;
  }

  if (expr.kind !== "identifier") {
    return undefined;
  }

  if (context.importBindings?.has(expr.name)) {
    return undefined;
  }

  return identifierExpression(
    context.localNameMap?.get(expr.name) ?? escapeCSharpIdentifier(expr.name)
  );
};

export const resolveRuntimeCarrierExpressionAst = (
  expr: IrExpression,
  context: EmitterContext
): CSharpExpressionAst | undefined => {
  const hasRuntimeCarrierSurface = (
    candidateAst: CSharpExpressionAst | undefined
  ): candidateAst is CSharpExpressionAst => {
    if (!candidateAst) {
      return false;
    }

    const runtimeCarrierType = resolveRuntimeCarrierIrType(expr, context);
    const candidateType = resolveDirectStorageExpressionType(
      expr,
      candidateAst,
      context
    );
    if (!runtimeCarrierType || !candidateType) {
      return false;
    }

    if (
      willCarryAsRuntimeUnion(runtimeCarrierType, context) ||
      willCarryAsRuntimeUnion(candidateType, context)
    ) {
      if (
        !willCarryAsRuntimeUnion(runtimeCarrierType, context) ||
        !willCarryAsRuntimeUnion(candidateType, context)
      ) {
        return false;
      }

      if (
        runtimeUnionAliasReferencesMatch(
          candidateType,
          runtimeCarrierType,
          context
        )
      ) {
        return true;
      }

      const [candidateLayout, candidateLayoutContext] = buildRuntimeUnionLayout(
        candidateType,
        context,
        emitTypeAst
      );
      const [runtimeCarrierLayout] = buildRuntimeUnionLayout(
        runtimeCarrierType,
        candidateLayoutContext,
        emitTypeAst
      );
      return (
        !!candidateLayout &&
        !!runtimeCarrierLayout &&
        sameTypeAstSurface(
          buildRuntimeUnionTypeAst(candidateLayout),
          buildRuntimeUnionTypeAst(runtimeCarrierLayout)
        )
      );
    }

    return (
      runtimeUnionAliasReferencesMatch(
        candidateType,
        runtimeCarrierType,
        context
      ) ||
      (matchesExpectedEmissionType(
        stripNullish(candidateType),
        stripNullish(runtimeCarrierType),
        context
      ) &&
        matchesExpectedEmissionType(
          stripNullish(runtimeCarrierType),
          stripNullish(candidateType),
          context
        ))
    );
  };

  if (expr.kind !== "identifier" && expr.kind !== "memberAccess") {
    return undefined;
  }

  const narrowKey =
    expr.kind === "identifier" ? expr.name : getMemberAccessNarrowKey(expr);
  const narrowed = narrowKey
    ? context.narrowedBindings?.get(narrowKey)
    : undefined;
  if (narrowed?.kind === "expr") {
    return (
      [narrowed.carrierExprAst, narrowed.exprAst, narrowed.storageExprAst].find(
        hasRuntimeCarrierSurface
      ) ??
      narrowed.carrierExprAst ??
      narrowed.storageExprAst ??
      narrowed.exprAst
    );
  }
  if (narrowed?.kind === "runtimeSubset" && narrowed.storageExprAst) {
    return hasRuntimeCarrierSurface(narrowed.storageExprAst)
      ? narrowed.storageExprAst
      : undefined;
  }

  if (expr.kind !== "identifier") {
    return undefined;
  }

  if (context.importBindings?.has(expr.name)) {
    return undefined;
  }

  return identifierExpression(
    context.localNameMap?.get(expr.name) ?? escapeCSharpIdentifier(expr.name)
  );
};

export {
  resolveDirectStorageIrType,
  resolveIdentifierCarrierStorageType,
  resolveIdentifierRuntimeCarrierType,
  resolveRuntimeCarrierIrType,
};
