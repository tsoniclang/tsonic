

export const jsRegExpText: string = `interface SymbolConstructor {
  readonly match: unique symbol;
  readonly matchAll: unique symbol;
  readonly replace: unique symbol;
  readonly search: unique symbol;
  readonly species: unique symbol;
  readonly split: unique symbol;
}

interface RegExpNamedGroups {
  readonly [key: string]: string | undefined;
}

interface RegExpNamedIndices {
  readonly [key: string]: [int32, int32] | undefined;
}

interface RegExpMatchArray extends Array<string | undefined> {
  readonly index: int32 | undefined;
  readonly input: string | undefined;
  readonly groups: RegExpNamedGroups | undefined;
  readonly indices: RegExpIndicesArray | undefined;
  0: string;
}

interface RegExpExecArray extends Array<string | undefined> {
  readonly index: int32;
  readonly input: string;
  readonly groups: RegExpNamedGroups | undefined;
  readonly indices: RegExpIndicesArray | undefined;
  0: string;
}

interface RegExpIndicesArray extends Array<[int32, int32] | undefined> {
  readonly groups: RegExpNamedIndices | undefined;
}

interface RegExpStringIterator<T> extends IterableIterator<T> {
  [Symbol.iterator](): RegExpStringIterator<T>;
}

interface JsRegExpNamedGroups {
  readonly [key: string]: import("@tsonic/js/types.js").JsString | undefined;
}

interface JsRegExpNamedIndices {
  readonly [key: string]: [int32, int32] | undefined;
}

interface JsRegExpMatchArray extends Array<import("@tsonic/js/types.js").JsString | undefined> {
  readonly index: int32 | undefined;
  readonly input: import("@tsonic/js/types.js").JsString | undefined;
  readonly groups: JsRegExpNamedGroups | undefined;
  readonly indices: JsRegExpIndicesArray | undefined;
  0: import("@tsonic/js/types.js").JsString;
}

interface JsRegExpExecArray extends Array<import("@tsonic/js/types.js").JsString | undefined> {
  readonly index: int32;
  readonly input: import("@tsonic/js/types.js").JsString;
  readonly groups: JsRegExpNamedGroups | undefined;
  readonly indices: JsRegExpIndicesArray | undefined;
  0: import("@tsonic/js/types.js").JsString;
}

interface JsRegExpIndicesArray extends Array<[int32, int32] | undefined> {
  readonly groups: JsRegExpNamedIndices | undefined;
}

interface JsRegExpStringIterator<T> extends IterableIterator<T> {
  [Symbol.iterator](): JsRegExpStringIterator<T>;
}

type RegExpReplaceCallback = (substring: string, ...args: any[]) => string;
type JsRegExpReplaceCallback = (
  substring: import("@tsonic/js/types.js").JsString,
  ...args: any[]
) => import("@tsonic/js/types.js").JsString;

interface RegExp {
  exec(string: string): RegExpExecArray | null;
  exec(string: import("@tsonic/js/types.js").JsString): JsRegExpExecArray | null;
  test(string: string): boolean;
  test(string: import("@tsonic/js/types.js").JsString): boolean;
  toString(): string;
  readonly source: string;
  readonly flags: string;
  readonly global: boolean;
  readonly ignoreCase: boolean;
  readonly multiline: boolean;
  readonly dotAll: boolean;
  readonly hasIndices: boolean;
  readonly sticky: boolean;
  readonly unicode: boolean;
  readonly unicodeSets: boolean;
  lastIndex: int32;
  [Symbol.match](string: string): RegExpMatchArray | null;
  [Symbol.match](string: import("@tsonic/js/types.js").JsString): JsRegExpMatchArray | null;
  [Symbol.matchAll](string: string): RegExpStringIterator<RegExpExecArray>;
  [Symbol.matchAll](string: import("@tsonic/js/types.js").JsString): JsRegExpStringIterator<JsRegExpExecArray>;
  [Symbol.replace](string: string, replaceValue: string): string;
  [Symbol.replace](string: string, replacer: RegExpReplaceCallback): string;
  [Symbol.replace](string: import("@tsonic/js/types.js").JsString, replaceValue: import("@tsonic/js/types.js").JsString): import("@tsonic/js/types.js").JsString;
  [Symbol.replace](string: import("@tsonic/js/types.js").JsString, replacer: JsRegExpReplaceCallback): import("@tsonic/js/types.js").JsString;
  [Symbol.search](string: string): int32;
  [Symbol.search](string: import("@tsonic/js/types.js").JsString): int32;
  [Symbol.split](string: string, limit?: int32): (string | undefined)[];
  [Symbol.split](string: import("@tsonic/js/types.js").JsString, limit?: int32): (import("@tsonic/js/types.js").JsString | undefined)[];
}

interface RegExpConstructor {
  new (pattern?: RegExp | string | import("@tsonic/js/types.js").JsString, flags?: string): RegExp;
  (pattern?: RegExp | string | import("@tsonic/js/types.js").JsString, flags?: string): RegExp;
  readonly prototype: RegExp;
  readonly [Symbol.species]: RegExpConstructor;
  escape(string: string): string;
  escape(string: import("@tsonic/js/types.js").JsString): string;
}
declare var RegExp: RegExpConstructor;

interface String {
  match(regexp: string | RegExp): RegExpMatchArray | null;
  match(matcher: { [Symbol.match](string: string): RegExpMatchArray | null }): RegExpMatchArray | null;
  matchAll(regexp: RegExp): RegExpStringIterator<RegExpExecArray>;
  matchAll(matcher: { [Symbol.matchAll](string: string): RegExpStringIterator<RegExpExecArray> }): RegExpStringIterator<RegExpExecArray>;
  replace(searchValue: string | RegExp, replaceValue: string): string;
  replace(searchValue: string | RegExp, replacer: RegExpReplaceCallback): string;
  replace(searchValue: { [Symbol.replace](string: string, replaceValue: string): string }, replaceValue: string): string;
  replace(searchValue: { [Symbol.replace](string: string, replacer: RegExpReplaceCallback): string }, replacer: RegExpReplaceCallback): string;
  replaceAll(searchValue: string | RegExp, replaceValue: string): string;
  replaceAll(searchValue: string | RegExp, replacer: RegExpReplaceCallback): string;
  replaceAll(searchValue: { [Symbol.replace](string: string, replaceValue: string): string }, replaceValue: string): string;
  replaceAll(searchValue: { [Symbol.replace](string: string, replacer: RegExpReplaceCallback): string }, replacer: RegExpReplaceCallback): string;
  search(regexp: string | RegExp): int32;
  search(searcher: { [Symbol.search](string: string): int32 }): int32;
  split(separator: string, limit?: int32): string[];
  split(separator: RegExp, limit?: int32): (string | undefined)[];
  split<T extends string | undefined>(splitter: { [Symbol.split](string: string, limit?: int32): T[] }, limit?: int32): T[];
}`;
