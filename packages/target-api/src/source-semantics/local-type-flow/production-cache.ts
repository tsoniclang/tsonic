import type { Node } from "@tsonic/tsts";
import type { SourceTypeBinding, SourceTypeComponent } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../descriptor-contracts.js";

export function createSourceProductionCache<Key extends object, Value>(input: {
  readonly dependency: (key: Key) => SourceTypeComponent;
  readonly produce: (key: Key, bindings: readonly SourceTypeBinding[]) => SourceProductionResult<Value>;
}): {
  query(key: Key, bindings: readonly SourceTypeBinding[]): SourceProductionResult<Value>;
  seed(key: Key, bindings: readonly SourceTypeBinding[], value: SourceProductionResult<Value>): void;
  revision(): number;
} {
  const identities = new WeakMap<object, number>();
  const cache = new WeakMap<Key, Map<string, SourceProductionResult<Value>>>();
  const active = new WeakMap<Key, Set<string>>();
  let serial = 0;
  let revision = 0;
  function identity(value: object): number {
    const previous = identities.get(value);
    if (previous !== undefined) return previous;
    const selected = serial++;
    identities.set(value, selected);
    return selected;
  }
  function environment(bindings: readonly SourceTypeBinding[]): string {
    const declarations = new Set<Node>();
    return bindings.map(binding => {
      if (declarations.has(binding.declaration)) throw new Error("A Source production environment requires one value per original binder.");
      declarations.add(binding.declaration);
      return `${identity(binding.declaration)}:${identity(binding.value)}`;
    }).join("/");
  }
  function seed(key: Key, bindings: readonly SourceTypeBinding[], value: SourceProductionResult<Value>): void {
    if (value.kind === "pending") return;
    const signature = environment(bindings);
    let records = cache.get(key);
    if (records === undefined) { records = new Map(); cache.set(key, records); }
    if (records.has(signature)) return;
    records.set(signature, value);
    revision++;
  }
  function query(key: Key, bindings: readonly SourceTypeBinding[]): SourceProductionResult<Value> {
    const signature = environment(bindings);
    const previous = cache.get(key)?.get(signature);
    if (previous !== undefined) return previous;
    let running = active.get(key);
    if (running?.has(signature)) return { kind: "pending", dependencies: [input.dependency(key)] };
    if (running === undefined) { running = new Set(); active.set(key, running); }
    running.add(signature);
    try {
      const result = input.produce(key, bindings);
      seed(key, bindings, result);
      return result;
    } finally { running.delete(signature); }
  }
  return Object.freeze({ query, seed, revision: () => revision });
}
