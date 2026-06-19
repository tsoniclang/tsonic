import type { TestingT } from "./assert.js";
import * as nodeFs from "node:fs";

export function Assert(t: TestingT, actual: string | Uint8Array, path: string): void {
  const expected = nodeFs.readFileSync(path);
  const actualBuffer = typeof actual === "string" ? Buffer.from(actual) : Buffer.from(actual);
  if (!expected.equals(actualBuffer)) {
    t.Fatal(`golden mismatch for ${path}`);
  }
}
