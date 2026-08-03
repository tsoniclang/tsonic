import type {
  AstReader,
  Node,
  SourceFile,
  Symbol,
  TypeCheckerQueries,
} from "@tsonic/tsts";

export function sourceFileIdentity(
  ast: AstReader,
  sourceFile: SourceFile | undefined,
): string | undefined {
  return sourceFile === undefined ? undefined : ast.getPath(sourceFile);
}

export function sourceNodeIdentity(
  ast: AstReader,
  node: Node | undefined,
): string | undefined {
  if (node === undefined) {
    return undefined;
  }
  const sourceFile = ast.getSourceFile(node);
  const file = sourceFileIdentity(ast, sourceFile);
  const kind = ast.kind(node);
  return file === undefined || kind === undefined
    ? undefined
    : `${file}\u0000${kind}\u0000${ast.pos(node)}\u0000${ast.end(node)}`;
}

export function sourceNodesEqual(
  ast: AstReader,
  left: Node | undefined,
  right: Node | undefined,
): boolean {
  const leftIdentity = sourceNodeIdentity(ast, left);
  return leftIdentity !== undefined &&
    leftIdentity === sourceNodeIdentity(ast, right);
}

export function sourceSymbolIdentity(
  ast: AstReader,
  checker: TypeCheckerQueries,
  symbol: Symbol | undefined,
): string | undefined {
  if (symbol === undefined) {
    return undefined;
  }
  const declarations = checker.getSymbolDeclarations(symbol)
    .map((declaration) => sourceNodeIdentity(ast, declaration))
    .filter((identity): identity is string => identity !== undefined)
    .sort();
  return declarations.length === 0
    ? undefined
    : declarations.join("\u0001");
}

export function sourceSymbolsEqual(
  ast: AstReader,
  checker: TypeCheckerQueries,
  left: Symbol | undefined,
  right: Symbol | undefined,
): boolean {
  const leftIdentity = sourceSymbolIdentity(ast, checker, left);
  return leftIdentity !== undefined &&
    leftIdentity === sourceSymbolIdentity(ast, checker, right);
}
