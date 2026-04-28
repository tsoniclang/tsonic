import * as ts from "typescript";

const scanObjectLiteralMethodRuntime = (
  method: ts.MethodDeclaration
): string | undefined => {
  let reason: string | undefined;

  const visit = (node: ts.Node): void => {
    if (reason) return;

    if (node !== method && ts.isFunctionLike(node)) {
      return;
    }

    if (node.kind === ts.SyntaxKind.SuperKeyword) {
      reason = "Method shorthand cannot reference super in synthesized types";
      return;
    }

    if (ts.isIdentifier(node) && node.text === "arguments") {
      reason =
        "Method shorthand cannot reference JavaScript arguments in emitted Tsonic code";
      return;
    }

    ts.forEachChild(node, visit);
  };

  if (method.body) {
    visit(method.body);
  }

  return reason;
};

const objectLiteralMethodRuntimeReasonCache = new WeakMap<
  ts.MethodDeclaration,
  string | undefined
>();

export const getUnsupportedObjectLiteralMethodRuntimeReason = (
  method: ts.MethodDeclaration
): string | undefined => {
  if (objectLiteralMethodRuntimeReasonCache.has(method)) {
    return objectLiteralMethodRuntimeReasonCache.get(method);
  }

  const reason = scanObjectLiteralMethodRuntime(method);
  objectLiteralMethodRuntimeReasonCache.set(method, reason);
  return reason;
};
