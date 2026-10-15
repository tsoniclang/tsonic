export function parseFiniteNumberLiteral(text: string): number | undefined {
  const value = Number(removeNumericSeparators(text));
  return Number.isFinite(value) ? value : undefined;
}

export function parseBigIntLiteral(text: string): bigint | undefined {
  const normalized = removeNumericSeparators(text).replace(/n$/u, "");
  try {
    return BigInt(normalized);
  } catch {
    return undefined;
  }
}

function removeNumericSeparators(text: string): string {
  return text.split("_").join("");
}
