export function Pointer(value) {
    return value;
}
export function Slice(ptr, len) {
    const length = len;
    if (length < 0) {
        throw new globalThis.Error("unsafe.Slice: len out of range");
    }
    if (ptr === undefined || ptr === null) {
        if (length === 0) {
            return [];
        }
        throw new globalThis.Error("unsafe.Slice: ptr is nil and len is not zero");
    }
    if (typeof ptr === "object" && "length" in ptr) {
        return globalThis.Array.prototype.slice.call(ptr, 0, length);
    }
    return length === 0 ? [] : [ptr];
}
export function String(ptr, len) {
    const bytes = Slice(ptr, len);
    return new TextDecoder().decode(Uint8Array.from(bytes));
}
export function StringData(value) {
    return new TextEncoder().encode(value)[0];
}
//# sourceMappingURL=unsafe.js.map