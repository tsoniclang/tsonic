/**
 * Equality-literal and instanceof narrowing resolvers.
 *
 * Handles equality comparisons against literals (null, undefined, booleans,
 * strings, numbers), instanceof checks, and equality literal target resolution.
 */

import * as ts from "typescript";
import type { ProgramContext } from "../program-context.js";
import { stableIrTypeKey, type IrType } from "../types.js";
import type { BindingInternal } from "../binding/binding-types.js";
import { simpleBindingContributesTypeIdentity } from "../../program/binding-registry.js";
import { tsbindgenClrTypeNameToTsTypeName } from "../../tsbindgen/names.js";
import type { DeclId } from "../type-system/index.js";
import {
  getAccessPathTarget,
  getCurrentTypeForAccessPath,
} from "./access-paths.js";
import {
  unwrapExpr,
  isEqualityOperator,
  isInequalityOperator,
  makeTypeNarrowing,
  filterTypeByResolvedCandidates,
  type TypeNarrowing,
} from "./narrowing-resolvers-typeof.js";

export type EqualityLiteralTarget =
  | {
      readonly kind: "exact";
      readonly type: IrType;
    }
  | {
      readonly kind: "nullish";
    };

export const tryResolveEqualityLiteralTarget = (
  expr: ts.Expression
): EqualityLiteralTarget | undefined => {
  const current = unwrapExpr(expr);

  if (current.kind === ts.SyntaxKind.NullKeyword) {
    return { kind: "exact", type: { kind: "primitiveType", name: "null" } };
  }

  if (
    current.kind === ts.SyntaxKind.Identifier &&
    (current as ts.Identifier).text === "undefined"
  ) {
    return {
      kind: "exact",
      type: { kind: "primitiveType", name: "undefined" },
    };
  }

  if (
    current.kind === ts.SyntaxKind.TrueKeyword ||
    current.kind === ts.SyntaxKind.FalseKeyword
  ) {
    return {
      kind: "exact",
      type: {
        kind: "literalType",
        value: current.kind === ts.SyntaxKind.TrueKeyword,
      },
    };
  }

  if (
    ts.isStringLiteral(current) ||
    ts.isNoSubstitutionTemplateLiteral(current)
  ) {
    return {
      kind: "exact",
      type: { kind: "literalType", value: current.text },
    };
  }

  if (ts.isNumericLiteral(current)) {
    return {
      kind: "exact",
      type: { kind: "literalType", value: Number(current.text) },
    };
  }

  return undefined;
};

export const candidateMatchesEqualityLiteral = (
  candidate: IrType,
  literal: EqualityLiteralTarget
): boolean => {
  if (literal.kind === "nullish") {
    return (
      (candidate.kind === "primitiveType" && candidate.name === "null") ||
      (candidate.kind === "primitiveType" && candidate.name === "undefined") ||
      (candidate.kind === "literalType" && candidate.value === null)
    );
  }

  const target = literal.type;
  if (target.kind === "primitiveType") {
    return candidate.kind === "primitiveType" && candidate.name === target.name;
  }

  if (target.kind === "literalType") {
    return candidate.kind === "literalType" && candidate.value === target.value;
  }

  return false;
};

export const narrowTypeByEqualityLiteral = (
  currentType: IrType | undefined,
  literal: EqualityLiteralTarget,
  wantEqual: boolean,
  ctx: ProgramContext
): IrType | undefined => {
  if (!currentType) return undefined;

  return filterTypeByResolvedCandidates(
    currentType,
    (candidate) =>
      candidateMatchesEqualityLiteral(candidate, literal) === wantEqual,
    ctx
  );
};

export const tryResolveEqualityLiteralNarrowing = (
  expr: ts.Expression,
  ctx: ProgramContext,
  whenTruthy: boolean
): TypeNarrowing | undefined => {
  const unwrapped = unwrapExpr(expr);
  if (!ts.isBinaryExpression(unwrapped)) return undefined;

  const operator = unwrapped.operatorToken.kind;
  const isEquality = isEqualityOperator(operator);
  const isInequality = isInequalityOperator(operator);
  if (!isEquality && !isInequality) return undefined;

  const leftTarget = getAccessPathTarget(unwrapped.left, ctx);
  const rightTarget = getAccessPathTarget(unwrapped.right, ctx);
  const leftLiteral = tryResolveEqualityLiteralTarget(unwrapped.left);
  const rightLiteral = tryResolveEqualityLiteralTarget(unwrapped.right);

  const literal =
    leftTarget && rightLiteral
      ? rightLiteral
      : rightTarget && leftLiteral
        ? leftLiteral
        : undefined;
  const narrowedTarget = leftTarget ?? rightTarget;
  if (!literal || !narrowedTarget) return undefined;

  const useNullishPair =
    literal.kind === "exact" &&
    literal.type.kind === "primitiveType" &&
    (literal.type.name === "null" || literal.type.name === "undefined") &&
    (operator === ts.SyntaxKind.EqualsEqualsToken ||
      operator === ts.SyntaxKind.ExclamationEqualsToken);
  const effectiveLiteral: EqualityLiteralTarget = useNullishPair
    ? { kind: "nullish" }
    : literal;
  const wantEqual = whenTruthy ? isEquality : isInequality;
  const currentType = getCurrentTypeForAccessPath(narrowedTarget, ctx);
  const targetType = narrowTypeByEqualityLiteral(
    currentType,
    effectiveLiteral,
    wantEqual,
    ctx
  );
  if (!targetType) return undefined;

  return makeTypeNarrowing(narrowedTarget, targetType);
};

export const resolveInstanceofTargetType = (
  expr: ts.Expression,
  ctx: ProgramContext
): IrType | undefined => {
  const tryResolveExplicitGlobalBindingTargetType = (
    identifier: ts.Identifier
  ): IrType | undefined => {
    const simpleBinding = ctx.bindings.getExactBindingByKind(
      identifier.text,
      "global"
    );
    if (
      !simpleBinding ||
      !simpleBindingContributesTypeIdentity(simpleBinding)
    ) {
      return undefined;
    }

    return {
      kind: "referenceType",
      name: tsbindgenClrTypeNameToTsTypeName(simpleBinding.type),
    };
  };

  const isAnonymousStructuralReferenceType = (type: IrType): boolean =>
    type.kind === "referenceType" &&
    type.name.startsWith("__Anon_") &&
    (type.structuralMembers?.length ?? 0) > 0;

  const tryResolveConstructTargetFromTypeNode = (
    node: ts.TypeNode | undefined
  ): IrType | undefined => {
    if (!node) {
      return undefined;
    }

    if (ts.isParenthesizedTypeNode(node)) {
      return tryResolveConstructTargetFromTypeNode(node.type);
    }

    if (ts.isConstructorTypeNode(node)) {
      return ctx.typeSystem.typeFromSyntax(
        ctx.binding.captureTypeSyntax(node.type)
      );
    }

    if (ts.isTypeLiteralNode(node)) {
      const candidates = new Map<string, IrType>();
      for (const member of node.members) {
        if (!ts.isConstructSignatureDeclaration(member) || !member.type) {
          continue;
        }

        const target = ctx.typeSystem.typeFromSyntax(
          ctx.binding.captureTypeSyntax(member.type)
        );
        if (target.kind === "unknownType") {
          continue;
        }

        const preferred = selectPreferredTargetType(target) ?? target;
        candidates.set(stableIrTypeKey(preferred), preferred);
      }

      return candidates.size === 1
        ? Array.from(candidates.values())[0]
        : undefined;
    }

    if (ts.isIntersectionTypeNode(node)) {
      const candidates = new Map<string, IrType>();
      for (const member of node.types) {
        const target = tryResolveConstructTargetFromTypeNode(member);
        if (!target) {
          continue;
        }
        candidates.set(stableIrTypeKey(target), target);
      }

      return candidates.size === 1
        ? Array.from(candidates.values())[0]
        : undefined;
    }

    return undefined;
  };

  const tryResolveConstructTargetFromDecl = (
    declId: DeclId
  ): IrType | undefined => {
    const handleRegistryGetter = (ctx.binding as Partial<BindingInternal>)
      ._getHandleRegistry;
    if (typeof handleRegistryGetter !== "function") {
      return undefined;
    }

    const declInfo = handleRegistryGetter.call(ctx.binding).getDecl(declId);
    if (!declInfo) {
      return undefined;
    }

    const nodes: (ts.TypeNode | undefined)[] = [
      declInfo.typeNode as ts.TypeNode | undefined,
      declInfo.valueDeclNode &&
      ts.isVariableDeclaration(declInfo.valueDeclNode as ts.Node)
        ? ((declInfo.valueDeclNode as ts.VariableDeclaration).type as
            | ts.TypeNode
            | undefined)
        : undefined,
    ];

    for (const node of nodes) {
      const target = tryResolveConstructTargetFromTypeNode(node);
      if (target) {
        return target;
      }
    }

    return undefined;
  };

  const tryResolvePrototypeTargetType = (
    type: IrType,
    seen: Set<string>
  ): IrType | undefined => {
    const typeKey = stableIrTypeKey(type);
    if (seen.has(typeKey)) {
      return undefined;
    }

    const prototypeType = ctx.typeSystem.typeOfMember(type, {
      kind: "byName",
      name: "prototype",
    });
    if (!prototypeType || prototypeType.kind === "unknownType") {
      return undefined;
    }

    const nextSeen = new Set(seen);
    nextSeen.add(typeKey);
    return selectPreferredTargetType(prototypeType, nextSeen);
  };

  const selectPreferredTargetType = (
    type: IrType,
    seen = new Set<string>()
  ): IrType | undefined => {
    if (
      type.kind === "unknownType" ||
      type.kind === "objectType" ||
      type.kind === "anyType"
    ) {
      return undefined;
    }

    if (isAnonymousStructuralReferenceType(type)) {
      return undefined;
    }

    if (type.kind === "referenceType") {
      const prototypeTarget = tryResolvePrototypeTargetType(type, seen);
      return prototypeTarget ?? type;
    }

    if (type.kind === "arrayType" || type.kind === "tupleType") {
      return type;
    }

    if (type.kind === "intersectionType") {
      const prototypeTarget = tryResolvePrototypeTargetType(type, seen);
      if (prototypeTarget) {
        return prototypeTarget;
      }

      const candidates = new Map<string, IrType>();
      for (const member of type.types) {
        const selected = selectPreferredTargetType(member, seen);
        if (!selected) {
          continue;
        }
        candidates.set(stableIrTypeKey(selected), selected);
      }

      return candidates.size === 1
        ? Array.from(candidates.values())[0]
        : undefined;
    }

    return undefined;
  };

  const unwrapped = unwrapExpr(expr);

  if (ts.isIdentifier(unwrapped)) {
    const explicitBindingTarget =
      tryResolveExplicitGlobalBindingTargetType(unwrapped);
    if (explicitBindingTarget) {
      return explicitBindingTarget;
    }

    const declId = ctx.binding.resolveIdentifier(unwrapped);
    if (declId) {
      const constructorTarget = tryResolveConstructTargetFromDecl(declId);
      if (constructorTarget) {
        return constructorTarget;
      }

      const preferredDeclType = selectPreferredTargetType(
        ctx.typeSystem.typeOfDecl(declId)
      );
      if (preferredDeclType) {
        return preferredDeclType;
      }

      const preferredValueReadType = selectPreferredTargetType(
        ctx.typeSystem.typeOfValueRead(declId)
      );
      if (preferredValueReadType) {
        return preferredValueReadType;
      }
    }

    return undefined;
  }

  const accessTarget = getAccessPathTarget(unwrapped, ctx);
  if (!accessTarget) return undefined;

  const type = getCurrentTypeForAccessPath(accessTarget, ctx);
  if (!type) return undefined;

  const preferred = selectPreferredTargetType(type);
  if (preferred) {
    return preferred;
  }

  return undefined;
};
