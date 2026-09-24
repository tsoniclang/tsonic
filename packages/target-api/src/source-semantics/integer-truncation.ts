import type { SourcePrimitiveKind } from "@tsonic/tsts";

const integerDomains: Partial<Record<SourcePrimitiveKind, { readonly width: number; readonly signed: boolean }>> = {
  int8: { width: 8, signed: true }, uint8: { width: 8, signed: false },
  int16: { width: 16, signed: true }, uint16: { width: 16, signed: false },
  int32: { width: 32, signed: true }, uint32: { width: 32, signed: false },
  int64: { width: 64, signed: true }, uint64: { width: 64, signed: false },
  int128: { width: 128, signed: true }, uint128: { width: 128, signed: false },
};

export function sourceIntegerTruncationFits(width: number, signed: boolean, target: SourcePrimitiveKind): boolean {
  const domain = integerDomains[target];
  if (domain === undefined || !Number.isInteger(width) || width < 0) return false;
  if (width === 0) return true;
  return signed ? domain.signed && width <= domain.width
    : width <= domain.width - (domain.signed ? 1 : 0);
}
