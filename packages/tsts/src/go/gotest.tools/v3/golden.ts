import type { TestingT } from "./assert.js";
import { byteArraysEqual, toNodeBytes } from "../../nodebytes.js";
import * as nodeFs from "node:fs";

export function Assert(t: TestingT, actual: string | Uint8Array, path: string): void {
  const expected = toNodeBytes(nodeFs.readFileSync(path));
  const actualBytes = toNodeBytes(actual);
  if (!byteArraysEqual(expected, actualBytes)) {
    t.Fatal(`golden mismatch for ${path}`);
  }
}
