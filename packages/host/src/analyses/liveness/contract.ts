import type { Result } from "../../diag/contract.js";
import type { DataflowAccount } from "../../dataflow/contract.js";
import type { LivenessFacts } from "../../ir-facts/contract.js";
import type { MirBody } from "../../ir-mir/contract.js";
import type { Execution } from "../../ir-types/contract.js";

export interface StorageUseDeps {
  readonly account: DataflowAccount;
}

export interface StorageUseInput {
  readonly execution: Execution;
  readonly body: MirBody;
}

export type AnalyzeStorageUse = (deps: StorageUseDeps, input: StorageUseInput) => Result<LivenessFacts>;
