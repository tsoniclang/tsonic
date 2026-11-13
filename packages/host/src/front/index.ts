import type { CaptureProgramModules, CreateCheckerExtensions, ExtensionReferencesOf, OpenCheckedProgram } from "./contract.js";
import { createExtensionTable, extensionReferences, openProgram, programModules } from "./checker.js";

export const createCheckerExtensions: CreateCheckerExtensions = createExtensionTable;
export const extensionReferencesOf: ExtensionReferencesOf = extensionReferences;
export const openCheckedProgram: OpenCheckedProgram = openProgram;
export const captureProgramModules: CaptureProgramModules = programModules;
