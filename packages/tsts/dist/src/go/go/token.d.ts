import type { bool, int } from "@tsonic/core/types.js";
export type Token = int;
export declare const ILLEGAL: Token;
export declare const EOF: Token;
export declare const COMMENT: Token;
export declare const IDENT: Token;
export declare const VAR: Token;
export declare const DEFINE: Token;
export declare const AND_ASSIGN: Token;
export declare const XOR: Token;
export declare function IsExported(name: string): bool;
export declare function IsIdentifier(name: string): bool;
export type Pos = int;
export declare const NoPos: Pos;
export interface Position {
    Filename: string;
    Offset: int;
    Line: int;
    Column: int;
}
//# sourceMappingURL=token.d.ts.map