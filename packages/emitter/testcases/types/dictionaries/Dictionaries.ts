// Dictionary with string keys (existing behavior)
export function getStringDict(): Record<string, number> {
  return {};
}

// Dictionary with number keys (new)
export function getNumberDict(): Record<number, string> {
  return {};
}

// Index signature with number key
export interface NumberIndexed {
  [key: number]: string;
}

// Function using number-keyed dictionary
export function lookupByNumber(
  dict: Record<number, string>,
  key: number
): string | undefined {
  return dict[key];
}
