/**
 * Exact-comparison lowering helpers.
 * Determines whether an already-emitted C# AST node matches an expected type,
 * avoiding redundant casts.
 */

import { IrType, stableIrTypeKey } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "../type-emitter.js";
import {
  stripNullish,
  splitRuntimeNullishUnionMembers,
  resolveTypeAlias,
  isDefinitelyValueType,
} from "../core/semantic/type-resolution.js";
import { resolveComparableType } from "../core/semantic/comparable-types.js";
import { areIrTypesEquivalent } from "../core/semantic/type-equivalence.js";
import {
  sameTypeAstSurface,
  stripNullableTypeAst,
} from "../core/format/backend-ast/utils.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";
import {
  canPreferAnonymousStructuralTarget,
  resolveAnonymousStructuralReferenceType,
} from "./structural-adaptation.js";

export const hasNullishBranch = (type: IrType | undefined): boolean => {
  if (!type || type.kind !== "unionType") return false;
  return type.types.some(
    (member) =>
      member.kind === "primitiveType" &&
      (member.name === "null" || member.name === "undefined")
  );
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

  const normalized = resolveComparableType(type, context);
  if (isSafelyEmittableTypeForExactComparison(normalized, context)) {
    return normalized;
  }

  return undefined;
};

export const tryEmitExactComparisonTargetAst = (
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
  pushCandidate(resolveComparableType(type, context));

  for (const candidate of candidates) {
    try {
      return emitTypeAst(candidate, context);
    } catch {
      continue;
    }
  }

  return undefined;
};

export const canUseImplicitOptionalSurfaceConversion = (
  actualType: IrType,
  expectedType: IrType,
  context: EmitterContext
): boolean => {
  if (!hasNullishBranch(expectedType)) {
    return false;
  }

  const normalizedActualBase = resolveComparableType(
    stripNullish(actualType),
    context
  );
  const normalizedExpectedBase = resolveComparableType(
    stripNullish(expectedType),
    context
  );

  return areIrTypesEquivalent(
    normalizedActualBase,
    normalizedExpectedBase,
    context
  );
};

export const isExactCastToType = (
  ast: CSharpExpressionAst,
  targetType: CSharpTypeAst
): boolean =>
  ast.kind === "castExpression" && sameTypeAstSurface(ast.type, targetType);

export const isExactArrayCreationToType = (
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

  return sameTypeAstSurface(ast.expression.expression.type, targetType);
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

export const isExactNullableValueAccessToType = (
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

export const isExactExpressionToType = (
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
