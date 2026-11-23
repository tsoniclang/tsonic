import type { ErrorValue, Result, UnitRequest, UnitResult, Violation } from "../diag/contract.js";
import type { BodyId, ItemNodeRef, ModuleId, NodeRef } from "../ids/contract.js";
import type { SignatureOf, TypeOf } from "../ir-types/contract.js";
import type { CheckedTypingCut, HirModule, HirNode } from "../ir-hir/contract.js";
import type { RuleTable } from "../ir-infer/contract.js";
import type { TirBody, TirVerifierInput } from "../ir-tir/contract.js";
import type { BoundLibraries } from "../libraries/contract.js";

export type FormsScope =
  | { readonly kind: "module-header"; readonly module: ModuleId }
  | { readonly kind: "declaration-header"; readonly declaration: ItemNodeRef }
  | { readonly kind: "execution"; readonly body: BodyId; readonly root: HirNode };

export interface FormDiagnosticSite {
  readonly kind: "unsupported-form" | "augmentation-frontier";
  readonly module: ModuleId;
  readonly report: HirNode;
  readonly cut: HirNode;
  readonly scope: FormsScope;
}

export interface FormsIndexDeps {
  readonly role: "source" | "declaration";
  readonly scopeOf: (node: HirNode) => FormsScope;
}

export interface FormsReportDeps {
  readonly owns: (site: FormDiagnosticSite) => boolean;
}

export interface SafetyDeps {
  readonly libraries: BoundLibraries;
  readonly verification: TirVerifierInput;
}

export interface ConsistencyDeps<State> {
  readonly typeOf: TypeOf;
  readonly signatureOf: SignatureOf;
  readonly rules: RuleTable<State>;
}

export type ConsistencyRule =
  | "conversion-source"
  | "conversion-destination"
  | "embedding-replay"
  | "refinement-source"
  | "refinement-destination"
  | "refinement-replay";

export type IndexFormDiagnostics = (deps: FormsIndexDeps, module: HirModule) => readonly FormDiagnosticSite[];
export type FormDiagnostics = (deps: FormsReportDeps, site: FormDiagnosticSite, unit: UnitRequest) => UnitResult<CheckedTypingCut>;
export type SafetyDiagnostics = (deps: SafetyDeps, body: TirBody, unit: UnitRequest) => UnitResult<ErrorValue | null>;
export type Consistency = <State>(
  deps: ConsistencyDeps<State>,
  body: TirBody,
) => Result<readonly Violation<ConsistencyRule, NodeRef>[]>;
