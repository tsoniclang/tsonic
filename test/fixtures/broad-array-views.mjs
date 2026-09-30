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
