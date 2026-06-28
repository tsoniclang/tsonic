export const ILLEGAL = 0;
export const EOF = 1;
export const COMMENT = 2;
export const IDENT = 4;
export const VAR = 85;
export const DEFINE = 47;
export const AND_ASSIGN = 24;
export const XOR = 27;
export function IsExported(name) {
    if (name.length === 0) {
        return false;
    }
    const first = Array.from(name)[0];
    return (first.toLocaleUpperCase() === first && first.toLocaleLowerCase() !== first);
}
export function IsIdentifier(name) {
    if (name.length === 0 || !/^[_\p{L}]$/u.test(Array.from(name)[0])) {
        return false;
    }
    for (const char of Array.from(name).slice(1)) {
        if (!/^[_\p{L}\p{N}]$/u.test(char)) {
            return false;
        }
    }
    return true;
}
export const NoPos = 0;
//# sourceMappingURL=token.js.map