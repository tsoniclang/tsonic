import test from "node:test";
import assert from "node:assert/strict";
import { New, Is, AsType, errorString } from "./errors.js";

test("errors.New produces distinct values with the given message", () => {
  const a = New("boom");
  const b = New("boom");
  assert.ok(a instanceof globalThis.Error);
  assert.equal((a as Error).message, "boom");
  // Distinct identities even with identical text (Go pointer semantics).
  assert.notEqual(a, b);
  assert.equal(Is(a, a), true);
  assert.equal(Is(a, b), false);
});

test("errors.Is matches a target by identity", () => {
  const sentinel = New("not found");
  assert.equal(Is(sentinel, sentinel), true);
  const other = New("other");
  assert.equal(Is(other, sentinel), false);
});

test("errors.Is treats nil/undefined targets correctly", () => {
  assert.equal(Is(undefined, undefined), true);
  assert.equal(Is(New("x"), undefined), false);
});

test("errors.Is walks the Unwrap chain", () => {
  const root = New("root cause");
  class Wrapped extends globalThis.Error {
    Unwrap() {
      return root;
    }
  }
  const wrapped = new Wrapped("wrapper");
  assert.equal(Is(wrapped, root), true);
  assert.equal(Is(wrapped, New("unrelated")), false);
});

test("errors.Is honours a custom Is() method", () => {
  const target = New("kind");
  class Custom extends globalThis.Error {
    Is(t: Error | undefined) {
      return t === target;
    }
  }
  assert.equal(Is(new Custom("c"), target), true);
});

test("errors.Is traverses multi-error Unwrap (slice form)", () => {
  const a = New("a");
  const b = New("b");
  class Multi extends globalThis.Error {
    Unwrap() {
      return [a, b];
    }
  }
  const multi = new Multi("multi");
  assert.equal(Is(multi, a), true);
  assert.equal(Is(multi, b), true);
  assert.equal(Is(multi, New("c")), false);
});

test("errors.AsType finds the first error of a target type in the chain", () => {
  class MyErr extends globalThis.Error {}
  const target = new MyErr("specific");
  class Wrapper extends globalThis.Error {
    Unwrap() {
      return target;
    }
  }
  const wrapper = new Wrapper("outer");
  const [found, ok] = AsType(wrapper, (e): e is MyErr => e instanceof MyErr);
  assert.equal(ok, true);
  assert.equal(found, target);
});

test("errors.AsType returns [undefined, false] when no match", () => {
  class MyErr extends globalThis.Error {}
  const [found, ok] = AsType(New("plain"), (e): e is MyErr => e instanceof MyErr);
  assert.equal(ok, false);
  assert.equal(found, undefined);
});

test("errorString carries the constructed message", () => {
  const e = new errorString("hello");
  assert.equal(e.message, "hello");
  assert.equal(e.name, "errorString");
});
