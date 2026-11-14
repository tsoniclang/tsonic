import type { Result } from "../../diag/contract.js";
import type { DataflowLimits } from "../../dataflow/contract.js";
import type { LivenessFacts } from "../../ir-facts/contract.js";
import type { MirBody } from "../../ir-mir/contract.js";
import type { Execution } from "../../ir-types/contract.js";

export interface StorageUseInput {
  readonly execution: Execution;
  readonly body: MirBody;
  readonly limits: DataflowLimits;
}

export type AnalyzeStorageUse = (input: StorageUseInput) => Result<LivenessFacts>;
