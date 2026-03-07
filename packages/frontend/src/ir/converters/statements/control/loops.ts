/**
 * Loop statement converters (while, for, for-of, for-in)
 *
 * Phase 5 Step 4: Uses ProgramContext instead of Binding.
 */

import * as ts from "typescript";
import {
  IrWhileStatement,
  IrForStatement,
  IrForOfStatement,
  IrForInStatement,
  IrType,
} from "../../../types.js";
import { convertExpression } from "../../../expression-converter.js";
import { convertBindingName } from "../../../syntax/binding-patterns.js";
import { convertStatementSingle } from "../../../statement-converter.js";
import { convertVariableDeclarationList } from "../helpers.js";
import type { ProgramContext } from "../../../program-context.js";
import { withVariableTypeEnv } from "../../type-env.js";

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

const deriveTupleIterationElementType = (
  elementTypes: readonly IrType[]
): IrType | undefined => {
  if (elementTypes.length === 0) return undefined;
  if (elementTypes.length === 1) return elementTypes[0];
  return { kind: "unionType", types: elementTypes };
};

const deriveForOfElementType = (
  type: IrType | undefined
): IrType | undefined => {
  const normalized = normalizeForIteration(type);
  if (!normalized) return undefined;

  if (normalized.kind === "arrayType") {
    return normalized.elementType;
  }

  if (normalized.kind === "tupleType") {
    return deriveTupleIterationElementType(normalized.elementTypes);
  }

  if (normalized.kind === "primitiveType" && normalized.name === "string") {
    return { kind: "primitiveType", name: "string" };
  }

  if (
    normalized.kind === "referenceType" &&
    normalized.typeArguments &&
    normalized.typeArguments.length > 0
  ) {
    const [firstTypeArg, secondTypeArg] = normalized.typeArguments;
    switch (normalized.name) {
      case "Array":
      case "ReadonlyArray":
      case "Iterable":
      case "IterableIterator":
      case "Iterator":
      case "AsyncIterable":
      case "AsyncIterableIterator":
      case "Generator":
      case "AsyncGenerator":
      case "Set":
      case "ReadonlySet":
        return firstTypeArg;
      case "Map":
      case "ReadonlyMap":
        return firstTypeArg && secondTypeArg
          ? {
              kind: "tupleType",
              elementTypes: [firstTypeArg, secondTypeArg],
            }
          : undefined;
      default:
        return undefined;
    }
  }

  return undefined;
};

/**
 * Convert while statement
 *
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 */
export const convertWhileStatement = (
  node: ts.WhileStatement,
  ctx: ProgramContext,
  expectedReturnType?: IrType
): IrWhileStatement => {
  const body = convertStatementSingle(node.statement, ctx, expectedReturnType);
  return {
    kind: "whileStatement",
    condition: convertExpression(node.expression, ctx, undefined),
    body: body ?? { kind: "emptyStatement" },
  };
};

/**
 * Convert for statement
 *
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 */
export const convertForStatement = (
  node: ts.ForStatement,
  ctx: ProgramContext,
  expectedReturnType?: IrType
): IrForStatement => {
  let initializer: IrForStatement["initializer"] | undefined;
  let bodyCtx: ProgramContext = ctx;

  if (node.initializer) {
    if (ts.isVariableDeclarationList(node.initializer)) {
      const converted = convertVariableDeclarationList(node.initializer, ctx);
      initializer = converted;
      bodyCtx = withVariableTypeEnv(
        ctx,
        node.initializer.declarations,
        converted
      );
    } else {
      initializer = convertExpression(node.initializer, ctx, undefined);
    }
  }

  const body = convertStatementSingle(
    node.statement,
    bodyCtx,
    expectedReturnType
  );
  return {
    kind: "forStatement",
    initializer,
    condition: node.condition
      ? convertExpression(node.condition, bodyCtx, undefined)
      : undefined,
    update: node.incrementor
      ? convertExpression(node.incrementor, bodyCtx, undefined)
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
  node: ts.ForOfStatement,
  ctx: ProgramContext,
  expectedReturnType?: IrType
): IrForOfStatement => {
  const firstDecl = ts.isVariableDeclarationList(node.initializer)
    ? node.initializer.declarations[0]
    : undefined;

  const variable = ts.isVariableDeclarationList(node.initializer)
    ? convertBindingName(
        firstDecl?.name ?? ts.factory.createIdentifier("_"),
        ctx
      )
    : convertBindingName(node.initializer as ts.BindingName, ctx);

  const expression = convertExpression(node.expression, ctx, undefined);

  // Thread inferred loop variable type into the body (deterministic, TS-free).
  // This is required for correct boolean-context lowering (e.g., `if (s)` for strings).
  let bodyCtx = ctx;
  if (ts.isVariableDeclarationList(node.initializer) && firstDecl) {
    const elementType = deriveForOfElementType(expression.inferredType);
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
    node.statement,
    bodyCtx,
    expectedReturnType
  );
  return {
    kind: "forOfStatement",
    variable,
    expression,
    body: body ?? { kind: "emptyStatement" },
    // TS parser marks `for await` loops with both `awaitModifier` and AwaitContext flags.
    // Use both to be resilient across TS versions/host implementations.
    isAwait:
      node.awaitModifier !== undefined ||
      (node.flags & ts.NodeFlags.AwaitContext) !== 0,
  };
};

/**
 * Convert for-in statement
 *
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 */
export const convertForInStatement = (
  node: ts.ForInStatement,
  ctx: ProgramContext,
  expectedReturnType?: IrType
): IrForInStatement => {
  const firstDecl = ts.isVariableDeclarationList(node.initializer)
    ? node.initializer.declarations[0]
    : undefined;

  const variable = ts.isVariableDeclarationList(node.initializer)
    ? convertBindingName(
        firstDecl?.name ?? ts.factory.createIdentifier("_"),
        ctx
      )
    : ts.isIdentifier(node.initializer)
      ? convertBindingName(node.initializer, ctx)
      : convertBindingName(ts.factory.createIdentifier("_"), ctx);

  const typedVariable =
    variable.kind === "identifierPattern"
      ? {
          ...variable,
          type: { kind: "primitiveType", name: "string" } as const,
        }
      : variable;

  // `for (k in obj)` binds `k` as a string. Thread this into the body for
  // correct boolean-context lowering (empty string is falsy in JS).
  let bodyCtx = ctx;
  const stringType = {
    kind: "primitiveType" as const,
    name: "string" as const,
  };
  if (ts.isVariableDeclarationList(node.initializer) && firstDecl) {
    bodyCtx = withVariableTypeEnv(ctx, [firstDecl], {
      kind: "variableDeclaration",
      declarationKind: "const",
      declarations: [
        { kind: "variableDeclarator", name: typedVariable, type: stringType },
      ],
      isExported: false,
    });
  } else if (ts.isIdentifier(node.initializer)) {
    // Assignment form: for (k in obj) { ... } where k is pre-declared.
    // Do not override its declaration type here.
    bodyCtx = ctx;
  }

  const body = convertStatementSingle(
    node.statement,
    bodyCtx,
    expectedReturnType
  );
  return {
    kind: "forInStatement",
    variable: typedVariable,
    expression: convertExpression(node.expression, ctx, undefined),
    body: body ?? { kind: "emptyStatement" },
  };
};
