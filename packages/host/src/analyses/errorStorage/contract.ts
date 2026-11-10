import type { Result } from "../../diag/contract.js";
import type { DefId } from "../../ids/contract.js";
import type { BodyInstance, TypeOf } from "../../ir-types/contract.js";
import type { MirBody } from "../../ir-mir/contract.js";
import type { AnalysisLimits, ErrorStorageFacts, LivenessFacts, OriginsResult } from "../../ir-facts/contract.js";

export interface ErrorStorageDeps {
  readonly livenessOf: (instance: BodyInstance) => LivenessFacts;
  readonly originsOf: (instance: BodyInstance) => OriginsResult;
  readonly typeOf: TypeOf;
  readonly sourceErrorDeclarations: readonly DefId[];
  readonly sourceStorageFields: readonly DefId[];
  readonly limits: AnalysisLimits;
}

export type AnalyzeErrorStorage = (
  deps: ErrorStorageDeps,
  body: MirBody,
) => Result<ErrorStorageFacts>;
