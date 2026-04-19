import type { IrExpression, IrType } from "@tsonic/frontend";
import { identifierExpression } from "../core/format/backend-ast/builders.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";
import type { EmitterContext } from "../types.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import { tryResolveRuntimeUnionMemberType } from "../core/semantic/narrowed-expression-types.js";
import { getMemberAccessNarrowKey } from "../core/semantic/narrowing-keys.js";
import { extractCalleeNameFromAst } from "../core/format/backend-ast/utils.js";
import { sameTypeAstSurface } from "../core/format/backend-ast/utils.js";
import { matchesExpectedEmissionType } from "../core/semantic/expected-type-matching.js";
import { runtimeUnionAliasReferencesMatch } from "../core/semantic/runtime-union-alias-identity.js";
import { stripNullish } from "../core/semantic/type-resolution.js";
import {
  buildRuntimeUnionLayout,
  buildRuntimeUnionTypeAst,
} from "../core/semantic/runtime-unions.js";
import { willCarryAsRuntimeUnion } from "../core/semantic/union-semantics.js";
import { emitTypeAst } from "../type-emitter.js";
import {
  resolveDirectStorageIrType,
  resolveIdentifierCarrierStorageType,
  resolveIdentifierRuntimeCarrierType,
  resolveRuntimeCarrierIrType,
} from "../core/semantic/direct-storage-ir-types.js";

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

const tryResolveExactStorageSurfaceType = (
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
  const projectedType = tryResolveProjectedExpressionType(ast);
  if (projectedType) {
    return projectedType;
  }

  const exactSurfaceType = tryResolveExactStorageSurfaceType(ast);
  if (exactSurfaceType) {
    return exactSurfaceType;
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
      return (
        tryResolveRuntimeUnionMemberType(
          narrowed.sourceType ??
            narrowed.carrierType ??
            narrowed.storageType ??
            narrowed.type,
          ast,
          context
        ) ??
        narrowed.type ??
        narrowed.storageType ??
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
