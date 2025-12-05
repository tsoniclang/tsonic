// Map type declaration and usage
export function createStringMap(): Map<string, number> {
  return new Map<string, number>();
}

// Set type declaration and usage
export function createNumberSet(): Set<number> {
  return new Set<number>();
}

// Map operations
export function useMap(map: Map<string, number>): number {
  map.set("a", 1);
  map.set("b", 2);
  const value = map.get("a");
  const hasKey = map.has("a");
  const deleted = map.delete("b");
  const size = map.size;
  return value ?? 0;
}

// Set operations
export function useSet(set: Set<string>): boolean {
  set.add("hello");
  set.add("world");
  const hasValue = set.has("hello");
  const deleted = set.delete("world");
  const size = set.size;
  return hasValue;
}
