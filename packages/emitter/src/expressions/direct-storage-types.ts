import { type IrExpression, type IrType } from "@tsonic/frontend";
import { identifierExpression } from "../core/format/backend-ast/builders.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";
import type { EmitterContext } from "../types.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import { tryResolveRuntimeUnionMemberType } from "../core/semantic/narrowed-expression-types.js";
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
            resolvedClrType: "global::System.Byte",
          };
        case "sbyte":
          return {
            kind: "referenceType",
            name: "sbyte",
            resolvedClrType: "global::System.SByte",
          };
        case "short":
          return {
            kind: "referenceType",
            name: "short",
            resolvedClrType: "global::System.Int16",
          };
        case "ushort":
          return {
            kind: "referenceType",
            name: "ushort",
            resolvedClrType: "global::System.UInt16",
          };
        case "int":
          return { kind: "primitiveType", name: "int" };
        case "uint":
          return {
            kind: "referenceType",
            name: "uint",
            resolvedClrType: "global::System.UInt32",
          };
        case "long":
          return {
            kind: "referenceType",
            name: "long",
            resolvedClrType: "global::System.Int64",
          };
        case "ulong":
          return {
            kind: "referenceType",
            name: "ulong",
            resolvedClrType: "global::System.UInt64",
          };
        case "nint":
          return {
            kind: "referenceType",
            name: "nint",
            resolvedClrType: "global::System.IntPtr",
          };
        case "nuint":
          return {
            kind: "referenceType",
            name: "nuint",
            resolvedClrType: "global::System.UIntPtr",
          };
        case "float":
          return {
            kind: "referenceType",
            name: "float",
            resolvedClrType: "global::System.Single",
          };
        case "double":
          return { kind: "primitiveType", name: "number" };
        case "decimal":
          return {
            kind: "referenceType",
            name: "decimal",
            resolvedClrType: "global::System.Decimal",
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
      const resolvedClrType = `${
        typeAst.name.aliasQualifier ? `${typeAst.name.aliasQualifier}::` : ""
      }${typeAst.name.segments.join(".")}`;
      const name =
        typeAst.name.segments[typeAst.name.segments.length - 1] ??
        resolvedClrType;
      return {
        kind: "referenceType",
        name,
        resolvedClrType,
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

  if (
    expr.inferredType &&
    matchesExpectedEmissionType(expr.inferredType, counterpartType, context) &&
    matchesExpectedEmissionType(counterpartType, expr.inferredType, context)
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

  return matchesExpectedEmissionType(
    nullishBranchStorageType,
    counterpartType,
    context
  ) &&
    matchesExpectedEmissionType(
      counterpartType,
      nullishBranchStorageType,
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
      matchesExpectedEmissionType(whenTrueType, whenFalseType, context) &&
      matchesExpectedEmissionType(whenFalseType, whenTrueType, context)
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
    return (
      narrowed.sourceType ??
      narrowed.type ??
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
      return tryResolveRuntimeUnionMemberType(storageType, ast, context);
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
  if (narrowed?.kind === "expr" && narrowed.storageExprAst) {
    return narrowed.storageExprAst;
  }

  if (expr.kind !== "identifier") {
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
    return narrowed.storageExprAst;
  }

  if (expr.kind !== "identifier") {
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
