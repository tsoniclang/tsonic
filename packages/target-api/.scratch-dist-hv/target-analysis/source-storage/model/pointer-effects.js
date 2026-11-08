/** The storage effect of a native pointer marker call, from the Host pointer-operation record (facts.selections.pointerOperation). */
export function sourceStoragePointerCallEffect(operation) {
    if (operation === undefined || "kind" in operation)
        return undefined;
    switch (operation.operation) {
        case "allocate": return Object.freeze({ resultAllocation: operation.call });
        case "load":
        case "store":
        case "address-of":
        case "bind-pointer":
        case "project-pointer": return Object.freeze({});
        default: return undefined;
    }
}
//# sourceMappingURL=pointer-effects.js.map