export type TargetNativeHandler<MemoryBinding, Safety, JsStringConversion, NativePointer, TypedLocation> = {
    readonly kind: "memory-binding";
    readonly selection: MemoryBinding;
} | {
    readonly kind: "explicit-safety";
    readonly selection: Safety;
} | {
    readonly kind: "js-string-conversion";
    readonly selection: JsStringConversion;
} | {
    readonly kind: "native-pointer";
    readonly selection: NativePointer;
} | {
    readonly kind: "typed-location";
    readonly selection: TypedLocation;
};
export declare function selectTargetNativeHandler<MemoryBinding, Safety, JsStringConversion, NativePointer, TypedLocation>(memoryBinding: MemoryBinding | undefined, safety: Safety | undefined, jsStringConversion: JsStringConversion | undefined, nativePointer: NativePointer | undefined, typedLocation: TypedLocation | undefined): TargetNativeHandler<MemoryBinding, Safety, JsStringConversion, NativePointer, TypedLocation> | undefined;
export declare function selectTargetNativePointerOperation<RawLocation, Layout, RawAddress, RawIdentity, NativePointer>(rawLocation: RawLocation | undefined, layout: Layout | undefined, rawAddress: RawAddress | undefined, rawIdentity: RawIdentity | undefined, nativePointer: NativePointer | undefined): RawLocation | Layout | RawAddress | RawIdentity | NativePointer | undefined;
//# sourceMappingURL=native-handlers.d.ts.map