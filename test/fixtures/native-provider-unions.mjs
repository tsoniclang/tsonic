export const nativeProviderUnionSource = `
import { Buffer } from "node:buffer";
type Payload = Buffer | string;
function hasSize(value: Buffer | string): boolean {
  if (typeof value === "string") return value.length === 3;
  return value.length === 3;
}
function isBuffer(value: Payload): value is Buffer { return value instanceof Buffer; }
function choose(value: boolean): Payload { return value ? Buffer.from("abc") : "abc"; }
export function run(): boolean {
  const binary = choose(true);
  const text = choose(false);
  if (!hasSize(binary) || !hasSize(text) || !isBuffer(binary) || isBuffer(text)) return false;
  if (isBuffer(binary)) return binary.toString() === "abc";
  return false;
}
`;
