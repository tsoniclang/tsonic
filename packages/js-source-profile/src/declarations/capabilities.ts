import { jsTypedArraySourceDeclarations } from "./typed-arrays.js";

export const jsCapabilitySourceProfileDeclarations = `
interface ArrayLike<T> {
  readonly length: int32;
  readonly [index: int32]: T;
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
  readonly byteLength: int32;
  slice(begin?: int32, end?: int32): ArrayBuffer;
}
interface ArrayBufferConstructor {
  new (byteLength: int32): ArrayBuffer;
  readonly prototype: ArrayBuffer;
}
declare var ArrayBuffer: ArrayBufferConstructor;

interface ArrayBufferView {
  readonly buffer: ArrayBuffer;
  readonly byteLength: int32;
  readonly byteOffset: int32;
}

interface DataView extends ArrayBufferView {
  getInt8(byteOffset: int32): int8;
  getUint8(byteOffset: int32): uint8;
  getInt16(byteOffset: int32, littleEndian?: boolean): int16;
  getUint16(byteOffset: int32, littleEndian?: boolean): uint16;
  getInt32(byteOffset: int32, littleEndian?: boolean): int32;
  getUint32(byteOffset: int32, littleEndian?: boolean): uint32;
  getFloat32(byteOffset: int32, littleEndian?: boolean): float32;
  getFloat64(byteOffset: int32, littleEndian?: boolean): float64;
  setInt8<TValue extends number | bigint>(byteOffset: int32, value: TValue): void;
  setUint8<TValue extends number | bigint>(byteOffset: int32, value: TValue): void;
  setInt16<TValue extends number | bigint>(byteOffset: int32, value: TValue, littleEndian?: boolean): void;
  setUint16<TValue extends number | bigint>(byteOffset: int32, value: TValue, littleEndian?: boolean): void;
  setInt32<TValue extends number | bigint>(byteOffset: int32, value: TValue, littleEndian?: boolean): void;
  setUint32<TValue extends number | bigint>(byteOffset: int32, value: TValue, littleEndian?: boolean): void;
  setFloat32<TValue extends number | bigint>(byteOffset: int32, value: TValue, littleEndian?: boolean): void;
  setFloat64<TValue extends number | bigint>(byteOffset: int32, value: TValue, littleEndian?: boolean): void;
}
interface DataViewConstructor {
  new (buffer: ArrayBuffer, byteOffset?: int32, byteLength?: int32): DataView;
}
declare var DataView: DataViewConstructor;

${jsTypedArraySourceDeclarations}

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
  readonly locale: string;
  readonly calendar: string;
  readonly numberingSystem: string;
  readonly timeZone: string;
}
interface IntlDateTimeFormatConstructor {
  new (locales?: string | readonly string[], options?: IntlDateTimeFormatOptions): IntlDateTimeFormat;
}

interface IntlNumberFormat {
  format(value: number | bigint): string;
  formatToParts(value: number | bigint): IntlNumberFormatPart[];
  resolvedOptions(): IntlResolvedNumberFormatOptions;
}
interface BigInt {
  toLocaleString(locales?: string | readonly string[], options?: IntlNumberFormatOptions): string;
}
interface IntlNumberFormatPart { type: string; value: string; }
interface IntlNumberFormatOptions {
  localeMatcher?: "lookup" | "best fit";
  style?: "decimal" | "percent" | "currency" | "unit";
  numberingSystem?: string;
  currency?: string;
  currencyDisplay?: "symbol" | "narrowSymbol" | "code" | "name";
  currencySign?: "standard" | "accounting";
  unit?: string;
  unitDisplay?: "short" | "long" | "narrow";
  notation?: "standard" | "scientific" | "engineering" | "compact";
  compactDisplay?: "short" | "long";
  signDisplay?: "auto" | "never" | "always" | "exceptZero" | "negative";
  useGrouping?: boolean | "auto" | "always" | "min2";
  minimumIntegerDigits?: int32;
  minimumFractionDigits?: int32;
  maximumFractionDigits?: int32;
  minimumSignificantDigits?: int32;
  maximumSignificantDigits?: int32;
  roundingPriority?: "auto" | "morePrecision" | "lessPrecision";
  roundingIncrement?: int32;
  roundingMode?: "ceil" | "floor" | "expand" | "trunc" | "halfCeil" | "halfFloor" | "halfExpand" | "halfTrunc" | "halfEven";
  trailingZeroDisplay?: "auto" | "stripIfInteger";
}
interface IntlResolvedNumberFormatOptions {
  readonly locale: string;
  readonly numberingSystem: string;
  readonly style: string;
  readonly minimumIntegerDigits: int32;
  readonly minimumFractionDigits: int32 | undefined;
  readonly maximumFractionDigits: int32 | undefined;
  readonly minimumSignificantDigits: int32 | undefined;
  readonly maximumSignificantDigits: int32 | undefined;
  readonly useGrouping: false | "auto" | "always" | "min2";
  readonly currency: string | undefined;
  readonly currencyDisplay: string | undefined;
  readonly currencySign: string | undefined;
  readonly unit: string | undefined;
  readonly unitDisplay: string | undefined;
  readonly notation: string;
  readonly compactDisplay: string | undefined;
  readonly signDisplay: string;
  readonly roundingPriority: string;
  readonly roundingIncrement: int32;
  readonly roundingMode: string;
  readonly trailingZeroDisplay: string;
}
interface IntlNumberFormatConstructor {
  new (locales?: string | readonly string[], options?: IntlNumberFormatOptions): IntlNumberFormat;
}

interface IntlCollator {
  compare(left: string, right: string): int32;
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
  readonly locale: string;
  readonly usage: string;
  readonly sensitivity: string;
  readonly ignorePunctuation: boolean;
  readonly collation: string;
  readonly numeric: boolean;
  readonly caseFirst: string;
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
  toJSON(): string | null;
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

declare function setTimeout(callback: () => void, delay?: int32): int32;
declare function clearTimeout(id: int32): void;
declare function setInterval(callback: () => void, delay?: int32): int32;
declare function clearInterval(id: int32): void;
`.trim();
