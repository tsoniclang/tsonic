import * as ts from "typescript";

export const typeNodeUsesImportedTypeNames = (
  node: ts.TypeNode,
  typeImportsByLocalName: ReadonlyMap<
    string,
    { readonly source: string; readonly importedName: string }
  >
): boolean => {
  const allowlistedImportSources = new Set<string>(["@tsonic/core/types.js"]);

  let found = false;
  const visit = (current: ts.Node): void => {
    if (found) return;
    if (
      ts.isTypeReferenceNode(current) &&
      ts.isIdentifier(current.typeName)
    ) {
      const imported = typeImportsByLocalName.get(current.typeName.text);
      if (imported && !allowlistedImportSources.has(imported.source.trim())) {
        found = true;
        return;
      }
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
};

export const unwrapParens = (node: ts.TypeNode): ts.TypeNode => {
  let current = node;
  while (ts.isParenthesizedTypeNode(current)) {
    current = current.type;
  }
  return current;
};
