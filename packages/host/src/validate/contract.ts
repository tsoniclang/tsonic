import type { Computed, Result, Violation } from "../diag/contract.js";
import type { NodeRef } from "../ids/contract.js";
import type { SignatureOf, TypeOf } from "../ir-types/contract.js";
import type { HirModule } from "../ir-hir/contract.js";
import type { RuleTable } from "../ir-infer/contract.js";
import type { TirBody } from "../ir-tir/contract.js";
import type { Libraries } from "../libraries/contract.js";

export interface FormsDeps {
  readonly libraries: Libraries;
}

export interface SafetyDeps {
  readonly libraries: Libraries;
  readonly typeOf: TypeOf;
  readonly signatureOf: SignatureOf;
}

export interface ConsistencyDeps {
  readonly typeOf: TypeOf;
  readonly signatureOf: SignatureOf;
  readonly rules: RuleTable;
}

export type ConsistencyRule =
  | "conversion-source"
  | "conversion-destination"
  | "embedding-replay"
  | "refinement-source"
  | "refinement-destination"
  | "refinement-replay";

export type FormDiagnostics = (deps: FormsDeps, module: HirModule) => Computed<null>;
export type SafetyDiagnostics = (deps: SafetyDeps, body: TirBody) => Computed<null>;
export type Consistency = (
  deps: ConsistencyDeps,
  body: TirBody,
) => Result<readonly Violation<ConsistencyRule, NodeRef>[]>;
