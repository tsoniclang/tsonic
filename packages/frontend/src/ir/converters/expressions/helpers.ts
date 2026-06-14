/**
 * Helper functions for expression conversion.
 *
 * Source syntax comes from TSTS. Type information comes from TypeSystem and the
 * TSTS-backed source semantic boundary; this file must not import TypeScript.
 */

import {
  getTstsContainingSourceFile,
  getTstsIdentifierText,
  getTstsInitializerNode,
  isTstsFunctionLikeDeclaration,
  getTstsNodeLocation,
  getTstsNodeText,
  getTstsPropertyNameText,
  getTstsStatementNodes,
  TstsSyntax,
  type TstsNode,
} from "@tsonic/tsts";
import type { IrType } from "../../types.js";
import type { SourceLocation } from "../../../types/diagnostic.js";
import type { ProgramContext } from "../../program-context.js";
import { expandParameterTypesForArguments } from "../../type-system/type-system-call-resolution.js";

export const getSourceSpan = (node: TstsNode): SourceLocation | undefined =>
  getTstsNodeLocation(getTstsContainingSourceFile(node), node);

export const getTstsText = (node: TstsNode | undefined): string | undefined =>
  node ? getTstsNodeText(node) : undefined;

export const getTstsNameText = (
  node: TstsNode | undefined
): string | undefined =>
  node ? getTstsIdentifierText(TstsSyntax.Node_Name(node)) : undefined;

export const getTstsPropertyKeyText = (
  node: TstsNode | undefined
): string | undefined => getTstsPropertyNameText(node) ?? getTstsText(node);

export const getTstsNodeKind = (
  token: TstsNode | number | undefined
): number | undefined =>
  typeof token === "number" ? token : token?.Kind;

export const getTstsExpression = (
  node: TstsNode | undefined
): TstsNode | undefined => (node ? TstsSyntax.Node_Expression(node) : undefined);

const concreteTstsNodes = (
  nodes: readonly (TstsNode | undefined)[] | undefined
): readonly TstsNode[] =>
  (nodes ?? []).filter((node): node is TstsNode => node !== undefined);

export const getTstsArguments = (
  node: TstsNode | undefined
): readonly TstsNode[] =>
  node ? concreteTstsNodes(TstsSyntax.Node_Arguments(node)) : [];

export const getTstsTypeArguments = (
  node: TstsNode | undefined
): readonly TstsNode[] =>
  node ? concreteTstsNodes(TstsSyntax.Node_TypeArguments(node)) : [];

export const getTstsParameters = (
  node: TstsNode | undefined
): readonly TstsNode[] =>
  node ? concreteTstsNodes(TstsSyntax.Node_Parameters(node)) : [];

export const getTstsObjectProperties = (
  node: TstsNode | undefined
): readonly TstsNode[] =>
  node ? concreteTstsNodes(TstsSyntax.Node_Properties(node)) : [];

export const getTstsArrayElements = (
  node: TstsNode | undefined
): readonly TstsNode[] =>
  node ? concreteTstsNodes(TstsSyntax.Node_Elements(node)) : [];

export const getTstsDeclaredType = (
  node: TstsNode | undefined
): TstsNode | undefined => (node ? TstsSyntax.Node_Type(node) : undefined);

export const isTstsAsync = (node: TstsNode): boolean =>
  (TstsSyntax.Node_ModifierNodes(node) ?? []).some(
    (modifier) => modifier?.Kind === TstsSyntax.KindAsyncKeyword
  );

const stripParenthesizedExpression = (node: TstsNode): TstsNode => {
  let current = node;
  while (current.Kind === TstsSyntax.KindParenthesizedExpression) {
    const inner = getTstsExpression(current);
    if (!inner) {
      return current;
    }
    current = inner;
  }
  return current;
};

const deriveCallReturnType = (
  node: TstsNode,
  ctx: ProgramContext
): IrType | undefined => {
  const sigId = ctx.binding.resolveCallSignature(node);
  if (!sigId) return undefined;

  const resolved = ctx.typeSystem.resolveCall({
    sigId,
    argumentCount: getTstsArguments(node).length,
  });

  return resolved.returnType.kind === "unknownType"
    ? undefined
    : resolved.returnType;
};

const deriveNewExpressionType = (
  node: TstsNode,
  ctx: ProgramContext
): IrType | undefined => {
  const sigId = ctx.binding.resolveConstructorSignature(node);
  if (!sigId) return undefined;

  const explicitTypeArgs = getTstsTypeArguments(node).map((typeArg) =>
    ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(typeArg))
  );

  const argTypes: (IrType | undefined)[] = [];
  const args = getTstsArguments(node);
  for (const arg of args) {
    if (arg.Kind === TstsSyntax.KindSpreadElement) {
      argTypes.push(undefined);
    } else if (arg.Kind === TstsSyntax.KindNumericLiteral) {
      argTypes.push({ kind: "primitiveType", name: "number" });
    } else if (arg.Kind === TstsSyntax.KindStringLiteral) {
      argTypes.push({ kind: "primitiveType", name: "string" });
    } else if (
      arg.Kind === TstsSyntax.KindTrueKeyword ||
      arg.Kind === TstsSyntax.KindFalseKeyword
    ) {
      argTypes.push({ kind: "primitiveType", name: "boolean" });
    } else if (arg.Kind === TstsSyntax.KindIdentifier) {
      argTypes.push(deriveIdentifierType(arg, ctx));
    } else if (arg.Kind === TstsSyntax.KindNewExpression) {
      argTypes.push(deriveNewExpressionType(arg, ctx));
    } else {
      argTypes.push(undefined);
    }
  }

  const resolved = ctx.typeSystem.resolveCall({
    sigId,
    argumentCount: args.length,
    explicitTypeArgs: explicitTypeArgs.length > 0 ? explicitTypeArgs : undefined,
    argTypes,
  });

  return resolved.returnType.kind === "unknownType"
    ? undefined
    : resolved.returnType;
};

const deriveTypeFromInitializer = (
  initializer: TstsNode,
  ctx: ProgramContext
): IrType | undefined => {
  if (initializer.Kind === TstsSyntax.KindCallExpression) {
    return deriveCallReturnType(initializer, ctx);
  }
  if (initializer.Kind === TstsSyntax.KindNewExpression) {
    return deriveNewExpressionType(initializer, ctx);
  }
  if (initializer.Kind === TstsSyntax.KindIdentifier) {
    return deriveIdentifierType(initializer, ctx);
  }
  if (initializer.Kind === TstsSyntax.KindNumericLiteral) {
    return { kind: "primitiveType", name: "number" };
  }
  if (initializer.Kind === TstsSyntax.KindStringLiteral) {
    return { kind: "primitiveType", name: "string" };
  }
  if (
    initializer.Kind === TstsSyntax.KindTrueKeyword ||
    initializer.Kind === TstsSyntax.KindFalseKeyword
  ) {
    return { kind: "primitiveType", name: "boolean" };
  }
  if (initializer.Kind === TstsSyntax.KindArrayLiteralExpression) {
    const [firstElem] = getTstsArrayElements(initializer);
    if (firstElem && firstElem.Kind !== TstsSyntax.KindSpreadElement) {
      const elementType = deriveTypeFromInitializer(firstElem, ctx);
      return elementType ? { kind: "arrayType", elementType } : undefined;
    }
  }
  return undefined;
};

export const deriveIdentifierType = (
  node: TstsNode,
  ctx: ProgramContext
): IrType | undefined => {
  const declId = ctx.binding.resolveIdentifier(node);
  if (!declId) return undefined;

  const declType = ctx.typeSystem.typeOfValueRead(declId);
  return declType.kind === "unknownType" ? undefined : declType;
};

export const extractTypeArguments = (
  node: TstsNode,
  ctx: ProgramContext
): readonly IrType[] | undefined => {
  try {
    const typeArguments = getTstsTypeArguments(node);
    return typeArguments.length > 0
      ? typeArguments.map((typeArg) =>
          ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(typeArg))
        )
      : undefined;
  } catch {
    return undefined;
  }
};

export const checkIfRequiresSpecialization = (
  node: TstsNode,
  ctx: ProgramContext
): boolean => {
  try {
    const sigId =
      node.Kind === TstsSyntax.KindCallExpression
        ? ctx.binding.resolveCallSignature(node)
        : ctx.binding.resolveConstructorSignature(node);
    if (!sigId) return false;

    return (
      ctx.typeSystem.signatureHasConditionalReturn(sigId) ||
      ctx.typeSystem.signatureHasVariadicTypeParams(sigId)
    );
  } catch {
    return false;
  }
};

export const convertBinaryOperator = (
  token: TstsNode | number | undefined
): string => {
  const operatorMap: Record<number, string> = {
    [TstsSyntax.KindPlusToken]: "+",
    [TstsSyntax.KindMinusToken]: "-",
    [TstsSyntax.KindAsteriskToken]: "*",
    [TstsSyntax.KindSlashToken]: "/",
    [TstsSyntax.KindPercentToken]: "%",
    [TstsSyntax.KindAsteriskAsteriskToken]: "**",
    [TstsSyntax.KindEqualsEqualsToken]: "==",
    [TstsSyntax.KindExclamationEqualsToken]: "!=",
    [TstsSyntax.KindEqualsEqualsEqualsToken]: "===",
    [TstsSyntax.KindExclamationEqualsEqualsToken]: "!==",
    [TstsSyntax.KindLessThanToken]: "<",
    [TstsSyntax.KindGreaterThanToken]: ">",
    [TstsSyntax.KindLessThanEqualsToken]: "<=",
    [TstsSyntax.KindGreaterThanEqualsToken]: ">=",
    [TstsSyntax.KindLessThanLessThanToken]: "<<",
    [TstsSyntax.KindGreaterThanGreaterThanToken]: ">>",
    [TstsSyntax.KindGreaterThanGreaterThanGreaterThanToken]: ">>>",
    [TstsSyntax.KindAmpersandToken]: "&",
    [TstsSyntax.KindBarToken]: "|",
    [TstsSyntax.KindCaretToken]: "^",
    [TstsSyntax.KindAmpersandAmpersandToken]: "&&",
    [TstsSyntax.KindBarBarToken]: "||",
    [TstsSyntax.KindQuestionQuestionToken]: "??",
    [TstsSyntax.KindInKeyword]: "in",
    [TstsSyntax.KindInstanceOfKeyword]: "instanceof",
    [TstsSyntax.KindEqualsToken]: "=",
    [TstsSyntax.KindPlusEqualsToken]: "+=",
    [TstsSyntax.KindMinusEqualsToken]: "-=",
    [TstsSyntax.KindAsteriskEqualsToken]: "*=",
    [TstsSyntax.KindSlashEqualsToken]: "/=",
    [TstsSyntax.KindPercentEqualsToken]: "%=",
    [TstsSyntax.KindAsteriskAsteriskEqualsToken]: "**=",
    [TstsSyntax.KindLessThanLessThanEqualsToken]: "<<=",
    [TstsSyntax.KindGreaterThanGreaterThanEqualsToken]: ">>=",
    [TstsSyntax.KindGreaterThanGreaterThanGreaterThanEqualsToken]: ">>>=",
    [TstsSyntax.KindAmpersandEqualsToken]: "&=",
    [TstsSyntax.KindBarEqualsToken]: "|=",
    [TstsSyntax.KindCaretEqualsToken]: "^=",
    [TstsSyntax.KindAmpersandAmpersandEqualsToken]: "&&=",
    [TstsSyntax.KindBarBarEqualsToken]: "||=",
    [TstsSyntax.KindQuestionQuestionEqualsToken]: "??=",
  };

  return operatorMap[getTstsNodeKind(token) ?? TstsSyntax.KindEqualsToken] ?? "=";
};

export const isAssignmentOperator = (
  token: TstsNode | number | undefined
): boolean => {
  const kind = getTstsNodeKind(token);
  return kind !== undefined && TstsSyntax.IsAssignmentOperator(kind);
};

const getIdentifierCallableArgumentType = (
  call: TstsNode,
  argumentIndex: number,
  ctx: ProgramContext
): IrType | undefined => {
  const callee = getTstsExpression(call);
  if (!callee) return undefined;

  const target = stripParenthesizedExpression(callee);
  if (target.Kind !== TstsSyntax.KindIdentifier) {
    return undefined;
  }

  const declId = ctx.binding.resolveIdentifier(target);
  if (!declId) {
    return undefined;
  }

  const valueType = ctx.typeSystem.typeOfValueRead(declId);
  const callableType =
    valueType?.kind === "functionType"
      ? valueType
      : valueType
        ? ctx.typeSystem.delegateToFunctionType(valueType)
        : undefined;
  if (!callableType) {
    return undefined;
  }

  const parameterType = expandParameterTypesForArguments(
    callableType.parameters,
    callableType.parameters.map((parameter) => parameter.type),
    getTstsArguments(call).length
  )[argumentIndex];

  if (
    !parameterType ||
    parameterType.kind === "unknownType" ||
    ctx.typeSystem.containsTypeParameter(parameterType)
  ) {
    return undefined;
  }

  return parameterType;
};

export const getContextualType = (
  node: TstsNode,
  ctx: ProgramContext
): IrType | undefined => {
  try {
    const parent = node.Parent;
    if (!parent) return undefined;

    if (parent.Kind === TstsSyntax.KindVariableDeclaration) {
      const typeNode = getTstsDeclaredType(parent);
      return typeNode
        ? ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(typeNode))
        : undefined;
    }

    if (parent.Kind === TstsSyntax.KindReturnStatement) {
      let current: TstsNode | undefined = parent;
      while (current && !isTstsFunctionLikeDeclaration(current)) {
        current = current.Parent;
      }
      const returnTypeNode = getTstsDeclaredType(current);
      return returnTypeNode
        ? ctx.typeSystem.typeFromSyntax(
            ctx.binding.captureTypeSyntax(returnTypeNode)
          )
        : undefined;
    }

    if (parent.Kind === TstsSyntax.KindPropertyAssignment) {
      const propName = getTstsPropertyKeyText(TstsSyntax.Node_Name(parent));
      if (
        propName &&
        parent.Parent?.Kind === TstsSyntax.KindObjectLiteralExpression
      ) {
        const parentType = getContextualType(parent.Parent, ctx);
        if (parentType?.kind === "objectType") {
          const member = parentType.members.find(
            (m) => m.kind === "propertySignature" && m.name === propName
          );
          if (member?.kind === "propertySignature") {
            return member.type;
          }
        }
      }
    }

    if (parent.Kind === TstsSyntax.KindArrayLiteralExpression) {
      const arrayType = getContextualType(parent, ctx);
      return arrayType?.kind === "arrayType" ? arrayType.elementType : undefined;
    }

    if (
      parent.Kind === TstsSyntax.KindCallExpression ||
      parent.Kind === TstsSyntax.KindNewExpression
    ) {
      const args = getTstsArguments(parent);
      const argIndex = args.indexOf(node);
      if (argIndex < 0) return undefined;

      if (parent.Kind === TstsSyntax.KindCallExpression) {
        const directCallableParameterType = getIdentifierCallableArgumentType(
          parent,
          argIndex,
          ctx
        );
        if (directCallableParameterType) {
          return directCallableParameterType;
        }
      }

      const sigId =
        parent.Kind === TstsSyntax.KindCallExpression
          ? ctx.binding.resolveCallSignature(parent)
          : ctx.binding.resolveConstructorSignature(parent);
      if (sigId) {
        const resolved = ctx.typeSystem.resolveCall({
          sigId,
          argumentCount: args.length,
        });
        const paramType = resolved.parameterTypes[argIndex];
        if (paramType && paramType.kind !== "unknownType") {
          return paramType;
        }
      }
    }

    const initializer = getTstsInitializerNode(parent);
    return initializer === node
      ? deriveTypeFromInitializer(initializer, ctx)
      : undefined;
  } catch {
    return undefined;
  }
};

export const getTstsTopLevelStatementContaining = (
  node: TstsNode
): TstsNode | undefined => {
  const sourceFile = getTstsContainingSourceFile(node);
  if (!sourceFile) return undefined;
  const statements = getTstsStatementNodes(sourceFile);
  let current: TstsNode | undefined = node;
  while (current?.Parent && current.Parent !== sourceFile) {
    current = current.Parent;
  }
  return current && statements.includes(current) ? current : undefined;
};
