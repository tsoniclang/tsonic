/**
 * Object literal type helpers — property expected type resolution,
 * contextual type selection, key resolution, and function type normalization.
 */

import {
  getTstsNodeText,
  TstsSyntax,
  type GoPtr,
  type TstsNode,
  type TstsSymbol,
} from "@tsonic/tsts";
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
import { getTstsParameters } from "./helpers.js";

type TstsSemanticSymbol = GoPtr<TstsSymbol>;

type ObjectLiteralPrimitiveValue =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined;

const getLiteralPrimitiveValue = (
  expression: TstsNode
):
  | { readonly ok: true; readonly value: ObjectLiteralPrimitiveValue }
  | { readonly ok: false } => {
  const current = unwrapDeterministicKeyExpression(expression);

  if (
    current.Kind === TstsSyntax.KindStringLiteral ||
    current.Kind === TstsSyntax.KindNoSubstitutionTemplateLiteral
  ) {
    return { ok: true, value: getTstsNodeText(current) ?? "" };
  }

  if (current.Kind === TstsSyntax.KindNumericLiteral) {
    return { ok: true, value: Number(getTstsNodeText(current)) };
  }

  if (current.Kind === TstsSyntax.KindTrueKeyword) {
    return { ok: true, value: true };
  }

  if (current.Kind === TstsSyntax.KindFalseKeyword) {
    return { ok: true, value: false };
  }

  if (current.Kind === TstsSyntax.KindNullKeyword) {
    return { ok: true, value: null };
  }

  if (
    current.Kind === TstsSyntax.KindPrefixUnaryExpression &&
    TstsSyntax.AsPrefixUnaryExpression(current)?.Operator ===
      TstsSyntax.KindMinusToken &&
    TstsSyntax.AsPrefixUnaryExpression(current)?.Operand?.Kind ===
      TstsSyntax.KindNumericLiteral
  ) {
    return {
      ok: true,
      value: -Number(
        getTstsNodeText(TstsSyntax.AsPrefixUnaryExpression(current)?.Operand)
      ),
    };
  }

  if (current.Kind === TstsSyntax.KindBigIntLiteral) {
    return { ok: true, value: BigInt((getTstsNodeText(current) ?? "0n").slice(0, -1)) };
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
  node: TstsNode,
  ctx: ProgramContext
): ReadonlyMap<string, ObjectLiteralPrimitiveValue> => {
  const values = new Map<string, ObjectLiteralPrimitiveValue>();
  for (const prop of TstsSyntax.Node_Properties(node) ?? []) {
    if (!prop || prop.Kind !== TstsSyntax.KindPropertyAssignment) {
      continue;
    }

    const keyName = resolveObjectLiteralMemberKey(
      TstsSyntax.Node_Name(prop) ?? prop,
      ctx
    ).keyName;
    if (!keyName) {
      continue;
    }

    const initializer = TstsSyntax.Node_Initializer(prop);
    if (!initializer) continue;
    const literal = getLiteralPrimitiveValue(initializer);
    if (literal.ok) {
      values.set(keyName, literal.value);
    }
  }

  return values;
};

export const unwrapDeterministicKeyExpression = (
  expr: TstsNode
): TstsNode => {
  let current = expr;
  for (;;) {
    if (current.Kind === TstsSyntax.KindParenthesizedExpression) {
      const inner = TstsSyntax.Node_Expression(current);
      if (!inner) return current;
      current = inner;
      continue;
    }
    if (
      current.Kind === TstsSyntax.KindAsExpression ||
      current.Kind === TstsSyntax.KindTypeAssertionExpression ||
      current.Kind === TstsSyntax.KindSatisfiesExpression
    ) {
      const inner = TstsSyntax.Node_Expression(current);
      if (!inner) return current;
      current = inner;
      continue;
    }
    return current;
  }
};

export const tryResolveDeterministicObjectKeyNameFromSyntax = (
  expr: TstsNode,
  ctx: ProgramContext,
  seenSymbols = new Set<TstsSemanticSymbol>()
): string | undefined => {
  const current = unwrapDeterministicKeyExpression(expr);
  if (
    current.Kind === TstsSyntax.KindStringLiteral ||
    current.Kind === TstsSyntax.KindNoSubstitutionTemplateLiteral ||
    current.Kind === TstsSyntax.KindNumericLiteral
  ) {
    return String(getTstsNodeText(current) ?? "");
  }

  if (current.Kind !== TstsSyntax.KindIdentifier) {
    return undefined;
  }

  const symbol = ctx.sourceSemantics.getSymbol(current);
  if (!symbol || seenSymbols.has(symbol)) {
    return undefined;
  }

  seenSymbols.add(symbol);
  const visitDeclarations = (target: TstsSemanticSymbol): string | undefined => {
    for (const decl of ctx.sourceSemantics.getSymbolDeclarations(target)) {
      if (
        decl.Kind === TstsSyntax.KindVariableDeclaration &&
        TstsSyntax.Node_Initializer(decl) &&
        decl.Parent?.Kind === TstsSyntax.KindVariableDeclarationList &&
        (TstsSyntax.AsVariableDeclarationList(decl.Parent)?.Flags ?? 0) !== 0
      ) {
        const resolved = tryResolveDeterministicObjectKeyNameFromSyntax(
          TstsSyntax.Node_Initializer(decl)!,
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

  const aliased = ctx.sourceSemantics.resolveAlias(symbol);
  if (aliased !== symbol && !seenSymbols.has(aliased)) {
    seenSymbols.add(aliased);
    return visitDeclarations(aliased);
  }

  return undefined;
};

export const resolveObjectLiteralMemberKey = (
  name: TstsNode,
  ctx: ProgramContext
): {
  readonly key: string | IrExpression;
  readonly keyName: string | undefined;
} => {
  if (
    name.Kind === TstsSyntax.KindIdentifier ||
    name.Kind === TstsSyntax.KindStringLiteral ||
    name.Kind === TstsSyntax.KindNoSubstitutionTemplateLiteral ||
    name.Kind === TstsSyntax.KindNumericLiteral
  ) {
    const keyName = String(getTstsNodeText(name) ?? "");
    return { key: keyName, keyName };
  }

  if (name.Kind !== TstsSyntax.KindComputedPropertyName) {
    return { key: "", keyName: undefined };
  }

  const computedExpression = TstsSyntax.AsComputedPropertyName(name)?.Expression;
  if (!computedExpression) {
    return { key: "", keyName: undefined };
  }
  const keyName = tryResolveDeterministicObjectKeyNameFromSyntax(
    computedExpression,
    ctx
  );
  const computedKey = convertExpression(
    unwrapDeterministicKeyExpression(computedExpression),
    ctx,
    undefined
  );
  return { key: keyName ?? computedKey, keyName };
};

export const methodUsesObjectLiteralThis = (
  method: TstsNode
): boolean => {
  let found = false;
  const visit = (current: TstsNode): void => {
    if (found) return;
    if (current.Kind === TstsSyntax.KindThisKeyword) {
      found = true;
      return;
    }
    if (
      current.Kind === TstsSyntax.KindFunctionExpression ||
      current.Kind === TstsSyntax.KindFunctionDeclaration ||
      current.Kind === TstsSyntax.KindMethodDeclaration ||
      current.Kind === TstsSyntax.KindGetAccessor ||
      current.Kind === TstsSyntax.KindSetAccessor
    ) {
      if (current !== method) {
        return;
      }
    }
    TstsSyntax.Node_ForEachChild(current, (child): boolean => {
      if (child) visit(child);
      return false;
    });
  };

  const body = TstsSyntax.Node_Body(method);
  if (body) {
    visit(body);
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
  parameters: readonly TstsNode[],
  ctx: ProgramContext,
  expectedType: IrType | undefined
): readonly IrParameter[] => {
  const expectedParamTypes = getExpectedFunctionParameterTypes(
    expectedType,
    ctx
  );

  return parameters.map((param, index) => {
    const typeNode = TstsSyntax.Node_Type(param);
    const explicitType = typeNode
      ? ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(typeNode))
      : undefined;
    const paramType = explicitType ?? expectedParamTypes?.[index];
    const name = TstsSyntax.Node_Name(param) ?? param;
    const initializer = TstsSyntax.Node_Initializer(param);

    return {
      kind: "parameter",
      pattern: convertBindingName(name, ctx),
      type: paramType,
      initializer: initializer
        ? convertExpression(initializer, ctx, paramType)
        : undefined,
      isOptional: TstsSyntax.Node_QuestionToken(param) !== undefined,
      isRest:
        TstsSyntax.AsParameterDeclaration(param)?.DotDotDotToken !== undefined,
      passing: "value",
    };
  });
};

export const buildObjectLiteralMethodFunctionType = (
  method: TstsNode,
  ctx: ProgramContext,
  expectedType: IrType | undefined
): IrFunctionType => {
  const expectedFnType = normalizeExpectedFunctionType(expectedType, ctx);
  const parameters = convertObjectLiteralMethodParameters(
    getTstsParameters(method),
    ctx,
    expectedFnType ?? expectedType
  );
  const returnTypeNode = TstsSyntax.Node_Type(method);
  const declaredReturnType = returnTypeNode
    ? ctx.typeSystem.typeFromSyntax(
        ctx.binding.captureTypeSyntax(returnTypeNode)
      )
    : undefined;

  return {
    kind: "functionType",
    parameters,
    returnType: declaredReturnType ??
      expectedFnType?.returnType ?? { kind: "unknownType" },
  };
};
