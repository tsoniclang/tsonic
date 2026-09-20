export const jsStringRegExpDeclarations = `
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
  search(regexp: string | RegExp): number;
  search(searcher: { [Symbol.search](string: string): number }): number;
  split(separator: string, limit?: number): string[];
  split(separator: RegExp, limit?: number): (string | undefined)[];
  split<T extends string | undefined>(splitter: { [Symbol.split](string: string, limit?: number): T[] }, limit?: number): T[];
}
`.trim();
