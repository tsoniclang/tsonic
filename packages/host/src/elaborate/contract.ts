import type { Diagnostic, Result } from "../diag/contract.js";
import type { ModuleId } from "../ids/contract.js";
import type { BindingScope, BodyInstance, SignatureOf, TypeOf } from "../ir-types/contract.js";
import type { HirBody } from "../ir-hir/contract.js";
import type { ConstraintSet, RuleTable, Solution } from "../ir-infer/contract.js";
import type { TirBody } from "../ir-tir/contract.js";

export interface ElaborateDeps {

  readonly rules: RuleTable;

  readonly typeOf: TypeOf;
  readonly signatureOf: SignatureOf;

  readonly checkerDiagnosticsOf: (module: ModuleId) => readonly Diagnostic[];
}

export interface ElaborateInput {

  readonly instance: BodyInstance;
  readonly scope: BindingScope;

  readonly body: HirBody;

  readonly constraints: ConstraintSet;

  readonly solution: Solution;

  readonly template: TirBody | null;

  readonly nestedBodies: readonly TirBody[];
}

export type Elaborate = (deps: ElaborateDeps, input: ElaborateInput) => Result<TirBody>;
