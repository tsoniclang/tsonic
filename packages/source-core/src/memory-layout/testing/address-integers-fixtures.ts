import assert from "node:assert/strict";

import { formatDiagnostics } from "@tsonic/tsts";

import type { CheckedSourceProgram } from "@tsonic/tsts";

import { assertMemoryDiagnostics, memorySession, memoryTestPrelude, memoryTestRegistration } from "./fixtures.js";

function addressSession(source: string, width: 32 | 64, byteOrder: "little" | "big" = "little"): CheckedSourceProgram {
  return memorySession(memoryTestPrelude + source, { registrations: [{
    ...memoryTestRegistration,
    descriptor: { fingerprint: `address-test-${byteOrder}-${width}`, byteOrder, addressWidth: width },
  }] });
}

function assertClean(checked: CheckedSourceProgram): void {
  const diagnostics = checked.diagnostics.filter((entry) => entry !== undefined);
  assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics, "/src"));
  assertMemoryDiagnostics(checked);
}

export { addressSession, assertClean };
