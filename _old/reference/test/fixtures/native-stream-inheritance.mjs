export const nativeStreamInheritanceSource = `
import type { WriteStream } from "node:fs";
import type { Buffer } from "node:buffer";
import type { Writable, Duplex, Transform } from "node:stream";
import { createGzip } from "node:zlib";
type Sink = WriteStream;
export function subscribe(sink: Sink, error: (value: Error) => void, drain: () => void, finish: () => void): Writable {
  sink.on("error", error);
  sink.off("error", error);
  sink.once("error", error);
  sink.off("error", error);
  sink.once("drain", drain);
  sink.off("drain", drain);
  sink.once("finish", finish);
  return sink.off("finish", finish);
}
export function write(sink: Sink, bytes: Buffer): Writable {
  sink.write(bytes);
  sink.write("text");
  return sink.end();
}
export function optionalWrite(sink: Sink | undefined, bytes: Buffer): boolean {
  return sink?.write(bytes) ?? false;
}
export function destroy(codec: Transform, error?: Error): Duplex {
  return codec.destroy(error);
}
export function run(): void {
  const direct = createGzip();
  direct.destroy();
  if (!direct.destroyed || direct.writable || direct.readable) throw new Error("direct codec destruction");
  const codec = createGzip();
  const erased: Transform = codec;
  const result = destroy(erased);
  if (!result.destroyed || result.writable || result.readable || !codec.destroyed) {
    throw new Error("erased codec destruction");
  }
}
`;

export const invalidNativeStreamInheritanceSources = Object.freeze([
  Object.freeze(["an undeclared event", `
import type { WriteStream } from "node:fs";
export function attach(sink: WriteStream): void { sink.once("undeclared", () => {}); }
`]),
  Object.freeze(["an incompatible error listener", `
import type { WriteStream } from "node:fs";
export function attach(sink: WriteStream): void { sink.on("error", (value: string) => {}); }
`]),
  Object.freeze(["an incompatible write carrier", `
import type { WriteStream } from "node:fs";
export function write(sink: WriteStream): void { sink.write(42); }
`]),
  Object.freeze(["an incompatible destruction error", `
import type { Transform } from "node:stream";
export function destroy(codec: Transform): void { codec.destroy("not an Error"); }
`]),
]);
