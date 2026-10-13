import type { SourceStorageBudget } from "../model/resource-budget.js";

export type SourceStorageKeyValue = null | string | number | readonly SourceStorageKeyValue[] | SourceStorageKeySet;

export interface SourceStorageKeySet {
  readonly kind: "set";
  readonly values: readonly SourceStorageKeyValue[];
}

type Composite = readonly SourceStorageKeyValue[] | SourceStorageKeySet;
type EncodedValue = null | string | number | readonly [number];

interface Entry {
  readonly children: readonly SourceStorageKeyValue[];
  readonly parent: Entry | undefined;
  readonly unordered: boolean;
  next: number;
  height: number;
  identity: number;
  complete: boolean;
  key: string;
}

function composite(value: SourceStorageKeyValue): value is Composite {
  return value !== null && typeof value === "object";
}

function empty(value: SourceStorageKeyValue): boolean {
  return Array.isArray(value) && value.length === 0;
}

export function encodeSourceStorageKey(value: SourceStorageKeyValue, budget: SourceStorageBudget): string | undefined {
  return budget.withRows(rows => {
    const entries = new Map<Composite, Entry>();
    const layers: Entry[][] = [];
    const enter = (value: Composite, parent?: Entry): Entry | undefined => {
      const children = Array.isArray(value) ? value as readonly SourceStorageKeyValue[] : (value as SourceStorageKeySet).values;
      for (let index = 0; index < Math.max(1, children.length); index += 32) if (!budget.step()) return undefined;
      if (!rows.add(2)) return undefined;
      const entry: Entry = { children, parent, next: 0, height: 0, identity: -1, complete: false,
        key: "", unordered: !Array.isArray(value) };
      entries.set(value, entry);
      return entry;
    };
    const atom = (value: SourceStorageKeyValue): EncodedValue => empty(value) ? [0]
      : composite(value) ? [entries.get(value)!.identity] : value;
    if (!composite(value) || empty(value)) {
      if (!budget.step()) return undefined;
      if (typeof value === "number" && !Number.isFinite(value)) {
        budget.reject("Source storage key numbers must be finite."); return undefined;
      }
      if (typeof value === "string" && value.length >= 128 && !rows.add(Math.ceil(value.length * 6 / 1024))) return undefined;
      return JSON.stringify([atom(value), []]);
    }
    const root = enter(value);
    if (root === undefined) return undefined;
    let current: Entry | undefined = root;
    while (current !== undefined) {
      if (current.next === current.children.length) {
        (layers[current.height] ??= []).push(current);
        current.complete = true;
        current = current.parent;
        continue;
      }
      const child = current.children[current.next]!;
      if (!composite(child) || empty(child)) { current.next += 1; continue; }
      const known = entries.get(child);
      if (known === undefined) {
        current = enter(child, current);
        if (current === undefined) return undefined;
        continue;
      }
      if (!known.complete) {
        budget.reject("Source storage keys require an acyclic exact value."); return undefined;
      }
      current.height = Math.max(current.height, known.height + 1);
      current.next += 1;
    }
    const encoded: string[] = [];
    for (const layer of layers) {
      for (const entry of layer) {
        if (!budget.step()) return undefined;
        let characters = 64;
        for (const child of entry.children) {
          if (typeof child === "number" && !Number.isFinite(child)) {
            budget.reject("Source storage key numbers must be finite."); return undefined;
          }
          characters += typeof child === "string" ? child.length * 6 + 2 : 16;
        }
        const blocks = Math.floor(characters / 1024);
        if (blocks !== 0 && !rows.add(blocks)) return undefined;
        const values = entry.children.map(atom);
        entry.key = JSON.stringify([entry.unordered ? "set" : "sequence", entry.unordered
          ? [...new Set(values.map(value => JSON.stringify(value)))].sort() : values]);
      }
      layer.sort((left, right) => left.key < right.key ? -1 : left.key > right.key ? 1 : 0);
      let previous: string | undefined;
      for (const entry of layer) {
        if (previous !== entry.key) { previous = entry.key; encoded.push(entry.key); }
        entry.identity = encoded.length;
      }
    }
    return budget.failure() === undefined ? JSON.stringify([[root.identity], encoded]) : undefined;
  });
}
