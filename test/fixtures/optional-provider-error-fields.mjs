export const optionalProviderErrorFieldSource = `
import type { Readable } from "node:stream";
type TransportError = NonNullable<Parameters<Readable["destroy"]>[0]>;
interface Part { readonly label: string; error?: TransportError; }
export function retain(input: TransportError): TransportError {
  const part: Part = { label: "part", error: input };
  const alias = part;
  const selected = alias.error;
  return selected === undefined ? input : selected;
}
export function run(): boolean {
  const original = new Error("original transport error");
  const selected = retain(original);
  return selected === original && selected.message === original.message;
}
export function main(): void {
  if (!run()) throw new Error("native Error field contract was replaced");
}
`;
