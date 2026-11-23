import type { ErrorValue, Result, UnitRequest, UnitResult } from "../diag/contract.js";
import type { AnalyzeBodyRound, BodyRoundEnvironment, BodyRoundValue } from "../analyses/body/contract.js";
import type { AnalyzeStorageUse } from "../analyses/liveness/contract.js";
import type { CallerRefusal, DataflowAccount, DataflowResult } from "../dataflow/contract.js";
import type { BodyId, DefId, NodeRef, SigId, SourceNodeRef } from "../ids/contract.js";
import type { BindingScope, BodyInstance, DeclaredExecution, Execution, Signature, SignatureOf } from "../ir-types/contract.js";
import type { ResolvedCallee, TirBody, TypedOperation } from "../ir-tir/contract.js";
import type { MirBody } from "../ir-mir/contract.js";
import type { AdmittedNativeGuarantee, NativeExportAssociation } from "../libraries/contract.js";
import type { ParameterMapping } from "../ir-infer/contract.js";
import type {
  DeclaredCellInventory, ParameterSlot, Summary, SummaryRelations,
  DependencyInventory, RequiredOperations, SummaryKey, SummaryAnswer, FactsVerificationContext, SummaryVerificationResources,
} from "../ir-facts/contract.js";

export interface SummaryLimits {
  readonly maximumIterationsPerComponent: number;
  readonly maximumComponentSize: number;
}

export interface DeclaredSummaryDeps {
  readonly signature: Signature;
  readonly parameters: readonly ParameterMapping[];
  readonly source: SourceNodeRef;
  readonly callables: readonly { readonly slot: ParameterSlot; readonly signatures: readonly [SigId, ...SigId[]] }[];
}

export type DeclaredSummaryInput = { readonly execution: DeclaredExecution } & (
  | { readonly kind: "native"; readonly guarantee: AdmittedNativeGuarantee;
      readonly associations: readonly NativeExportAssociation[]; readonly cells: DeclaredCellInventory;
      readonly relations: SummaryRelations }
  | { readonly kind: "unknown"; readonly scope: BindingScope; readonly bindingDependent: boolean; readonly suspends: boolean }
);

export type BindDeclaredSummary = (account: DataflowAccount, deps: DeclaredSummaryDeps,
  input: DeclaredSummaryInput) => DataflowResult<Result<Summary>>;

export interface ComponentDeps {
  readonly account: DataflowAccount;
  readonly maximumComponentSize: number;
  readonly componentRefusal: CallerRefusal;
}

export type ComponentsOf = (deps: ComponentDeps, input: RequiredOperations) => DataflowResult<DependencyInventory>;

export interface DependencyDeps {
  readonly account: DataflowAccount;
  readonly signatureOf: SignatureOf;
  readonly callableEntriesAt: (at: NodeRef, definition: DefId) => readonly SummaryKey[] | null;
  readonly calleeAt: (at: NodeRef, callee: ResolvedCallee) => SummaryKey | null;
  readonly initializerAt: (at: NodeRef, initializer: BodyId | { readonly instance: BodyInstance; readonly parameter: number;
    readonly callee: ResolvedCallee }) => SummaryKey | null;
  readonly operationEntriesAt: (at: NodeRef, operation: TypedOperation) => readonly SummaryKey[] | null;
  readonly dispatchEntriesAt: (at: NodeRef) => readonly SummaryKey[] | null;
}

export interface DependencyInput {
  readonly execution: Execution;
  readonly tir: TirBody;
}

export type DependenciesOf = (deps: DependencyDeps, input: DependencyInput) => DataflowResult<RequiredOperations>;

export interface ConvergenceDeps {
  readonly analyzeStorageUse: AnalyzeStorageUse;
  readonly analyzeBodyRound: AnalyzeBodyRound;
  readonly environment: BodyRoundEnvironment;
  readonly verification: FactsVerificationContext;
  readonly resources: SummaryVerificationResources;
}

export interface ConvergenceMember {
  readonly execution: Execution;
  readonly mir: MirBody;
  readonly tir: TirBody;
  readonly unit: UnitRequest;
}

export interface StableSummary {
  readonly key: SummaryKey;
  readonly answer: SummaryAnswer;
}

export interface ConvergenceInput {
  readonly inventory: DependencyInventory;
  readonly component: number;
  readonly members: readonly ConvergenceMember[];
  readonly outside: readonly StableSummary[];
  readonly maximumIterations: number;
  readonly iterationRefusal: CallerRefusal;
}

export interface StableBody {
  readonly execution: Execution;
  readonly key: string;
  readonly identity: string;
  readonly result: UnitResult<BodyRoundValue | ErrorValue>;
}

export type ConvergeComponent = (deps: ConvergenceDeps, input: ConvergenceInput) => DataflowResult<readonly StableBody[]>;
