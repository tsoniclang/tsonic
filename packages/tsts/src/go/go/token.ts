import type { bool, int } from "../scalars.js";

export type Token = int;

export const ILLEGAL: Token = 0 as Token;
export const EOF: Token = 1 as Token;
export const COMMENT: Token = 2 as Token;
export const IDENT: Token = 4 as Token;
export const VAR: Token = 85 as Token;
export const DEFINE: Token = 47 as Token;
export const AND_ASSIGN: Token = 24 as Token;
export const XOR: Token = 27 as Token;

export function IsExported(name: string): bool {
  if (name.length === 0) {
    return false as bool;
  }
  const first = Array.from(name)[0]!;
  return (first.toLocaleUpperCase() === first && first.toLocaleLowerCase() !== first) as bool;
}

export function IsIdentifier(name: string): bool {
  if (name.length === 0 || !/^[_\p{L}]$/u.test(Array.from(name)[0]!)) {
    return false as bool;
  }
  for (const char of Array.from(name).slice(1)) {
    if (!/^[_\p{L}\p{N}]$/u.test(char)) {
      return false as bool;
    }
  }
  return true as bool;
}

export type Pos = int;
export const NoPos: Pos = 0 as Pos;

export interface Position {
  Filename: string;
  Offset: int;
  Line: int;
  Column: int;
}
