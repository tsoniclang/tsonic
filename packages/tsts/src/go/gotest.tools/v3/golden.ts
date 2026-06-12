import type { TestingT } from "./assert.js";
import * as nodeFs from "node:fs";
import { byteArraysEqual, toNodeBytes } from "../../nodebytes.js";

export function Assert(t: TestingT, actual: string | Uint8Array, path: string): void {
  const expected = toNodeBytes(nodeFs.readFileSync(path));
  const actualBytes = typeof actual === "string" ? toNodeBytes(Buffer.from(actual)) : toNodeBytes(actual);
  if (!byteArraysEqual(expected, actualBytes)) {
    t.Fatal(`golden mismatch for ${path}`);
  }
}
