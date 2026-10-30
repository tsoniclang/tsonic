import assert from "node:assert/strict";

import { createTargetSourceProgram } from "@tsonic/target-api/source";

import { createTsonicPointerBackingQueries } from "./requirements.js";

import { cleanMemorySession, memoryCall } from "../../memory-layout/testing/fixtures.js";

import { tsonicRawMemoryOperationFactKey } from "../raw-memory/facts.js";

const imports = `
import { allocateptr, addressof, projectptr } from "@tsonic/core/lang.js";
`;

function inspect(sourceText: string, options: { closed?: boolean; budget?: number } = {}) {
  const checked = cleanMemorySession(imports + sourceText);
  const call = memoryCall(checked, "torawptr");
  const operation = checked.sourceFacts.getFact(call, tsonicRawMemoryOperationFactKey);
  assert.ok(operation?.operation === "to-raw");
  const queries = createTsonicPointerBackingQueries(createTargetSourceProgram(checked), {
    hasClosedCallers: () => options.closed ?? true,
    maximumValues: options.budget ?? 4096,
  });
  const result = queries.resolve(operation.pointerExpression);
  assert.equal(queries.resolve(operation.pointerExpression), result);
  assert.ok(Object.isFrozen(result));
  return result;
}

export { imports, inspect };
