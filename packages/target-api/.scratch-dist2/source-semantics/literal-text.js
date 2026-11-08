export function parseFiniteNumberLiteral(text) {
    const value = Number(removeNumericSeparators(text));
    return Number.isFinite(value) ? value : undefined;
}
export function parseBigIntLiteral(text) {
    const normalized = removeNumericSeparators(text).replace(/n$/u, "");
    try {
        return BigInt(normalized);
    }
    catch {
        return undefined;
    }
}
function removeNumericSeparators(text) {
    return text.split("_").join("");
}
//# sourceMappingURL=literal-text.js.map