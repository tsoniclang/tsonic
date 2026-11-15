import type { ErrorValue, Result, UnitRequest, UnitResult, Violation } from "../diag/contract.js";
import type { ModuleId, NodeId, NodeRef } from "../ids/contract.js";
import type { SignatureOf, TypeOf } from "../ir-types/contract.js";
import type { HirModule } from "../ir-hir/contract.js";
import type { RuleTable } from "../ir-infer/contract.js";
import type { TirBody, TirVerifierInput } from "../ir-tir/contract.js";
import type { BoundLibraries } from "../libraries/contract.js";

export interface FormsDeps {
  readonly libraries: BoundLibraries;
  readonly role: "source" | "declaration";
}

export interface SafetyDeps {
  readonly libraries: BoundLibraries;
  readonly verification: TirVerifierInput;
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

export interface RefusedOccurrence {
  readonly module: ModuleId;
  readonly node: NodeId;
  readonly error: ErrorValue;
}

export type FormDiagnostics = (deps: FormsDeps, module: HirModule, unit: UnitRequest) => UnitResult<readonly RefusedOccurrence[]>;
export type SafetyDiagnostics = (deps: SafetyDeps, body: TirBody, unit: UnitRequest) => UnitResult<ErrorValue | null>;
export type Consistency = (
  deps: ConsistencyDeps,
  body: TirBody,
) => Result<readonly Violation<ConsistencyRule, NodeRef>[]>;
