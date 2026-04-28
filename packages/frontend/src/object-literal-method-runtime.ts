import * as ts from "typescript";

const isAssignmentOperator = (kind: ts.SyntaxKind): boolean => {
  switch (kind) {
    case ts.SyntaxKind.EqualsToken:
    case ts.SyntaxKind.PlusEqualsToken:
    case ts.SyntaxKind.MinusEqualsToken:
    case ts.SyntaxKind.AsteriskEqualsToken:
    case ts.SyntaxKind.AsteriskAsteriskEqualsToken:
    case ts.SyntaxKind.SlashEqualsToken:
    case ts.SyntaxKind.PercentEqualsToken:
    case ts.SyntaxKind.LessThanLessThanEqualsToken:
    case ts.SyntaxKind.GreaterThanGreaterThanEqualsToken:
    case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
    case ts.SyntaxKind.AmpersandEqualsToken:
    case ts.SyntaxKind.BarEqualsToken:
    case ts.SyntaxKind.CaretEqualsToken:
    case ts.SyntaxKind.BarBarEqualsToken:
    case ts.SyntaxKind.AmpersandAmpersandEqualsToken:
    case ts.SyntaxKind.QuestionQuestionEqualsToken:
      return true;
    default:
      return false;
  }
};

const isFunctionBoundary = (
  node: ts.Node
): node is ts.FunctionLikeDeclaration => ts.isFunctionLike(node);

const hasFixedRequiredParameters = (method: ts.MethodDeclaration): boolean =>
  method.parameters.every(
    (param) =>
      !param.dotDotDotToken &&
      !param.questionToken &&
      param.initializer === undefined
  );

const isWriteLikeUse = (node: ts.Node): boolean => {
  const parent = node.parent;
  if (!parent) return false;

  if (
    ts.isBinaryExpression(parent) &&
    parent.left === node &&
    isAssignmentOperator(parent.operatorToken.kind)
  ) {
    return true;
  }

  if (
    (ts.isPrefixUnaryExpression(parent) ||
      ts.isPostfixUnaryExpression(parent)) &&
    parent.operand === node &&
    (parent.operator === ts.SyntaxKind.PlusPlusToken ||
      parent.operator === ts.SyntaxKind.MinusMinusToken)
  ) {
    return true;
  }

  return ts.isDeleteExpression(parent) && parent.expression === node;
};

const nearestObjectLiteralMethodBoundary = (
  node: ts.Node
): ts.MethodDeclaration | undefined => {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (
      ts.isMethodDeclaration(current) &&
      ts.isObjectLiteralExpression(current.parent)
    ) {
      return current;
    }
    if (isFunctionBoundary(current)) {
      return undefined;
    }
    current = current.parent;
  }
  return undefined;
};

const isArgumentsLengthAccess = (
  node: ts.Node
): node is ts.PropertyAccessExpression =>
  ts.isPropertyAccessExpression(node) &&
  ts.isIdentifier(node.expression) &&
  node.expression.text === "arguments" &&
  node.name.text === "length";

const tryParseArgumentsIndex = (
  node: ts.ElementAccessExpression
): number | undefined => {
  const arg = node.argumentExpression;
  if (!arg || !ts.isNumericLiteral(arg)) {
    return undefined;
  }

  const value = Number(arg.text);
  if (!Number.isInteger(value) || value < 0) {
    return undefined;
  }

  return value;
};

const isArgumentsIndexAccess = (
  node: ts.Node
): node is ts.ElementAccessExpression =>
  ts.isElementAccessExpression(node) &&
  ts.isIdentifier(node.expression) &&
  node.expression.text === "arguments" &&
  tryParseArgumentsIndex(node) !== undefined;

const hasIdentifierParameters = (method: ts.MethodDeclaration): boolean =>
  method.parameters.every((param) => ts.isIdentifier(param.name));

type ObjectLiteralMethodArgumentsCapture = {
  readonly index: number;
  readonly parameterName: string;
  readonly parameter: ts.ParameterDeclaration & {
    readonly name: ts.Identifier;
  };
  readonly tempName: string;
};

type ObjectLiteralMethodRuntimeAnalysis =
  | {
      readonly ok: true;
      readonly arity: number;
      readonly indexedCaptures: readonly ObjectLiteralMethodArgumentsCapture[];
    }
  | {
      readonly ok: false;
      readonly reason: string;
    };

const objectLiteralMethodRuntimeAnalysisCache = new WeakMap<
  ts.MethodDeclaration,
  ObjectLiteralMethodRuntimeAnalysis
>();

const collectUsedNames = (method: ts.MethodDeclaration): Set<string> => {
  const used = new Set<string>();

  for (const param of method.parameters) {
    if (ts.isIdentifier(param.name)) {
      used.add(param.name.text);
    }
  }

  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) {
      used.add(node.text);
    }
    ts.forEachChild(node, visit);
  };

  if (method.body) {
    visit(method.body);
  }

  return used;
};

const buildIndexedCaptures = (
  method: ts.MethodDeclaration,
  indices: readonly number[]
): readonly ObjectLiteralMethodArgumentsCapture[] => {
  const usedNames = collectUsedNames(method);
  const captures: ObjectLiteralMethodArgumentsCapture[] = [];

  for (const index of indices) {
    const param = method.parameters[index];
    if (!param || !ts.isIdentifier(param.name)) {
      continue;
    }

    let tempName = `__tsonic_object_method_argument_${index}`;
    while (usedNames.has(tempName)) {
      tempName = `${tempName}_`;
    }
    usedNames.add(tempName);

    captures.push({
      index,
      parameterName: param.name.text,
      parameter: param as ts.ParameterDeclaration & {
        readonly name: ts.Identifier;
      },
      tempName,
    });
  }

  return captures;
};

const analyzeObjectLiteralMethodRuntime = (
  method: ts.MethodDeclaration
): ObjectLiteralMethodRuntimeAnalysis => {
  const cached = objectLiteralMethodRuntimeAnalysisCache.get(method);
  if (cached) {
    return cached;
  }

  let reason: string | undefined;
  const indexedAccesses = new Set<number>();

  const visit = (current: ts.Node): void => {
    if (reason) return;

    if (current !== method && isFunctionBoundary(current)) {
      let nestedUsesArguments = false;
      const scanNested = (nested: ts.Node): void => {
        if (nestedUsesArguments) return;
        if (ts.isIdentifier(nested) && nested.text === "arguments") {
          nestedUsesArguments = true;
          return;
        }
        ts.forEachChild(nested, scanNested);
      };
      ts.forEachChild(current, scanNested);
      if (nestedUsesArguments) {
        reason =
          "Method shorthand cannot capture arguments through nested function bodies in synthesized types";
      }
      return;
    }

    if (current.kind === ts.SyntaxKind.SuperKeyword) {
      reason = "Method shorthand cannot reference super in synthesized types";
      return;
    }

    if (ts.isIdentifier(current) && current.text === "arguments") {
      const parent = current.parent;
      if (!parent) {
        reason =
          "Method shorthand can only reference arguments.length or arguments[n] in synthesized types";
        return;
      }

      if (isArgumentsLengthAccess(parent) && parent.expression === current) {
        if (!hasFixedRequiredParameters(method)) {
          reason =
            "Method shorthand can only reference arguments.length when parameters are fixed required parameters";
          return;
        }
        if (nearestObjectLiteralMethodBoundary(current) !== method) {
          reason =
            "Method shorthand cannot capture arguments through nested function bodies in synthesized types";
          return;
        }
        if (isWriteLikeUse(parent)) {
          reason =
            "Method shorthand cannot assign to arguments.length in synthesized types";
          return;
        }
        return;
      }

      if (isArgumentsIndexAccess(parent) && parent.expression === current) {
        const index = tryParseArgumentsIndex(parent);
        if (index === undefined) {
          reason =
            "Method shorthand can only reference arguments[n] with a non-negative integer literal index in synthesized types";
          return;
        }
        if (!hasFixedRequiredParameters(method)) {
          reason =
            "Method shorthand can only reference arguments[n] when parameters are fixed required parameters";
          return;
        }
        if (!hasIdentifierParameters(method)) {
          reason =
            "Method shorthand can only reference arguments[n] when parameters are identifier bindings";
          return;
        }
        if (index >= method.parameters.length) {
          reason =
            "Method shorthand can only reference arguments[n] for declared parameters in synthesized types";
          return;
        }
        if (nearestObjectLiteralMethodBoundary(current) !== method) {
          reason =
            "Method shorthand cannot capture arguments through nested function bodies in synthesized types";
          return;
        }
        if (isWriteLikeUse(parent)) {
          reason =
            "Method shorthand cannot assign to arguments[n] in synthesized types";
          return;
        }
        indexedAccesses.add(index);
        return;
      }

      reason =
        "Method shorthand can only reference arguments.length or arguments[n] in synthesized types";
      return;
    }

    ts.forEachChild(current, visit);
  };

  if (method.body) {
    visit(method.body);
  }

  const analysis: ObjectLiteralMethodRuntimeAnalysis = reason
    ? { ok: false, reason }
    : {
        ok: true,
        arity: method.parameters.length,
        indexedCaptures: buildIndexedCaptures(
          method,
          [...indexedAccesses].sort((a, b) => a - b)
        ),
      };

  objectLiteralMethodRuntimeAnalysisCache.set(method, analysis);
  return analysis;
};

export const getUnsupportedObjectLiteralMethodRuntimeReason = (
  method: ts.MethodDeclaration
): string | undefined => {
  const analysis = analyzeObjectLiteralMethodRuntime(method);
  return analysis.ok ? undefined : analysis.reason;
};

export const tryGetObjectLiteralMethodArgumentsLength = (
  node: ts.PropertyAccessExpression
): number | undefined => {
  if (!isArgumentsLengthAccess(node)) {
    return undefined;
  }

  const method = nearestObjectLiteralMethodBoundary(node.expression);
  if (!method) {
    return undefined;
  }

  const analysis = analyzeObjectLiteralMethodRuntime(method);
  if (!analysis.ok) {
    return undefined;
  }

  return analysis.arity;
};

export const tryGetObjectLiteralMethodArgumentCapture = (
  node: ts.ElementAccessExpression
): ObjectLiteralMethodArgumentsCapture | undefined => {
  if (!isArgumentsIndexAccess(node)) {
    return undefined;
  }

  const method = nearestObjectLiteralMethodBoundary(node.expression);
  if (!method) {
    return undefined;
  }

  const analysis = analyzeObjectLiteralMethodRuntime(method);
  if (!analysis.ok) {
    return undefined;
  }

  const index = tryParseArgumentsIndex(node);
  if (index === undefined) {
    return undefined;
  }

  return (
    analysis.indexedCaptures.find((capture) => capture.index === index) ??
    undefined
  );
};

export const createObjectLiteralMethodArgumentPrelude = (
  method: ts.MethodDeclaration
): readonly ts.Statement[] => {
  const analysis = analyzeObjectLiteralMethodRuntime(method);
  if (!analysis.ok || analysis.indexedCaptures.length === 0) {
    return [];
  }

  return analysis.indexedCaptures.map((capture) =>
    ts.factory.createVariableStatement(
      undefined,
      ts.factory.createVariableDeclarationList(
        [
          ts.factory.createVariableDeclaration(
            ts.factory.createIdentifier(capture.tempName),
            undefined,
            undefined,
            capture.parameter.name
          ),
        ],
        ts.NodeFlags.Const
      )
    )
  );
};
