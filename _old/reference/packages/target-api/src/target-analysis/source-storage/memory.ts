import type { SourceMemoryQueries } from "../../source-model/memory.js";
import type { SourceStorageBindings } from "../../source-model/storage.js";
import type { SourceStorageQueries } from "../../source-model/program.js";
import { createSourceClosedArrayStorageQueries } from "../source-array-storage.js";
import { createSourceMemoryBindingQueries } from "../source-memory-bindings.js";
import { createSourceMemoryMetadataProduction } from "../source-memory-metadata.js";
import { createSourcePointerBackingQueries } from "../source-pointer-backing.js";
import { createSourceRawLocationQueries } from "../source-raw-location.js";
import { createSourceMemoryObservationQueries } from "../source-memory-observations.js";
import type { SourceStorageScope } from "./graph/scoped-model.js";
import { createSourceMemoryEnvironments } from "./model/memory-environments.js";
import { createSourceStorageMemoryMetadata } from "./model/memory-metadata.js";
import { sourceStorageOutcome, type SourceStorageProgram } from "./model/program.js";
import type { SourceStorageBudget } from "./model/resource-budget.js";
import type { createSourceStorageTransport } from "./transport/transport.js";

export function createSourceMemoryQueries(input: {
  readonly source: SourceStorageProgram;
  readonly storage: SourceStorageQueries;
  readonly budget: SourceStorageBudget;
  readonly transport: ReturnType<typeof createSourceStorageTransport>;
  readonly bindingStates: WeakMap<SourceStorageBindings, readonly SourceStorageScope[]>;
}): SourceMemoryQueries {
  const { context } = input.source.analysis.memory;
  const metadata = createSourceMemoryMetadataProduction(context, input.budget);
  const environments = createSourceMemoryEnvironments({ ...input, context });
  const pointerBacking = createSourcePointerBackingQueries({ ...input, environments });
  const memoryMetadata = createSourceStorageMemoryMetadata({ ...input, environments, metadata });
  const memoryBindings = createSourceMemoryBindingQueries({ ...input, environments, context, metadata });
  const closedArrayStorage = createSourceClosedArrayStorageQueries(input);
  const rawLocation = createSourceRawLocationQueries({ context, environments, metadata: memoryMetadata, budget: input.budget });
  const observation = createSourceMemoryObservationQueries({ context, environments, metadata: memoryMetadata, budget: input.budget });
  return Object.freeze({
    observation: Object.freeze({ value: sourceStorageOutcome(observation.value) }),
    rawLocation: Object.freeze({ resolve: sourceStorageOutcome(rawLocation.resolve) }),
    pointerBacking: Object.freeze({ value: sourceStorageOutcome(pointerBacking.value), returned: sourceStorageOutcome(pointerBacking.returned) }),
    memoryMetadata: Object.freeze({ value: sourceStorageOutcome(memoryMetadata.value), declaration: sourceStorageOutcome(memoryMetadata.declaration),
      isCompileTimeExpression: sourceStorageOutcome(memoryMetadata.isCompileTimeExpression) }),
    memoryBindings: Object.freeze({ field: sourceStorageOutcome(memoryBindings.field), record: sourceStorageOutcome(memoryBindings.record),
      inventory: sourceStorageOutcome(memoryBindings.inventory) }),
    closedArrayStorage: Object.freeze({ resolve: sourceStorageOutcome(closedArrayStorage.resolve) }),
  });
}
