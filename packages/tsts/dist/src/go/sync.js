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
    Lock() { }
    Unlock() { }
    TryLock() {
        return true;
    }
}
// RWMutex is a reader/writer mutual exclusion lock. Single-threaded: all no-ops.
export class RWMutex {
    Lock() { }
    Unlock() { }
    RLock() { }
    RUnlock() { }
    TryLock() {
        return true;
    }
    TryRLock() {
        return true;
    }
    // RLocker returns a Locker interface backed by the read lock.
    RLocker() {
        return { Lock: () => this.RLock(), Unlock: () => this.RUnlock() };
    }
}
// Once is an object that performs exactly one action.
export class Once {
    // Single-threaded mutable memo flag is the faithful model of Once's done bit.
    done = false;
    // Do calls f only the first time Do is invoked for this Once.
    Do(f) {
        if (!this.done) {
            this.done = true;
            f();
        }
    }
}
// OnceFunc returns a function that invokes f only once. The returned function may
// be called concurrently in Go; here it is simply memoized.
export function OnceFunc(f) {
    const once = new Once();
    return () => {
        once.Do(f);
    };
}
// OnceValue returns a function that invokes f only once and returns the value
// returned by f. The returned function may be called any number of times.
export function OnceValue(f) {
    let called = false;
    let value;
    return () => {
        if (!called) {
            called = true;
            value = f();
        }
        return value;
    };
}
// OnceValues returns a function that invokes f only once and returns the two
// values returned by f. Modeled as a tuple return to match Go's (T1, T2).
export function OnceValues(f) {
    let called = false;
    let v1;
    let v2;
    return () => {
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
export class Map {
    primitive = new globalThis.Map();
    structured = NewGoStructMap();
    nanNumberEntries = [];
    // Load returns the value stored for key, and whether it was present.
    Load(key) {
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
    Store(key, value) {
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
    LoadOrStore(key, value) {
        const bucket = mapKeyBucket(key);
        if (bucket === mapKeyBucketPrimitive) {
            const existing = this.primitive.get(key);
            if (existing !== undefined || this.primitive.has(key)) {
                return [existing, true];
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
    LoadAndDelete(key) {
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
    Delete(key) {
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
    Clear() {
        this.primitive.clear();
        this.structured.clear();
        this.nanNumberEntries.length = 0;
    }
    // Range calls f sequentially for each key and value present in the map.
    // If f returns false, Range stops the iteration.
    Range(f) {
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
const mapKeyBucketStructured = 0;
const mapKeyBucketPrimitive = 1;
const mapKeyBucketNanNumber = 2;
function mapKeyBucket(key) {
    const keyType = typeof key;
    if (keyType === "number") {
        return globalThis.Number.isNaN(key) ? mapKeyBucketNanNumber : mapKeyBucketPrimitive;
    }
    if (keyType === "string" || keyType === "boolean" || keyType === "bigint") {
        return mapKeyBucketPrimitive;
    }
    return mapKeyBucketStructured;
}
export class Pool {
    New;
    items = [];
    Get() {
        const item = this.items.pop();
        if (item !== undefined) {
            return item;
        }
        if (this.New !== undefined) {
            return this.New();
        }
        return undefined;
    }
    Put(x) {
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
    L;
    constructor(l) {
        this.L = l;
    }
    // Wait atomically unlocks L and suspends; on wakeup it re-locks L. Single-threaded
    // there is nothing to wait for, so it returns immediately with L re-locked.
    Wait() {
        this.L.Unlock();
        this.L.Lock();
    }
    // Signal wakes one goroutine waiting on c, if there is any. No-op single-threaded.
    Signal() { }
    // Broadcast wakes all goroutines waiting on c. No-op single-threaded.
    Broadcast() { }
}
// NewCond returns a new Cond with Locker l.
export function NewCond(l) {
    return new Cond(l);
}
// WaitGroup waits for a collection of goroutines to finish. Single-threaded, all
// spawned work has already completed synchronously by the time Wait is called, so
// the counter is tracked for fidelity but Wait never blocks.
export class WaitGroup {
    counter = 0;
    // Add adds delta, which may be negative, to the WaitGroup counter.
    Add(delta) {
        this.counter = this.counter + delta;
        if (this.counter < 0) {
            throw new globalThis.Error("sync: negative WaitGroup counter");
        }
    }
    // Done decrements the WaitGroup counter by one.
    Done() {
        this.Add(-1);
    }
    // Wait blocks until the WaitGroup counter is zero. Single-threaded it returns
    // immediately (any goroutines ran synchronously before Wait was reached).
    Wait() { }
    // Go runs f in a new goroutine and tracks it. Single-threaded, f runs synchronously.
    Go(f) {
        this.Add(1);
        try {
            f();
        }
        finally {
            this.Done();
        }
    }
}
//# sourceMappingURL=sync.js.map