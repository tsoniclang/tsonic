export const borrowedCallbackInputSource = `
export function twice(values: number[], apply: (items: number[]) => number): number {
  return apply(values) + apply(values);
}
export function observe(values: readonly number[], apply: (items: readonly number[]) => number): number {
  return apply(values) + apply(values);
}
export function run(): boolean {
  const values = [1, 2];
  const result = twice(values, items => { items[0] += 1; return items[0]; });
  const read = observe(values, items => items[0]);
  return result === 5 && read === 6 && values[0] === 3 && values[1] === 2;
}
`;
