export const lexicalFunctionValuesSource = `
import type { int32 } from "@tsonic/core/types.js";
export function create(): () => int32 {
  return value;
  function value(): int32 { return 23 as int32; }
}
export function counter(): () => int32 {
  let value = 0 as int32;
  function next(): int32 { value += 1; return value; }
  return next;
}
export function optionalCounter(flag: boolean): (() => int32) | null {
  if (!flag) return null;
  let value = 0 as int32;
  function next(): int32 { return ++value; }
  return next;
}
export function branchCounter(flag: boolean): (() => int32) | null {
  let value = 0 as int32;
  function next(): int32 { return ++value; }
  return flag ? next : null;
}
export function branchIdentity(flag: boolean): (() => int32) | null {
  let value = 0 as int32;
  function next(): int32 { return ++value; }
  if (flag) {
    const left = next;
    const right = next;
    return left === right ? left : null;
  }
  return null;
}
export function forwarded(value: int32): () => int32 {
  function read(): int32 { return value; }
  function forward(): int32 { return read(); }
  return forward;
}
export function generic<T>(value: T): () => T {
  function read(): T { return value; }
  return read;
}
export function recursive(value: int32): (depth: int32) => int32 {
  function read(depth: int32): int32 { return depth === 0 ? value : read((depth - 1) as int32); }
  return read;
}
export function directAndValue(): boolean {
  let value = 0 as int32;
  function next(): int32 { value += 1; return value; }
  const first = next();
  const left = next;
  const right = next;
  return first === 1 && left === right && left() === 2 && next() === 3 && right() === 4;
}
export function arrowValue(): () => () => int32 {
  let value = 0 as int32;
  function next(): int32 { return ++value; }
  return () => next;
}
export function arrowCall(): () => int32 {
  let value = 0 as int32;
  function next(): int32 { return ++value; }
  return () => next();
}
export function namedValue(): () => () => int32 {
  let value = 0 as int32;
  function next(): int32 { return ++value; }
  function get(): () => int32 { return next; }
  return get;
}
export function deferred(): () => int32 {
  const callback = read;
  const value = 17 as int32;
  return callback;
  function read(): int32 { return value; }
}
export function nested(value: int32): () => int32 {
  function read(): int32 {
    function inner(): int32 { return value; }
    return inner();
  }
  return read;
}
export function nestedMutable(): () => int32 {
  let value = 0 as int32;
  function read(): int32 {
    function inner(): int32 { return ++value; }
    return inner();
  }
  return read;
}
export function defaultMutation(): () => int32 {
  let value = 0 as int32;
  function next(step: int32 = ++value): int32 { return step; }
  function read(): int32 { return next(); }
  return read;
}
export function composed(): boolean {
  const arrowGet = arrowValue();
  const arrowLeft = arrowGet();
  const arrowRight = arrowGet();
  const namedGet = namedValue();
  const namedLeft = namedGet();
  const namedRight = namedGet();
  const directArrow = arrowCall();
  const nestedNext = nestedMutable();
  const defaultNext = defaultMutation();
  return arrowLeft === arrowRight && arrowLeft() === 1 && arrowRight() === 2 &&
    namedLeft === namedRight && namedLeft() === 1 && namedRight() === 2 &&
    directArrow() === 1 && directArrow() === 2 && deferred()() === 17 && nested(19 as int32)() === 19 &&
    nestedNext() === 1 && nestedNext() === 2 && defaultNext() === 1 && defaultNext() === 2;
}
export function retained(): boolean {
  const first = counter();
  const alias = first;
  const second = counter();
  const genericRead = generic("payload");
  return first === alias && first !== second && first() === 1 && alias() === 2 && second() === 1 &&
    forwarded(7 as int32)() === 7 && genericRead() === "payload" && genericRead() === "payload" &&
    generic(9 as int32)() === 9 && recursive(11 as int32)(3 as int32) === 11 && directAndValue();
}
export function run(): boolean {
  const first = create();
  const second = create();
  function value(): int32 { return 19 as int32; }
  const left = value;
  const right = value;
  return first !== second && first() === 23 && second() === 23 &&
    left === right && left() === 19 && right() === 19 && value() === 19 && retained() && composed();
}
`;
