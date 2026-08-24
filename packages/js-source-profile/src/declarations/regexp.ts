export const jsRegExpObjectDeclarations = `
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
  lastIndex: number;
  [Symbol.match](string: string): RegExpMatchArray | null;
  [Symbol.match](string: import("@tsonic/js/types.js").JsString): JsRegExpMatchArray | null;
  [Symbol.matchAll](string: string): RegExpStringIterator<RegExpExecArray>;
  [Symbol.matchAll](string: import("@tsonic/js/types.js").JsString): JsRegExpStringIterator<JsRegExpExecArray>;
  [Symbol.replace](string: string, replaceValue: string): string;
  [Symbol.replace](string: string, replacer: RegExpReplaceCallback): string;
  [Symbol.replace](string: import("@tsonic/js/types.js").JsString, replaceValue: import("@tsonic/js/types.js").JsString): import("@tsonic/js/types.js").JsString;
  [Symbol.replace](string: import("@tsonic/js/types.js").JsString, replacer: JsRegExpReplaceCallback): import("@tsonic/js/types.js").JsString;
  [Symbol.search](string: string): number;
  [Symbol.search](string: import("@tsonic/js/types.js").JsString): number;
  [Symbol.split](string: string, limit?: number): string[];
  [Symbol.split](string: import("@tsonic/js/types.js").JsString, limit?: number): import("@tsonic/js/types.js").JsString[];
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
`.trim();
