import type { JsValue } from "@tsonic/core/types.js";

const isObject = (value: JsValue): value is Record<string, JsValue> => {
  return value !== null && typeof value === "object" && !Array.isArray(value);
};

export function main(): void {
  const root = JSON.parse('{"title":"hello","count":2}');
  if (!isObject(root)) return;

  const entries = Object.entries(root);
  const first = entries[0];
  if (first === undefined) return;

  const [key, value] = first;
  if (typeof value === "number") {
    console.log(key, value.toString());
  } else if (typeof value === "string") {
    console.log(key, value.toUpperCase());
  }
}
