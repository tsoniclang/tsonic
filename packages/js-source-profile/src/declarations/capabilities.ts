export const jsCapabilitySourceProfileDeclarations = `
interface ArrayLike<T> {
  readonly length: number;
  readonly [index: number]: T;
}

interface SymbolConstructor {
  (description?: string | number): symbol;
  for(key: string): symbol;
  keyFor(symbol: symbol): string | undefined;
}

interface WeakKeyTypes {
  object: object;
}
type WeakKey = WeakKeyTypes[keyof WeakKeyTypes];

interface WeakMap<K extends WeakKey, V> {
  delete(key: K): boolean;
  get(key: K): V | undefined;
  has(key: K): boolean;
  set(key: K, value: V): this;
}
interface WeakMapConstructor {
  new <K extends WeakKey, V>(entries?: readonly (readonly [K, V])[] | null): WeakMap<K, V>;
}
declare var WeakMap: WeakMapConstructor;

interface WeakSet<T extends WeakKey> {
  add(value: T): this;
  delete(value: T): boolean;
  has(value: T): boolean;
}
interface WeakSetConstructor {
  new <T extends WeakKey>(values?: readonly T[] | null): WeakSet<T>;
}
declare var WeakSet: WeakSetConstructor;

interface ArrayBuffer {
  readonly byteLength: number;
  slice(begin?: number, end?: number): ArrayBuffer;
}
interface ArrayBufferConstructor {
  new (byteLength: number): ArrayBuffer;
  readonly prototype: ArrayBuffer;
}
declare var ArrayBuffer: ArrayBufferConstructor;

interface ArrayBufferView {
  readonly buffer: ArrayBuffer;
  readonly byteLength: number;
  readonly byteOffset: number;
}

interface DataView extends ArrayBufferView {
  getInt8(byteOffset: number): number;
  getUint8(byteOffset: number): number;
  getInt16(byteOffset: number, littleEndian?: boolean): number;
  getUint16(byteOffset: number, littleEndian?: boolean): number;
  getInt32(byteOffset: number, littleEndian?: boolean): number;
  getUint32(byteOffset: number, littleEndian?: boolean): number;
  getFloat32(byteOffset: number, littleEndian?: boolean): number;
  getFloat64(byteOffset: number, littleEndian?: boolean): number;
  setInt8(byteOffset: number, value: number): void;
  setUint8(byteOffset: number, value: number): void;
  setInt16(byteOffset: number, value: number, littleEndian?: boolean): void;
  setUint16(byteOffset: number, value: number, littleEndian?: boolean): void;
  setInt32(byteOffset: number, value: number, littleEndian?: boolean): void;
  setUint32(byteOffset: number, value: number, littleEndian?: boolean): void;
  setFloat32(byteOffset: number, value: number, littleEndian?: boolean): void;
  setFloat64(byteOffset: number, value: number, littleEndian?: boolean): void;
}
interface DataViewConstructor {
  new (buffer: ArrayBuffer, byteOffset?: number, byteLength?: number): DataView;
}
declare var DataView: DataViewConstructor;

interface TypedArray<TArray> extends ArrayBufferView, Iterable<number> {
  readonly BYTES_PER_ELEMENT: number;
  readonly length: number;
  [index: number]: number;
  at(index: number): number | undefined;
  fill(value: number, start?: number, end?: number): TArray;
  includes(searchElement: number, fromIndex?: number): boolean;
  indexOf(searchElement: number, fromIndex?: number): number;
  join(separator?: string): string;
  reverse(): TArray;
  set(array: ArrayLike<number>, offset?: number): void;
  slice(start?: number, end?: number): TArray;
  sort(compareFn?: (left: number, right: number) => number): TArray;
  subarray(begin?: number, end?: number): TArray;
}

interface Int8Array extends TypedArray<Int8Array> {}
interface Uint8Array extends TypedArray<Uint8Array> {}
interface Uint8ClampedArray extends TypedArray<Uint8ClampedArray> {}
interface Int16Array extends TypedArray<Int16Array> {}
interface Uint16Array extends TypedArray<Uint16Array> {}
interface Int32Array extends TypedArray<Int32Array> {}
interface Uint32Array extends TypedArray<Uint32Array> {}
interface Float32Array extends TypedArray<Float32Array> {}
interface Float64Array extends TypedArray<Float64Array> {}

interface TypedArrayConstructor<TArray extends TypedArray<TArray>> {
  new (length: number): TArray;
  new (array: ArrayLike<number> | Iterable<number>): TArray;
  new (buffer: ArrayBuffer, byteOffset?: number, length?: number): TArray;
  readonly BYTES_PER_ELEMENT: number;
}
interface Int8ArrayConstructor extends TypedArrayConstructor<Int8Array> {
  new (length: number): Int8Array;
  new (array: ArrayLike<number> | Iterable<number>): Int8Array;
  new (buffer: ArrayBuffer, byteOffset?: number, length?: number): Int8Array;
  readonly BYTES_PER_ELEMENT: 1;
}
interface Uint8ArrayConstructor extends TypedArrayConstructor<Uint8Array> {
  new (length: number): Uint8Array;
  new (array: ArrayLike<number> | Iterable<number>): Uint8Array;
  new (buffer: ArrayBuffer, byteOffset?: number, length?: number): Uint8Array;
  readonly BYTES_PER_ELEMENT: 1;
}
interface Uint8ClampedArrayConstructor extends TypedArrayConstructor<Uint8ClampedArray> {
  new (length: number): Uint8ClampedArray;
  new (array: ArrayLike<number> | Iterable<number>): Uint8ClampedArray;
  new (buffer: ArrayBuffer, byteOffset?: number, length?: number): Uint8ClampedArray;
  readonly BYTES_PER_ELEMENT: 1;
}
interface Int16ArrayConstructor extends TypedArrayConstructor<Int16Array> {
  new (length: number): Int16Array;
  new (array: ArrayLike<number> | Iterable<number>): Int16Array;
  new (buffer: ArrayBuffer, byteOffset?: number, length?: number): Int16Array;
  readonly BYTES_PER_ELEMENT: 2;
}
interface Uint16ArrayConstructor extends TypedArrayConstructor<Uint16Array> {
  new (length: number): Uint16Array;
  new (array: ArrayLike<number> | Iterable<number>): Uint16Array;
  new (buffer: ArrayBuffer, byteOffset?: number, length?: number): Uint16Array;
  readonly BYTES_PER_ELEMENT: 2;
}
interface Int32ArrayConstructor extends TypedArrayConstructor<Int32Array> {
  new (length: number): Int32Array;
  new (array: ArrayLike<number> | Iterable<number>): Int32Array;
  new (buffer: ArrayBuffer, byteOffset?: number, length?: number): Int32Array;
  readonly BYTES_PER_ELEMENT: 4;
}
interface Uint32ArrayConstructor extends TypedArrayConstructor<Uint32Array> {
  new (length: number): Uint32Array;
  new (array: ArrayLike<number> | Iterable<number>): Uint32Array;
  new (buffer: ArrayBuffer, byteOffset?: number, length?: number): Uint32Array;
  readonly BYTES_PER_ELEMENT: 4;
}
interface Float32ArrayConstructor extends TypedArrayConstructor<Float32Array> {
  new (length: number): Float32Array;
  new (array: ArrayLike<number> | Iterable<number>): Float32Array;
  new (buffer: ArrayBuffer, byteOffset?: number, length?: number): Float32Array;
  readonly BYTES_PER_ELEMENT: 4;
}
interface Float64ArrayConstructor extends TypedArrayConstructor<Float64Array> {
  new (length: number): Float64Array;
  new (array: ArrayLike<number> | Iterable<number>): Float64Array;
  new (buffer: ArrayBuffer, byteOffset?: number, length?: number): Float64Array;
  readonly BYTES_PER_ELEMENT: 8;
}
declare var Int8Array: Int8ArrayConstructor;
declare var Uint8Array: Uint8ArrayConstructor;
declare var Uint8ClampedArray: Uint8ClampedArrayConstructor;
declare var Int16Array: Int16ArrayConstructor;
declare var Uint16Array: Uint16ArrayConstructor;
declare var Int32Array: Int32ArrayConstructor;
declare var Uint32Array: Uint32ArrayConstructor;
declare var Float32Array: Float32ArrayConstructor;
declare var Float64Array: Float64ArrayConstructor;

interface PromiseFulfilledResult<T> {
  status: "fulfilled";
  value: T;
}
interface PromiseRejectedResult {
  status: "rejected";
  reason: unknown;
}
type PromiseSettledResult<T> = PromiseFulfilledResult<T> | PromiseRejectedResult;

interface Promise<T> {
  finally(onfinally?: (() => void) | null): Promise<T>;
}
interface PromiseConstructor {
  race<T extends readonly unknown[]>(values: T): Promise<Awaited<T[number]>>;
  any<T extends readonly unknown[]>(values: T): Promise<Awaited<T[number]>>;
  allSettled<T extends readonly unknown[]>(values: T): Promise<{ [K in keyof T]: PromiseSettledResult<Awaited<T[K]>> }>;
}

interface IntlDateTimeFormat {
  format(value?: Date | number): string;
  formatToParts(value?: Date | number): IntlDateTimeFormatPart[];
  resolvedOptions(): IntlResolvedDateTimeFormatOptions;
}
interface IntlDateTimeFormatPart { type: string; value: string; }
interface IntlDateTimeFormatOptions {
  localeMatcher?: "lookup" | "best fit";
  weekday?: "long" | "short" | "narrow";
  era?: "long" | "short" | "narrow";
  year?: "numeric" | "2-digit";
  month?: "numeric" | "2-digit" | "long" | "short" | "narrow";
  day?: "numeric" | "2-digit";
  hour?: "numeric" | "2-digit";
  minute?: "numeric" | "2-digit";
  second?: "numeric" | "2-digit";
  timeZoneName?: "long" | "short";
  timeZone?: string;
  hour12?: boolean;
}
interface IntlResolvedDateTimeFormatOptions {
  locale: string;
  calendar: string;
  numberingSystem: string;
  timeZone: string;
}
interface IntlDateTimeFormatConstructor {
  new (locales?: string | readonly string[], options?: IntlDateTimeFormatOptions): IntlDateTimeFormat;
}

interface IntlNumberFormat {
  format(value: number): string;
  formatToParts(value: number): IntlNumberFormatPart[];
  resolvedOptions(): IntlResolvedNumberFormatOptions;
}
interface IntlNumberFormatPart { type: string; value: string; }
interface IntlNumberFormatOptions {
  localeMatcher?: "lookup" | "best fit";
  style?: "decimal" | "percent" | "currency";
  currency?: string;
  currencyDisplay?: "symbol" | "narrowSymbol" | "code" | "name";
  useGrouping?: boolean;
  minimumIntegerDigits?: number;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}
interface IntlResolvedNumberFormatOptions {
  locale: string;
  numberingSystem: string;
  style: string;
  minimumIntegerDigits: number;
  minimumFractionDigits: number;
  maximumFractionDigits: number;
  useGrouping: boolean;
}
interface IntlNumberFormatConstructor {
  new (locales?: string | readonly string[], options?: IntlNumberFormatOptions): IntlNumberFormat;
}

interface IntlCollator {
  compare(left: string, right: string): number;
  resolvedOptions(): IntlResolvedCollatorOptions;
}
interface IntlCollatorOptions {
  localeMatcher?: "lookup" | "best fit";
  usage?: "sort" | "search";
  sensitivity?: "base" | "accent" | "case" | "variant";
  ignorePunctuation?: boolean;
  numeric?: boolean;
  caseFirst?: "upper" | "lower" | "false";
}
interface IntlResolvedCollatorOptions {
  locale: string;
  usage: string;
  sensitivity: string;
  ignorePunctuation: boolean;
  collation: string;
  numeric: boolean;
  caseFirst: string;
}
interface IntlCollatorConstructor {
  new (locales?: string | readonly string[], options?: IntlCollatorOptions): IntlCollator;
}
interface IntlObject {
  readonly DateTimeFormat: IntlDateTimeFormatConstructor;
  readonly NumberFormat: IntlNumberFormatConstructor;
  readonly Collator: IntlCollatorConstructor;
}
declare var Intl: IntlObject;

type JsonReplacer = (this: unknown, key: string, value: unknown) => unknown;
interface JSON {
  stringify(value: unknown, replacer?: JsonReplacer | readonly (string | number)[] | null, space?: string | number): string | undefined;
}

interface ObjectConstructor {
  assign<T extends object, U extends object>(target: T, source: U): T & U;
}

interface ReadonlyMap<K, V> {
  forEach(callbackfn: (value: V, key: K, map: ReadonlyMap<K, V>) => void): void;
}
interface ReadonlySet<T> {
  forEach(callbackfn: (value: T, key: T, set: ReadonlySet<T>) => void): void;
  union(other: ReadonlySet<T>): Set<T>;
  intersection(other: ReadonlySet<T>): Set<T>;
  difference(other: ReadonlySet<T>): Set<T>;
  symmetricDifference(other: ReadonlySet<T>): Set<T>;
  isSubsetOf(other: ReadonlySet<T>): boolean;
  isSupersetOf(other: ReadonlySet<T>): boolean;
  isDisjointFrom(other: ReadonlySet<T>): boolean;
}

interface Date {
  valueOf(): number;
  getUTCFullYear(): number;
  getUTCMonth(): number;
  getUTCDate(): number;
  getUTCDay(): number;
  getUTCHours(): number;
  getUTCMinutes(): number;
  getUTCSeconds(): number;
  getUTCMilliseconds(): number;
  setTime(time: number): number;
  setUTCMilliseconds(ms: number): number;
  setUTCSeconds(sec: number, ms?: number): number;
  setUTCMinutes(min: number, sec?: number, ms?: number): number;
  setUTCHours(hours: number, min?: number, sec?: number, ms?: number): number;
  setUTCDate(date: number): number;
  setUTCMonth(month: number, date?: number): number;
  setUTCFullYear(year: number, month?: number, date?: number): number;
  toUTCString(): string;
  toJSON(): string;
}

interface Console {
  assert(condition?: boolean, ...data: unknown[]): void;
  clear(): void;
  count(label?: string): void;
  countReset(label?: string): void;
  debug(...data: unknown[]): void;
  dir(item?: unknown, options?: unknown): void;
  dirxml(...data: unknown[]): void;
  error(...data: unknown[]): void;
  group(...data: unknown[]): void;
  groupCollapsed(...data: unknown[]): void;
  groupEnd(): void;
  info(...data: unknown[]): void;
  log(...data: unknown[]): void;
  table(tabularData?: unknown, properties?: readonly string[]): void;
  time(label?: string): void;
  timeEnd(label?: string): void;
  timeLog(label?: string, ...data: unknown[]): void;
  timeStamp(label?: string): void;
  trace(...data: unknown[]): void;
  warn(...data: unknown[]): void;
}

declare function setTimeout(callback: () => void, delay?: number): number;
declare function clearTimeout(id: number): void;
declare function setInterval(callback: () => void, delay?: number): number;
declare function clearInterval(id: number): void;
`.trim();
