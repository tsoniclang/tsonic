export const nativeNodeErrorSource = `
import type { NodeError } from "node:util";
import type { Server } from "node:http";
import type { Readable, Writable } from "node:stream";
import { Buffer } from "node:buffer";
import { gzip, gunzip } from "node:zlib";

export function close(server: Server, done: (error?: NodeError) => void): void {
  server.close(error => done(error));
}

export function forward(source: Readable, destination: Writable): void {
  const listener = (error: NodeError): void => { destination.destroy(error); };
  source.on("error", listener);
  source.off("error", listener);
}

export function message(error: NodeError): string { return error.message; }
export function fail(error: NodeError): never { throw error; }

export function consume(error: NodeError | undefined): void {
  if (error === undefined) return;
  if (error.message.length === 0) throw new Error("empty native error");
  try { fail(error); } catch (failure) { throw failure; }
}

export function retained(error: NodeError): string {
  try { fail(error); } catch { return error.message; }
}

export function finalized(error: NodeError): string {
  let result = "";
  try { fail(error); } catch { } finally { result = error.message; }
  return result;
}

export function repeated(error: NodeError): string {
  for (let index = 0; index < 2; index++) {
    try { fail(error); } catch { }
  }
  return error.message;
}

export function captured(error: NodeError): boolean {
  const read = (): string => error.message;
  try { fail(error); } catch { }
  return read() === error.message;
}

export function run(): void {
  gunzip(Buffer.from("invalid gzip"), (error, output) => {
    if (error === undefined || error.message.length === 0 || output !== undefined) {
      throw new Error("native failure callback");
    }
    console.log("native error");
    try { fail(error); } catch { console.log("native throw"); }
  });
  gzip(Buffer.from("native payload"), (error, output) => {
    if (error !== undefined || output === undefined || output.length === 0) {
      throw new Error("native success callback");
    }
    console.log("native success");
  });
}
`;
