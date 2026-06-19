import type { bool } from "../scalars.js";

export interface Node {
  Pos?(): unknown;
  End?(): unknown;
  readonly __goFacadeName?: string;
}

export interface Expr extends Node {}
export interface Stmt extends Node {}

export interface BlockStmt extends Stmt { List?: Stmt[] }
export interface CallExpr extends Expr { Fun?: Expr; Args?: Expr[] }
export interface CommentGroup extends Node { List?: unknown[] }
export interface Field extends Node { Names?: Ident[]; Type?: Expr }
export interface FieldList extends Node { List?: Field[] }
export interface File extends Node { Decls?: Node[] }
export interface FuncDecl extends Node { Name?: Ident; Type?: FuncType; Body?: BlockStmt }
export interface FuncLit extends Expr { Type?: FuncType; Body?: BlockStmt }
export interface FuncType extends Expr { Params?: FieldList; Results?: FieldList }
export interface Ident extends Expr { Name?: string }
export interface TypeSpec extends Node { Name?: Ident; Type?: Expr }
export interface ValueSpec extends Node { Names?: Ident[]; Type?: Expr; Values?: Expr[] }

export const ArrayType = "ArrayType";
export const AssignStmt = "AssignStmt";
export const BasicLit = "BasicLit";
export const BinaryExpr = "BinaryExpr";
export const CaseClause = "CaseClause";
export const ChanType = "ChanType";
export const CommClause = "CommClause";
export const Ellipsis = "Ellipsis";
export const GenDecl = "GenDecl";
export const IndexExpr = "IndexExpr";
export const IndexListExpr = "IndexListExpr";
export const InterfaceType = "InterfaceType";
export const MapType = "MapType";
export const ParenExpr = "ParenExpr";
export const SelectorExpr = "SelectorExpr";
export const SelectStmt = "SelectStmt";
export const StarExpr = "StarExpr";
export const StructType = "StructType";
export const SwitchStmt = "SwitchStmt";
export const UnaryExpr = "UnaryExpr";

export function Inspect(root: Node | undefined, fn: (node: Node | undefined) => bool): void {
  const seen = new WeakSet<object>();
  const visit = (node: unknown): void => {
    if (node === undefined || node === null || typeof node !== "object") {
      return;
    }
    if (seen.has(node)) {
      return;
    }
    seen.add(node);
    if (!fn(node as Node)) {
      return;
    }
    for (const value of Object.values(node)) {
      if (globalThis.Array.isArray(value)) {
        for (const child of value) {
          visit(child);
        }
      } else {
        visit(value);
      }
    }
    fn(undefined);
  };
  visit(root);
}
