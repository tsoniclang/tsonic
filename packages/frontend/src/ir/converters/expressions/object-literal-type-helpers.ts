/**
 * Object literal type helpers — property expected type resolution,
 * contextual type selection, key resolution, and function type normalization.
 */

import * as ts from "typescript";
import {
  IrFunctionType,
  IrInterfaceMember,
  IrType,
  IrExpression,
  IrParameter,
} from "../../types.js";
import { containsTypeParameter } from "../../types/ir-substitution.js";
import { stableIrTypeKeyIfDeterministic } from "../../types/type-ops.js";
import { convertExpression } from "../../expression-converter.js";
import type { ProgramContext } from "../../program-context.js";
import { convertBindingName } from "../../syntax/binding-patterns.js";
import { isNullishPrimitive } from "./array-literals.js";

type ObjectLiteralPrimitiveValue =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined;

const getLiteralPrimitiveValue = (
  expression: ts.Expression
):
  | { readonly ok: true; readonly value: ObjectLiteralPrimitiveValue }
  | { readonly ok: false } => {
  const current = unwrapDeterministicKeyExpression(expression);

  if (
    ts.isStringLiteral(current) ||
    ts.isNoSubstitutionTemplateLiteral(current)
  ) {
    return { ok: true, value: current.text };
  }

  if (ts.isNumericLiteral(current)) {
    return { ok: true, value: Number(current.text) };
  }

  if (current.kind === ts.SyntaxKind.TrueKeyword) {
    return { ok: true, value: true };
  }

  if (current.kind === ts.SyntaxKind.FalseKeyword) {
    return { ok: true, value: false };
  }

  if (current.kind === ts.SyntaxKind.NullKeyword) {
    return { ok: true, value: null };
  }

  if (
    ts.isPrefixUnaryExpression(current) &&
    current.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(current.operand)
  ) {
    return { ok: true, value: -Number(current.operand.text) };
  }

  if (ts.isBigIntLiteral(current)) {
    return { ok: true, value: BigInt(current.text.slice(0, -1)) };
  }

  return { ok: false };
};

const literalTypeContainsValue = (
  type: IrType,
  value: ObjectLiteralPrimitiveValue
): boolean | undefined => {
  if (type.kind === "literalType") {
    return Object.is(type.value, value);
  }

  if (type.kind !== "unionType") {
    return undefined;
  }

  let sawLiteralConstraint = false;
  for (const member of type.types) {
    const contains = literalTypeContainsValue(member, value);
    if (contains === true) {
      return true;
    }
    if (contains === false) {
      sawLiteralConstraint = true;
    }
  }

  return sawLiteralConstraint ? false : undefined;
};

const methodSignatureToFunctionType = (
  member: Extract<IrInterfaceMember, { kind: "methodSignature" }>
): IrFunctionType => ({
  kind: "functionType",
  typeParameters: member.typeParameters,
  parameters: member.parameters,
  returnType: member.returnType ?? { kind: "voidType" },
});

const collectMethodExpectedType = (
  members: readonly IrInterfaceMember[],
  propName: string
): IrType | undefined => {
  const methods = members.filter(
    (
      member
    ): member is Extract<IrInterfaceMember, { kind: "methodSignature" }> =>
      member.kind === "methodSignature" && member.name === propName
  );

  if (methods.length === 0) {
    return undefined;
  }

  const functionTypes = methods.map(methodSignatureToFunctionType);
  const [single] = functionTypes;
  return functionTypes.length === 1 && single
    ? single
    : { kind: "intersectionType", types: functionTypes };
};

/**
 * Get the expected type for an object property from the parent expected type.
 *
 * If expectedType is an objectType, looks up the property member directly.
 * If expectedType is a referenceType, we can't resolve it here (would need symbol table).
 */
export const getPropertyExpectedType = (
  propName: string,
  expectedType: IrType | undefined,
  ctx: ProgramContext
): IrType | undefined => {
  if (!expectedType) return undefined;

  if (expectedType.kind === "objectType") {
    const member = expectedType.members.find(
      (m) => m.kind === "propertySignature" && m.name === propName
    );
    if (member?.kind === "propertySignature") {
      return member.type;
    }
    return collectMethodExpectedType(expectedType.members, propName);
  }

  if (expectedType.kind === "referenceType") {
    // Use TypeSystem to resolve nominal members deterministically, including inherited members
    // and generic substitutions (e.g., `DeepContainer<T>.level1`).
    const memberType = ctx.typeSystem.typeOfMember(expectedType, {
      kind: "byName",
      name: propName,
    });
    return memberType.kind === "unknownType" ? undefined : memberType;
  }

  if (expectedType.kind === "dictionaryType") {
    // Thread dictionary value type to values (for nested object literal lowering).
    // Example: Record<string, unknown> → nested objects should lower deterministically.
    return expectedType.valueType;
  }

  return undefined;
};

export const selectObjectLiteralContextualType = (
  expectedType: IrType | undefined,
  literalKeys: readonly string[],
  ctx: ProgramContext,
  literalValues?: ReadonlyMap<string, ObjectLiteralPrimitiveValue>
): IrType | undefined => {
  if (!expectedType || literalKeys.length === 0) {
    return expectedType;
  }

  type Candidate = {
    readonly type: IrType;
    readonly order: number;
    readonly kind: "dictionary" | "object";
    readonly propertyCount: number;
    readonly literalMatchCount: number;
  };

  const candidates: Candidate[] = [];
  const seen = new Set<string>();

  const collectObjectPropertyNames = (type: IrType): readonly string[] => {
    if (type.kind === "objectType") {
      return type.members
        .filter(
          (
            member
          ): member is Extract<typeof member, { kind: "propertySignature" }> =>
            member.kind === "propertySignature"
        )
        .map((member) => member.name);
    }

    if (type.kind === "referenceType") {
      if (type.structuralMembers?.length) {
        return type.structuralMembers
          .filter(
            (
              member
            ): member is Extract<
              typeof member,
              { kind: "propertySignature" }
            > => member.kind === "propertySignature"
          )
          .map((member) => member.name);
      }
    }

    return [];
  };

  for (const candidate of ctx.typeSystem
    .collectNarrowingCandidates(expectedType)
    .filter(
      (member): member is IrType => !!member && !isNullishPrimitive(member)
    )) {
    const candidateKey = stableIrTypeKeyIfDeterministic(candidate);
    if (candidateKey) {
      if (seen.has(candidateKey)) {
        continue;
      }
      seen.add(candidateKey);
    }

    if (candidate.kind === "dictionaryType") {
      candidates.push({
        type: candidate,
        order: candidates.length,
        kind: "dictionary",
        propertyCount: Number.POSITIVE_INFINITY,
        literalMatchCount: 0,
      });
      continue;
    }

    if (candidate.kind !== "objectType" && candidate.kind !== "referenceType") {
      continue;
    }

    if (
      literalKeys.every(
        (key) => getPropertyExpectedType(key, candidate, ctx) !== undefined
      )
    ) {
      let literalCompatible = true;
      let literalMatchCount = 0;
      for (const [key, value] of literalValues ?? []) {
        const propertyType = getPropertyExpectedType(key, candidate, ctx);
        if (!propertyType) continue;
        const contains = literalTypeContainsValue(propertyType, value);
        if (contains === false) {
          literalCompatible = false;
          break;
        }
        if (contains === true) {
          literalMatchCount += 1;
        }
      }
      if (!literalCompatible) {
        continue;
      }

      candidates.push({
        type: candidate,
        order: candidates.length,
        kind: "object",
        propertyCount: collectObjectPropertyNames(candidate).length,
        literalMatchCount,
      });
    }
  }

  if (candidates.length === 0) {
    return expectedType;
  }

  candidates.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "object" ? -1 : 1;
    }

    if (left.kind === "object" && right.kind === "object") {
      if (left.literalMatchCount !== right.literalMatchCount) {
        return right.literalMatchCount - left.literalMatchCount;
      }

      if (left.propertyCount !== right.propertyCount) {
        return left.propertyCount - right.propertyCount;
      }
    }

    const leftKey = stableIrTypeKeyIfDeterministic(left.type);
    const rightKey = stableIrTypeKeyIfDeterministic(right.type);
    return leftKey && rightKey
      ? leftKey.localeCompare(rightKey)
      : left.order - right.order;
  });

  return candidates[0]?.type ?? expectedType;
};

export const collectObjectLiteralPrimitiveValues = (
  node: ts.ObjectLiteralExpression,
  ctx: ProgramContext
): ReadonlyMap<string, ObjectLiteralPrimitiveValue> => {
  const values = new Map<string, ObjectLiteralPrimitiveValue>();
  for (const prop of node.properties) {
    if (!ts.isPropertyAssignment(prop)) {
      continue;
    }

    const keyName = resolveObjectLiteralMemberKey(prop.name, ctx).keyName;
    if (!keyName) {
      continue;
    }

    const literal = getLiteralPrimitiveValue(prop.initializer);
    if (literal.ok) {
      values.set(keyName, literal.value);
    }
  }

  return values;
};

export const unwrapDeterministicKeyExpression = (
  expr: ts.Expression
): ts.Expression => {
  let current = expr;
  for (;;) {
    if (ts.isParenthesizedExpression(current)) {
      current = current.expression;
      continue;
    }
    if (
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isSatisfiesExpression(current)
    ) {
      current = current.expression;
      continue;
    }
    return current;
  }
};

export const tryResolveDeterministicObjectKeyNameFromSyntax = (
  expr: ts.Expression,
  ctx: ProgramContext,
  seenSymbols = new Set<ts.Symbol>()
): string | undefined => {
  const current = unwrapDeterministicKeyExpression(expr);
  if (
    ts.isStringLiteral(current) ||
    ts.isNoSubstitutionTemplateLiteral(current) ||
    ts.isNumericLiteral(current)
  ) {
    return String(current.text);
  }

  if (!ts.isIdentifier(current)) {
    return undefined;
  }

  const symbol = ctx.checker.getSymbolAtLocation(current);
  if (!symbol || seenSymbols.has(symbol)) {
    return undefined;
  }

  seenSymbols.add(symbol);
  const visitDeclarations = (target: ts.Symbol): string | undefined => {
    for (const decl of target.getDeclarations() ?? []) {
      if (
        ts.isVariableDeclaration(decl) &&
        decl.initializer &&
        ts.isVariableDeclarationList(decl.parent) &&
        (decl.parent.flags & ts.NodeFlags.Const) !== 0
      ) {
        const resolved = tryResolveDeterministicObjectKeyNameFromSyntax(
          decl.initializer,
          ctx,
          seenSymbols
        );
        if (resolved !== undefined) return resolved;
      }
    }
    return undefined;
  };

  const direct = visitDeclarations(symbol);
  if (direct !== undefined) return direct;

  if ((symbol.flags & ts.SymbolFlags.Alias) !== 0) {
    const aliased = ctx.checker.getAliasedSymbol(symbol);
    if (!seenSymbols.has(aliased)) {
      seenSymbols.add(aliased);
      return visitDeclarations(aliased);
    }
  }

  return undefined;
};

export const resolveObjectLiteralMemberKey = (
  name: ts.PropertyName,
  ctx: ProgramContext
): {
  readonly key: string | IrExpression;
  readonly keyName: string | undefined;
} => {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNoSubstitutionTemplateLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    const keyName = String(name.text);
    return { key: keyName, keyName };
  }

  if (!ts.isComputedPropertyName(name)) {
    return { key: "", keyName: undefined };
  }

  const keyName = tryResolveDeterministicObjectKeyNameFromSyntax(
    name.expression,
    ctx
  );
  const computedKey = convertExpression(
    unwrapDeterministicKeyExpression(name.expression),
    ctx,
    undefined
  );
  return { key: keyName ?? computedKey, keyName };
};

export const methodUsesObjectLiteralThis = (
  method: ts.MethodDeclaration
): boolean => {
  let found = false;
  const visit = (current: ts.Node): void => {
    if (found) return;
    if (current.kind === ts.SyntaxKind.ThisKeyword) {
      found = true;
      return;
    }
    if (
      ts.isFunctionExpression(current) ||
      ts.isFunctionDeclaration(current) ||
      ts.isMethodDeclaration(current) ||
      ts.isGetAccessorDeclaration(current) ||
      ts.isSetAccessorDeclaration(current)
    ) {
      if (current !== method) {
        return;
      }
    }
    ts.forEachChild(current, visit);
  };

  if (method.body) {
    visit(method.body);
  }
  return found;
};

export const normalizeExpectedFunctionType = (
  expectedType: IrType | undefined,
  ctx: ProgramContext
): IrFunctionType | undefined => {
  if (!expectedType) return undefined;
  const candidateMap = new Map<string, IrFunctionType>();
  for (const member of ctx.typeSystem
    .collectNarrowingCandidates(expectedType)
    .filter(
      (candidate): candidate is IrType =>
        !!candidate && !isNullishPrimitive(candidate)
    )) {
    const normalized =
      member.kind === "functionType"
        ? member
        : ctx.typeSystem.delegateToFunctionType(member);
    if (!normalized || containsTypeParameter(normalized)) {
      continue;
    }
    const key = stableIrTypeKeyIfDeterministic(normalized);
    if (!key) continue;
    candidateMap.set(key, normalized);
  }
  const candidates = [...candidateMap.values()];
  return candidates.length === 1 ? candidates[0] : undefined;
};

export const getExpectedFunctionParameterTypes = (
  expectedType: IrType | undefined,
  ctx: ProgramContext
): readonly (IrType | undefined)[] | undefined => {
  const fnType = normalizeExpectedFunctionType(expectedType, ctx);
  return fnType?.parameters.map((param) => param.type);
};

export const convertObjectLiteralMethodParameters = (
  parameters: ts.NodeArray<ts.ParameterDeclaration>,
  ctx: ProgramContext,
  expectedType: IrType | undefined
): readonly IrParameter[] => {
  const expectedParamTypes = getExpectedFunctionParameterTypes(
    expectedType,
    ctx
  );

  return parameters.map((param, index) => {
    const explicitType = param.type
      ? ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(param.type))
      : undefined;
    const paramType = explicitType ?? expectedParamTypes?.[index];

    return {
      kind: "parameter",
      pattern: convertBindingName(param.name, ctx),
      type: paramType,
      initializer: param.initializer
        ? convertExpression(param.initializer, ctx, paramType)
        : undefined,
      isOptional: !!param.questionToken,
      isRest: !!param.dotDotDotToken,
      passing: "value",
    };
  });
};

export const buildObjectLiteralMethodFunctionType = (
  method: ts.MethodDeclaration,
  ctx: ProgramContext,
  expectedType: IrType | undefined
): IrFunctionType => {
  const expectedFnType = normalizeExpectedFunctionType(expectedType, ctx);
  const parameters = convertObjectLiteralMethodParameters(
    method.parameters,
    ctx,
    expectedFnType ?? expectedType
  );
  const declaredReturnType = method.type
    ? ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(method.type))
    : undefined;

  return {
    kind: "functionType",
    parameters,
    returnType: declaredReturnType ??
      expectedFnType?.returnType ?? { kind: "unknownType" },
  };
};
