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
