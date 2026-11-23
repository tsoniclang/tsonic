import type { CaptureModule, CaptureProgramModules, CreateCheckerExtensions, ExtensionReferencesOf, LowerModule, LowerModuleDefinitions,
  LowerModuleExports, OpenCheckedProgram } from "../front/contract.js";
import { captureModule, captureProgramModules, createCheckerExtensions, extensionReferencesOf, lowerModule, lowerModuleDefinitions,
  lowerModuleExports, openCheckedProgram } from "../front/index.js";
import type { ClassifyCycle, DeclaredSignatureOf, DescribeDefinitions, ErrorSignature, MembersOf, MemberTypeOf, PlaceSignature, ProduceType,
  ResumeDeclaredSignatureOf, ResumeProduceType } from "../decls/contract.js";
import { classifyCycle, declaredSignatureOf, describeDefinitions, errorSignature, membersOf, memberTypeOf, placeSignature, produceType,
  resumeDeclaredSignatureOf, resumeProduceType } from "../decls/index.js";
import type { CreateRuleTable, DecideCaptureModes, TypePatternMatch } from "../rules/contract.js";
import { createRuleTable, decideCaptureModes, matchTypePattern } from "../rules/index.js";
import type { ConstraintsOf, GroupsOf, ResumeConstraintsOf, ResumeSolveGroup, SolveGroup } from "../infer/contract.js";
import { constraintsOf, groupsOf, resumeConstraintsOf, resumeSolveGroup, solveGroup } from "../infer/index.js";
import type { AttachFormalDefault, Elaborate } from "../elaborate/contract.js";
import { attachFormalDefault, elaborate } from "../elaborate/index.js";
import type { LowerToMir } from "../lower-mir/contract.js";
import { lowerToMir } from "../lower-mir/index.js";
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
  readonly elaborate: { readonly attachFormalDefault: AttachFormalDefault; readonly elaborate: Elaborate };
  readonly lowerMir: { readonly lowerToMir: LowerToMir };
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
}

export interface FrontWiring {
  readonly createCheckerExtensions: CreateCheckerExtensions;
  readonly extensionReferencesOf: ExtensionReferencesOf;
  readonly openCheckedProgram: OpenCheckedProgram;
  readonly captureProgramModules: CaptureProgramModules;
  readonly captureModule: CaptureModule;
  readonly lowerModuleDefinitions: LowerModuleDefinitions;
  readonly lowerModuleExports: LowerModuleExports;
  readonly lowerModule: LowerModule;
}

/** The one wiring of the Host: each member is the component's own public operation. */
export const pipelineWiring: PipelineWiring = {
  front: { createCheckerExtensions, extensionReferencesOf, openCheckedProgram, captureProgramModules, captureModule, lowerModuleDefinitions,
    lowerModuleExports, lowerModule },
  decls: { classifyCycle, describeDefinitions, declaredSignatureOf, resumeDeclaredSignatureOf, errorSignature, placeSignature, membersOf, memberTypeOf,
    produceType, resumeProduceType },
  rules: { createRuleTable, decideCaptureModes, matchTypePattern },
  infer: { constraintsOf, groupsOf, resumeConstraintsOf, resumeSolveGroup, solveGroup },
  elaborate: { attachFormalDefault, elaborate },
  lowerMir: { lowerToMir },
  liveness: { analyzeStorageUse },
  bodyAnalysis: { analyzeBodyRound, proveInitialization },
  summaries: { bindDeclaredSummary, componentsOf, dependenciesOf, convergeComponent },
  validate: { formDiagnostics, indexFormDiagnostics, safetyDiagnostics },
};
