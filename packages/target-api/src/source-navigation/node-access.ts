import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import { isTypeSyntaxNode } from "./syntax.js";

export const ModifierFlagsPublic = 1 << 0;
export const ModifierFlagsPrivate = 1 << 1;
export const ModifierFlagsProtected = 1 << 2;
export const ModifierFlagsReadonly = 1 << 3;
export const ModifierFlagsOverride = 1 << 4;
export const ModifierFlagsExport = 1 << 5;
export const ModifierFlagsAbstract = 1 << 6;
export const ModifierFlagsAmbient = 1 << 7;
export const ModifierFlagsStatic = 1 << 8;
export const ModifierFlagsAccessor = 1 << 9;
export const ModifierFlagsAsync = 1 << 10;
export const ModifierFlagsConst = 1 << 12;

export function HasSyntacticModifier(
  ast: AstReader,
  node: Node,
  flag: number,
): boolean {
  return ast.hasModifier(node, flag);
}

export function Node_Text(ast: AstReader, node: Node | undefined): string {
  return node === undefined ? "" : ast.text(node);
}

export function SourceFile_FileName(
  ast: Pick<AstReader, "getFileName">,
  sourceFile: SourceFile,
): string {
  return ast.getFileName(sourceFile);
}

export function SourceKind(ast: AstReader, node: Node | undefined): string {
  return ast.kindName(node);
}

export function HasSourceKind(
  ast: AstReader,
  node: Node | undefined,
  expected: string,
): boolean {
  return ast.kindName(node) === expected;
}

export function IsTypeSyntaxNode(ast: AstReader, node: Node): boolean {
  return isTypeSyntaxNode(ast, node);
}

export function isAstNode(
  ast: Pick<AstReader, "kind">,
  value: unknown,
): value is Node {
  return typeof value === "object" &&
    value !== null &&
    ast.kind(value as Node) !== undefined;
}
