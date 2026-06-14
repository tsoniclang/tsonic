import {
  forEachTstsChild,
  getTstsContainingSourceFile,
  getTstsIdentifierText,
  getTstsNodeLocation,
  getTstsNodeText,
  getTstsParameters,
  isTstsFunctionLikeDeclaration,
  TstsSyntax,
  type TstsNode,
} from "@tsonic/tsts";
import type { IrParameter, IrStatement } from "./ir/types.js";

const isAssignmentOperator = (kind: number): boolean =>
  TstsSyntax.IsAssignmentOperator(kind);

const hasFixedRequiredParameters = (method: TstsNode): boolean =>
  getTstsParameters(method).every(
    (param) =>
      TstsSyntax.AsParameterDeclaration(param)?.DotDotDotToken === undefined &&
      TstsSyntax.Node_QuestionToken(param) === undefined &&
      TstsSyntax.Node_Initializer(param) === undefined
  );

const isWriteLikeUse = (node: TstsNode): boolean => {
  const parent = node.Parent;
  if (!parent) return false;

  if (parent.Kind === TstsSyntax.KindBinaryExpression) {
    const binary = TstsSyntax.AsBinaryExpression(parent);
    if (
      binary?.Left === node &&
      binary.OperatorToken &&
      isAssignmentOperator(binary.OperatorToken.Kind)
    ) {
      return true;
    }
  }

  if (parent.Kind === TstsSyntax.KindPrefixUnaryExpression) {
    const prefix = TstsSyntax.AsPrefixUnaryExpression(parent);
    return (
      prefix?.Operand === node &&
      (prefix.Operator === TstsSyntax.KindPlusPlusToken ||
        prefix.Operator === TstsSyntax.KindMinusMinusToken)
    );
  }

  if (parent.Kind === TstsSyntax.KindPostfixUnaryExpression) {
    const postfix = TstsSyntax.AsPostfixUnaryExpression(parent);
    return (
      postfix?.Operand === node &&
      (postfix.Operator === TstsSyntax.KindPlusPlusToken ||
        postfix.Operator === TstsSyntax.KindMinusMinusToken)
    );
  }

  return (
    parent.Kind === TstsSyntax.KindDeleteExpression &&
    TstsSyntax.AsDeleteExpression(parent)?.Expression === node
  );
};

const nearestObjectLiteralMethodBoundary = (
  node: TstsNode
): TstsNode | undefined => {
  let current: TstsNode | undefined = node.Parent;
  while (current) {
    if (
      current.Kind === TstsSyntax.KindMethodDeclaration &&
      current.Parent?.Kind === TstsSyntax.KindObjectLiteralExpression
    ) {
      return current;
    }
    if (isTstsFunctionLikeDeclaration(current)) {
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
    access?.Expression?.Kind === TstsSyntax.KindIdentifier &&
    getTstsIdentifierText(access.Expression) === "arguments" &&
    getTstsIdentifierText(access.name) === "length"
  );
};

const tryParseArgumentsIndex = (node: TstsNode): number | undefined => {
  if (node.Kind !== TstsSyntax.KindElementAccessExpression) {
    return undefined;
  }
  const arg = TstsSyntax.AsElementAccessExpression(node)?.ArgumentExpression;
  if (!arg || arg.Kind !== TstsSyntax.KindNumericLiteral) {
    return undefined;
  }

  const value = Number(getTstsNodeText(arg));
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
    access?.Expression?.Kind === TstsSyntax.KindIdentifier &&
    getTstsIdentifierText(access.Expression) === "arguments" &&
    tryParseArgumentsIndex(node) !== undefined
  );
};

const hasIdentifierParameters = (method: TstsNode): boolean =>
  getTstsParameters(method).every(
    (param) => TstsSyntax.Node_Name(param)?.Kind === TstsSyntax.KindIdentifier
  );

export type ObjectLiteralMethodArgumentsCapture = {
  readonly index: number;
  readonly parameterName: string;
  readonly parameter: TstsNode;
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
  TstsNode,
  ObjectLiteralMethodRuntimeAnalysis
>();

const collectUsedNames = (method: TstsNode): Set<string> => {
  const used = new Set<string>();

  for (const param of getTstsParameters(method)) {
    const name = getTstsIdentifierText(TstsSyntax.Node_Name(param));
    if (name) {
      used.add(name);
    }
  }

  const body = TstsSyntax.Node_Body(method);
  if (body) {
    forEachTstsChild(body, (node) => {
      if (node?.Kind === TstsSyntax.KindIdentifier) {
        const text = getTstsIdentifierText(node);
        if (text) {
          used.add(text);
        }
      }
    });
  }

  return used;
};

const buildIndexedCaptures = (
  method: TstsNode,
  indices: readonly number[]
): readonly ObjectLiteralMethodArgumentsCapture[] => {
  const usedNames = collectUsedNames(method);
  const captures: ObjectLiteralMethodArgumentsCapture[] = [];
  const parameters = getTstsParameters(method);

  for (const index of indices) {
    const parameter = parameters[index];
    const parameterName = getTstsIdentifierText(TstsSyntax.Node_Name(parameter));
    if (!parameter || !parameterName) {
      continue;
    }

    let tempName = `__tsonic_object_method_argument_${index}`;
    while (usedNames.has(tempName)) {
      tempName = `${tempName}_`;
    }
    usedNames.add(tempName);

    captures.push({
      index,
      parameterName,
      parameter,
      tempName,
    });
  }

  return captures;
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

  const visit = (current: TstsNode): void => {
    if (reason) return;

    if (current !== method && isTstsFunctionLikeDeclaration(current)) {
      let nestedUsesArguments = false;
      const scanNested = (nested: TstsNode | undefined): void => {
        if (!nested || nestedUsesArguments) return;
        if (
          nested.Kind === TstsSyntax.KindIdentifier &&
          getTstsIdentifierText(nested) === "arguments"
        ) {
          nestedUsesArguments = true;
          return;
        }
        forEachTstsChild(nested, scanNested);
      };
      forEachTstsChild(current, scanNested);
      if (nestedUsesArguments) {
        reason =
          "Method shorthand cannot capture arguments through nested function bodies in synthesized types";
      }
      return;
    }

    if (current.Kind === TstsSyntax.KindSuperKeyword) {
      reason = "Method shorthand cannot reference super in synthesized types";
      return;
    }

    if (
      current.Kind === TstsSyntax.KindIdentifier &&
      getTstsIdentifierText(current) === "arguments"
    ) {
      const parent = current.Parent;
      if (!parent) {
        reason =
          "Method shorthand can only reference arguments.length or arguments[n] in synthesized types";
        return;
      }

      if (
        isArgumentsLengthAccess(parent) &&
        TstsSyntax.AsPropertyAccessExpression(parent)?.Expression === current
      ) {
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

      if (
        isArgumentsIndexAccess(parent) &&
        TstsSyntax.AsElementAccessExpression(parent)?.Expression === current
      ) {
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
        if (index >= getTstsParameters(method).length) {
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

    forEachTstsChild(current, (child) => {
      if (child) visit(child);
    });
  };

  const body = TstsSyntax.Node_Body(method);
  if (body) {
    visit(body);
  }

  const analysis: ObjectLiteralMethodRuntimeAnalysis = reason
    ? { ok: false, reason }
    : {
        ok: true,
        arity: getTstsParameters(method).length,
        indexedCaptures: buildIndexedCaptures(
          method,
          [...indexedAccesses].sort((a, b) => a - b)
        ),
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

export const tryGetObjectLiteralMethodArgumentsLength = (
  node: TstsNode
): number | undefined => {
  if (!isArgumentsLengthAccess(node)) {
    return undefined;
  }

  const expression = TstsSyntax.AsPropertyAccessExpression(node)?.Expression;
  if (!expression) {
    return undefined;
  }

  const method = nearestObjectLiteralMethodBoundary(expression);
  if (!method) {
    return undefined;
  }

  const analysis = analyzeObjectLiteralMethodRuntime(method);
  return analysis.ok ? analysis.arity : undefined;
};

export const isSupportedObjectLiteralMethodArgumentsReference = (
  node: TstsNode
): boolean => {
  if (getTstsIdentifierText(node) !== "arguments") {
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
    tryGetObjectLiteralMethodArgumentCapture(parent) !== undefined
  );
};

export const tryGetObjectLiteralMethodArgumentCapture = (
  node: TstsNode
): ObjectLiteralMethodArgumentsCapture | undefined => {
  if (!isArgumentsIndexAccess(node)) {
    return undefined;
  }

  const expression = TstsSyntax.AsElementAccessExpression(node)?.Expression;
  if (!expression) {
    return undefined;
  }

  const method = nearestObjectLiteralMethodBoundary(expression);
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
  method: TstsNode,
  parameters: readonly IrParameter[]
): readonly IrStatement[] => {
  const analysis = analyzeObjectLiteralMethodRuntime(method);
  if (!analysis.ok || analysis.indexedCaptures.length === 0) {
    return [];
  }

  const sourceFile = getTstsContainingSourceFile(method);

  return analysis.indexedCaptures.map((capture) => ({
    kind: "variableDeclaration",
    declarationKind: "const",
    isExported: false,
    declarations: [
      {
        kind: "variableDeclarator",
        name: {
          kind: "identifierPattern",
          name: capture.tempName,
        },
        type: parameters[capture.index]?.type,
        initializer: {
          kind: "identifier",
          name: capture.parameterName,
          inferredType: parameters[capture.index]?.type,
          sourceSpan: sourceFile
            ? getTstsNodeLocation(sourceFile, capture.parameter)
            : undefined,
        },
      },
    ],
  }));
};
