/**
 * Loop statement converters (while, for, for-of)
 *
 * Uses ProgramContext for loop conversion.
 */

import { TstsSyntax, type TstsNode } from "@tsonic/tsts";
import {
  IrWhileStatement,
  IrForStatement,
  IrForOfStatement,
  IrForInStatement,
  IrType,
} from "../../../types.js";
import { normalizedUnionType } from "../../../types/type-ops.js";
import { convertExpression } from "../../../expression-converter.js";
import { convertBindingName } from "../../../syntax/binding-patterns.js";
import { convertStatementSingle } from "../../../statement-converter.js";
import {
  convertVariableDeclarationList,
  definedTstsNodes,
} from "../helpers.js";
import type { ProgramContext } from "../../../program-context.js";
import { withVariableTypeEnv } from "../../type-env.js";

const isOneLiteral = (node: TstsNode): boolean =>
  node.Kind === TstsSyntax.KindNumericLiteral && TstsSyntax.Node_Text(node) === "1";

const isIdentifierNamed = (
  node: TstsNode,
  name: string
): boolean =>
  node.Kind === TstsSyntax.KindIdentifier && TstsSyntax.Node_Text(node) === name;

const isCanonicalIntegerIncrementor = (
  incrementor: TstsNode | undefined,
  name: string
): boolean => {
  if (!incrementor) return false;

  if (
    TstsSyntax.IsPostfixUnaryExpression(incrementor) ||
    TstsSyntax.IsPrefixUnaryExpression(incrementor)
  ) {
    const updateExpression =
      TstsSyntax.AsPostfixUnaryExpression(incrementor) ??
      TstsSyntax.AsPrefixUnaryExpression(incrementor);
    return (
      updateExpression?.Operator === TstsSyntax.KindPlusPlusToken &&
      !!updateExpression.Operand &&
      isIdentifierNamed(updateExpression.Operand, name)
    );
  }

  if (!TstsSyntax.IsBinaryExpression(incrementor)) return false;
  const binary = TstsSyntax.AsBinaryExpression(incrementor);
  if (!binary) return false;

  if (
    binary.OperatorToken?.Kind === TstsSyntax.KindPlusEqualsToken &&
    !!binary.Left &&
    isIdentifierNamed(binary.Left, name)
  ) {
    return !!binary.Right && isOneLiteral(binary.Right);
  }

  if (
    binary.OperatorToken?.Kind !== TstsSyntax.KindEqualsToken ||
    !binary.Left ||
    !isIdentifierNamed(binary.Left, name) ||
    !binary.Right ||
    !TstsSyntax.IsBinaryExpression(binary.Right)
  ) {
    return false;
  }
  const right = TstsSyntax.AsBinaryExpression(binary.Right);
  if (!right || right.OperatorToken?.Kind !== TstsSyntax.KindPlusToken) {
    return false;
  }

  return (
    (!!right.Left &&
      !!right.Right &&
      isIdentifierNamed(right.Left, name) &&
      isOneLiteral(right.Right)) ||
    (!!right.Left &&
      !!right.Right &&
      isOneLiteral(right.Left) &&
      isIdentifierNamed(right.Right, name))
  );
};

const detectCanonicalIntegerLoopVariable = (
  initializer: TstsNode | undefined,
  incrementor: TstsNode | undefined
): string | undefined => {
  if (!initializer || !TstsSyntax.IsVariableDeclarationList(initializer)) {
    return undefined;
  }

  const flags = TstsSyntax.AsVariableDeclarationList(initializer)?.Flags ?? 0;
  if ((flags & TstsSyntax.NodeFlagsLet) === 0) {
    return undefined;
  }

  const declarations = definedTstsNodes(
    TstsSyntax.AsVariableDeclarationList(initializer)?.Declarations?.Nodes
  );
  if (declarations.length !== 1) {
    return undefined;
  }

  const decl = declarations[0];
  const name = decl ? TstsSyntax.Node_Name(decl) : undefined;
  const initializerNode = decl ? TstsSyntax.Node_Initializer(decl) : undefined;
  if (
    !decl ||
    !name ||
    !TstsSyntax.IsIdentifier(name) ||
    !initializerNode ||
    initializerNode.Kind !== TstsSyntax.KindNumericLiteral ||
    !Number.isInteger(Number(TstsSyntax.Node_Text(initializerNode)))
  ) {
    return undefined;
  }

  const nameText = TstsSyntax.Node_Text(name) ?? "";
  return isCanonicalIntegerIncrementor(incrementor, nameText)
    ? nameText
    : undefined;
};

const normalizeForIteration = (
  type: IrType | undefined
): IrType | undefined => {
  if (!type) return undefined;

  if (type.kind === "unionType") {
    const nonNullish = type.types.filter(
      (part) =>
        !(
          part.kind === "primitiveType" &&
          (part.name === "null" || part.name === "undefined")
        )
    );
    if (nonNullish.length === 1) {
      const only = nonNullish[0];
      return only ? normalizeForIteration(only) : undefined;
    }
  }

  if (type.kind === "intersectionType") {
    const preferred =
      type.types.find((part) => part.kind === "arrayType") ??
      type.types.find((part) => part.kind === "tupleType") ??
      type.types.find(
        (part) => part.kind === "primitiveType" && part.name === "string"
      ) ??
      type.types.find((part) => part.kind === "referenceType");
    return preferred ? normalizeForIteration(preferred) : type;
  }

  return type;
};

const deriveForOfElementType = (
  type: IrType | undefined,
  ctx: ProgramContext
): IrType | undefined => {
  const normalized = normalizeForIteration(type);
  if (!normalized) return undefined;

  if (normalized.kind === "unionType") {
    const memberElementTypes: IrType[] = [];

    for (const member of normalized.types) {
      const memberElementType = deriveForOfElementType(member, ctx);
      if (!memberElementType) {
        return undefined;
      }
      memberElementTypes.push(memberElementType);
    }

    if (memberElementTypes.length === 0) {
      return undefined;
    }

    return normalizedUnionType(memberElementTypes);
  }

  if (normalized.kind === "primitiveType" && normalized.name === "string") {
    return { kind: "primitiveType", name: "string" };
  }

  return ctx.typeSystem.getIterableShape(normalized)?.elementType;
};

/**
 * Convert while statement
 *
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 */
export const convertWhileStatement = (
  node: TstsNode,
  ctx: ProgramContext,
  expectedReturnType?: IrType
): IrWhileStatement => {
  const whileStatement = TstsSyntax.AsWhileStatement(node);
  const body = whileStatement?.Statement
    ? convertStatementSingle(whileStatement.Statement, ctx, expectedReturnType)
    : undefined;
  return {
    kind: "whileStatement",
    condition: whileStatement?.Expression
      ? convertExpression(whileStatement.Expression, ctx, undefined)
      : convertExpression(node, ctx, undefined),
    body: body ?? { kind: "emptyStatement" },
  };
};

/**
 * Convert for statement
 *
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 */
export const convertForStatement = (
  node: TstsNode,
  ctx: ProgramContext,
  expectedReturnType?: IrType
): IrForStatement => {
  let initializer: IrForStatement["initializer"] | undefined;
  let bodyCtx: ProgramContext = ctx;
  const forStatement = TstsSyntax.AsForStatement(node);

  if (forStatement?.Initializer) {
    if (TstsSyntax.IsVariableDeclarationList(forStatement.Initializer)) {
      const converted = convertVariableDeclarationList(forStatement.Initializer, ctx);
      initializer = converted;
      const canonicalLoopVariable = detectCanonicalIntegerLoopVariable(
        forStatement.Initializer,
        forStatement.Incrementor
      );
      const declarations = definedTstsNodes(
        TstsSyntax.AsVariableDeclarationList(forStatement.Initializer)
          ?.Declarations?.Nodes
      );
      bodyCtx = canonicalLoopVariable
        ? withVariableTypeEnv(ctx, declarations, {
            kind: "variableDeclaration",
            declarationKind: "let",
            declarations: converted.declarations.map((decl) =>
              decl.name.kind === "identifierPattern" &&
              decl.name.name === canonicalLoopVariable
                ? {
                    ...decl,
                    type: { kind: "primitiveType", name: "int" },
                  }
                : decl
            ),
            isExported: false,
          })
        : withVariableTypeEnv(ctx, declarations, converted);
    } else {
      initializer = convertExpression(forStatement.Initializer, ctx, undefined);
    }
  }

  const body = convertStatementSingle(
    forStatement?.Statement ?? node,
    bodyCtx,
    expectedReturnType
  );
  return {
    kind: "forStatement",
    initializer,
    condition: forStatement?.Condition
      ? convertExpression(forStatement.Condition, bodyCtx, undefined)
      : undefined,
    update: forStatement?.Incrementor
      ? convertExpression(forStatement.Incrementor, bodyCtx, undefined)
      : undefined,
    body: body ?? { kind: "emptyStatement" },
  };
};

/**
 * Convert for-of statement
 *
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 */
export const convertForOfStatement = (
  node: TstsNode,
  ctx: ProgramContext,
  expectedReturnType?: IrType
): IrForOfStatement => {
  const forOf = TstsSyntax.AsForInOrOfStatement(node);
  const firstDecl =
    forOf?.Initializer && TstsSyntax.IsVariableDeclarationList(forOf.Initializer)
      ? definedTstsNodes(
          TstsSyntax.AsVariableDeclarationList(forOf.Initializer)?.Declarations
            ?.Nodes
        )[0]
    : undefined;

  const variable =
    forOf?.Initializer && TstsSyntax.IsVariableDeclarationList(forOf.Initializer)
      ? firstDecl
        ? convertBindingName(TstsSyntax.Node_Name(firstDecl) ?? firstDecl, ctx)
        : ({ kind: "identifierPattern" as const, name: "_" })
      : forOf?.Initializer
        ? convertBindingName(forOf.Initializer, ctx)
        : ({ kind: "identifierPattern" as const, name: "_" });

  const expression = forOf?.Expression
    ? convertExpression(forOf.Expression, ctx, undefined)
    : convertExpression(node, ctx, undefined);

  // Thread Tsonic-owned for-of element lowering facts into the body when the
  // loop variable is synthetic from this conversion step. Ordinary source
  // use-site types still come from TSTS through sourceSemantics.
  let bodyCtx = ctx;
  if (
    forOf?.Initializer &&
    TstsSyntax.IsVariableDeclarationList(forOf.Initializer) &&
    firstDecl
  ) {
    const elementType = deriveForOfElementType(expression.inferredType, ctx);
    if (elementType) {
      bodyCtx = withVariableTypeEnv(ctx, [firstDecl], {
        kind: "variableDeclaration",
        declarationKind: "const",
        declarations: [
          { kind: "variableDeclarator", name: variable, type: elementType },
        ],
        isExported: false,
      });
    }
  }

  const body = convertStatementSingle(
    forOf?.Statement ?? node,
    bodyCtx,
    expectedReturnType
  );
  return {
    kind: "forOfStatement",
    variable,
    expression,
    body: body ?? { kind: "emptyStatement" },
    // Only syntactic `for await (... of ...)` should lower as async iteration.
    // `AwaitContext` is also set for plain `for...of` inside async functions.
    isAwait: forOf?.AwaitModifier !== undefined,
  };
};

/**
 * Convert for-in statement.
 *
 * Supported only after validation has proven a closed string-key carrier.
 * The loop variable is deterministically typed as string and the emitter
 * lowers the source to the dictionary `Keys` collection.
 */
export const convertForInStatement = (
  node: TstsNode,
  ctx: ProgramContext,
  expectedReturnType?: IrType
): IrForInStatement => {
  const forIn = TstsSyntax.AsForInOrOfStatement(node);
  const firstDecl =
    forIn?.Initializer && TstsSyntax.IsVariableDeclarationList(forIn.Initializer)
      ? definedTstsNodes(
          TstsSyntax.AsVariableDeclarationList(forIn.Initializer)?.Declarations
            ?.Nodes
        )[0]
    : undefined;

  const variable =
    forIn?.Initializer && TstsSyntax.IsVariableDeclarationList(forIn.Initializer)
      ? firstDecl
        ? convertBindingName(TstsSyntax.Node_Name(firstDecl) ?? firstDecl, ctx)
        : ({ kind: "identifierPattern" as const, name: "_" })
      : forIn?.Initializer
        ? convertBindingName(forIn.Initializer, ctx)
        : ({ kind: "identifierPattern" as const, name: "_" });

  const expression = forIn?.Expression
    ? convertExpression(forIn.Expression, ctx, undefined)
    : convertExpression(node, ctx, undefined);

  let bodyCtx = ctx;
  if (
    forIn?.Initializer &&
    TstsSyntax.IsVariableDeclarationList(forIn.Initializer) &&
    firstDecl
  ) {
    const stringType: IrType = { kind: "primitiveType", name: "string" };
    bodyCtx = withVariableTypeEnv(ctx, [firstDecl], {
      kind: "variableDeclaration",
      declarationKind: "const",
      declarations: [
        { kind: "variableDeclarator", name: variable, type: stringType },
      ],
      isExported: false,
    });
  }

  const body = convertStatementSingle(
    forIn?.Statement ?? node,
    bodyCtx,
    expectedReturnType
  );
  return {
    kind: "forInStatement",
    variable,
    expression,
    body: body ?? { kind: "emptyStatement" },
  };
};
