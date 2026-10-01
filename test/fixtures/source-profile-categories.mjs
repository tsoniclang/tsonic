export const sourceProfileCategoriesSource = `
interface Entry { readonly value: number; }
function stringCategory(value: RegExp | string | readonly string[]): boolean { return typeof value === "string"; }
function callableCategory(value: Entry | (() => number) | string): boolean { return typeof value === "function"; }
function objectCategory(value: Entry | (() => number) | string): boolean { return typeof value === "object"; }
function mapCategory(value: Map<string, number> | string): boolean { return typeof value === "object"; }
function setCategory(value: Set<number> | string): boolean { return typeof value === "object"; }
function dateCategory(value: Date | string): boolean { return typeof value === "object"; }
function bytesCategory(value: Uint8Array | string): boolean { return typeof value === "object"; }
function symbolCategory(value: symbol | string): boolean { return typeof value === "symbol"; }
export function run(): boolean {
  const entry: Entry = { value: 1 };
  return stringCategory("text") && !stringCategory(new RegExp("text")) && !stringCategory(["text"]) &&
    callableCategory(() => 1) && !callableCategory(entry) && !callableCategory("text") &&
    objectCategory(entry) && !objectCategory(() => 1) && !objectCategory("text") &&
    mapCategory(new Map<string, number>()) && !mapCategory("text") &&
    setCategory(new Set<number>()) && !setCategory("text") &&
    dateCategory(new Date(0)) && !dateCategory("text") &&
    bytesCategory(new Uint8Array(1)) && !bytesCategory("text") &&
    symbolCategory(Symbol("token")) && !symbolCategory("text");
}
`;
