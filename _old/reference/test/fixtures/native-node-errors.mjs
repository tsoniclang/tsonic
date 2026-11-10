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
  const listener = (error: Error): void => { destination.destroy(error); };
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

export const nativeNodeErrorUnionSource = `
import type { NodeError } from "node:util";
import { Buffer } from "node:buffer";
import { gunzip } from "node:zlib";

export function failUnion(error: Error | NodeError): never { throw error; }
export function failReordered(error: NodeError | Error): never { throw error; }
export function failOptionalUnion(error: Error | NodeError | undefined): void {
  if (error !== undefined) failUnion(error);
}
export function throwNative(error: NodeError): never { return failUnion(error); }
export function throwSource(error: Error): never { return failReordered(error); }
export function rethrowUnion(error: Error | NodeError): void {
  try { failUnion(error); } catch (failure) { throw failure; }
}
`;

export const nativeNodeErrorUnionProofSource = `${nativeNodeErrorUnionSource}
export class LocalFailure extends Error { readonly tag = "local"; }
export function failProject(error: LocalFailure | NodeError): never { throw error; }
export function runUnions(): void {
  let caught = 0;
  failOptionalUnion(undefined);
  try { failUnion(new Error("source")); } catch { caught++; }
  try { failReordered(new Error("reordered")); } catch { caught++; }
  try { failProject(new LocalFailure("project")); }
  catch (failure) { if (failure instanceof LocalFailure && failure.tag === "local") caught++; }
  if (caught !== 3) throw new Error("source error alternative routes");
  gunzip(Buffer.from("invalid gzip"), error => {
    if (error === undefined) throw new Error("native error missing");
    let nativeCaught = 0;
    try { failUnion(error); } catch { nativeCaught++; }
    try { failReordered(error); } catch { nativeCaught++; }
    try { failProject(error); } catch { nativeCaught++; }
    try { failOptionalUnion(error); } catch { nativeCaught++; }
    try { rethrowUnion(error); } catch { nativeCaught++; }
    if (nativeCaught !== 5) throw new Error("native error alternative routes");
    console.log("native union routes");
  });
}
`;
