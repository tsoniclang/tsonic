export const broadArrayViewSource = `
function inspect(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  const items = value as readonly unknown[];
  return items.length;
}
function mutate(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const items = value as unknown[];
  const alias = items;
  items[0] = 7;
  return alias[0] === 7 && items.length === 2;
}
function narrowed(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.length === 2 && value[0] === 7;
}
function typed(value: string | string[]): number {
  if (!Array.isArray(value)) return 0;
  return value.length;
}
function known(value: string[]): boolean { return Array.isArray(value); }
export function run(): boolean {
  const input: unknown[] = [1, 2];
  const alias = input;
  return inspect(input) === 2 && inspect("not an array") === 0 &&
    mutate(input) && narrowed(input) && input[0] === 7 && alias[0] === 7 &&
    typed(["left", "right"]) === 2 && typed("not an array") === 0 && known(["item"]);
}
`;

export const broadArrayCategoryWriteSource = `
function update(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  let calls = 0;
  const index = (): number => { calls++; return 0; };
  value[index()] = 7;
  return calls === 1 && value[0] === 7 && value.length === 2;
}
export function run(): boolean {
  const values: unknown[] = [1, 2];
  const alias = values;
  return update(values) && alias[0] === 7 && !update("not an array");
}
`;

export const broadArrayFailureSource = `
function count(value: unknown): number {
  const values = value as string[];
  return values.length;
}
export function run(): boolean {
  if (count(["native"]) !== 1) return false;
  try {
    count([1]);
    return false;
  } catch {
    return true;
  }
}
`;
