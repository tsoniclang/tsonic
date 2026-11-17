import assert from "node:assert/strict";

import { formatDiagnostics } from "@tsonic/tsts";

import type { CheckedSourceProgram, Node } from "@tsonic/tsts";

import { readTsonicMemoryType } from "../../public/facts.js";

import { assertMemoryDiagnostics, memorySession } from "./fixtures.js";

const prelude = `
import { abi } from "test:abi";
import type { Pointer, RawPointer, uint32, int32 } from "@tsonic/core/types.js";
import { memorylayout, memoryfield, sizeof, allocateptr, torawptr, reinterpretrawptr } from "@tsonic/core/lang.js";
`;

function clean(source: string, extraFiles: Readonly<Record<string, string>> = {}): CheckedSourceProgram {
  const checked = memorySession(prelude + source, { extraFiles });
  const diagnostics = checked.diagnostics.filter(entry => entry !== undefined);
  assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics, "/src"));
  assertMemoryDiagnostics(checked);
  return checked;
}

function identity(checked: CheckedSourceProgram, node: Node) {
  const fact = readTsonicMemoryType(checked.sourceFacts, node);
  assert.ok(fact);
  assert.ok(Object.isFrozen(fact));
  assert.ok(Object.isFrozen(fact.identity));
  return fact.identity;
}

export { prelude, clean, identity };
