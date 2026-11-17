export const lexicalGenericFunctionsSource = `
import type { int32 } from "@tsonic/core/types.js";
export function forwardOuter<T>(value: T): T {
  function forward(inner: T): T { return inner; }
  function through<U>(outer: T, other: U): T { return forward(outer); }
  return through(value, 3 as int32);
}
export function captureOuter<T>(value: T): T {
  function read(): T { return value; }
  function through(): T { return read(); }
  return through();
}
export function shadowOuter<T>(value: T): T {
  function identity<T>(inner: T): T { return inner; }
  return identity(value);
}
class Keeper<T> {
  readonly value: T;
  constructor(value: T) { this.value = value; }
  read(): T { return this.value; }
  forward<U>(other: U): T { return this.read(); }
}
export function readKeeper(value: int32): int32 {
  const keeper = new Keeper(value);
  return keeper.forward(0 as int32);
}
export function run(): int32 {
  return (forwardOuter(5 as int32) + captureOuter(7 as int32) + shadowOuter(11 as int32)) as int32;
}
`;
