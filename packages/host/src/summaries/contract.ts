import type { Result } from "../diag/contract.js";
import type { DataflowLimits } from "../dataflow/contract.js";
import type { DefId, SourceNodeRef } from "../ids/contract.js";
import type { BindingScope, BodyInstance, DeclaredExecution, Signature, SignatureOf, TypeOf } from "../ir-types/contract.js";
import type { AdmittedNativeGuarantee, NativeExportAssociation } from "../libraries/contract.js";
import type { ParameterMapping } from "../ir-infer/contract.js";
import type { CheckedPhase, Declaration } from "../ir-hir/contract.js";
import type { TirBody } from "../ir-tir/contract.js";
import type {
  AnalysisLimits, BodyFacts, CallComponent, CallGraph, Summary, SummaryKey,
} from "../ir-facts/contract.js";

export interface SummaryLimits {
  readonly maximumWork: number;
  readonly maximumIterationsPerComponent: number;
  readonly maximumComponentSize: number;
}

export type DeclaredSummaryInput = {
  readonly execution: DeclaredExecution;
  readonly signature: Signature;
  readonly parameters: readonly ParameterMapping[];
  readonly source: SourceNodeRef;
} & (
  | { readonly kind: "native"; readonly guarantee: AdmittedNativeGuarantee; readonly associations: readonly NativeExportAssociation[] }
  | { readonly kind: "unknown"; readonly scope: BindingScope; readonly bindingDependent: boolean; readonly suspends: boolean }
);

export type BindDeclaredSummary = (input: DeclaredSummaryInput) => Result<Summary>;

export interface CallGraphDeps {
  readonly itemOf: (definition: DefId) => Declaration<CheckedPhase>;
  readonly bodiesOf: (definition: DefId) => readonly BodyInstance[];
  readonly tirBody: (instance: BodyInstance) => TirBody;
  readonly signatureOf: SignatureOf;
  readonly typeOf: TypeOf;
  readonly limits: AnalysisLimits;
  readonly graphLimits: DataflowLimits;
  readonly summaryLimits: SummaryLimits;
}

export interface SummariesDeps {
  readonly bodiesOf: (key: SummaryKey) => readonly BodyInstance[];
  readonly signatureOf: SignatureOf;
  readonly summaryOf: (key: SummaryKey) => Summary;
  readonly analyzeBody: (
    instance: BodyInstance,
    approximations: readonly Summary[],
  ) => Result<BodyFacts>;
  readonly limits: AnalysisLimits;
  readonly summaryLimits: SummaryLimits;
}

export type BuildCallGraph = (
  deps: CallGraphDeps,
  roots: readonly DefId[],
) => Result<CallGraph>;

export type SummariesOf = (
  deps: SummariesDeps,
  component: CallComponent,
  instances: readonly SummaryKey[],
) => Result<readonly Summary[]>;
