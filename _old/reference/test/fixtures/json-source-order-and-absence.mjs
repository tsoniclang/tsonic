export const jsonSourceOrderAndAbsenceSource = `
export function run(): void {
  const ordered = JSON.stringify({ zebra: 1, alpha: 2 });
  if (ordered !== '{"zebra":1,"alpha":2}') throw new Error("JSON source property order");
  const nested = JSON.stringify({ b: { a: 1, b: 2 }, a: 0 });
  if (nested !== '{"b":{"a":1,"b":2},"a":0}') throw new Error("JSON nested source property order");
  const replaced = JSON.stringify({ keep: 7, drop: 0, null: 1 }, (key: string, value: unknown): unknown => {
    if (key === "drop") return undefined;
    if (key === "null") return null;
    return value;
  });
  if (replaced !== '{"keep":7,"drop":null,"null":null}') throw new Error("JSON single native absence");
}
`;
