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
