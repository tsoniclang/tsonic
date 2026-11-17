export const partialNativeGuardsSource = `
class Item { value: number = 8; }
function text(value: string | (() => string) | undefined): string {
  if (value === undefined) return "missing";
  if (typeof value === "function") return value();
  return value;
}
function item(value: Item | (() => Item) | undefined): number {
  if (value === undefined) return -1;
  if (typeof value === "function") return value().value;
  return value.value;
}
function numeric(value: string | number | undefined): string {
  if (value === undefined) return "missing";
  if (typeof value === "number") return "number";
  return value;
}
function optional(value: string | (() => string) | undefined): string | undefined {
  if (typeof value === "function") return undefined;
  return value;
}
function afterWrite(value: string | number | undefined): string {
  if (value === undefined) return "missing";
  if (typeof value === "number") return "number";
  value = 4;
  return typeof value === "number" ? "changed" : "wrong";
}
export function run(): boolean {
  return text("kept") === "kept" && text(() => "callback") === "callback" && text(undefined) === "missing" &&
    item(new Item()) === 8 && item(() => new Item()) === 8 && item(undefined) === -1 &&
    numeric("kept") === "kept" && numeric(7) === "number" && numeric(undefined) === "missing" &&
    optional("kept") === "kept" && optional(undefined) === undefined && optional(() => "callback") === undefined &&
    afterWrite("kept") === "changed";
}
`;
