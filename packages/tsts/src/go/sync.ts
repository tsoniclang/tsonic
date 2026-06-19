import type { int, bool } from "./scalars.js";
import { GoStructMap, NewGoStructMap } from "./compat.js";

// Go: package sync
//
// TypeScript is single-threaded, so the concurrency primitives degrade to
// faithful single-threaded equivalents:
//   - Mutex/RWMutex Lock/Unlock/RLock/RUnlock are no-ops (there is no other
//     goroutine that could ever hold the lock).
//   - Once.Do / OnceFunc / OnceValue / OnceValues run the function exactly once
//     and memoize the result.
//   - Map wraps a plain Map (matching sync.Map's (value, ok) and Range contract).
//   - Pool calls its New factory on Get (since nothing is ever retained across
//     goroutines, a fresh value is always valid); Put is a no-op.
//   - WaitGroup tracks a counter; Wait returns immediately because all "goroutines"
//     in this single-threaded port run synchronously before Wait is reached.
//   - Cond's Wait would block forever single-threaded (no other goroutine can
//     Signal), so we model it as a no-op wakeup paired with Signal/Broadcast,
//     which matches how the checker pool polls after each wakeup.

// Mutex is a mutual exclusion lock. Single-threaded: Lock/Unlock are no-ops.
export class Mutex {
  Lock(): void {}
  Unlock(): void {}
  TryLock(): bool {
    return true;
  }
}

// RWMutex is a reader/writer mutual exclusion lock. Single-threaded: all no-ops.
export class RWMutex {
  Lock(): void {}
  Unlock(): void {}
  RLock(): void {}
  RUnlock(): void {}
  TryLock(): bool {
    return true;
  }
  TryRLock(): bool {
    return true;
  }
  // RLocker returns a Locker interface backed by the read lock.
  RLocker(): Locker {
    return { Lock: () => this.RLock(), Unlock: () => this.RUnlock() };
  }
}

// Locker is implemented by Mutex and RWMutex (used by Cond).
export interface Locker {
  Lock(): void;
  Unlock(): void;
}

// Once is an object that performs exactly one action.
export class Once {
  // Single-threaded mutable memo flag is the faithful model of Once's done bit.
  private done: bool = false;

  // Do calls f only the first time Do is invoked for this Once.
  Do(f: () => void): void {
    if (!this.done) {
      this.done = true;
      f();
    }
  }
}

// OnceFunc returns a function that invokes f only once. The returned function may
// be called concurrently in Go; here it is simply memoized.
export function OnceFunc(f: () => void): () => void {
  const once = new Once();
  return (): void => {
    once.Do(f);
  };
}

// OnceValue returns a function that invokes f only once and returns the value
// returned by f. The returned function may be called any number of times.
export function OnceValue<T>(f: () => T): () => T {
  let called = false;
  let value!: T;
  return (): T => {
    if (!called) {
      called = true;
      value = f();
    }
    return value;
  };
}

// OnceValues returns a function that invokes f only once and returns the two
// values returned by f. Modeled as a tuple return to match Go's (T1, T2).
export function OnceValues<T1, T2>(f: () => [T1, T2]): () => [T1, T2] {
  let called = false;
  let v1!: T1;
  let v2!: T2;
  return (): [T1, T2] => {
    if (!called) {
      called = true;
      const result = f();
      v1 = result[0];
      v2 = result[1];
    }
    return [v1, v2];
  };
}

// Map is like a Go sync.Map: a concurrent map of any/any. Single-threaded, it is
// a thin wrapper over a plain Map preserving the (value, ok) and Range contracts.
export class Map<K = unknown, V = unknown> {
  private readonly primitive = new globalThis.Map<K, V>();
  private readonly structured: GoStructMap<K, V> = NewGoStructMap<K, V>();
  private readonly nanNumberEntries: [K, V][] = [];

  // Load returns the value stored for key, and whether it was present.
  Load(key: K): [V | undefined, bool] {
    const bucket = mapKeyBucket(key);
    if (bucket === mapKeyBucketPrimitive) {
      const value = this.primitive.get(key);
      return [value, value !== undefined || this.primitive.has(key)];
    }
    if (bucket === mapKeyBucketNanNumber) {
      return [undefined, false];
    }
    return this.structured.load(key);
  }

  // Store sets the value for a key.
  Store(key: K, value: V): void {
    const bucket = mapKeyBucket(key);
    if (bucket === mapKeyBucketPrimitive) {
      this.primitive.set(key, value);
      return;
    }
    if (bucket === mapKeyBucketNanNumber) {
      this.nanNumberEntries.push([key, value]);
      return;
    }
    this.structured.set(key, value);
  }

  // LoadOrStore returns the existing value if present; otherwise stores and returns
  // the given value. loaded is true if the value was already present.
  LoadOrStore(key: K, value: V): [V, bool] {
    const bucket = mapKeyBucket(key);
    if (bucket === mapKeyBucketPrimitive) {
      const existing = this.primitive.get(key);
      if (existing !== undefined || this.primitive.has(key)) {
        return [existing as V, true];
      }
      this.primitive.set(key, value);
      return [value, false];
    }
    if (bucket === mapKeyBucketNanNumber) {
      this.nanNumberEntries.push([key, value]);
      return [value, false];
    }
    return this.structured.loadOrStore(key, value);
  }

  // LoadAndDelete deletes the value for a key, returning the previous value if any.
  LoadAndDelete(key: K): [V | undefined, bool] {
    const bucket = mapKeyBucket(key);
    if (bucket === mapKeyBucketPrimitive) {
      const existing = this.primitive.get(key);
      const ok = existing !== undefined || this.primitive.has(key);
      this.primitive.delete(key);
      return [existing, ok];
    }
    if (bucket === mapKeyBucketNanNumber) {
      return [undefined, false];
    }
    return this.structured.loadAndDelete(key);
  }

  // Delete deletes the value for a key.
  Delete(key: K): void {
    const bucket = mapKeyBucket(key);
    if (bucket === mapKeyBucketPrimitive) {
      this.primitive.delete(key);
      return;
    }
    if (bucket === mapKeyBucketNanNumber) {
      return;
    }
    this.structured.delete(key);
  }

  // Clear deletes all the entries.
  Clear(): void {
    this.primitive.clear();
    this.structured.clear();
    this.nanNumberEntries.length = 0;
  }

  // Range calls f sequentially for each key and value present in the map.
  // If f returns false, Range stops the iteration.
  Range(f: (key: K, value: V) => bool): void {
    // Snapshot keys so the callback may safely Store/Delete during iteration,
    // matching sync.Map's "Range does not necessarily correspond to any
    // consistent snapshot" but allowing concurrent mutation.
    for (const [key, value] of globalThis.Array.from(this.primitive.entries())) {
      if (!f(key, value)) {
        return;
      }
    }
    for (const [key, value] of globalThis.Array.from(this.structured.entries())) {
      if (!f(key, value)) {
        return;
      }
    }
    for (const [key, value] of globalThis.Array.from(this.nanNumberEntries)) {
      if (!f(key, value)) {
        return;
      }
    }
  }
}

const mapKeyBucketStructured: int = 0;
const mapKeyBucketPrimitive: int = 1;
const mapKeyBucketNanNumber: int = 2;

function mapKeyBucket(key: unknown): int {
  const keyType = typeof key;
  if (keyType === "number") {
    return globalThis.Number.isNaN(key) ? mapKeyBucketNanNumber : mapKeyBucketPrimitive;
  }
  if (keyType === "string" || keyType === "boolean" || keyType === "bigint") {
    return mapKeyBucketPrimitive;
  }
  return mapKeyBucketStructured;
}

export class Pool<T = unknown> {
  New?: () => T;
  private readonly items: T[] = [];

  Get(): T | undefined {
    const item = this.items.pop();
    if (item !== undefined) {
      return item;
    }
    if (this.New !== undefined) {
      return this.New();
    }
    return undefined;
  }

  Put(x: T): void {
    if (x !== undefined && x !== null) {
      this.items.push(x);
    }
  }
}

// Cond implements a condition variable. Single-threaded, no other goroutine can
// Signal a blocked Wait, so callers always poll their predicate after Wait. We
// model Wait as a non-blocking yield point and Signal/Broadcast as no-ops.
export class Cond {
  // L is held while observing or changing the condition.
  readonly L: Locker;

  constructor(l: Locker) {
    this.L = l;
  }

  // Wait atomically unlocks L and suspends; on wakeup it re-locks L. Single-threaded
  // there is nothing to wait for, so it returns immediately with L re-locked.
  Wait(): void {
    this.L.Unlock();
    this.L.Lock();
  }

  // Signal wakes one goroutine waiting on c, if there is any. No-op single-threaded.
  Signal(): void {}

  // Broadcast wakes all goroutines waiting on c. No-op single-threaded.
  Broadcast(): void {}
}

// NewCond returns a new Cond with Locker l.
export function NewCond(l: Locker): Cond {
  return new Cond(l);
}

// WaitGroup waits for a collection of goroutines to finish. Single-threaded, all
// spawned work has already completed synchronously by the time Wait is called, so
// the counter is tracked for fidelity but Wait never blocks.
export class WaitGroup {
  private counter: int = 0;

  // Add adds delta, which may be negative, to the WaitGroup counter.
  Add(delta: int): void {
    this.counter = this.counter + delta;
    if (this.counter < 0) {
      throw new globalThis.Error("sync: negative WaitGroup counter");
    }
  }

  // Done decrements the WaitGroup counter by one.
  Done(): void {
    this.Add(-1);
  }

  // Wait blocks until the WaitGroup counter is zero. Single-threaded it returns
  // immediately (any goroutines ran synchronously before Wait was reached).
  Wait(): void {}

  // Go runs f in a new goroutine and tracks it. Single-threaded, f runs synchronously.
  Go(f: () => void): void {
    this.Add(1);
    try {
      f();
    } finally {
      this.Done();
    }
  }
}
