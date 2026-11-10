import type { Computed, Diagnostic } from "../diag/contract.js";
import type { BodyId, ModuleId } from "../ids/contract.js";
import type { ArtifactBindings, SignatureOf, TypeEvidence, TypeOf, TypeProductionRequest } from "../ir-types/contract.js";
import type { HirBody } from "../ir-hir/contract.js";
import type { ConstraintSet, RuleTable, Solution } from "../ir-infer/contract.js";
import type { TirBody } from "../ir-tir/contract.js";

export interface ElaborateDeps {
  readonly bindings: ArtifactBindings;
  readonly produceType: (request: TypeProductionRequest) => TypeEvidence;
  readonly constraintsOf: (body: BodyId) => ConstraintSet;
  readonly templateOf: (body: BodyId) => TirBody;
  readonly rules: RuleTable;
  readonly typeOf: TypeOf;
  readonly signatureOf: SignatureOf;
  readonly checkerDiagnosticsOf: (module: ModuleId) => readonly Diagnostic[];
}

export type Elaborate = (
  deps: ElaborateDeps,
  body: HirBody,
  solution: Solution,
) => Computed<TirBody>;
