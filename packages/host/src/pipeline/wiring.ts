import type { CaptureModules, CaptureProgramModules, CreateCheckerExtensions, ExtensionReferencesOf, LowerModule, LowerModuleDefinitions,
  LowerModuleExports, OpenCheckedProgram } from "../front/contract.js";
import { captureModules, captureProgramModules, createCheckerExtensions, extensionReferencesOf, lowerModule, lowerModuleDefinitions,
  lowerModuleExports, openCheckedProgram } from "../front/index.js";
import type { ClassifyCycle, DeclaredSignatureOf, DescribeDefinitions, EnumOf, ErrorSignature, MembersOf, MemberTypeOf, PlaceSignature, ProduceType,
  ResumeDeclaredSignatureOf, ResumeEnumOf, ResumeProduceType } from "../decls/contract.js";
import { classifyCycle, declaredSignatureOf, describeDefinitions, enumOf, errorSignature, membersOf, memberTypeOf, placeSignature, produceType,
  resumeDeclaredSignatureOf, resumeEnumOf, resumeProduceType } from "../decls/index.js";
import type { CreateRuleTable, DecideCaptureModes, TypePatternMatch } from "../rules/contract.js";
import { createRuleTable, decideCaptureModes, matchTypePattern } from "../rules/index.js";
import type { ConstraintsOf, GroupsOf, ResumeConstraintsOf, ResumeSolveGroup, SolveGroup } from "../infer/contract.js";
import { constraintsOf, groupsOf, resumeConstraintsOf, resumeSolveGroup, solveGroup } from "../infer/index.js";
import type { AttachDefault, Elaborate, ElaborateSelectedCall } from "../elaborate/contract.js";
import { attachDefault, elaborate, elaborateSelectedCall } from "../elaborate/index.js";
import type { LowerToMir } from "../lower-mir/contract.js";
import { lowerToMir } from "../lower-mir/index.js";
import type { Evaluate, ResumeEvaluate } from "../evaluate/contract.js";
import { evaluate, resumeEvaluate } from "../evaluate/index.js";
import type { LayoutOf, MaterializeMetadata, ObserveLayout, ResumeLayout } from "../metadata/contract.js";
import { layoutOf, materializeMetadata, observeLayout, resumeLayout } from "../metadata/index.js";
import type { AnalyzeStorageUse } from "../analyses/liveness/contract.js";
import { analyzeStorageUse } from "../analyses/liveness/index.js";
import type { AnalyzeBodyRound, ProveInitialization } from "../analyses/body/contract.js";
import { analyzeBodyRound, proveInitialization } from "../analyses/body/index.js";
import type { BindDeclaredSummary, ComponentsOf, ConvergeComponent, DependenciesOf } from "../summaries/contract.js";
import { bindDeclaredSummary, componentsOf, convergeComponent, dependenciesOf } from "../summaries/index.js";
import type { FormDiagnostics, IndexFormDiagnostics, SafetyDiagnostics } from "../validate/contract.js";
import { formDiagnostics, indexFormDiagnostics, safetyDiagnostics } from "../validate/index.js";

/**
 * What Pipeline wires: its run-time connections to the components. One member per public operation of a
 * component, typed by that component's own contract function type. Pipeline's composition reaches a component
 * through this record and nothing else; the architecture inspection reports a public operation that is not a
 * member, and a member with no operation behind it.
 *
 * The record holds the operations that exist. It grows by one member with each operation a component makes public.
 */
export interface PipelineWiring {
  readonly front: FrontWiring;
  readonly decls: DeclsWiring;
  readonly rules: { readonly createRuleTable: CreateRuleTable; readonly decideCaptureModes: DecideCaptureModes;
    readonly matchTypePattern: TypePatternMatch };
  readonly infer: { readonly constraintsOf: ConstraintsOf; readonly groupsOf: GroupsOf; readonly resumeConstraintsOf: ResumeConstraintsOf;
    readonly resumeSolveGroup: ResumeSolveGroup; readonly solveGroup: SolveGroup };
  readonly elaborate: { readonly attachDefault: AttachDefault; readonly elaborate: Elaborate;
    readonly elaborateSelectedCall: ElaborateSelectedCall };
  readonly lowerMir: { readonly lowerToMir: LowerToMir };
  readonly evaluate: { readonly evaluate: Evaluate; readonly resumeEvaluate: ResumeEvaluate };
  readonly metadata: { readonly layoutOf: LayoutOf; readonly resumeLayout: ResumeLayout; readonly materializeMetadata: MaterializeMetadata;
    readonly observeLayout: ObserveLayout };
  readonly liveness: { readonly analyzeStorageUse: AnalyzeStorageUse };
  readonly bodyAnalysis: { readonly analyzeBodyRound: AnalyzeBodyRound; readonly proveInitialization: ProveInitialization };
  readonly summaries: { readonly bindDeclaredSummary: BindDeclaredSummary; readonly componentsOf: ComponentsOf;
    readonly dependenciesOf: DependenciesOf; readonly convergeComponent: ConvergeComponent };
  readonly validate: { readonly indexFormDiagnostics: IndexFormDiagnostics; readonly formDiagnostics: FormDiagnostics; readonly safetyDiagnostics: SafetyDiagnostics };
}

export interface DeclsWiring {
  readonly classifyCycle: ClassifyCycle;
  readonly describeDefinitions: DescribeDefinitions;
  readonly declaredSignatureOf: DeclaredSignatureOf;
  readonly resumeDeclaredSignatureOf: ResumeDeclaredSignatureOf;
  readonly errorSignature: ErrorSignature;
  readonly placeSignature: PlaceSignature;
  readonly membersOf: MembersOf;
  readonly memberTypeOf: MemberTypeOf;
  readonly produceType: ProduceType;
  readonly resumeProduceType: ResumeProduceType;
  readonly enumOf: EnumOf;
  readonly resumeEnumOf: ResumeEnumOf;
}

export interface FrontWiring {
  readonly createCheckerExtensions: CreateCheckerExtensions;
  readonly extensionReferencesOf: ExtensionReferencesOf;
  readonly openCheckedProgram: OpenCheckedProgram;
  readonly captureProgramModules: CaptureProgramModules;
  readonly captureModules: CaptureModules;
  readonly lowerModuleDefinitions: LowerModuleDefinitions;
  readonly lowerModuleExports: LowerModuleExports;
  readonly lowerModule: LowerModule;
}

/** The one wiring of the Host: each member is the component's own public operation. */
export const pipelineWiring: PipelineWiring = {
  front: { createCheckerExtensions, extensionReferencesOf, openCheckedProgram, captureProgramModules, captureModules, lowerModuleDefinitions,
    lowerModuleExports, lowerModule },
  decls: { classifyCycle, describeDefinitions, declaredSignatureOf, resumeDeclaredSignatureOf, errorSignature, placeSignature, membersOf, memberTypeOf,
    produceType, resumeProduceType, enumOf, resumeEnumOf },
  rules: { createRuleTable, decideCaptureModes, matchTypePattern },
  infer: { constraintsOf, groupsOf, resumeConstraintsOf, resumeSolveGroup, solveGroup },
  elaborate: { attachDefault, elaborate, elaborateSelectedCall },
  lowerMir: { lowerToMir },
  evaluate: { evaluate, resumeEvaluate },
  metadata: { layoutOf, resumeLayout, materializeMetadata, observeLayout },
  liveness: { analyzeStorageUse },
  bodyAnalysis: { analyzeBodyRound, proveInitialization },
  summaries: { bindDeclaredSummary, componentsOf, dependenciesOf, convergeComponent },
  validate: { formDiagnostics, indexFormDiagnostics, safetyDiagnostics },
};
