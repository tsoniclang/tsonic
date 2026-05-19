import { int } from "@tsonic/core/types.js";

// Action types (void return)
export function runAction(action: () => void): void {
  action();
}

export function runActionWithArg(action: (x: int) => void, value: int): void {
  action(value);
}

// Func types (with return)
export function applyFunc<T, R>(fn: (arg: T) => R, value: T): R {
  return fn(value);
}

export function applyFunc2<T1, T2, R>(
  fn: (a: T1, b: T2) => R,
  a: T1,
  b: T2
): R {
  return fn(a, b);
}

// Composing functions
export function compose<A, B, C>(f: (a: A) => B, g: (b: B) => C): (a: A) => C {
  return (a: A): C => g(f(a));
}
