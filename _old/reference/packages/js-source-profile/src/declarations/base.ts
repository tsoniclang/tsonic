import { sourceErrorDeclarations } from "./errors.js";

export const sourceNoLibBaseDeclarations = `
type PropertyKey = string | number | symbol;
type UnicodeNormalizationForm = "NFC" | "NFD" | "NFKC" | "NFKD";

interface Object {}
interface Function {}
interface CallableFunction extends Function {}
interface NewableFunction extends Function {}
interface IArguments {
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
