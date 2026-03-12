/**
 * Flow narrowing helpers (frontend).
 *
 * Airplane-grade requirement:
 * - Deterministic (TS-free) narrowing logic
 * - Correct lexical scoping (key by DeclId.id, not by identifier text)
 *
 * Currently supports:
 * - `x instanceof T` in boolean (truthy) contexts
 * - Conjunction: `(x instanceof T) && ...` (collects narrowings from both sides)
 * - `istype<T>(x)` in boolean (truthy) contexts (compiler-only type guard)
 */

import * as ts from "typescript";
import type { ProgramContext } from "../program-context.js";
import type { IrType } from "../types.js";
import type { DeclId } from "../type-system/index.js";

export type TypeNarrowing = {
  readonly declId: number;
  readonly targetType: IrType;
};

type BoundDecl = DeclId;

const unwrapExpr = (expr: ts.Expression): ts.Expression => {
  let current = expr;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
};

const getStringLiteralText = (expr: ts.Expression): string | undefined => {
  const unwrapped = unwrapExpr(expr);
  if (
    ts.isStringLiteral(unwrapped) ||
    ts.isNoSubstitutionTemplateLiteral(unwrapped)
  ) {
    return unwrapped.text;
  }
  return undefined;
};

const extractIdentifierPropertyAccess = (
  value: ts.Expression,
  ctx: ProgramContext
): { declId: BoundDecl; propertyName: string } | undefined => {
  const candidate = unwrapExpr(value);

  if (ts.isPropertyAccessExpression(candidate)) {
    const object = unwrapExpr(candidate.expression);
    if (!ts.isIdentifier(object)) return undefined;
    const declId = ctx.binding.resolveIdentifier(object);
    if (!declId) return undefined;
    return { declId, propertyName: candidate.name.text };
  }

  if (ts.isElementAccessExpression(candidate)) {
    const object = unwrapExpr(candidate.expression);
    const argument = candidate.argumentExpression
      ? unwrapExpr(candidate.argumentExpression)
      : undefined;
    if (!ts.isIdentifier(object) || !argument) return undefined;
    const propertyName = getStringLiteralText(argument);
    if (!propertyName) return undefined;
    const declId = ctx.binding.resolveIdentifier(object);
    if (!declId) return undefined;
    return { declId, propertyName };
  }

  return undefined;
};

const genericTypeofTarget = (tag: string): IrType | undefined => {
  switch (tag) {
    case "string":
      return { kind: "primitiveType", name: "string" };
    case "number":
      return { kind: "primitiveType", name: "number" };
    case "boolean":
      return { kind: "primitiveType", name: "boolean" };
    case "undefined":
      return { kind: "primitiveType", name: "undefined" };
    default:
      return undefined;
  }
};

const matchesTypeofTag = (type: IrType, tag: string): boolean => {
  if (type.kind === "literalType") {
    switch (tag) {
      case "string":
        return typeof type.value === "string";
      case "number":
        return typeof type.value === "number";
      case "boolean":
        return typeof type.value === "boolean";
      default:
        return false;
    }
  }

  if (type.kind !== "primitiveType") return false;

  switch (tag) {
    case "string":
      return type.name === "string";
    case "number":
      return type.name === "number" || type.name === "int";
    case "boolean":
      return type.name === "boolean";
    case "undefined":
      return type.name === "undefined";
    default:
      return false;
  }
};

const narrowTypeByTypeofTag = (
  currentType: IrType | undefined,
  tag: string
): IrType | undefined => {
  if (!currentType) return genericTypeofTarget(tag);

  if (currentType.kind === "unionType") {
    const kept = currentType.types.filter(
      (member): member is IrType => !!member && matchesTypeofTag(member, tag)
    );
    if (kept.length === 1) return kept[0];
    if (kept.length > 1) {
      return { kind: "unionType", types: kept };
    }
    return genericTypeofTarget(tag);
  }

  return matchesTypeofTag(currentType, tag)
    ? currentType
    : genericTypeofTarget(tag);
};

const tryResolveTruthyNarrowing = (
  expr: ts.Expression,
  ctx: ProgramContext
): TypeNarrowing | undefined => {
  const unwrapped = unwrapExpr(expr);

  const getCurrentType = (declId: BoundDecl): IrType =>
    ctx.typeEnv?.get(declId.id) ?? ctx.typeSystem.typeOfDecl(declId);

  const getMemberTypeForNarrowing = (
    type: IrType,
    propertyName: string
  ): IrType | undefined => {
    if (type.kind === "objectType") {
      const member = type.members.find(
        (candidate) =>
          candidate.kind === "propertySignature" &&
          candidate.name === propertyName
      );
      return member && member.kind === "propertySignature"
        ? member.type
        : undefined;
    }

    if (
      type.kind === "referenceType" &&
      type.structuralMembers &&
      type.structuralMembers.length > 0
    ) {
      const member = type.structuralMembers.find(
        (candidate) =>
          candidate.kind === "propertySignature" &&
          candidate.name === propertyName
      );
      return member && member.kind === "propertySignature"
        ? member.type
        : undefined;
    }

    const memberType = ctx.typeSystem.typeOfMember(type, {
      kind: "byName",
      name: propertyName,
    });
    return memberType.kind === "unknownType" ? undefined : memberType;
  };

  const propertyTypeIsDefinitelyTruthy = (type: IrType | undefined): boolean => {
    if (!type) return false;
    if (type.kind === "literalType") {
      return type.value === true;
    }
    return false;
  };

  const propertyTypeIsDefinitelyFalsy = (type: IrType | undefined): boolean => {
    if (!type) return false;
    if (type.kind === "literalType") {
      return type.value === false;
    }
    if (type.kind === "primitiveType") {
      return type.name === "undefined" || type.name === "null";
    }
    return false;
  };

  const collectPropertyNarrowingCandidates = (
    currentType: IrType
  ): readonly IrType[] => {
    const expanded = ctx.typeSystem.collectNarrowingCandidates(currentType);
    return expanded.length > 0 ? expanded : [currentType];
  };

  const narrowTypeByPropertyTruthiness = (
    currentType: IrType,
    propertyName: string,
    wantTruthy: boolean
  ): IrType | undefined => {
    const kept = collectPropertyNarrowingCandidates(currentType).filter(
      (member): member is IrType => {
        if (!member) return false;
        const memberType = getMemberTypeForNarrowing(member, propertyName);
        return wantTruthy
          ? propertyTypeIsDefinitelyTruthy(memberType)
          : propertyTypeIsDefinitelyFalsy(memberType);
      }
    );

    if (kept.length === 0) return undefined;
    if (kept.length === 1) return kept[0];
    return { kind: "unionType", types: kept };
  };

  const narrowTypeByPropertyPresence = (
    currentType: IrType,
    propertyName: string,
    wantPresent: boolean
  ): IrType | undefined => {
    const kept = collectPropertyNarrowingCandidates(currentType).filter(
      (member): member is IrType => {
        if (!member) return false;
        const hasMember = getMemberTypeForNarrowing(member, propertyName) !== undefined;
        return hasMember === wantPresent;
      }
    );

    if (kept.length === 0) return undefined;
    if (kept.length === 1) return kept[0];
    return { kind: "unionType", types: kept };
  };

  const propertyAccess = extractIdentifierPropertyAccess(unwrapped, ctx);
  if (propertyAccess) {
    const currentType = getCurrentType(propertyAccess.declId);
    const targetType = narrowTypeByPropertyTruthiness(
      currentType,
      propertyAccess.propertyName,
      true
    );
    if (targetType) {
      return { declId: propertyAccess.declId.id, targetType };
    }
  }

  if (
    ts.isBinaryExpression(unwrapped) &&
    unwrapped.operatorToken.kind === ts.SyntaxKind.InKeyword
  ) {
    const propertyName = getStringLiteralText(unwrapped.left);
    const object = unwrapExpr(unwrapped.right);
    if (propertyName && ts.isIdentifier(object)) {
      const declId = ctx.binding.resolveIdentifier(object);
      if (declId) {
        const targetType = narrowTypeByPropertyPresence(
          getCurrentType(declId),
          propertyName,
          true
        );
        if (targetType) {
          return { declId: declId.id, targetType };
        }
      }
    }
  }

  // istype<T>(x)
  if (
    ts.isCallExpression(unwrapped) &&
    ts.isIdentifier(unwrapped.expression) &&
    unwrapped.expression.text === "istype" &&
    unwrapped.typeArguments &&
    unwrapped.typeArguments.length === 1 &&
    unwrapped.arguments.length === 1
  ) {
    const typeArg = unwrapped.typeArguments[0];
    const rawArg = unwrapped.arguments[0];
    if (!typeArg || !rawArg) return undefined;
    const valueArg = unwrapExpr(rawArg);
    if (!ts.isIdentifier(valueArg)) return undefined;

    const targetType = ctx.typeSystem.typeFromSyntax(
      ctx.binding.captureTypeSyntax(typeArg)
    );
    if (targetType.kind === "unknownType") return undefined;

    const narrowedDeclId = ctx.binding.resolveIdentifier(valueArg);
    if (!narrowedDeclId) return undefined;

    return { declId: narrowedDeclId.id, targetType };
  }

  // typeof x === "string" / "number" / "boolean" / "undefined"
  if (
    ts.isBinaryExpression(unwrapped) &&
    (unwrapped.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      unwrapped.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken)
  ) {
    const left = unwrapExpr(unwrapped.left);
    const right = unwrapExpr(unwrapped.right);
    const leftLiteral = getStringLiteralText(left);
    const rightLiteral = getStringLiteralText(right);

    const extractTypeofIdentifier = (
      expr: ts.Expression
    ): ts.Identifier | undefined => {
      if (!ts.isTypeOfExpression(expr)) return undefined;
      const operand = unwrapExpr(expr.expression);
      return ts.isIdentifier(operand) ? operand : undefined;
    };

    const leftTypeofIdent = extractTypeofIdentifier(left);
    const rightTypeofIdent = extractTypeofIdentifier(right);

    const tag =
      leftTypeofIdent && rightLiteral
        ? rightLiteral
        : rightTypeofIdent && leftLiteral
          ? leftLiteral
          : undefined;
    const narrowedIdent = leftTypeofIdent ?? rightTypeofIdent;
    if (!tag || !narrowedIdent) return undefined;

    const narrowedDeclId = ctx.binding.resolveIdentifier(narrowedIdent);
    if (!narrowedDeclId) return undefined;

    const currentType =
      ctx.typeEnv?.get(narrowedDeclId.id) ??
      ctx.typeSystem.typeOfDecl(narrowedDeclId);
    const targetType = narrowTypeByTypeofTag(currentType, tag);
    if (!targetType) return undefined;

    return { declId: narrowedDeclId.id, targetType };
  }

  // x instanceof T
  if (!ts.isBinaryExpression(unwrapped)) return undefined;
  if (unwrapped.operatorToken.kind !== ts.SyntaxKind.InstanceOfKeyword)
    return undefined;

  const left = unwrapExpr(unwrapped.left);
  const right = unwrapExpr(unwrapped.right);

  if (!ts.isIdentifier(left)) return undefined;
  if (!ts.isIdentifier(right)) return undefined;

  const targetDeclId = ctx.binding.resolveIdentifier(right);
  if (!targetDeclId) return undefined;

  const targetType = ctx.typeSystem.typeOfDecl(targetDeclId);
  if (targetType.kind === "unknownType") return undefined;

  const narrowedDeclId = ctx.binding.resolveIdentifier(left);
  if (!narrowedDeclId) return undefined;

  return { declId: narrowedDeclId.id, targetType };
};

/**
 * Collect `instanceof` narrowings that are guaranteed to hold when `expr` is truthy.
 *
 * We only collect from conjunctions (&&) because truthiness of `A && B` implies both
 * `A` and `B` are truthy; for `A || B` it does not guarantee either side.
 */
export const collectTypeNarrowingsInTruthyExpr = (
  expr: ts.Expression,
  ctx: ProgramContext
): readonly TypeNarrowing[] => {
  const unwrapped = unwrapExpr(expr);

  if (
    ts.isPrefixUnaryExpression(unwrapped) &&
    unwrapped.operator === ts.SyntaxKind.ExclamationToken
  ) {
    return collectTypeNarrowingsInFalsyExpr(unwrapped.operand, ctx);
  }

  const direct = tryResolveTruthyNarrowing(unwrapped, ctx);
  if (direct) return [direct];

  if (ts.isBinaryExpression(unwrapped)) {
    if (
      unwrapped.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
    ) {
      return [
        ...collectTypeNarrowingsInTruthyExpr(unwrapped.left, ctx),
        ...collectTypeNarrowingsInTruthyExpr(unwrapped.right, ctx),
      ];
    }
  }

  return [];
};

const tryResolveFalsyNarrowing = (
  expr: ts.Expression,
  ctx: ProgramContext
): TypeNarrowing | undefined => {
  const unwrapped = unwrapExpr(expr);

  if (
    ts.isPrefixUnaryExpression(unwrapped) &&
    unwrapped.operator === ts.SyntaxKind.ExclamationToken
  ) {
    const truthy = collectTypeNarrowingsInTruthyExpr(unwrapped.operand, ctx);
    return truthy[0];
  }

  const getCurrentType = (declId: BoundDecl): IrType =>
    ctx.typeEnv?.get(declId.id) ?? ctx.typeSystem.typeOfDecl(declId);

  const getMemberTypeForNarrowing = (
    type: IrType,
    propertyName: string
  ): IrType | undefined => {
    if (type.kind === "objectType") {
      const member = type.members.find(
        (candidate) =>
          candidate.kind === "propertySignature" &&
          candidate.name === propertyName
      );
      return member && member.kind === "propertySignature"
        ? member.type
        : undefined;
    }

    if (
      type.kind === "referenceType" &&
      type.structuralMembers &&
      type.structuralMembers.length > 0
    ) {
      const member = type.structuralMembers.find(
        (candidate) =>
          candidate.kind === "propertySignature" &&
          candidate.name === propertyName
      );
      return member && member.kind === "propertySignature"
        ? member.type
        : undefined;
    }

    const memberType = ctx.typeSystem.typeOfMember(type, {
      kind: "byName",
      name: propertyName,
    });
    return memberType.kind === "unknownType" ? undefined : memberType;
  };

  const collectPropertyNarrowingCandidates = (
    currentType: IrType
  ): readonly IrType[] => {
    const expanded = ctx.typeSystem.collectNarrowingCandidates(currentType);
    return expanded.length > 0 ? expanded : [currentType];
  };

  const narrowTypeByPropertyTruthiness = (
    currentType: IrType,
    propertyName: string,
    wantTruthy: boolean
  ): IrType | undefined => {
    const kept = collectPropertyNarrowingCandidates(currentType).filter(
      (member): member is IrType => {
        if (!member) return false;
        const memberType = getMemberTypeForNarrowing(member, propertyName);
        if (!memberType || memberType.kind !== "literalType") return false;
        return wantTruthy ? memberType.value === true : memberType.value === false;
      }
    );

    if (kept.length === 0) return undefined;
    if (kept.length === 1) return kept[0];
    return { kind: "unionType", types: kept };
  };

  const narrowTypeByPropertyPresence = (
    currentType: IrType,
    propertyName: string,
    wantPresent: boolean
  ): IrType | undefined => {
    const kept = collectPropertyNarrowingCandidates(currentType).filter(
      (member): member is IrType => {
        if (!member) return false;
        const hasMember = getMemberTypeForNarrowing(member, propertyName) !== undefined;
        return hasMember === wantPresent;
      }
    );

    if (kept.length === 0) return undefined;
    if (kept.length === 1) return kept[0];
    return { kind: "unionType", types: kept };
  };

  const propertyAccess = extractIdentifierPropertyAccess(unwrapped, ctx);
  if (propertyAccess) {
    const currentType = getCurrentType(propertyAccess.declId);
    const targetType = narrowTypeByPropertyTruthiness(
      currentType,
      propertyAccess.propertyName,
      false
    );
    if (targetType) {
      return { declId: propertyAccess.declId.id, targetType };
    }
  }

  if (
    ts.isBinaryExpression(unwrapped) &&
    unwrapped.operatorToken.kind === ts.SyntaxKind.InKeyword
  ) {
    const propertyName = getStringLiteralText(unwrapped.left);
    const object = unwrapExpr(unwrapped.right);
    if (propertyName && ts.isIdentifier(object)) {
      const declId = ctx.binding.resolveIdentifier(object);
      if (declId) {
        const targetType = narrowTypeByPropertyPresence(
          getCurrentType(declId),
          propertyName,
          false
        );
        if (targetType) {
          return { declId: declId.id, targetType };
        }
      }
    }
  }

  return undefined;
};

export const collectTypeNarrowingsInFalsyExpr = (
  expr: ts.Expression,
  ctx: ProgramContext
): readonly TypeNarrowing[] => {
  const unwrapped = unwrapExpr(expr);

  const direct = tryResolveFalsyNarrowing(unwrapped, ctx);
  if (direct) return [direct];

  return [];
};

export const withAppliedNarrowings = (
  ctx: ProgramContext,
  narrowings: readonly TypeNarrowing[]
): ProgramContext => {
  if (narrowings.length === 0) return ctx;

  const next = new Map<number, IrType>(ctx.typeEnv ?? []);
  for (const n of narrowings) {
    next.set(n.declId, n.targetType);
  }
  return { ...ctx, typeEnv: next };
};
