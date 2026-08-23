export const jsRegExpObjectDeclarations = `
type RegExpReplaceCallback = (substring: string, ...args: any[]) => string;

interface RegExp {
  exec(string: string): RegExpExecArray | null;
  test(string: string): boolean;
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
  [Symbol.matchAll](string: string): RegExpStringIterator<RegExpExecArray>;
  [Symbol.replace](string: string, replaceValue: string): string;
  [Symbol.replace](string: string, replacer: RegExpReplaceCallback): string;
  [Symbol.search](string: string): number;
  [Symbol.split](string: string, limit?: number): string[];
}

interface RegExpConstructor {
  new (pattern?: RegExp | string, flags?: string): RegExp;
  (pattern?: RegExp | string, flags?: string): RegExp;
  readonly prototype: RegExp;
  readonly [Symbol.species]: RegExpConstructor;
  escape(string: string): string;
}
declare var RegExp: RegExpConstructor;
`.trim();
