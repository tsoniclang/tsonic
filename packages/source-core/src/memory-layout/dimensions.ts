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

export function memoryLayoutDimensionsError(layout: {
  readonly byteSize: number;
  readonly byteAlignment: number;
  readonly stride: number;
  readonly dataLayout: { readonly addressWidth: 32 | 64 };
  readonly fields: readonly (MemoryFieldDimensions & { readonly selectedDeclaration: object })[];
}): string | undefined {
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
  const declarations = new Set<object>();
  for (const field of layout.fields) {
    const fieldError = memoryFieldDimensionsError(field);
    if (fieldError !== undefined) return fieldError;
    if (declarations.has(field.selectedDeclaration)) return "Memory layout repeats a physical field.";
    declarations.add(field.selectedDeclaration);
    if (field.byteOffset > layout.byteSize || field.byteAlignment > layout.byteAlignment ||
        layout.byteAlignment % field.byteAlignment !== 0) {
      return "Memory field is outside the aggregate or violates aggregate alignment.";
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
