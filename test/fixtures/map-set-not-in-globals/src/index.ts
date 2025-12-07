// NEGATIVE TEST: Map and Set are not in globals packages
// In noLib mode, TS should fail to resolve these names
// This verifies "globals are the universe" principle

export function useMap(): Map<string, number> {
  // ERROR: Cannot find name 'Map'
  const map = new Map<string, number>();
  map.set("key", 42);
  return map;
}

export function useSet(): Set<number> {
  // ERROR: Cannot find name 'Set'
  const set = new Set<number>();
  set.add(1);
  set.add(2);
  return set;
}
