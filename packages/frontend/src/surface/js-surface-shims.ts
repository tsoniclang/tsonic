import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as ts from "typescript";

export const JS_SURFACE_GLOBALS_SHIMS = `
import type { int, long, double } from "@tsonic/core/types.js";
import type { List } from "@tsonic/dotnet/System.Collections.Generic.js";

declare global {
  interface String {
    readonly length: int;
    toUpperCase(): string;
    toLowerCase(): string;
    trim(): string;
    trimStart(): string;
    trimEnd(): string;
    substring(start: int, end?: int): string;
    slice(start: int, end?: int): string;
    indexOf(searchString: string, position?: int): int;
    lastIndexOf(searchString: string, position?: int): int;
    startsWith(searchString: string, position?: int): boolean;
    endsWith(searchString: string, endPosition?: int): boolean;
    includes(searchString: string, position?: int): boolean;
    replace(searchValue: string, replaceValue: string): string;
    replaceAll(searchValue: string, replaceValue: string): string;
    repeat(count: int): string;
    padStart(targetLength: int, padString?: string): string;
    padEnd(targetLength: int, padString?: string): string;
    charAt(index: int): string;
    charCodeAt(index: int): int;
    split(separator: string, limit?: int): List<string>;
    at(index: int): string;
    concat(...strings: string[]): string;
    localeCompare(compareString: string): int;
    match(pattern: string | RegExp): List<string> | undefined;
    search(pattern: string | RegExp): int;
  }

  interface Array<T> {
    readonly length: int;
    at(index: int): T;
    concat(...items: T[]): T[];
    every(callback: (value: T) => boolean): boolean;
    filter(callback: (value: T) => boolean): T[];
    filter(callback: (value: T, index: int) => boolean): T[];
    find(callback: (value: T) => boolean): T | undefined;
    find(callback: (value: T, index: int) => boolean): T | undefined;
    findIndex(callback: (value: T) => boolean): int;
    findIndex(callback: (value: T, index: int) => boolean): int;
    findLast(callback: (value: T) => boolean): T | undefined;
    findLast(callback: (value: T, index: int) => boolean): T | undefined;
    findLastIndex(callback: (value: T) => boolean): int;
    findLastIndex(callback: (value: T, index: int) => boolean): int;
    flat(depth?: int): unknown[];
    forEach(callback: (value: T) => void): void;
    forEach(callback: (value: T, index: int) => void): void;
    includes(searchElement: T): boolean;
    includes(searchElement: T, fromIndex?: int): boolean;
    indexOf(searchElement: T, fromIndex?: int): int;
    join(separator?: string): string;
    lastIndexOf(searchElement: T, fromIndex?: int): int;
    map<TResult>(callback: (value: T) => TResult): TResult[];
    map<TResult>(callback: (value: T, index: int) => TResult): TResult[];
    reduce(callback: (previousValue: T, currentValue: T) => T): T;
    reduce<TResult>(
      callback: (previousValue: TResult, currentValue: T) => TResult,
      initialValue: TResult
    ): TResult;
    reduceRight<TResult>(
      callback: (previousValue: TResult, currentValue: T) => TResult,
      initialValue: TResult
    ): TResult;
    slice(start?: int, end?: int): T[];
    some(callback: (value: T) => boolean): boolean;
  }

  interface ReadonlyArray<T> {
    readonly length: int;
    at(index: int): T;
    concat(...items: T[]): T[];
    every(callback: (value: T) => boolean): boolean;
    filter(callback: (value: T) => boolean): T[];
    filter(callback: (value: T, index: int) => boolean): T[];
    find(callback: (value: T) => boolean): T | undefined;
    find(callback: (value: T, index: int) => boolean): T | undefined;
    findIndex(callback: (value: T) => boolean): int;
    findIndex(callback: (value: T, index: int) => boolean): int;
    findLast(callback: (value: T) => boolean): T | undefined;
    findLast(callback: (value: T, index: int) => boolean): T | undefined;
    findLastIndex(callback: (value: T) => boolean): int;
    findLastIndex(callback: (value: T, index: int) => boolean): int;
    flat(depth?: int): unknown[];
    forEach(callback: (value: T) => void): void;
    forEach(callback: (value: T, index: int) => void): void;
    includes(searchElement: T): boolean;
    includes(searchElement: T, fromIndex?: int): boolean;
    indexOf(searchElement: T, fromIndex?: int): int;
    join(separator?: string): string;
    lastIndexOf(searchElement: T, fromIndex?: int): int;
    map<TResult>(callback: (value: T) => TResult): TResult[];
    map<TResult>(callback: (value: T, index: int) => TResult): TResult[];
    reduce(callback: (previousValue: T, currentValue: T) => T): T;
    reduce<TResult>(
      callback: (previousValue: TResult, currentValue: T) => TResult,
      initialValue: TResult
    ): TResult;
    reduceRight<TResult>(
      callback: (previousValue: TResult, currentValue: T) => TResult,
      initialValue: TResult
    ): TResult;
    slice(start?: int, end?: int): T[];
    some(callback: (value: T) => boolean): boolean;
  }

  interface Console {
    log(...data: unknown[]): void;
    error(...data: unknown[]): void;
    warn(...data: unknown[]): void;
    info(...data: unknown[]): void;
    debug(...data: unknown[]): void;
  }

  const console: Console;

  interface Date {
    toString(): string;
    toDateString(): string;
    toTimeString(): string;
    toISOString(): string;
    toUTCString(): string;
    valueOf(): long;
    getTime(): long;
    getFullYear(): int;
    getMonth(): int;
    getDate(): int;
    getDay(): int;
    getHours(): int;
    getMinutes(): int;
    getSeconds(): int;
    getMilliseconds(): int;
    setTime(time: long): long;
    setFullYear(year: int, month?: int, date?: int): long;
    setMonth(month: int, date?: int): long;
    setDate(date: int): long;
    setHours(hours: int, minutes?: int, seconds?: int, ms?: int): long;
    setMinutes(minutes: int, seconds?: int, ms?: int): long;
    setSeconds(seconds: int, ms?: int): long;
    setMilliseconds(ms: int): long;
  }

  interface DateConstructor {
    new (): Date;
    new (value: string | number | long): Date;
    new (year: int, monthIndex: int, date?: int): Date;
    now(): long;
    parse(s: string): long;
    UTC(year: int, monthIndex: int, date?: int): long;
  }

  const Date: DateConstructor;

  interface JSON {
    parse<T = unknown>(text: string): T;
    stringify(
      value: unknown,
      replacer?: ((this: unknown, key: string, value: unknown) => unknown) | readonly (number | string)[] | null,
      space?: string | number | int
    ): string;
  }

  const JSON: JSON;

  interface Math {
    readonly E: double;
    readonly LN10: double;
    readonly LN2: double;
    readonly LOG2E: double;
    readonly LOG10E: double;
    readonly PI: double;
    readonly SQRT1_2: double;
    readonly SQRT2: double;
    abs(x: double): double;
    acos(x: double): double;
    asin(x: double): double;
    atan(x: double): double;
    atan2(y: double, x: double): double;
    ceil(x: double): double;
    cos(x: double): double;
    exp(x: double): double;
    floor(x: double): double;
    log(x: double): double;
    max(...values: double[]): double;
    min(...values: double[]): double;
    pow(x: double, y: double): double;
    random(): double;
    round(x: double): double;
    sin(x: double): double;
    sqrt(x: double): double;
    tan(x: double): double;
    trunc(x: double): double;
  }

  const Math: Math;

  interface RegExpMatchArray extends Array<string> {
    index?: int;
    input?: string;
  }

  interface RegExp {
    exec(string: string): RegExpMatchArray | null;
    test(string: string): boolean;
    readonly source: string;
    readonly global: boolean;
    readonly ignoreCase: boolean;
    readonly multiline: boolean;
    lastIndex: int;
  }

  interface RegExpConstructor {
    new (pattern: string | RegExp, flags?: string): RegExp;
    (pattern: string | RegExp, flags?: string): RegExp;
  }

  const RegExp: RegExpConstructor;

  interface Map<K, V> {
    readonly size: int;
    clear(): void;
    delete(key: K): boolean;
    forEach(
      callbackfn: (value: V, key: K, map: Map<K, V>) => void,
      thisArg?: unknown
    ): void;
    get(key: K): V | undefined;
    has(key: K): boolean;
    set(key: K, value: V): this;
    entries(): IterableIterator<[K, V]>;
    keys(): IterableIterator<K>;
    values(): IterableIterator<V>;
    [Symbol.iterator](): IterableIterator<[K, V]>;
  }

  interface MapConstructor {
    new (): Map<unknown, unknown>;
    new <K, V>(entries?: readonly (readonly [K, V])[] | null): Map<K, V>;
  }

  const Map: MapConstructor;

  interface Set<T> {
    readonly size: int;
    add(value: T): this;
    clear(): void;
    delete(value: T): boolean;
    forEach(
      callbackfn: (value: T, value2: T, set: Set<T>) => void,
      thisArg?: unknown
    ): void;
    has(value: T): boolean;
    entries(): IterableIterator<[T, T]>;
    keys(): IterableIterator<T>;
    values(): IterableIterator<T>;
    [Symbol.iterator](): IterableIterator<T>;
  }

  interface SetConstructor {
    new (): Set<unknown>;
    new <T = unknown>(values?: readonly T[] | null): Set<T>;
  }

  const Set: SetConstructor;

  function parseInt(str: string, radix?: int): long | undefined;
  function parseFloat(str: string): double;
  function isFinite(value: double): boolean;
  function isNaN(value: double): boolean;
  function setTimeout(
    handler: (...args: unknown[]) => void,
    timeout?: int,
    ...args: unknown[]
  ): int;
  function clearTimeout(id: int): void;
  function setInterval(
    handler: (...args: unknown[]) => void,
    timeout?: int,
    ...args: unknown[]
  ): int;
  function clearInterval(id: int): void;
}

export {};
`;

const NODE_MODULE_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ["assert", "assert"],
  ["buffer", "buffer"],
  ["child_process", "child_process"],
  ["crypto", "crypto"],
  ["dgram", "dgram"],
  ["dns", "dns"],
  ["events", "events"],
  ["fs", "fs"],
  ["net", "net"],
  ["os", "os"],
  ["path", "path"],
  ["process", "process"],
  ["querystring", "querystring"],
  ["readline", "readline"],
  ["stream", "stream"],
  ["timers", "timers"],
  ["tls", "tls"],
  ["url", "url"],
  ["util", "util"],
  ["zlib", "zlib"],
];

const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const collectNodeModuleMembers = (
  nodejsPackageRoot: string
): ReadonlyMap<string, readonly string[]> | undefined => {
  const internalIndexPath =
    [
      join(nodejsPackageRoot, "index", "internal", "index.d.ts"),
      join(
        nodejsPackageRoot,
        "versions",
        "10",
        "index",
        "internal",
        "index.d.ts"
      ),
    ].find((candidate) => existsSync(candidate)) ?? null;
  if (!internalIndexPath) return undefined;

  const source = ts.createSourceFile(
    internalIndexPath,
    readFileSync(internalIndexPath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  const members = new Map<string, string[]>();

  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node) && node.name) {
      const className = node.name.text;
      if (className.endsWith("$instance")) {
        const moduleName = className.slice(0, -"$instance".length);
        const collected = new Set<string>();
        for (const member of node.members) {
          const modifiers = ts.canHaveModifiers(member)
            ? ts.getModifiers(member)
            : undefined;
          const staticMember = modifiers?.some(
            (modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword
          );
          if (!staticMember || !member.name) continue;
          if (ts.isIdentifier(member.name)) {
            collected.add(member.name.text);
          } else if (ts.isStringLiteral(member.name)) {
            collected.add(member.name.text);
          }
        }
        members.set(
          moduleName,
          [...collected].sort((a, b) => a.localeCompare(b))
        );
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return members;
};

export const JS_SURFACE_NODE_MODULE_SHIMS = `
declare module "node:assert" { export { assert } from "@tsonic/nodejs/index.js"; }
declare module "assert" { export { assert } from "@tsonic/nodejs/index.js"; }
declare module "node:buffer" { export { buffer } from "@tsonic/nodejs/index.js"; }
declare module "buffer" { export { buffer } from "@tsonic/nodejs/index.js"; }
declare module "node:child_process" { export { child_process } from "@tsonic/nodejs/index.js"; }
declare module "child_process" { export { child_process } from "@tsonic/nodejs/index.js"; }
declare module "node:crypto" { export { crypto } from "@tsonic/nodejs/index.js"; }
declare module "crypto" { export { crypto } from "@tsonic/nodejs/index.js"; }
declare module "node:dgram" { export { dgram } from "@tsonic/nodejs/index.js"; }
declare module "dgram" { export { dgram } from "@tsonic/nodejs/index.js"; }
declare module "node:dns" { export { dns } from "@tsonic/nodejs/index.js"; }
declare module "dns" { export { dns } from "@tsonic/nodejs/index.js"; }
declare module "node:events" { export { events } from "@tsonic/nodejs/index.js"; }
declare module "events" { export { events } from "@tsonic/nodejs/index.js"; }
declare module "node:fs" { export { fs } from "@tsonic/nodejs/index.js"; }
declare module "fs" { export { fs } from "@tsonic/nodejs/index.js"; }
declare module "node:net" { export { net } from "@tsonic/nodejs/index.js"; }
declare module "net" { export { net } from "@tsonic/nodejs/index.js"; }
declare module "node:os" { export { os } from "@tsonic/nodejs/index.js"; }
declare module "os" { export { os } from "@tsonic/nodejs/index.js"; }
declare module "node:path" { export { path } from "@tsonic/nodejs/index.js"; }
declare module "path" { export { path } from "@tsonic/nodejs/index.js"; }
declare module "node:process" { export { process } from "@tsonic/nodejs/index.js"; }
declare module "process" { export { process } from "@tsonic/nodejs/index.js"; }
declare module "node:querystring" { export { querystring } from "@tsonic/nodejs/index.js"; }
declare module "querystring" { export { querystring } from "@tsonic/nodejs/index.js"; }
declare module "node:readline" { export { readline } from "@tsonic/nodejs/index.js"; }
declare module "readline" { export { readline } from "@tsonic/nodejs/index.js"; }
declare module "node:stream" { export { stream } from "@tsonic/nodejs/index.js"; }
declare module "stream" { export { stream } from "@tsonic/nodejs/index.js"; }
declare module "node:timers" { export { timers } from "@tsonic/nodejs/index.js"; }
declare module "timers" { export { timers } from "@tsonic/nodejs/index.js"; }
declare module "node:tls" { export { tls } from "@tsonic/nodejs/index.js"; }
declare module "tls" { export { tls } from "@tsonic/nodejs/index.js"; }
declare module "node:url" { export { url } from "@tsonic/nodejs/index.js"; }
declare module "url" { export { url } from "@tsonic/nodejs/index.js"; }
declare module "node:util" { export { util } from "@tsonic/nodejs/index.js"; }
declare module "util" { export { util } from "@tsonic/nodejs/index.js"; }
declare module "node:zlib" { export { zlib } from "@tsonic/nodejs/index.js"; }
declare module "zlib" { export { zlib } from "@tsonic/nodejs/index.js"; }
`;

const renderNodeModuleDeclaration = (
  specifier: string,
  moduleName: string,
  members: readonly string[] | undefined
): string => {
  if (!members || members.length === 0) {
    return `declare module "${specifier}" { export { ${moduleName} } from "@tsonic/nodejs/index.js"; }`;
  }

  const exports = members
    .filter((member) => IDENTIFIER_RE.test(member))
    .map(
      (member) =>
        `  export const ${member}: typeof import("@tsonic/nodejs/index.js").${moduleName}.${member};`
    )
    .join("\n");

  return `declare module "${specifier}" {\n${exports}\n}`;
};

export const buildJsSurfaceNodeModuleShims = (
  nodejsPackageRoot: string | undefined
): string => {
  if (!nodejsPackageRoot) return JS_SURFACE_NODE_MODULE_SHIMS;

  const membersByModule = collectNodeModuleMembers(nodejsPackageRoot);
  if (!membersByModule) return JS_SURFACE_NODE_MODULE_SHIMS;

  const declarations: string[] = [];
  for (const [specifier, moduleName] of NODE_MODULE_ALIASES) {
    const canonicalSpecifier = `node:${specifier}`;
    const members = membersByModule.get(moduleName);
    declarations.push(
      renderNodeModuleDeclaration(canonicalSpecifier, moduleName, members)
    );
    declarations.push(
      `declare module "${specifier}" { export * from "${canonicalSpecifier}"; }`
    );
  }

  return declarations.join("\n");
};
