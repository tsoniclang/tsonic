export const jsTypedArrayElementKinds = Object.freeze({
  Int8Array: "int8", Uint8Array: "uint8", Uint8ClampedArray: "uint8",
  Int16Array: "int16", Uint16Array: "uint16", Int32Array: "int32", Uint32Array: "uint32",
  Float32Array: "float32", Float64Array: "float64",
} as const);

export const jsTypedArraySourceDeclarations = `
interface TypedArray<TArray, TElement> extends ArrayBufferView, Iterable<TElement> {
  readonly BYTES_PER_ELEMENT: int32;
  readonly length: int32;
  [index: int32]: TElement;
  at(index: int32): TElement | undefined;
  fill<TValue extends number | bigint>(value: TValue, start?: int32, end?: int32): TArray;
  includes<TValue extends number | bigint>(searchElement: TValue, fromIndex?: int32): boolean;
  indexOf<TValue extends number | bigint>(searchElement: TValue, fromIndex?: int32): int32;
  join(separator?: string): string;
  reverse(): TArray;
  set<TValue extends number | bigint>(array: ArrayLike<TValue>, offset?: int32): void;
  slice(start?: int32, end?: int32): TArray;
  sort<TResult extends number | bigint = number>(compareFn?: (left: TElement, right: TElement) => TResult): TArray;
  subarray(begin?: int32, end?: int32): TArray;
}
interface TypedArrayConstructor<TArray> {
  new (length: int32): TArray;
  new <TValue extends number | bigint>(array: ArrayLike<TValue> | Iterable<TValue>): TArray;
  new (buffer: ArrayBuffer, byteOffset?: int32, length?: int32): TArray;
  readonly BYTES_PER_ELEMENT: int32;
}
${Object.entries(jsTypedArrayElementKinds).map(([name, element]) => `
interface ${name} extends TypedArray<${name}, ${element}> {}
interface ${name}Constructor extends TypedArrayConstructor<${name}> {}
declare var ${name}: ${name}Constructor;
`).join("\n")}
`.trim();
