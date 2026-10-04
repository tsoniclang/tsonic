export const nativeRetainedErrorSource = `
import { Readable } from "node:stream";
import type { uint64 } from "@tsonic/core/types.js";
class DetailedError extends Error {
  readonly code: uint64 = 9007199254740993n;
  constructor() { super("original"); }
}
export function run(): void {
  const stream = Readable.from([]);
  const original = new DetailedError();
  let received: Error | undefined;
  stream.on("error", error => { received = error; });
  stream.destroy(original);
  if (received?.name !== original.name || received?.message !== original.message || received?.stack !== undefined) {
    throw new Error("Error observations lost");
  }
  if (received === undefined) throw new Error("Error not delivered");
  if (received !== original) throw new Error("Error identity lost");
  const alias: Error = received;
  original.name = "UpdatedError";
  original.stack = "authored stack";
  if (alias.name !== "UpdatedError" || alias.stack !== "authored stack") throw new Error("Error observation snapshotted");
  if (!(received instanceof DetailedError)) throw new Error("Error origin lost");
  if (received.code !== 9007199254740993n) throw new Error("Error payload lost");
  original.message = "changed";
  if (received.message !== "changed") throw new Error("Error fields snapshotted");
}
`;
