import type { CaptureProgramModules, OpenCheckedProgram } from "./contract.js";
import { openProgram, programModules } from "./checker.js";

export const openCheckedProgram: OpenCheckedProgram = openProgram;
export const captureProgramModules: CaptureProgramModules = programModules;
