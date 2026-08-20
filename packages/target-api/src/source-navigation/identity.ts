import type {
  AstReader,
  Node,
  SourceFile,
  Symbol,
  TypeCheckerQueries,
} from "@tsonic/tsts";
import { relative, resolve } from "node:path";

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

export function projectSourceNodeIdentity(
  ast: AstReader,
  node: Node | undefined,
  projectRoot: string,
): string | undefined {
  if (node === undefined) {
    return undefined;
  }
  const sourceFile = ast.getSourceFile(node);
  const file = sourceFileIdentity(ast, sourceFile);
  const kind = ast.kind(node);
  if (file === undefined || kind === undefined) {
    return undefined;
  }
  const projectPath = normalizePath(resolve(projectRoot));
  const sourcePath = normalizePath(resolve(file));
  const projectRelativePath = normalizePath(relative(projectPath, sourcePath));
  if (
    projectRelativePath.length === 0 ||
    projectRelativePath === "." ||
    projectRelativePath === ".." ||
    projectRelativePath.startsWith("../")
  ) {
    return undefined;
  }
  return `${projectRelativePath}\u0000${kind}\u0000${ast.pos(node)}\u0000${ast.end(node)}`;
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

function normalizePath(value: string): string {
  return value.split("\\").join("/");
}
