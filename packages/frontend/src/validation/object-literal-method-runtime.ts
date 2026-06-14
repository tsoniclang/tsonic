import type { TstsNode } from "@tsonic/tsts";
import {
  forEachTstsChild,
  isTstsOptionalParameter,
  isTstsRestParameter,
  TstsSyntax,
} from "@tsonic/tsts";
import {
  getNodeExpression,
  getNodeParameters,
  isAssignmentOperator,
  isFunctionBoundary,
  isIdentifierNamed,
  isUpdateOperator,
} from "./tsts-helpers.js";

type ObjectLiteralMethodRuntimeAnalysis =
  | {
      readonly ok: true;
      readonly arity: number;
      readonly indexedAccesses: ReadonlySet<number>;
    }
  | {
      readonly ok: false;
      readonly reason: string;
    };

const objectLiteralMethodRuntimeAnalysisCache = new WeakMap<
  TstsNode,
  ObjectLiteralMethodRuntimeAnalysis
>();

const hasFixedRequiredParameters = (method: TstsNode): boolean =>
  getNodeParameters(method).every(
    (param) => !isTstsRestParameter(param) && !isTstsOptionalParameter(param)
  );

const hasIdentifierParameters = (method: TstsNode): boolean =>
  getNodeParameters(method).every(
    (param) => TstsSyntax.Node_Name(param)?.Kind === TstsSyntax.KindIdentifier
  );

const isWriteLikeUse = (node: TstsNode): boolean => {
  const parent = node.Parent;
  if (!parent) return false;

  if (parent.Kind === TstsSyntax.KindBinaryExpression) {
    const binary = TstsSyntax.AsBinaryExpression(parent);
    return (
      binary?.Left === node &&
      binary.OperatorToken !== undefined &&
      isAssignmentOperator(binary.OperatorToken.Kind)
    );
  }

  if (
    parent.Kind === TstsSyntax.KindPrefixUnaryExpression ||
    parent.Kind === TstsSyntax.KindPostfixUnaryExpression
  ) {
    const unary =
      parent.Kind === TstsSyntax.KindPrefixUnaryExpression
        ? TstsSyntax.AsPrefixUnaryExpression(parent)
        : TstsSyntax.AsPostfixUnaryExpression(parent);
    return unary?.Operand === node && isUpdateOperator(unary.Operator);
  }

  return (
    parent.Kind === TstsSyntax.KindDeleteExpression &&
    getNodeExpression(parent) === node
  );
};

const nearestObjectLiteralMethodBoundary = (
  node: TstsNode
): TstsNode | undefined => {
  let current = node.Parent;
  while (current) {
    if (
      current.Kind === TstsSyntax.KindMethodDeclaration &&
      current.Parent?.Kind === TstsSyntax.KindObjectLiteralExpression
    ) {
      return current;
    }
    if (isFunctionBoundary(current)) {
      return undefined;
    }
    current = current.Parent;
  }
  return undefined;
};

const isArgumentsLengthAccess = (node: TstsNode): boolean => {
  if (node.Kind !== TstsSyntax.KindPropertyAccessExpression) {
    return false;
  }
  const access = TstsSyntax.AsPropertyAccessExpression(node);
  return (
    isIdentifierNamed(access?.Expression, "arguments") &&
    isIdentifierNamed(access?.name, "length")
  );
};

const tryParseArgumentsIndex = (node: TstsNode): number | undefined => {
  if (node.Kind !== TstsSyntax.KindElementAccessExpression) {
    return undefined;
  }
  const argument = TstsSyntax.AsElementAccessExpression(node)?.ArgumentExpression;
  if (argument?.Kind !== TstsSyntax.KindNumericLiteral) {
    return undefined;
  }

  const value = Number(TstsSyntax.Node_Text(argument));
  if (!Number.isInteger(value) || value < 0) {
    return undefined;
  }

  return value;
};

const isArgumentsIndexAccess = (node: TstsNode): boolean => {
  if (node.Kind !== TstsSyntax.KindElementAccessExpression) {
    return false;
  }
  const access = TstsSyntax.AsElementAccessExpression(node);
  return (
    isIdentifierNamed(access?.Expression, "arguments") &&
    tryParseArgumentsIndex(node) !== undefined
  );
};

const scanForArgumentsIdentifier = (node: TstsNode): boolean => {
  let found = false;
  const visit = (current: TstsNode | undefined): void => {
    if (!current || found) return;
    if (isIdentifierNamed(current, "arguments")) {
      found = true;
      return;
    }
    forEachTstsChild(current, visit);
  };
  visit(node);
  return found;
};

const analyzeObjectLiteralMethodRuntime = (
  method: TstsNode
): ObjectLiteralMethodRuntimeAnalysis => {
  const cached = objectLiteralMethodRuntimeAnalysisCache.get(method);
  if (cached) {
    return cached;
  }

  let reason: string | undefined;
  const indexedAccesses = new Set<number>();

  const visit = (current: TstsNode | undefined): void => {
    if (!current || reason) return;

    if (current !== method && isFunctionBoundary(current)) {
      if (scanForArgumentsIdentifier(current)) {
        reason =
          "Method shorthand cannot capture arguments through nested function bodies in synthesized types";
      }
      return;
    }

    if (current.Kind === TstsSyntax.KindSuperKeyword) {
      reason = "Method shorthand cannot reference super in synthesized types";
      return;
    }

    if (isIdentifierNamed(current, "arguments")) {
      const parent = current.Parent;
      if (!parent) {
        reason =
          "Method shorthand can only reference arguments.length or arguments[n] in synthesized types";
        return;
      }

      if (isArgumentsLengthAccess(parent)) {
        const access = TstsSyntax.AsPropertyAccessExpression(parent);
        if (access?.Expression !== current) {
          reason =
            "Method shorthand can only reference arguments.length or arguments[n] in synthesized types";
          return;
        }
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

      if (isArgumentsIndexAccess(parent)) {
        const access = TstsSyntax.AsElementAccessExpression(parent);
        if (access?.Expression !== current) {
          reason =
            "Method shorthand can only reference arguments.length or arguments[n] in synthesized types";
          return;
        }
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
        if (index >= getNodeParameters(method).length) {
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

    forEachTstsChild(current, visit);
  };

  const body = TstsSyntax.Node_Body(method);
  if (body) {
    visit(body);
  }

  const analysis: ObjectLiteralMethodRuntimeAnalysis = reason
    ? { ok: false, reason }
    : {
        ok: true,
        arity: getNodeParameters(method).length,
        indexedAccesses,
      };

  objectLiteralMethodRuntimeAnalysisCache.set(method, analysis);
  return analysis;
};

export const getUnsupportedObjectLiteralMethodRuntimeReason = (
  method: TstsNode
): string | undefined => {
  const analysis = analyzeObjectLiteralMethodRuntime(method);
  return analysis.ok ? undefined : analysis.reason;
};

const tryGetObjectLiteralMethodArgumentsLength = (
  node: TstsNode
): number | undefined => {
  if (!isArgumentsLengthAccess(node)) {
    return undefined;
  }

  const access = TstsSyntax.AsPropertyAccessExpression(node);
  if (!access?.Expression) {
    return undefined;
  }

  const method = nearestObjectLiteralMethodBoundary(access.Expression);
  if (!method) {
    return undefined;
  }

  const analysis = analyzeObjectLiteralMethodRuntime(method);
  return analysis.ok ? analysis.arity : undefined;
};

const hasObjectLiteralMethodArgumentCapture = (node: TstsNode): boolean => {
  if (!isArgumentsIndexAccess(node)) {
    return false;
  }

  const access = TstsSyntax.AsElementAccessExpression(node);
  if (!access?.Expression) {
    return false;
  }

  const method = nearestObjectLiteralMethodBoundary(access.Expression);
  if (!method) {
    return false;
  }

  const analysis = analyzeObjectLiteralMethodRuntime(method);
  if (!analysis.ok) {
    return false;
  }

  const index = tryParseArgumentsIndex(node);
  return index !== undefined && analysis.indexedAccesses.has(index);
};

export const isSupportedObjectLiteralMethodArgumentsReference = (
  node: TstsNode
): boolean => {
  if (!isIdentifierNamed(node, "arguments")) {
    return false;
  }

  const parent = node.Parent;
  if (!parent) {
    return false;
  }

  if (
    isArgumentsLengthAccess(parent) &&
    TstsSyntax.AsPropertyAccessExpression(parent)?.Expression === node &&
    tryGetObjectLiteralMethodArgumentsLength(parent) !== undefined
  ) {
    return true;
  }

  return (
    isArgumentsIndexAccess(parent) &&
    TstsSyntax.AsElementAccessExpression(parent)?.Expression === node &&
    hasObjectLiteralMethodArgumentCapture(parent)
  );
};
