export const nativeRuntimeCompletionSource = String.raw`
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { Buffer } from "node:buffer";
export function main(): void {
  const reader = createInterface({ input: Readable.from([Buffer.from("answer\n")]) });
  reader.question("", answer => {
    if (answer !== "answer") throw new Error("wrong buffered answer");
    console.log("native runtime completion");
  });
}
`;

export const nativeRuntimeOriginalErrorSource = String.raw`
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { Buffer } from "node:buffer";
export function schedule(): Error {
  const original = new Error("original readline failure");
  const reader = createInterface({ input: Readable.from([Buffer.from("answer\n")]) });
  reader.question("", answer => {
    if (answer !== "answer") throw new Error("wrong buffered answer");
    throw original;
  });
  return original;
}
`;
