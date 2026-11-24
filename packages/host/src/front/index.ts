import type { CaptureModules, CaptureProgramModules, CreateCheckerExtensions, ExtensionReferencesOf, LowerModule, LowerModuleDefinitions,
  LowerModuleExports, OpenCheckedProgram, PrepareSourceImports } from "./contract.js";
import { captureRawModules } from "./capture.js";
import { createExtensionTable, extensionReferences, openProgram, prepareImports, programModules } from "./checker.js";
import { lowerDefinitions, lowerExports, lowerRawModule } from "./lower.js";

export const createCheckerExtensions: CreateCheckerExtensions = createExtensionTable;
export const extensionReferencesOf: ExtensionReferencesOf = extensionReferences;
export const openCheckedProgram: OpenCheckedProgram = openProgram;
export const prepareSourceImports: PrepareSourceImports = prepareImports;
export const captureProgramModules: CaptureProgramModules = programModules;
export const captureModules: CaptureModules = captureRawModules;
export const lowerModuleDefinitions: LowerModuleDefinitions = lowerDefinitions;
export const lowerModuleExports: LowerModuleExports = lowerExports;
export const lowerModule: LowerModule = lowerRawModule;
