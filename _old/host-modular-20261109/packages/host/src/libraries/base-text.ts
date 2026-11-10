

export const sourceBaseText: string = `type PropertyKey = string | number | symbol;
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


interface Error {
  readonly name: string;
  readonly message: string;
  readonly stack: string | undefined;
  readonly cause: Error | undefined;
}
interface ErrorOptions { cause?: Error; }
interface ErrorConstructor {
  new (message?: string, options?: ErrorOptions): Error;
  (message?: string, options?: ErrorOptions): Error;
  captureStackTrace(error: Error): void;
}
declare var Error: ErrorConstructor;


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
}`;

export const sourceUtilityText: string = `type ThisParameterType<T> = T extends (this: infer U, ...args: never) => any ? U : unknown;
type OmitThisParameter<T> = unknown extends ThisParameterType<T>
  ? T
  : T extends (...args: infer A) => infer R
    ? (...args: A) => R
    : T;

type Awaited<T> = T extends null | undefined
  ? T
  : T extends object & { then(onfulfilled: infer F, ...args: infer _): any; }
    ? F extends ((value: infer V, ...args: infer _) => any)
      ? Awaited<V>
      : never
    : T;

type Partial<T> = { [P in keyof T]?: T[P] };
type Required<T> = { [P in keyof T]-?: T[P] };
type Readonly<T> = { readonly [P in keyof T]: T[P] };
type Pick<T, K extends keyof T> = { [P in K]: T[P] };
type Record<K extends keyof any, T> = { [P in K]: T };
type Exclude<T, U> = T extends U ? never : T;
type Extract<T, U> = T extends U ? T : never;
type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;
type NonNullable<T> = T & {};
type Parameters<T extends (...args: any) => any> = T extends (...args: infer P) => any ? P : never;
type ConstructorParameters<T extends abstract new (...args: any) => any> = T extends abstract new (...args: infer P) => any ? P : never;
type ReturnType<T extends (...args: any) => any> = T extends (...args: any) => infer R ? R : any;
type InstanceType<T extends abstract new (...args: any) => any> = T extends abstract new (...args: any) => infer R ? R : any;
type Uppercase<S extends string> = intrinsic;
type Lowercase<S extends string> = intrinsic;
type Capitalize<S extends string> = intrinsic;
type Uncapitalize<S extends string> = intrinsic;
type NoInfer<T> = intrinsic;
interface ThisType<T> {}`;
