/**
 * Helper functions for object literal expression conversion
 */

import * as ts from "typescript";
import {
  IrBlockStatement,
  IrFunctionExpression,
  IrFunctionType,
  IrInterfaceMember,
  IrObjectProperty,
  IrType,
  IrExpression,
  IrParameter,
  IrStatement,
} from "../../types.js";
import {
  containsTypeParameter,
  typesEqual,
} from "../../types/ir-substitution.js";
import { stableIrTypeKey } from "../../types/type-ops.js";
import { convertExpression } from "../../expression-converter.js";
import type { ProgramContext } from "../../program-context.js";
import { convertAccessorProperty } from "../statements/declarations/classes/properties.js";
import { convertBindingName } from "../../syntax/binding-patterns.js";
import { isNullishPrimitive } from "./array-literals.js";

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
    // Direct member lookup - only check property signatures (not methods)
    const member = expectedType.members.find(
      (m) => m.kind === "propertySignature" && m.name === propName
    );
    return member?.kind === "propertySignature" ? member.type : undefined;
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
  ctx: ProgramContext
): IrType | undefined => {
  if (!expectedType || literalKeys.length === 0) {
    return expectedType;
  }

  type Candidate = {
    readonly type: IrType;
    readonly kind: "dictionary" | "object";
    readonly propertyCount: number;
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
    const candidateKey = stableIrTypeKey(candidate);
    if (seen.has(candidateKey)) {
      continue;
    }
    seen.add(candidateKey);

    if (candidate.kind === "dictionaryType") {
      candidates.push({
        type: candidate,
        kind: "dictionary",
        propertyCount: Number.POSITIVE_INFINITY,
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
      candidates.push({
        type: candidate,
        kind: "object",
        propertyCount: collectObjectPropertyNames(candidate).length,
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
      if (left.propertyCount !== right.propertyCount) {
        return left.propertyCount - right.propertyCount;
      }
    }

    return stableIrTypeKey(left.type).localeCompare(
      stableIrTypeKey(right.type)
    );
  });

  return candidates[0]?.type ?? expectedType;
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
    candidateMap.set(stableIrTypeKey(normalized), normalized);
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

export const getSynthesizedPropertyType = (
  expr: IrExpression,
  widenNumericLiterals: boolean
): IrType | undefined => {
  if (
    widenNumericLiterals &&
    expr.kind === "literal" &&
    typeof expr.value === "number"
  ) {
    return { kind: "primitiveType", name: "number" };
  }
  return expr.inferredType;
};

export const getProvisionalAccessorPropertyType = (
  memberName: string,
  getter: ts.GetAccessorDeclaration | undefined,
  setter: ts.SetAccessorDeclaration | undefined,
  expectedType: IrType | undefined,
  ctx: ProgramContext,
  objectLiteralThisType: IrType | undefined
): IrType | undefined => {
  const getterType = getter?.type
    ? ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(getter.type))
    : undefined;
  const setterValueParam = setter?.parameters[0];
  const setterType =
    setterValueParam?.type !== undefined
      ? ctx.typeSystem.typeFromSyntax(
          ctx.binding.captureTypeSyntax(setterValueParam.type)
        )
      : undefined;
  if (getterType) return getterType;
  if (setterType) return setterType;
  if (expectedType) return expectedType;

  if (!getter) return undefined;

  const accessorMember = convertAccessorProperty(
    memberName,
    getter,
    setter,
    objectLiteralThisType ? { ...ctx, objectLiteralThisType } : ctx,
    undefined
  );

  return accessorMember.kind === "propertyDeclaration"
    ? accessorMember.type
    : undefined;
};

export const collectReturnExpressionTypes = (
  stmt: IrStatement,
  acc: IrType[]
): void => {
  switch (stmt.kind) {
    case "returnStatement":
      if (stmt.expression?.inferredType) {
        acc.push(stmt.expression.inferredType);
      }
      return;
    case "blockStatement":
      for (const inner of stmt.statements) {
        collectReturnExpressionTypes(inner, acc);
      }
      return;
    case "ifStatement":
      collectReturnExpressionTypes(stmt.thenStatement, acc);
      if (stmt.elseStatement) {
        collectReturnExpressionTypes(stmt.elseStatement, acc);
      }
      return;
    case "whileStatement":
    case "forStatement":
    case "forOfStatement":
    case "forInStatement":
      collectReturnExpressionTypes(stmt.body, acc);
      return;
    case "switchStatement":
      for (const clause of stmt.cases) {
        for (const inner of clause.statements) {
          collectReturnExpressionTypes(inner, acc);
        }
      }
      return;
    case "tryStatement":
      collectReturnExpressionTypes(stmt.tryBlock, acc);
      if (stmt.catchClause) {
        collectReturnExpressionTypes(stmt.catchClause.body, acc);
      }
      if (stmt.finallyBlock) {
        collectReturnExpressionTypes(stmt.finallyBlock, acc);
      }
      return;
    default:
      return;
  }
};

export const inferDeterministicReturnTypeFromBlock = (
  body: IrBlockStatement
): IrType | undefined => {
  const returns: IrType[] = [];
  collectReturnExpressionTypes(body, returns);

  if (returns.length === 0) {
    return { kind: "voidType" };
  }

  const [first] = returns;
  if (!first) return undefined;
  if (first.kind === "unknownType" || first.kind === "anyType") {
    return undefined;
  }

  for (let index = 1; index < returns.length; index += 1) {
    const current = returns[index];
    if (!current || !typesEqual(current, first)) {
      return undefined;
    }
  }

  return first;
};

export const finalizeObjectLiteralMethodExpression = (
  expr: IrExpression
): IrExpression => {
  if (expr.kind !== "functionExpression") return expr;

  const functionInferredType =
    expr.inferredType?.kind === "functionType" ? expr.inferredType : undefined;
  const inferredReturnType =
    expr.returnType ?? functionInferredType?.returnType;
  const needsInference =
    inferredReturnType === undefined ||
    inferredReturnType.kind === "unknownType" ||
    inferredReturnType.kind === "anyType";

  if (!needsInference) return expr;

  const recoveredReturnType = inferDeterministicReturnTypeFromBlock(expr.body);
  if (!recoveredReturnType) return expr;

  return {
    ...expr,
    returnType: expr.returnType ?? recoveredReturnType,
    inferredType: {
      ...(functionInferredType ?? {
        kind: "functionType" as const,
        parameters: expr.parameters,
      }),
      returnType: recoveredReturnType,
    },
  } satisfies IrFunctionExpression;
};

export const collectSynthesizedObjectMembers = (
  properties: readonly IrObjectProperty[],
  pendingMethods: readonly {
    readonly keyName: string;
    readonly functionType: IrFunctionType;
  }[],
  pendingAccessors: readonly {
    readonly memberName: string;
    readonly propertyType: IrType | undefined;
  }[],
  widenNumericLiterals: boolean
): {
  readonly ok: boolean;
  readonly members?: readonly IrInterfaceMember[];
  readonly failureReason?: string;
} => {
  const synthesizedMembers: IrInterfaceMember[] = [];

  for (const prop of properties) {
    if (prop.kind === "property") {
      const keyName =
        typeof prop.key === "string"
          ? prop.key
          : prop.key.kind === "literal" && typeof prop.key.value === "string"
            ? prop.key.value
            : undefined;

      if (!keyName) {
        return {
          ok: false,
          failureReason:
            "Only identifier and computed string-literal keys are supported",
        };
      }

      const propType = getSynthesizedPropertyType(
        prop.value,
        widenNumericLiterals
      );
      if (
        !propType ||
        propType.kind === "unknownType" ||
        propType.kind === "anyType"
      ) {
        return {
          ok: false,
          failureReason: `Property '${keyName}' type cannot be recovered deterministically`,
        };
      }

      synthesizedMembers.push({
        kind: "propertySignature",
        name: keyName,
        type: propType,
        isOptional: false,
        isReadonly: false,
      });
      continue;
    }

    const spreadType = prop.expression.inferredType;
    if (spreadType?.kind !== "objectType") {
      return {
        ok: false,
        failureReason:
          "Spread sources must have a deterministically known object literal shape",
      };
    }

    for (const member of spreadType.members) {
      if (member.kind === "propertySignature") {
        synthesizedMembers.push(member);
      }
    }
  }

  for (const method of pendingMethods) {
    synthesizedMembers.push({
      kind: "propertySignature",
      name: method.keyName,
      type: method.functionType,
      isOptional: false,
      isReadonly: false,
    });
  }

  for (const accessor of pendingAccessors) {
    if (!accessor.propertyType) {
      return {
        ok: false,
        failureReason: `Accessor '${accessor.memberName}' type cannot be recovered deterministically`,
      };
    }

    synthesizedMembers.push({
      kind: "propertySignature",
      name: accessor.memberName,
      type: accessor.propertyType,
      isOptional: false,
      isReadonly: false,
    });
  }

  return { ok: true, members: synthesizedMembers };
};
