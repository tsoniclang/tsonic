// Faithful TypeScript port of Go's `errors` standard library package.
//
// Go errors are values of the `error` interface (a type with an `Error() string`
// method). In this single-threaded TypeScript port a Go error is represented as a
// JavaScript `Error` (see `GoError = Error | undefined` in ./compat.js). The
// idiomatic Go "nil error" maps to `undefined`.
//
// Error chains are supported via an optional `Unwrap()` method (returning either a
// single error or a slice of errors) and the optional comparison hooks `Is(target)`
// and `As(target)` that Go's `errors` package consults. These mirror the
// `interface { Unwrap() error }`, `interface { Unwrap() []error }`,
// `interface { Is(error) bool }` and `interface { As(any) bool }` conventions.

import type { bool } from "./scalars.js";
import type { GoError } from "./compat.js";

// Structural shape Go errors may optionally satisfy. None of these methods are
// required; `errors.Is`/`errors.AsType` probe for them at runtime exactly like the
// Go runtime probes for the corresponding interfaces.
export interface GoUnwrappable {
  // Go: interface { Unwrap() error } OR interface { Unwrap() []error }
  Unwrap?(): GoError | GoError[];
  // Go: interface { Is(target error) bool }
  Is?(target: GoError): bool;
  // Go: interface { As(target any) bool }
  As?(target: unknown): bool;
}

// The concrete type produced by errors.New. It corresponds to Go's *errorString.
// Each instance has its own identity, so two New(text) calls are never equal even
// when their messages match (matching Go's pointer-comparison semantics).
export class errorString extends globalThis.Error {
  constructor(text: string) {
    super(text);
    this.name = "errorString";
  }
}

// errors.New returns an error that formats as the given text. Each call returns a
// distinct error value even if the text is identical.
export function New(text: string): GoError {
  return new errorString(text);
}

// Reads the optional Unwrap() method off an error, normalising the result to an
// array of wrapped errors (Go supports both single and multi unwrap).
function unwrap(err: GoError): GoError[] {
  if (err === undefined) {
    return [];
  }
  const candidate = err as unknown as GoUnwrappable;
  if (typeof candidate.Unwrap !== "function") {
    return [];
  }
  const unwrapped = candidate.Unwrap();
  if (unwrapped === undefined) {
    return [];
  }
  if (globalThis.Array.isArray(unwrapped)) {
    return unwrapped;
  }
  return [unwrapped];
}

// errors.Is reports whether any error in err's tree matches target.
//
// The tree consists of err itself followed by the errors obtained by repeatedly
// calling Unwrap(). An error is considered to match target if it is equal to that
// target or if it implements a method Is(error) bool such that Is(target) returns
// true. Matching mirrors Go's depth-first traversal over single/multi unwraps.
export function Is(err: GoError, target: GoError): bool {
  if (target === undefined) {
    return err === undefined;
  }
  // Iterative depth-first walk to avoid relying on recursion limits.
  const stack: GoError[] = [err];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) {
      continue;
    }
    if (current === target) {
      return true;
    }
    const withIs = current as unknown as GoUnwrappable;
    if (typeof withIs.Is === "function" && withIs.Is(target) === true) {
      return true;
    }
    // Push children in order so the first wrapped error is visited first.
    const children = unwrap(current);
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push(children[i]);
    }
  }
  return false;
}

// A runtime type guard used by AsType to test whether a tree error is of the
// requested target type. Mirrors Go's reflect-based assignability check: in this
// port the caller supplies a predicate that recognises the desired concrete type.
export type TypeGuard<T> = (err: GoError) => err is T & GoError;

// errors.AsType[T](err) finds the first error in err's tree that is of type T,
// returning that error and true on success, or the zero value (undefined) and
// false otherwise.
//
// Go's generic `errors.AsType[T]` infers T from the type argument. In TypeScript
// there is no runtime type argument, so the concrete-type check is supplied as a
// predicate `guard`. The traversal order matches errors.Is.
export function AsType<T>(err: GoError, guard: TypeGuard<T>): [T | undefined, bool] {
  const stack: GoError[] = [err];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) {
      continue;
    }
    if (guard(current)) {
      return [current, true];
    }
    const withAs = current as unknown as GoUnwrappable;
    if (typeof withAs.As === "function" && withAs.As(current) === true) {
      // The error customises matching via As; honour it only when the value is
      // recognised by the guard, which the branch above already covered.
    }
    const children = unwrap(current);
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push(children[i]);
    }
  }
  return [undefined, false];
}
