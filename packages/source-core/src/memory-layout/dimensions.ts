export interface MemoryFieldDimensions {
  readonly byteOffset: number;
  readonly byteAlignment: number;
}

export function memoryFieldDimensionsError(field: MemoryFieldDimensions): string | undefined {
  if (!isSize(field.byteOffset)) return "Memory field offset must be a non-negative safe integer.";
  if (!isAlignment(field.byteAlignment)) return "Memory field alignment must be a positive power of two.";
  return field.byteOffset % field.byteAlignment === 0
    ? undefined : "Memory field offset violates its selected alignment.";
}

interface MemoryValueDimensions {
  readonly byteSize: number;
  readonly byteAlignment: number;
  readonly stride: number;
}

export function memoryLayoutDimensionsError(layout: MemoryValueDimensions & {
  readonly dataLayout: { readonly addressWidth: 32 | 64 };
} & ({
  readonly kind: "value";
  readonly fields: readonly (MemoryFieldDimensions & {
    readonly selectedDeclaration: object;
    readonly fieldLayout: { readonly byteSize: number };
  })[];
} | {
  readonly kind: "array";
  readonly fixedArray: { readonly length: bigint };
  readonly elementLayout: MemoryValueDimensions;
})): string | undefined {
  if (!isSize(layout.byteSize) || !isSize(layout.stride)) {
    return "Memory layout size and stride must be non-negative safe integers.";
  }
  if (!isAlignment(layout.byteAlignment)) return "Memory alignment must be a positive power of two.";
  if (layout.stride < layout.byteSize || layout.stride % layout.byteAlignment !== 0) {
    return "Memory stride must contain the value and preserve its alignment.";
  }
  const maximum = (1n << BigInt(layout.dataLayout.addressWidth)) - 1n;
  if ([layout.byteSize, layout.byteAlignment, layout.stride].some((size) => BigInt(size) > maximum)) {
    return "Memory layout exceeds its selected address width.";
  }
  if (layout.kind === "array") {
    const count = layout.fixedArray.length;
    const element = layout.elementLayout;
    if (typeof count !== "bigint" || count < 0n || !isSize(element.byteSize) ||
        !isSize(element.stride) || !isAlignment(element.byteAlignment) ||
        element.stride < element.byteSize || element.stride % element.byteAlignment !== 0) {
      return "Memory array requires an exact non-negative extent and valid element dimensions.";
    }
    const occupied = count === 0n ? 0n : (count - 1n) * BigInt(element.stride) + BigInt(element.byteSize);
    if (occupied > BigInt(layout.byteSize)) return "Memory array elements exceed the selected whole-array size.";
    if (count !== 0n && layout.byteAlignment % element.byteAlignment !== 0) {
      return "Memory array alignment does not preserve its selected element alignment.";
    }
    return undefined;
  }
  const declarations = new Set<object>();
  for (const field of layout.fields) {
    const fieldError = memoryFieldDimensionsError(field);
    if (fieldError !== undefined) return fieldError;
    if (declarations.has(field.selectedDeclaration)) return "Memory layout repeats a physical field.";
    declarations.add(field.selectedDeclaration);
    if (!isSize(field.fieldLayout.byteSize) || field.byteOffset > layout.byteSize - field.fieldLayout.byteSize ||
        field.byteAlignment > layout.byteAlignment ||
        layout.byteAlignment % field.byteAlignment !== 0) {
      return "Memory field is outside the aggregate or violates aggregate alignment.";
    }
  }
  const occupied = layout.fields.filter((field) => field.fieldLayout.byteSize !== 0)
    .sort((left, right) => left.byteOffset - right.byteOffset);
  for (let index = 1; index < occupied.length; index += 1) {
    const previous = occupied[index - 1]!;
    if (occupied[index]!.byteOffset - previous.byteOffset < previous.fieldLayout.byteSize) {
      return "Memory layout contains overlapping physical fields.";
    }
  }
  return undefined;
}

function isSize(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function isAlignment(value: number): boolean {
  return isSize(value) && value > 0 && (BigInt(value) & (BigInt(value) - 1n)) === 0n;
}
