// Faithful TypeScript port of Go's `context` standard library package (the subset
// used by typescript-go): the `Context` interface, the empty root contexts
// (`Background`/`TODO`), and the immutable value-chain (`WithValue`).
//
// TS-Go runs single-threaded, so cancellation and deadlines never actually fire.
// We therefore model the inert, never-canceled behavior of Go's `emptyCtx`:
//   - `Done()` returns a nil channel (Go: `emptyCtx.Done()` returns nil), i.e. a
//     channel that is never ready, represented as `undefined`.
//   - `Err()` returns nil (no error), i.e. `undefined`.
//   - `Deadline()` returns the zero `time.Time` and `false` (no deadline set).
//   - `Value(key)` walks the value chain (Go's `valueCtx.Value` / `value`).
//
// `WithValue(parent, key, val)` returns a new `valueCtx` that answers `Value(key)`
// with `val` and delegates everything else to `parent`, exactly as Go does. Keys
// are compared by identity/value with `===`, matching Go's `c.key == key` on the
// unexported, comparable key types (named `int` keys / pointer keys) the call sites
// use. Multiple Go return values map to tuples, so `Deadline()` returns
// `[Time, bool]`.

import type { bool } from "@tsonic/core/types.js";
import type { GoChan, GoError } from "./compat.js";
import { New } from "./errors.js";
import { Time } from "./time.js";

// Go: var Canceled = errors.New("context canceled")
export const Canceled: GoError = New("context canceled");

// Go: type CancelFunc func()
export type CancelFunc = () => void;

// Go: type CancelCauseFunc func(cause error)
export type CancelCauseFunc = (cause: GoError) => void;

// Go: type Context interface { Deadline; Done; Err; Value }
//
// Done() returns `<-chan struct{}` which may be nil; the nil channel is modeled as
// `undefined`. Deadline()'s `(time.Time, bool)` becomes a `[Time, bool]` tuple.
export interface Context {
  Deadline(): [Time, bool];
  Done(): GoChan<EmptyStruct, "receive"> | undefined;
  Err(): GoError;
  Value(key: unknown): unknown;
}

// Go's `struct{}` element type for the Done channel, matching the empty-struct
// shape used elsewhere in the port (see core/semaphore.ts, core/workgroup.ts).
type EmptyStruct = { readonly __tsgoEmpty?: never };

// Go: type emptyCtx struct{}
//
// An emptyCtx is never canceled, has no values, and has no deadline. It is the
// common base of backgroundCtx and todoCtx.
class emptyCtx implements Context {
  // Go: func (emptyCtx) Deadline() (deadline time.Time, ok bool) { return }
  Deadline(): [Time, bool] {
    return [new Time(), false as bool];
  }

  // Go: func (emptyCtx) Done() <-chan struct{} { return nil }
  Done(): GoChan<EmptyStruct, "receive"> | undefined {
    return undefined;
  }

  // Go: func (emptyCtx) Err() error { return nil }
  Err(): GoError {
    return undefined;
  }

  // Go: func (emptyCtx) Value(key any) any { return nil }
  Value(_key: unknown): unknown {
    return undefined;
  }
}

// Go: type backgroundCtx struct{ emptyCtx }
class backgroundCtx extends emptyCtx {}

// Go: type todoCtx struct{ emptyCtx }
class todoCtx extends emptyCtx {}

// Go: func Background() Context { return backgroundCtx{} }
//
// Returns a non-nil, empty Context. It is never canceled, has no values, and has
// no deadline.
export function Background(): Context {
  return new backgroundCtx();
}

// Go: func TODO() Context { return todoCtx{} }
export function TODO(): Context {
  return new todoCtx();
}

// Go: type valueCtx struct { Context; key, val any }
//
// A valueCtx carries a key-value pair. It implements Value for that key and
// delegates all other calls to the embedded Context (`parent`).
class valueCtx implements Context {
  readonly parent: Context;
  readonly key: unknown;
  readonly val: unknown;

  constructor(parent: Context, key: unknown, val: unknown) {
    this.parent = parent;
    this.key = key;
    this.val = val;
  }

  // Go: func (c *valueCtx) Value(key any) any { if c.key == key { return c.val }; return value(c.Context, key) }
  Value(key: unknown): unknown {
    if (this.key === key) {
      return this.val;
    }
    return this.parent.Value(key);
  }

  Deadline(): [Time, bool] {
    return this.parent.Deadline();
  }

  Done(): GoChan<EmptyStruct, "receive"> | undefined {
    return this.parent.Done();
  }

  Err(): GoError {
    return this.parent.Err();
  }
}

// Go: func WithValue(parent Context, key, val any) Context
//
// Returns a derived context that carries `val` for `key` and delegates all other
// operations to `parent`. Go panics on a nil parent or nil/uncomparable key; we
// mirror the nil-parent and nil-key panics with thrown errors (Go panic -> throw).
export function WithValue(parent: Context, key: unknown, val: unknown): Context {
  if (parent === undefined) {
    throw new globalThis.Error("cannot create context from nil parent");
  }
  if (key === undefined) {
    throw new globalThis.Error("nil key");
  }
  return new valueCtx(parent, key, val);
}
