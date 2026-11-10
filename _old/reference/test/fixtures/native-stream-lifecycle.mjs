export const nativeStreamLifecycleSource = `
import { createGzip } from "node:zlib";
import { Buffer } from "node:buffer";
import type { Duplex } from "node:stream";

export function run(): void {
  const codec = createGzip();
  const stream: Duplex = codec;
  const expected = new Error("native lifecycle identity");
  let received: Error | undefined;
  let errors = 0;
  let closes = 0;
  let finishes = 0;
  const removed = (): void => { throw new Error("removed lifecycle listener"); };
  const removedError = (error: Error): void => { throw error; };
  stream.on("error", removedError);
  stream.off("error", removedError);
  stream.once("error", removedError);
  stream.off("error", removedError);
  stream.on("close", removed);
  stream.off("close", removed);
  stream.once("close", removed);
  stream.off("close", removed);
  stream.on("drain", removed);
  stream.off("drain", removed);
  stream.once("drain", removed);
  stream.off("drain", removed);
  stream.on("finish", removed);
  stream.off("finish", removed);
  stream.once("finish", removed);
  stream.off("finish", removed);
  stream.once("error", (error: Error): void => { received = error; errors++; });
  stream.once("close", (): void => { closes++; });
  stream.once("finish", (): void => { finishes++; });
  stream.cork();
  stream.write(Buffer.from("pending native data"));
  stream.uncork();
  stream.destroy(expected);
  stream.destroy(expected);
  if (received !== expected || errors !== 1 || closes !== 1 || finishes !== 0) {
    throw new Error("native stream lifecycle identity failed");
  }
  if (!codec.destroyed || codec.readable || codec.writable || codec.writableFinished) {
    throw new Error("native codec resource was not destroyed");
  }
  const complete = createGzip();
  const completed: Duplex = complete;
  completed.end();
}
`;

export const invalidNativeStreamLifecycleSources = Object.freeze([
  Object.freeze(["a non-callable close listener", `
import type { Duplex } from "node:stream";
export function attach(stream: Duplex): void { stream.once("close", 42); }
`]),
  Object.freeze(["an incompatible error listener", `
import type { Duplex } from "node:stream";
export function attach(stream: Duplex): void { stream.on("error", (error: string): void => {}); }
`]),
  Object.freeze(["an undeclared lifecycle event", `
import type { Duplex } from "node:stream";
export function attach(stream: Duplex): void { stream.on("completed", (): void => {}); }
`]),
  Object.freeze(["an incompatible final write carrier", `
import type { Duplex } from "node:stream";
export function finish(stream: Duplex): void { stream.end(42); }
`]),
]);
