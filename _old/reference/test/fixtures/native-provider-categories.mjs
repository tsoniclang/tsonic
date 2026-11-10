export const nativeProviderCategoriesSource = `
import { URLSearchParams } from "node:url";
class Container {
  value: URLSearchParams;
  constructor(value: URLSearchParams) { this.value = value; }
}
let calls = 0;
function count(): number { return calls; }
function selected(value: Container): URLSearchParams { calls++; return value.value; }
function category(value: URLSearchParams | string | null | undefined): boolean {
  return typeof value === "object";
}
export function run(): boolean {
  const container = new Container(new URLSearchParams("first=1"));
  const parameters = selected(container);
  const alias = parameters;
  const valueCategory = typeof selected(container);
  return count() === 2 && valueCategory === "object" && typeof alias === "object" &&
    category(parameters) && !category("text") && category(undefined) && category(null);
}
`;
