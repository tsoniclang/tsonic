export function selectTargetNativeHandler(memoryBinding, safety, jsStringConversion, nativePointer, typedLocation) {
    if (memoryBinding !== undefined)
        return Object.freeze({ kind: "memory-binding", selection: memoryBinding });
    if (safety !== undefined)
        return Object.freeze({ kind: "explicit-safety", selection: safety });
    if (jsStringConversion !== undefined)
        return Object.freeze({ kind: "js-string-conversion", selection: jsStringConversion });
    if (nativePointer !== undefined)
        return Object.freeze({ kind: "native-pointer", selection: nativePointer });
    return typedLocation === undefined ? undefined : Object.freeze({ kind: "typed-location", selection: typedLocation });
}
export function selectTargetNativePointerOperation(rawLocation, layout, rawAddress, rawIdentity, nativePointer) {
    return rawLocation ?? layout ?? rawAddress ?? rawIdentity ?? nativePointer;
}
//# sourceMappingURL=native-handlers.js.map