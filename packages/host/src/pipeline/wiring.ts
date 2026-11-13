import type { CaptureModule, CaptureProgramModules, CreateCheckerExtensions, ExtensionReferencesOf, LowerModule, LowerModuleDefinitions,
  LowerModuleExports, OpenCheckedProgram } from "../front/contract.js";
import { captureModule, captureProgramModules, createCheckerExtensions, extensionReferencesOf, lowerModule, lowerModuleDefinitions,
  lowerModuleExports, openCheckedProgram } from "../front/index.js";

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
};
