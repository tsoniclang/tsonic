import * as ts from "typescript";

const isDynamicImportCall = (node: ts.CallExpression): boolean =>
  node.expression.kind === ts.SyntaxKind.ImportKeyword;

export const getDynamicImportLiteralSpecifier = (
  node: ts.CallExpression
): string | undefined => {
  if (!isDynamicImportCall(node)) return undefined;
  if (node.arguments.length !== 1) return undefined;
  const [arg] = node.arguments;
  return arg && ts.isStringLiteral(arg) ? arg.text : undefined;
};

export const isClosedWorldDynamicImportSpecifier = (
  specifier: string
): boolean =>
  specifier.startsWith("./") || specifier.startsWith("../");

export const isSideEffectOnlyDynamicImport = (
  node: ts.CallExpression
): boolean => {
  const parent = node.parent;
  return (
    ts.isAwaitExpression(parent) &&
    parent.expression === node &&
    ts.isExpressionStatement(parent.parent)
  );
};

export const isSupportedDynamicImportSideEffect = (
  node: ts.CallExpression
): boolean => {
  const specifier = getDynamicImportLiteralSpecifier(node);
  return (
    specifier !== undefined &&
    isClosedWorldDynamicImportSpecifier(specifier) &&
    isSideEffectOnlyDynamicImport(node)
  );
};

export type DynamicImportSite = {
  readonly node: ts.CallExpression;
  readonly specifier: string;
};

export const collectSupportedDynamicImportSites = (
  sourceFile: ts.SourceFile
): readonly DynamicImportSite[] => {
  const sites: DynamicImportSite[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && isSupportedDynamicImportSideEffect(node)) {
      const specifier = getDynamicImportLiteralSpecifier(node);
      if (specifier) {
        sites.push({ node, specifier });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return sites;
};
