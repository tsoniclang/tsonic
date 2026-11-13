import type { CaptureModule, CaptureProgramModules, CreateCheckerExtensions, ExtensionReferencesOf, LowerModule, LowerModuleDefinitions,
  LowerModuleExports, OpenCheckedProgram } from "./contract.js";
import { captureRawModule } from "./capture.js";
import { createExtensionTable, extensionReferences, openProgram, programModules } from "./checker.js";
import { lowerDefinitions, lowerExports, lowerRawModule } from "./lower.js";

export const createCheckerExtensions: CreateCheckerExtensions = createExtensionTable;
export const extensionReferencesOf: ExtensionReferencesOf = extensionReferences;
export const openCheckedProgram: OpenCheckedProgram = openProgram;
export const captureProgramModules: CaptureProgramModules = programModules;
export const captureModule: CaptureModule = captureRawModule;
export const lowerModuleDefinitions: LowerModuleDefinitions = lowerDefinitions;
export const lowerModuleExports: LowerModuleExports = lowerExports;
export const lowerModule: LowerModule = lowerRawModule;
