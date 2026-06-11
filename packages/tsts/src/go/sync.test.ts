import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Mutex,
  RWMutex,
  Once,
  OnceFunc,
  OnceValue,
  OnceValues,
  Map as SyncMap,
  Pool,
  Cond,
  NewCond,
  WaitGroup,
} from "./sync.js";

test("sync.Mutex Lock/Unlock are no-ops", () => {
  const m = new Mutex();
  m.Lock();
  m.Unlock();
  assert.equal(m.TryLock(), true);
});

test("sync.RWMutex no-ops + RLocker", () => {
  const rw = new RWMutex();
  rw.Lock();
  rw.Unlock();
  rw.RLock();
  rw.RUnlock();
  assert.equal(rw.TryLock(), true);
  assert.equal(rw.TryRLock(), true);
  const locker = rw.RLocker();
  locker.Lock();
  locker.Unlock();
});

test("sync.Once.Do runs exactly once", () => {
  const once = new Once();
  let count = 0;
  once.Do(() => {
    count = count + 1;
  });
  once.Do(() => {
    count = count + 1;
  });
  assert.equal(count, 1);
});

test("sync.OnceFunc runs once", () => {
  let count = 0;
  const f = OnceFunc(() => {
    count = count + 1;
  });
  f();
  f();
  f();
  assert.equal(count, 1);
});

test("sync.OnceValue memoizes the result", () => {
  let calls = 0;
  const get = OnceValue<string>(() => {
    calls = calls + 1;
    return "value";
  });
  assert.equal(get(), "value");
  assert.equal(get(), "value");
  assert.equal(calls, 1);
});

test("sync.OnceValues memoizes a tuple", () => {
  let calls = 0;
  const get = OnceValues<string, number>(() => {
    calls = calls + 1;
    return ["s", 42];
  });
  assert.deepEqual(get(), ["s", 42]);
  assert.deepEqual(get(), ["s", 42]);
  assert.equal(calls, 1);
});

test("sync.Map Load/Store/LoadOrStore/Delete/Range", () => {
  const m = new SyncMap<string, number>();
  // Missing key -> (undefined, false).
  assert.deepEqual(m.Load("a"), [undefined, false]);

  m.Store("a", 1);
  assert.deepEqual(m.Load("a"), [1, true]);

  // LoadOrStore returns existing without overwriting.
  assert.deepEqual(m.LoadOrStore("a", 99), [1, true]);
  assert.deepEqual(m.LoadOrStore("b", 2), [2, false]);
  assert.deepEqual(m.Load("b"), [2, true]);

  // LoadAndDelete.
  assert.deepEqual(m.LoadAndDelete("b"), [2, true]);
  assert.deepEqual(m.Load("b"), [undefined, false]);

  // Range over all entries.
  m.Store("c", 3);
  const seen = new globalThis.Map<string, number>();
  m.Range((k, v) => {
    seen.set(k, v);
    return true;
  });
  assert.equal(seen.get("a"), 1);
  assert.equal(seen.get("c"), 3);

  // Range early-stops when callback returns false.
  let count = 0;
  m.Range(() => {
    count = count + 1;
    return false;
  });
  assert.equal(count, 1);

  m.Delete("a");
  assert.deepEqual(m.Load("a"), [undefined, false]);

  m.Clear();
  let any = false;
  m.Range(() => {
    any = true;
    return true;
  });
  assert.equal(any, false);
});

test("sync.Pool Get uses New; Put discards", () => {
  let constructed = 0;
  const p = new Pool<{ id: number }>();
  p.New = () => {
    constructed = constructed + 1;
    return { id: constructed };
  };
  const a = p.Get();
  const b = p.Get();
  assert.deepEqual(a, { id: 1 });
  assert.deepEqual(b, { id: 2 });
  p.Put(a as { id: number });

  // Without New, Get returns undefined (Go: nil).
  const empty = new Pool<number>();
  assert.equal(empty.Get(), undefined);
});

test("sync.Cond / NewCond no-op wakeups", () => {
  const m = new Mutex();
  const c = new Cond(m);
  assert.equal(c.L, m);
  c.Signal();
  c.Broadcast();
  // Wait re-locks and returns immediately single-threaded.
  c.Wait();

  const c2 = NewCond(m);
  assert.ok(c2 instanceof Cond);
});

test("sync.WaitGroup counter + Wait", () => {
  const wg = new WaitGroup();
  wg.Add(2);
  wg.Done();
  wg.Done();
  wg.Wait(); // returns immediately

  // Negative counter panics (throws).
  const wg2 = new WaitGroup();
  assert.throws(() => wg2.Done(), /negative WaitGroup counter/);
});

test("sync.WaitGroup.Go runs synchronously and balances the counter", () => {
  const wg = new WaitGroup();
  let ran = false;
  wg.Go(() => {
    ran = true;
  });
  assert.equal(ran, true);
  // Counter is back to zero, so a subsequent Done would underflow.
  assert.throws(() => wg.Done(), /negative WaitGroup counter/);
});
