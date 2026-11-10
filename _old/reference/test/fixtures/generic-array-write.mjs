export const genericArrayWriteSource = `
export function assign<Value>(values: Value[], value: Value): void {
  values[0] = value;
}
export function run(): boolean {
  const values = [2];
  assign(values, 17);
  const text = ["before"];
  assign(text, "after");
  return values[0] === 17 && text[0] === "after";
}
`;
