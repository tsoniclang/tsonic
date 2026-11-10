export const nativeEventFailureSource = String.raw`
import { EventEmitter } from "node:events";
import type { uint64 } from "@tsonic/core/types.js";

class DetailedError extends Error {
  readonly code: uint64 = 9007199254740993n;
  constructor() { super("original listener failure"); }
}

export function main(): void {
  const emitter = new EventEmitter();
  const original = new DetailedError();
  let completed = 0;
  const count = (): number => completed;
  emitter.once("data", (): void => { throw original; });
  emitter.once("data", (): void => { completed += 1; });
  let retained = false;
  try { emitter.emit("data"); }
  catch (failure) {
    if (failure instanceof DetailedError) {
      retained = failure === original && failure.code === 9007199254740993n
        && failure.message === "original listener failure" && failure.stack === undefined;
    }
  }
  if (!retained || count() !== 0 || emitter.listenerCount("data") !== 1)
    throw new Error("original listener failure or pending registration lost");
  if (!emitter.emit("data") || count() !== 1 || emitter.listenerCount("data") !== 0)
    throw new Error("pending once listener was not retained");
  if (emitter.emit("data")) throw new Error("once listener executed twice");
  console.log("native event identity");
}
`;

export const nativeEventReentrantSource = String.raw`
import { EventEmitter } from "node:events";

export function main(): void {
  const emitter = new EventEmitter();
  let first = 0;
  let second = 0;
  emitter.once("data", (): void => {
    first += 1;
    if (!emitter.emit("data")) throw new Error("nested listener unavailable");
  });
  emitter.once("data", (): void => { second += 1; });
  if (!emitter.emit("data") || first !== 1 || second !== 1 || emitter.emit("data"))
    throw new Error("reentrant once ownership lost");
  console.log("native event reentrancy");
}
`;

export const nativePortCompletionSource = String.raw`
import { MessageChannel } from "node:worker_threads";

export function main(): void {
  const channel = new MessageChannel();
  let completed = 0;
  channel.port2.once("message", (): void => {
    completed += 1;
    channel.port2.once("message", (): void => {
      completed += 1;
      channel.port1.close();
      channel.port2.close();
      if (completed !== 2) throw new Error("port message frontier lost");
      console.log("native port completion");
    });
  });
  channel.port1.postMessage(1);
  channel.port1.postMessage(2);
}
`;

export const nativePortFailureSource = String.raw`
import { MessageChannel } from "node:worker_threads";
let completed = 0;

export function schedule(): Error {
  const channel = new MessageChannel();
  const original = new Error("original port failure");
  channel.port2.once("message", (): void => { throw original; });
  channel.port2.once("message", (): void => {
    completed += 1;
    channel.port1.close();
    channel.port2.close();
  });
  channel.port1.postMessage(1);
  channel.port1.postMessage(2);
  return original;
}

export function count(): number { return completed; }
`;
