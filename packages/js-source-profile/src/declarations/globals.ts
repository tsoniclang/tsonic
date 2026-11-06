import { jsStandardSourceProfileDeclarations } from "./composition.js";
import { sourceErrorDeclarations, sourceErrorNames } from "./errors.js";

const sharedNoLibDeclarations = `
type PropertyKey = string | number | symbol;
type UnicodeNormalizationForm = "NFC" | "NFD" | "NFKC" | "NFKD";

interface Object {}
interface Function {}
interface CallableFunction extends Function {}
interface NewableFunction extends Function {}
interface IArguments {
  readonly length: int32;
  [index: int32]: unknown;
}
interface Boolean {}
interface Number {}
interface RegExp {}

${sourceErrorDeclarations}

interface PromiseLike<T> {
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1) | null,
    onrejected?: ((reason: unknown) => TResult2) | null
  ): PromiseLike<TResult1 | TResult2>;
}

interface Promise<T> {
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1) | null,
    onrejected?: ((reason: unknown) => TResult2) | null
  ): Promise<TResult1 | TResult2>;
  catch<TResult = never>(onrejected?: ((reason: unknown) => TResult) | null): Promise<T | TResult>;
}

interface PromiseConstructor {
  new <T>(executor: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: unknown) => void) => void): Promise<T>;
  resolve<T>(value: T | PromiseLike<T>): Promise<T>;
  reject<T = never>(reason?: unknown): Promise<T>;
  all<T>(values: readonly Promise<T>[]): Promise<T[]>;
  all<T extends readonly unknown[]>(values: T): Promise<{ [K in keyof T]: Awaited<T[K]> }>;
}
declare var Promise: PromiseConstructor;

interface Symbol {
  readonly description: string | undefined;
  toString(): string;
  valueOf(): symbol;
}

interface SymbolConstructor {
  readonly iterator: unique symbol;
  readonly asyncIterator: unique symbol;
  readonly dispose: unique symbol;
  readonly asyncDispose: unique symbol;
}
declare var Symbol: SymbolConstructor;

interface IteratorYieldResult<TYield> {
  done?: false;
  value: TYield;
}
interface IteratorReturnResult<TReturn> {
  done: true;
  value: TReturn;
}
type IteratorResult<T, TReturn = unknown> = IteratorYieldResult<T> | IteratorReturnResult<TReturn>;
interface Iterator<T, TReturn = unknown, TNext = unknown> {
  next(): IteratorResult<T, TReturn>;
  next(value: TNext): IteratorResult<T, TReturn>;
}
interface Iterable<T, TReturn = unknown, TNext = unknown> {
  [Symbol.iterator](): Iterator<T, TReturn, TNext>;
}
interface IterableIterator<T, TReturn = unknown, TNext = unknown> extends Iterator<T, TReturn, TNext> {
  [Symbol.iterator](): IterableIterator<T, TReturn, TNext>;
}
interface AsyncIterator<T, TReturn = unknown, TNext = unknown> {
  next(): Promise<IteratorResult<T, TReturn>>;
  next(value: TNext): Promise<IteratorResult<T, TReturn>>;
}
interface AsyncIterable<T, TReturn = unknown, TNext = unknown> {
  [Symbol.asyncIterator](): AsyncIterator<T, TReturn, TNext>;
}
interface AsyncIterableIterator<T, TReturn = unknown, TNext = unknown> extends AsyncIterator<T, TReturn, TNext> {
  [Symbol.asyncIterator](): AsyncIterableIterator<T, TReturn, TNext>;
}
interface Generator<T = unknown, TReturn = unknown, TNext = unknown> extends Iterator<T, TReturn, TNext> {
  next(): IteratorResult<T, TReturn>;
  next(value: TNext): IteratorResult<T, TReturn>;
  return(value: TReturn): IteratorResult<T, TReturn>;
  throw(error: unknown): IteratorResult<T, TReturn>;
  [Symbol.iterator](): Generator<T, TReturn, TNext>;
}
interface AsyncGenerator<T = unknown, TReturn = unknown, TNext = unknown> extends AsyncIterator<T, TReturn, TNext> {
  next(): Promise<IteratorResult<T, TReturn>>;
  next(value: TNext): Promise<IteratorResult<T, TReturn>>;
  return(value: TReturn): Promise<IteratorResult<T, TReturn>>;
  throw(error: unknown): Promise<IteratorResult<T, TReturn>>;
  [Symbol.asyncIterator](): AsyncGenerator<T, TReturn, TNext>;
}
interface Disposable {
  [Symbol.dispose](): void;
}
interface AsyncDisposable {
  [Symbol.asyncDispose](): void | PromiseLike<void>;
}

`.trim();

export const jsSurfaceSourceProfileDeclarations = `
${sharedNoLibDeclarations}
${jsStandardSourceProfileDeclarations}

${sourceErrorNames.filter(name => name !== "Error").map(name => `
interface ${name} extends Error {}
interface ${name}Constructor {
  new (message?: string): ${name};
  (message?: string): ${name};
}
declare var ${name}: ${name}Constructor;
`).join("\n")}

interface TemplateStringsArray extends ReadonlyArray<string> {
  readonly raw: readonly string[];
}

interface Object {
  hasOwnProperty(key: PropertyKey): boolean;
  toString(): string;
}

interface ObjectConstructor {
  keys(value: object): string[];
  values<T>(value: { [key: string]: T } | ArrayLike<T>): T[];
  entries<T>(value: { [key: string]: T } | ArrayLike<T>): [string, T][];
  assign<T extends object, U extends object>(target: T, source: U): T & U;
  hasOwn(value: object, key: PropertyKey): boolean;
  is(value: unknown, other: unknown): boolean;
  getPrototypeOf(value: object): object | null;
  setPrototypeOf(value: object, prototype: object | null): object;
  create(value: object | null): object;
  defineProperty<T extends object>(target: T, propertyKey: PropertyKey, descriptor: object): T;
  defineProperties<T extends object>(target: T, properties: object): T;
  freeze<T extends object>(value: T): Readonly<T>;
  fromEntries<T = unknown>(entries: Iterable<readonly [PropertyKey, T]>): { [key: string]: T };
  getOwnPropertyDescriptor(value: object, propertyKey: PropertyKey): object | undefined;
  getOwnPropertyDescriptors(value: object): object;
  getOwnPropertyNames(value: object): string[];
  getOwnPropertySymbols(value: object): symbol[];
  isExtensible(value: object): boolean;
  isFrozen(value: object): boolean;
  isSealed(value: object): boolean;
  preventExtensions<T extends object>(value: T): T;
  seal<T extends object>(value: T): T;
}
declare var Object: ObjectConstructor;

interface FunctionConstructor {
  new (...args: string[]): Function;
  (...args: string[]): Function;
}
declare var Function: FunctionConstructor;

interface Boolean {
  toString(): string;
  valueOf(): boolean;
}
interface BooleanConstructor {
  new (value?: unknown): Boolean;
  (value?: unknown): boolean;
}
declare var Boolean: BooleanConstructor;

interface Number {
  toString(radix?: int32): string;
  toLocaleString(locales?: string | string[], options?: object): string;
  valueOf(): number;
  toFixed(fractionDigits?: int32): string;
  toExponential(fractionDigits?: int32): string;
  toPrecision(precision?: int32): string;
}
interface NumberConstructor {
  readonly MAX_VALUE: number;
  readonly MIN_VALUE: number;
  readonly NaN: number;
  readonly NEGATIVE_INFINITY: number;
  readonly POSITIVE_INFINITY: number;
  readonly MAX_SAFE_INTEGER: number;
  readonly MIN_SAFE_INTEGER: number;
  readonly EPSILON: number;
  new (value?: unknown): Number;
  (value?: unknown): number;
  isFinite(value: unknown): boolean;
  isInteger(value: unknown): boolean;
  isNaN(value: unknown): boolean;
  isSafeInteger(value: unknown): boolean;
  parseFloat(value: string): number;
  parseInt(value: string, radix?: int32): number;
}
declare var Number: NumberConstructor;

interface String {
  [Symbol.iterator](): IterableIterator<string>;
  readonly length: int32;
  readonly [index: int32]: string;
  startsWith(value: string, position?: int32): boolean;
  endsWith(value: string, endPosition?: int32): boolean;
  includes(value: string, position?: int32): boolean;
  trim(): string;
  trimStart(): string;
  trimEnd(): string;
  trimLeft(): string;
  trimRight(): string;
  toString(): string;
  valueOf(): string;
  charAt(index: int32): string;
  charCodeAt(index: int32): int32;
  codePointAt(index: int32): int32 | undefined;
  slice(start?: int32, end?: int32): string;
  substring(start: int32, end?: int32): string;
  substr(start: int32, length?: int32): string;
  indexOf(searchString: string, position?: int32): int32;
  lastIndexOf(searchString: string, position?: int32): int32;
  at(index: int32): string | undefined;
  concat(...strings: string[]): string;
  repeat(count: int32): string;
  padStart(maxLength: int32, fillString?: string): string;
  padEnd(maxLength: int32, fillString?: string): string;
  normalize(form?: string): string;
  localeCompare(that: string, locales?: string | string[], options?: object): int32;
  toLowerCase(): string;
  toUpperCase(): string;
  toLocaleLowerCase(locales?: string | string[]): string;
  toLocaleUpperCase(locales?: string | string[]): string;
  isWellFormed(): boolean;
  toWellFormed(): string;
}
interface StringConstructor {
  new (value?: unknown): String;
  (value?: unknown): string;
  raw(callSite: TemplateStringsArray, ...substitutions: unknown[]): string;
  fromCharCode(...codes: int32[]): string;
  fromCodePoint(...codes: int32[]): string;
}
declare var String: StringConstructor;

interface Array<T> extends Iterable<T> {
  length: int32;
  [index: int32]: T;
  entries(): ArrayEntriesIterator<T>;
  push(...items: T[]): int32;
  pop(): T | undefined;
  shift(): T | undefined;
  unshift(...items: T[]): int32;
  slice(start?: int32, end?: int32): T[];
  splice(start: int32, deleteCount?: int32, ...items: T[]): T[];
  concat(...items: (T | readonly T[])[]): T[];
  join(separator?: string): string;
  indexOf(searchElement: T, fromIndex?: int32): int32;
  lastIndexOf(searchElement: T, fromIndex?: int32): int32;
  includes(searchElement: T, fromIndex?: int32): boolean;
  reverse(): T[];
  sort(compareFn?: (a: T, b: T) => number): T[];
  at(index: int32): T | undefined;
  forEach(callbackfn: (value: T, index: import("@tsonic/core/types.js").int32, array: T[]) => void): void;
  map<U>(callbackfn: (value: T, index: import("@tsonic/core/types.js").int32, array: T[]) => U): U[];
  filter(callbackfn: (value: T, index: import("@tsonic/core/types.js").int32, array: T[]) => unknown): T[];
  reduce(callbackfn: (previousValue: T, currentValue: T, currentIndex: import("@tsonic/core/types.js").int32, array: T[]) => T): T;
  reduce<U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: import("@tsonic/core/types.js").int32, array: T[]) => U, initialValue: U): U;
  some(callbackfn: (value: T, index: import("@tsonic/core/types.js").int32, array: T[]) => unknown): boolean;
  every(callbackfn: (value: T, index: import("@tsonic/core/types.js").int32, array: T[]) => unknown): boolean;
  find(callbackfn: (value: T, index: import("@tsonic/core/types.js").int32, array: T[]) => unknown): T | undefined;
  findIndex(callbackfn: (value: T, index: import("@tsonic/core/types.js").int32, array: T[]) => unknown): int32;
  findLast(callbackfn: (value: T, index: import("@tsonic/core/types.js").int32, array: T[]) => unknown): T | undefined;
  findLastIndex(callbackfn: (value: T, index: import("@tsonic/core/types.js").int32, array: T[]) => unknown): int32;
  fill(value: T, start?: int32, end?: int32): T[];
  copyWithin(target: int32, start: int32, end?: int32): T[];
}

interface ReadonlyArray<T> extends Iterable<T> {
  readonly length: int32;
  readonly [index: int32]: T;
  entries(): ArrayEntriesIterator<T>;
  slice(start?: int32, end?: int32): T[];
  concat(...items: (T | readonly T[])[]): T[];
  join(separator?: string): string;
  indexOf(searchElement: T, fromIndex?: int32): int32;
  lastIndexOf(searchElement: T, fromIndex?: int32): int32;
  includes(searchElement: T, fromIndex?: int32): boolean;
  at(index: int32): T | undefined;
  forEach(callbackfn: (value: T, index: import("@tsonic/core/types.js").int32, array: readonly T[]) => void): void;
  map<U>(callbackfn: (value: T, index: import("@tsonic/core/types.js").int32, array: readonly T[]) => U): U[];
  filter(callbackfn: (value: T, index: import("@tsonic/core/types.js").int32, array: readonly T[]) => unknown): T[];
  some(callbackfn: (value: T, index: import("@tsonic/core/types.js").int32, array: readonly T[]) => unknown): boolean;
  every(callbackfn: (value: T, index: import("@tsonic/core/types.js").int32, array: readonly T[]) => unknown): boolean;
  find(callbackfn: (value: T, index: import("@tsonic/core/types.js").int32, array: readonly T[]) => unknown): T | undefined;
  findIndex(callbackfn: (value: T, index: import("@tsonic/core/types.js").int32, array: readonly T[]) => unknown): int32;
  findLast(callbackfn: (value: T, index: import("@tsonic/core/types.js").int32, array: readonly T[]) => unknown): T | undefined;
  findLastIndex(callbackfn: (value: T, index: import("@tsonic/core/types.js").int32, array: readonly T[]) => unknown): int32;
}

interface ArrayEntriesIterator<T> extends IterableIterator<[int32, T], undefined, unknown> {
  next(): IteratorResult<[int32, T], undefined>;
  [Symbol.iterator](): ArrayEntriesIterator<T>;
}

interface ArrayConstructor {
  new <T>(arrayLength: int32): T[];
  new <T>(...items: T[]): T[];
  <T>(arrayLength: int32): T[];
  <T>(...items: T[]): T[];
  isArray(value: unknown): value is unknown[];
  from(arrayLike: string): string[];
  from<T>(arrayLike: ArrayLike<T> | Iterable<T>): T[];
  from<T, U>(arrayLike: ArrayLike<T> | Iterable<T>, mapfn: (value: T, index: import("@tsonic/core/types.js").int32) => U): U[];
  of<T>(...items: T[]): T[];
}
declare var Array: ArrayConstructor;

interface BigInt {
  toString(radix?: int32): string;
}
interface BigIntConstructor {
  (value: bigint | boolean | number | string): bigint;
  asIntN(bits: number, value: bigint): bigint;
  asUintN(bits: number, value: bigint): bigint;
}
declare var BigInt: BigIntConstructor;

interface Map<K, V> extends ReadonlyMap<K, V> {
  readonly size: int32;
  get(key: K): V | undefined;
  set(key: K, value: V): this;
  has(key: K): boolean;
  delete(key: K): boolean;
  clear(): void;
  keys(): IterableIterator<K>;
  values(): IterableIterator<V>;
  entries(): IterableIterator<[K, V]>;
  forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void): void;
}
interface ReadonlyMap<K, V> extends Iterable<[K, V]> {
  readonly size: int32;
  get(key: K): V | undefined;
  has(key: K): boolean;
  keys(): IterableIterator<K>;
  values(): IterableIterator<V>;
  entries(): IterableIterator<[K, V]>;
}
interface MapConstructor {
  new <K, V>(entries?: readonly (readonly [K, V])[] | Iterable<readonly [K, V]>): Map<K, V>;
}
declare var Map: MapConstructor;

interface Set<T> extends ReadonlySet<T> {
  readonly size: int32;
  add(value: T): this;
  has(value: T): boolean;
  delete(value: T): boolean;
  clear(): void;
  keys(): IterableIterator<T>;
  values(): IterableIterator<T>;
  entries(): IterableIterator<[T, T]>;
  forEach(callbackfn: (value: T, key: T, set: Set<T>) => void): void;
}
interface ReadonlySet<T> extends Iterable<T> {
  readonly size: int32;
  has(value: T): boolean;
  keys(): IterableIterator<T>;
  values(): IterableIterator<T>;
  entries(): IterableIterator<[T, T]>;
}
interface SetConstructor {
  new <T>(values?: readonly T[] | Iterable<T>): Set<T>;
}
declare var Set: SetConstructor;

interface Date {
  getFullYear(): int32;
  getMonth(): int32;
  getDate(): int32;
  getDay(): int32;
  getHours(): int32;
  getMinutes(): int32;
  getSeconds(): int32;
  getMilliseconds(): int32;
  getTimezoneOffset(): int32;
  getTime(): number;
  toString(): string;
  toISOString(): string;
}
interface DateConstructor {
  new (): Date;
  new (value: number | string): Date;
  (): string;
  now(): number;
  parse(value: string): number;
  UTC(year: int32, monthIndex: int32, date?: int32, hours?: int32, minutes?: int32, seconds?: int32, ms?: int32): number;
}
declare var Date: DateConstructor;

interface JSON {
  parse(text: string): unknown;
}
declare var JSON: JSON;

interface Math {
  readonly E: number;
  readonly LN2: number;
  readonly LN10: number;
  readonly LOG2E: number;
  readonly LOG10E: number;
  readonly PI: number;
  readonly SQRT1_2: number;
  readonly SQRT2: number;
  abs(x: number): number;
  acos(x: number): number;
  acosh(x: number): number;
  asin(x: number): number;
  asinh(x: number): number;
  atan(x: number): number;
  atanh(x: number): number;
  atan2(y: number, x: number): number;
  cbrt(x: number): number;
  floor(x: number): number;
  ceil(x: number): number;
  clz32(x: number): import("@tsonic/core/types.js").int32;
  cos(x: number): number;
  cosh(x: number): number;
  exp(x: number): number;
  expm1(x: number): number;
  fround(x: number): number;
  hypot(...values: number[]): number;
  imul(x: number, y: number): import("@tsonic/core/types.js").int32;
  log(x: number): number;
  log1p(x: number): number;
  log10(x: number): number;
  log2(x: number): number;
  round(x: number): number;
  max(...values: number[]): number;
  min(...values: number[]): number;
  pow(x: number, y: number): number;
  sign(x: number): number;
  sin(x: number): number;
  sinh(x: number): number;
  sqrt(x: number): number;
  tan(x: number): number;
  tanh(x: number): number;
  trunc(x: number): number;
  random(): number;
}
declare var Math: Math;

interface Console {
  log(...data: unknown[]): void;
  error(...data: unknown[]): void;
  warn(...data: unknown[]): void;
  info(...data: unknown[]): void;
  debug(...data: unknown[]): void;
  trace(...data: unknown[]): void;
  assert(condition?: boolean, ...data: unknown[]): void;
  time(label?: string): void;
  timeLog(label?: string, ...data: unknown[]): void;
  timeEnd(label?: string): void;
  timeStamp(label?: string): void;
  count(label?: string): void;
  countReset(label?: string): void;
  group(...data: unknown[]): void;
  groupCollapsed(...data: unknown[]): void;
  groupEnd(): void;
  clear(): void;
  dir(item?: unknown, options?: unknown): void;
  dirxml(...data: unknown[]): void;
  table(tabularData?: unknown, properties?: readonly string[]): void;
}
declare var console: Console;

declare function parseInt(value: string, radix?: int32): number;
declare function parseFloat(value: string): number;
declare function isNaN(value: number | bigint): boolean;
declare function isFinite(value: number | bigint): boolean;
declare function setTimeout(callback: () => void, delay?: int32): int32;
declare function clearTimeout(id: int32): void;
declare function setInterval(callback: () => void, delay?: int32): int32;
declare function clearInterval(id: int32): void;
declare function encodeURIComponent(value: string): string;
declare function decodeURIComponent(value: string): string;

interface ProxyConstructor {
  new <T extends object>(target: T, handler: object): T;
  revocable<T extends object>(target: T, handler: object): { proxy: T; revoke: () => void };
}
declare var Proxy: ProxyConstructor;

declare function eval(source: string): unknown;

interface DataView {
  getBigUint64(byteOffset: int32, littleEndian?: boolean): uint64;
  setBigUint64(byteOffset: int32, value: uint64, littleEndian?: boolean): void;
}

interface Uint8ArrayConstructor {
  new (): Uint8Array;
  from(values: readonly uint8[]): Uint8Array;
  from(values: Uint8Array): Uint8Array;
}

interface SharedArrayBuffer {
  readonly byteLength: int32;
  slice(begin?: int32, end?: int32): SharedArrayBuffer;
}
interface SharedArrayBufferConstructor {
  new (byteLength: int32): SharedArrayBuffer;
  readonly prototype: SharedArrayBuffer;
}
declare var SharedArrayBuffer: SharedArrayBufferConstructor;

interface Atomics {
  wait(array: Int32Array, index: int32, value: int32, timeout?: number): "ok" | "not-equal" | "timed-out";
  notify(array: Int32Array, index: int32, count?: int32): int32;
  load(array: Int32Array, index: int32): int32;
  store(array: Int32Array, index: int32, value: int32): int32;
}
declare var Atomics: Atomics;
`.trim();
