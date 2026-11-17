export const guardedClosedUnionFiles = Object.freeze({
  "contracts.ts": `
import type { Buffer } from "node:buffer";
export type Body = string | number | boolean | null | Record<string, unknown> | unknown[] | Buffer | Uint8Array;
`,
  "index.ts": `
import { Buffer } from "node:buffer";
import type { Body } from "./contracts.js";

function stringify(value: unknown): string {
  return JSON.stringify(value) ?? "absent";
}

export function forward(body?: Body): string {
  if (body == null) return "absent";
  else if (body instanceof Buffer) return "buffer";
  else if (body instanceof Uint8Array) return "bytes";
  else return typeof body === "string" ? body : stringify(body);
}

export function run(): boolean {
  return forward() === "absent" && forward(null) === "absent" &&
    forward("text") === "text" && forward(3) === "3" && forward(false) === "false" &&
    forward([1, true]) === "[1,true]" && forward({ count: 3 }) === '{"count":3}' &&
    forward(Buffer.from("value")) === "buffer" && forward(new Uint8Array(2)) === "bytes";
}

export function main(): void {
  if (!run()) throw new Error("guarded closed union");
}
`,
});
