export const structuralEnumerationSource = `
let reads = 0;
function collect(value: { count: number }): string {
  let keys = "";
  for (const key in value) keys += key + ",";
  return keys;
}
export function run(): boolean {
  const value = { first: 1, 10: 10, count: 2, 2: 2, get last(): number { reads++; return 9; } };
  const alias: { count: number } = value;
  const first = collect(alias);
  const second = collect(value);
  alias.count = 7.5;
  return first === "2,10,first,count,last," && second === first && value.count === 7.5 && reads === 0;
}
`;
