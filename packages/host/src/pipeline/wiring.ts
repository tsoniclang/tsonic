import type { CaptureModule, CaptureProgramModules, CreateCheckerExtensions, ExtensionReferencesOf, LowerModule, LowerModuleDefinitions,
  LowerModuleExports, OpenCheckedProgram } from "../front/contract.js";
import { captureModule, captureProgramModules, createCheckerExtensions, extensionReferencesOf, lowerModule, lowerModuleDefinitions,
  lowerModuleExports, openCheckedProgram } from "../front/index.js";
import type { DeclaredSignatureOf, DescribeDefinitions, ErrorSignature, PlaceSignature, ResumeDeclaredSignatureOf } from "../decls/contract.js";
import { declaredSignatureOf, describeDefinitions, errorSignature, placeSignature, resumeDeclaredSignatureOf } from "../decls/index.js";
import type { CreateRuleTable } from "../rules/contract.js";
import { createRuleTable } from "../rules/index.js";
import type { ConstraintsOf, GroupsOf, ResumeConstraintsOf, ResumeSolveGroup, SolveGroup } from "../infer/contract.js";
import { constraintsOf, groupsOf, resumeConstraintsOf, resumeSolveGroup, solveGroup } from "../infer/index.js";
import type { Elaborate } from "../elaborate/contract.js";
import { elaborate } from "../elaborate/index.js";
import type { LowerToMir } from "../lower-mir/contract.js";
import { lowerToMir } from "../lower-mir/index.js";

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
  readonly rules: { readonly createRuleTable: CreateRuleTable };
  readonly infer: { readonly constraintsOf: ConstraintsOf; readonly groupsOf: GroupsOf; readonly resumeConstraintsOf: ResumeConstraintsOf;
    readonly resumeSolveGroup: ResumeSolveGroup; readonly solveGroup: SolveGroup };
  readonly elaborate: { readonly elaborate: Elaborate };
  readonly lowerMir: { readonly lowerToMir: LowerToMir };
}

export interface DeclsWiring {
  readonly describeDefinitions: DescribeDefinitions;
  readonly declaredSignatureOf: DeclaredSignatureOf;
  readonly resumeDeclaredSignatureOf: ResumeDeclaredSignatureOf;
  readonly errorSignature: ErrorSignature;
  readonly placeSignature: PlaceSignature;
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
  decls: { describeDefinitions, declaredSignatureOf, resumeDeclaredSignatureOf, errorSignature, placeSignature },
  rules: { createRuleTable },
  infer: { constraintsOf, groupsOf, resumeConstraintsOf, resumeSolveGroup, solveGroup },
  elaborate: { elaborate },
  lowerMir: { lowerToMir },
};
