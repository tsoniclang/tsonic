export type TargetNativeHandler<MemoryBinding, Safety, JsStringConversion, NativePointer, TypedLocation> =
  | { readonly kind: "memory-binding"; readonly selection: MemoryBinding }
  | { readonly kind: "explicit-safety"; readonly selection: Safety }
  | { readonly kind: "js-string-conversion"; readonly selection: JsStringConversion }
  | { readonly kind: "native-pointer"; readonly selection: NativePointer }
  | { readonly kind: "typed-location"; readonly selection: TypedLocation };

export function selectTargetNativeHandler<MemoryBinding, Safety, JsStringConversion, NativePointer, TypedLocation>(
  memoryBinding: MemoryBinding | undefined,
  safety: Safety | undefined,
  jsStringConversion: JsStringConversion | undefined,
  nativePointer: NativePointer | undefined,
  typedLocation: TypedLocation | undefined,
): TargetNativeHandler<MemoryBinding, Safety, JsStringConversion, NativePointer, TypedLocation> | undefined {
  if (memoryBinding !== undefined) return Object.freeze({ kind: "memory-binding", selection: memoryBinding });
  if (safety !== undefined) return Object.freeze({ kind: "explicit-safety", selection: safety });
  if (jsStringConversion !== undefined) return Object.freeze({ kind: "js-string-conversion", selection: jsStringConversion });
  if (nativePointer !== undefined) return Object.freeze({ kind: "native-pointer", selection: nativePointer });
  return typedLocation === undefined ? undefined : Object.freeze({ kind: "typed-location", selection: typedLocation });
}

export function selectTargetNativePointerOperation<RawLocation, Layout, RawAddress, RawIdentity, NativePointer>(
  rawLocation: RawLocation | undefined,
  layout: Layout | undefined,
  rawAddress: RawAddress | undefined,
  rawIdentity: RawIdentity | undefined,
  nativePointer: NativePointer | undefined,
): RawLocation | Layout | RawAddress | RawIdentity | NativePointer | undefined {
  return rawLocation ?? layout ?? rawAddress ?? rawIdentity ?? nativePointer;
}
