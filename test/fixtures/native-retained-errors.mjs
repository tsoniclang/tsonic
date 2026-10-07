export const nativeRetainedErrorCases = Object.freeze([
  ...["inferred", "annotated", "aliased"].flatMap(parameter =>
    ["binding", "record"].map(storage => Object.freeze([parameter, storage, "direct"]))),
  Object.freeze(["annotated", "record", "captured"]),
  Object.freeze(["aliased", "binding", "captured"]),
]);

export function nativeRetainedErrorSourceFor(parameter = "inferred", storage = "binding", ordering = "direct") {
  if (!["inferred", "annotated", "aliased"].includes(parameter) || !["binding", "record"].includes(storage) ||
    !["direct", "captured"].includes(ordering)) {
    throw new Error("Invalid native retained Error fixture selection");
  }
  const input = parameter === "inferred" ? "error" : parameter === "annotated" ? "(error: Error)" : "(error: TransportError)";
  const declaration = storage === "binding" ? "let received: Error | undefined;" : "const receiver: { error?: Error } = {};";
  const received = storage === "binding" ? "received" : "receiver.error";
  const callback = `${input} => { ${received} = error; }`;
  const subscription = ordering === "direct" ? `stream.on("error", ${callback});` : `
  const detach = (): void => { stream.off("error", listener); };
  const listener = ${callback};
  stream.on("error", listener);`;
  return `
import { Readable } from "node:stream";
import type { uint64 } from "@tsonic/core/types.js";
${parameter === "aliased" ? "type TransportError = Error;" : ""}
class DetailedError extends Error {
  readonly code: uint64 = 9007199254740993n;
  constructor() { super("original"); }
}
export function run(): void {
  const stream = Readable.from([]);
  const original = new DetailedError();
  ${declaration}
  ${subscription}
  stream.destroy(original);
  ${ordering === "captured" ? "detach();" : ""}
  if (${received}?.name !== original.name || ${received}?.message !== original.message || ${received}?.stack !== undefined) {
    throw new Error("Error observations lost");
  }
  if (${received} === undefined) throw new Error("Error not delivered");
  if (${received} !== original) throw new Error("Error identity lost");
  const alias: Error = ${received};
  original.name = "UpdatedError";
  original.stack = "authored stack";
  if (alias.name !== "UpdatedError" || alias.stack !== "authored stack") throw new Error("Error observation snapshotted");
  if (!(${received} instanceof DetailedError)) throw new Error("Error origin lost");
  if (${received}.code !== 9007199254740993n) throw new Error("Error payload lost");
  original.message = "changed";
  if (${received}.message !== "changed") throw new Error("Error fields snapshotted");
}
`;
}

export const nativeRetainedErrorSource = nativeRetainedErrorSourceFor();

export const nativeRetainedTerminalErrorSource = `
import { Readable } from "node:stream";

export function run(): boolean {
  const stream = Readable.from([]);
  const original = new Error("original error callback");
  const later = new Error("later close callback");
  const supplied = new Error("native terminal input");
  let errors = 0;
  let closes = 0;
  const errorCount = (): number => errors;
  const closeCount = (): number => closes;
  let firstPreserved = false;
  let laterPreserved = false;
  stream.once("error", error => {
    if (error !== supplied) throw new Error("terminal input identity changed");
    errors++;
    throw original;
  });
  stream.once("close", () => { closes++; throw later; });
  try { stream.destroy(supplied); }
  catch (failure) {
    if (failure instanceof Error) firstPreserved = failure === original;
  }
  if (!stream.destroyed || errorCount() !== 1 || closeCount() !== 0) throw new Error("physical cleanup or source order changed");
  try { stream.destroy(); }
  catch (failure) {
    if (failure instanceof Error) laterPreserved = failure === later;
  }
  stream.destroy();
  return firstPreserved && laterPreserved && errorCount() === 1 && closeCount() === 1;
}
`;

export const nativeRetainedErrorFlowSource = `
import { createGzip } from "node:zlib";

export function run(): boolean {
  const original = new Error("original finish failure");
  const stack = original.stack;
  const stream = createGzip();
  stream.once("finish", (): void => { throw original; });
  let retained = false;
  try { stream.end(); }
  catch (failure) {
    if (failure instanceof Error) {
      retained = failure === original && failure.message === "original finish failure"
        && failure.name === "Error" && failure.stack === stack;
    }
  }
  stream.destroy();
  return retained;
}
`;
