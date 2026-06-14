import type { bool } from "@tsonic/core/types.js";
export interface Node {
    Pos?(): unknown;
    End?(): unknown;
    readonly __goFacadeName?: string;
}
export interface Expr extends Node {
}
export interface Stmt extends Node {
}
export interface BlockStmt extends Stmt {
    List?: Stmt[];
}
export interface CallExpr extends Expr {
    Fun?: Expr;
    Args?: Expr[];
}
export interface CommentGroup extends Node {
    List?: unknown[];
}
export interface Field extends Node {
    Names?: Ident[];
    Type?: Expr;
}
export interface FieldList extends Node {
    List?: Field[];
}
export interface File extends Node {
    Decls?: Node[];
}
export interface FuncDecl extends Node {
    Name?: Ident;
    Type?: FuncType;
    Body?: BlockStmt;
}
export interface FuncLit extends Expr {
    Type?: FuncType;
    Body?: BlockStmt;
}
export interface FuncType extends Expr {
    Params?: FieldList;
    Results?: FieldList;
}
export interface Ident extends Expr {
    Name?: string;
}
export interface TypeSpec extends Node {
    Name?: Ident;
    Type?: Expr;
}
export interface ValueSpec extends Node {
    Names?: Ident[];
    Type?: Expr;
    Values?: Expr[];
}
export declare const ArrayType = "ArrayType";
export declare const AssignStmt = "AssignStmt";
export declare const BasicLit = "BasicLit";
export declare const BinaryExpr = "BinaryExpr";
export declare const CaseClause = "CaseClause";
export declare const ChanType = "ChanType";
export declare const CommClause = "CommClause";
export declare const Ellipsis = "Ellipsis";
export declare const GenDecl = "GenDecl";
export declare const IndexExpr = "IndexExpr";
export declare const IndexListExpr = "IndexListExpr";
export declare const InterfaceType = "InterfaceType";
export declare const MapType = "MapType";
export declare const ParenExpr = "ParenExpr";
export declare const SelectorExpr = "SelectorExpr";
export declare const SelectStmt = "SelectStmt";
export declare const StarExpr = "StarExpr";
export declare const StructType = "StructType";
export declare const SwitchStmt = "SwitchStmt";
export declare const UnaryExpr = "UnaryExpr";
export declare function Inspect(root: Node | undefined, fn: (node: Node | undefined) => bool): void;
//# sourceMappingURL=ast.d.ts.map