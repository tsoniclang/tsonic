export const interfaceRepresentationAliasSource = `
interface Tokens extends ReadonlyArray<object> {}
interface MoreTokens extends Tokens {}
interface Values<T> extends ReadonlyArray<T> {}
interface Rows extends ReadonlyArray<Row> {}
interface Row extends ReadonlyArray<number> {}
function same(values: MoreTokens, token: object): boolean {
  let count = 0;
  for (const value of values) { if (value !== token) return false; count += 1; }
  return count === 2;
}
function sum(values: Values<number>): number {
  let result = 0;
  for (const value of values) result += value;
  return result;
}
export function run(): boolean {
  const token = {};
  const tokens = [token, token];
  const values = [2, 3];
  values[0] = 7;
  const alias: Values<number> = values;
  const rows: Rows = [values];
  let total = 0;
  for (const row of rows) total += sum(row);
  return same(tokens, token) && sum(alias) === 10 && total === 10;
}
`;

export const interfaceRepresentationAliasJsProofSource = `
function runJsAliases(): boolean {
  const tokens: MoreTokens = [{}, {}];
  if (tokens.length !== 2) return false;
  const originalTokens = [{}, {}];
  const tokenAlias: MoreTokens = originalTokens;
  const replacement = {};
  originalTokens[0] = replacement;
  if (tokenAlias[0] !== replacement) return false;
  Object.freeze(replacement);
  if (!Object.isFrozen(tokenAlias[0])) return false;
  const original = [2, 3];
  const alias: Values<number> = original;
  original[0] = 7;
  return sum(alias) === 10;
}
`;

export const interfaceRepresentationAliasFiles = {
  "facades.ts": `
export interface Values<T> extends ReadonlyArray<T> {}
export interface Redirect<Unused> extends ReadonlyArray<object> {}
export interface Nested<T> extends Values<Values<T>> {}
export function head<T>(values: Values<T>): T { return values[0]; }
export function forward<T>(values: Values<T>): Values<T> { return values; }
`,
  "index.ts": `
import type { Values, Redirect, Nested } from "./facades.js";
import { head, forward } from "./facades.js";
export function run(): boolean {
  const token = {};
  const replacement = {};
  const original: object[] = [token];
  const redirected: Redirect<string> = original;
  const generic: Values<object> = forward(redirected);
  const nested: Nested<object> = [generic];
  original[0] = replacement;
  return head(head(nested)) === replacement && head(redirected) !== token;
}
`,
};

export const interfaceRepresentationAliasNativeValueFiles = {
  "facades.ts": interfaceRepresentationAliasFiles["facades.ts"],
  "index.ts": `
import type { Values, Redirect, Nested } from "./facades.js";
import { head, forward } from "./facades.js";
export function run(): boolean {
  const token = {};
  const replacement = {};
  const original: object[] = [token];
  const redirected: Redirect<string> = original;
  const generic: Values<object> = forward(redirected);
  const nested: Nested<object> = [generic];
  original[0] = replacement;
  return head(head(nested)) === token && head(redirected) === token && head(original) === replacement;
}
`,
};
