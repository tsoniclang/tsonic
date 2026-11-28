import type { Diagnostic, Result } from "../diag/contract.js";
import type { BodyId, DefId, ModuleId, NodeId, Origin, SourceNodeRef, TyId } from "../ids/contract.js";
import type { ArtifactBindings, BindingScope, BodyInstance, NominalDefinition, SignatureOf, TypeOf, TypeInterner, TypePublicationWork } from "../ir-types/contract.js";
import type { CheckedLayoutAlias, CheckedPhase, CheckedTypingCut, CheckedTypingCuts, EnumMember, HirBindingViews, HirBody, HirNode } from "../ir-hir/contract.js";
import type { ApplicationDecision, ConstraintSet, RuleTable, Solution } from "../ir-infer/contract.js";
import type { StaticStorageOf, TirApplication, TirBody, TirDefaultInitializer, TypedPhase } from "../ir-tir/contract.js";

export interface ElaborateDeps<State> extends HirBindingViews {
  readonly cuts: CheckedTypingCuts;
  readonly types: TypeInterner;
  readonly typeWork: TypePublicationWork;

  readonly rules: RuleTable<State>;

  readonly typeOf: TypeOf;
  readonly signatureOf: SignatureOf;
  readonly nodeOf: (reference: SourceNodeRef) => HirNode | null;
  readonly bodyOf: (body: BodyId) => HirBody | null;
  readonly itemOf: (definition: DefId) => HirNode;
  readonly nominalOf: (definition: DefId) => NominalDefinition | null;
  readonly bindingScopeOf: (definition: DefId) => BindingScope;
  readonly staticStorageOf: StaticStorageOf;
  readonly enumValueTypeOf: (member: EnumMember<CheckedPhase>) => TyId | null;

  readonly checkerDiagnosticsOf: (module: ModuleId) => readonly Diagnostic[];
}

export type ElaborationCause =
  | { readonly kind: "form"; readonly cut: CheckedTypingCut }
  | { readonly kind: "producer"; readonly refusal: Extract<Result<never>, { readonly kind: "refused" }> };

export interface ElaborationNoResult {
  readonly kind: "no-result";
  readonly instance: BodyInstance;
  readonly causes: readonly [ElaborationCause, ...ElaborationCause[]];
  readonly diagnostics: readonly Diagnostic[];
}

export type ElaborationChild = TirBody | ElaborationNoResult
  | { readonly kind: "checked"; readonly body: HirBody; readonly instance: BodyInstance;
      readonly onRequired: (complete: (ready: TirBody) => Result<void>) => Result<void> };

export interface ElaborateInput {
  readonly instance: BodyInstance;
  readonly scope: BindingScope;
  readonly body: HirBody;
  readonly layoutAlias: CheckedLayoutAlias | null;
  readonly typing: {
    readonly kind: "ready";
    readonly constraints: ConstraintSet;
    readonly solution: Solution;
    readonly template: TirBody | null;
  } | ElaborationNoResult;
  readonly nestedBodies: readonly ElaborationChild[];
  readonly initializers: readonly ElaborationChild[];
}

export type ElaborationResult = Extract<Result<TirBody>, { readonly kind: "ok" }> | ElaborationNoResult;
export type Elaborate = <State>(deps: ElaborateDeps<State>, input: ElaborateInput) => ElaborationResult;

export interface SelectedCallDeps {
  readonly signatureOf: SignatureOf;
}

export interface SelectedCallOperands {
  readonly argumentAt: (position: number) => { readonly kind: "value" | "spread"; readonly expression: NodeId } | undefined;
}

export type ElaborateSelectedCall = (deps: SelectedCallDeps, decision: ApplicationDecision, bindings: ArtifactBindings,
  operands: SelectedCallOperands, origin: Origin) => TirApplication;

export interface DefaultAttachmentDeps {
  readonly signatureOf: SignatureOf;
}

export type AttachDefault = (deps: DefaultAttachmentDeps, owner: import("../ir-hir/contract.js").DefaultInitializerOwner<TypedPhase>,
  unopened: Extract<TirDefaultInitializer, { readonly kind: "checked-default" }>, ready: TirBody) => Result<void>;
